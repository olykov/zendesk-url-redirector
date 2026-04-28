import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { isHealthCheckEnabled, isKeycloakEnabled, loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { initSchema } from "./db/init.js";
import { ensureDefaultSettings } from "./db/settings.js";
import { ZendeskClient } from "./zendesk/client.js";
import { BasicAuth } from "./auth/basic.js";
import { KeycloakVerifier } from "./auth/keycloak.js";
import unifiedAuth from "./auth/unified.js";
import { authRoutes } from "./routes/auth.js";
import { redirectsRoutes } from "./routes/redirects.js";
import { redirectsBatchRoutes } from "./routes/redirects-batch.js";
import { settingsRoutes } from "./routes/settings.js";
import { HealthScheduler, SyncScheduler } from "./daemon/scheduler.js";
import type { HealthOptions } from "./daemon/health.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    bodyLimit: 32 * 1024 * 1024,
  });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 minute",
  });

  const { db, pool } = createDb(config.DATABASE_URL);
  await initSchema(db);
  await ensureDefaultSettings(db, {
    syncIntervalSeconds: config.SYNC_INTERVAL_SECONDS,
    healthIntervalSeconds: config.HEALTH_INTERVAL_SECONDS,
  });

  const zendesk = new ZendeskClient({
    subdomain: config.ZENDESK_SUBDOMAIN,
    email: config.ZENDESK_EMAIL,
    apiToken: config.ZENDESK_API_TOKEN,
    timeoutMs: config.ZENDESK_REQUEST_TIMEOUT_MS,
  });

  const scheduler = new SyncScheduler(db, zendesk, app.log);

  const healthCheckEnabled = isHealthCheckEnabled(config);
  const healthOptions: HealthOptions | null = healthCheckEnabled
    ? {
        helpCenterUrl: config.HELP_CENTER_URL!,
        concurrency: config.HEALTH_CHECK_CONCURRENCY,
        timeoutMs: config.HEALTH_CHECK_TIMEOUT_MS,
        userAgent: config.HEALTH_CHECK_USER_AGENT,
        requestDelayMs: config.HEALTH_CHECK_REQUEST_DELAY_MS,
      }
    : null;
  const healthScheduler = healthOptions
    ? new HealthScheduler(db, healthOptions, app.log)
    : null;

  const basic = config.BASIC_AUTH_ENABLED ? new BasicAuth(config) : null;
  const keycloakEnabled = isKeycloakEnabled(config);
  const keycloak = keycloakEnabled
    ? new KeycloakVerifier(
        { issuer: config.KEYCLOAK_ISSUER!, audience: config.KEYCLOAK_AUDIENCE! },
        app.log,
      )
    : null;

  await app.register(unifiedAuth, { basic, keycloak });

  app.log.info(
    {
      basic_auth: basic !== null,
      keycloak: keycloakEnabled,
      health_check: healthCheckEnabled,
    },
    "auth + health configured",
  );
  if (basic && !config.BASIC_AUTH_JWT_SECRET) {
    if (config.AUTH_SECRET) {
      app.log.info(
        "BASIC_AUTH_JWT_SECRET not set — using AUTH_SECRET as fallback for basic-auth JWTs.",
      );
    } else {
      app.log.warn(
        "Neither BASIC_AUTH_JWT_SECRET nor AUTH_SECRET is set — using ephemeral secret. Sessions invalidate on every restart.",
      );
    }
  }
  if (
    basic &&
    config.BASIC_AUTH_USERNAME === "admin" &&
    config.BASIC_AUTH_PASSWORD === "redirector"
  ) {
    app.log.warn(
      "Using default basic-auth credentials (admin/redirector). Change them before exposing the app.",
    );
  }
  if (!healthCheckEnabled) {
    app.log.info("Health checks disabled (HELP_CENTER_URL not set).");
  } else {
    const rawInterval = Number(process.env.HEALTH_INTERVAL_SECONDS);
    if (Number.isFinite(rawInterval) && rawInterval < 3600) {
      app.log.warn(
        { requested: rawInterval, applied: config.HEALTH_INTERVAL_SECONDS },
        "HEALTH_INTERVAL_SECONDS below minimum (3600); clamped to 1 hour.",
      );
    }
  }

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(
    async (instance) => {
      await instance.register(authRoutes, { basic, keycloakEnabled });
      await instance.register(redirectsRoutes, {
        db,
        zendesk,
        defaultBrandId: config.ZENDESK_DEFAULT_BRAND_ID,
        scheduler,
        healthOptions,
      });
      await instance.register(redirectsBatchRoutes, {
        db,
        zendesk,
        defaultBrandId: config.ZENDESK_DEFAULT_BRAND_ID,
      });
      await instance.register(settingsRoutes, { db, scheduler, healthScheduler });
    },
    { prefix: "/api" },
  );

  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode;
    if (code === 401) return reply.code(401).send({ error: "unauthorized" });
    app.log.error({ err }, "request error");
    if (code && code < 500) return reply.code(code).send({ error: e.message });
    return reply.code(500).send({ error: "internal_error" });
  });

  await scheduler.start();
  void scheduler.triggerOnce("manual").catch(() => undefined);
  if (healthScheduler) {
    await healthScheduler.start();
    // Don't kick off an initial health-check probe at startup — wait until first
    // cron tick or manual trigger so we don't hammer the help center on every
    // container restart.
  }

  let shuttingDown = false;
  const closeGracefully = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "shutting down");
    scheduler.stop();
    healthScheduler?.stop();
    await app.close();
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void closeGracefully("SIGINT"));
  process.on("SIGTERM", () => void closeGracefully("SIGTERM"));

  await app.listen({ host: config.HOST, port: config.PORT });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
