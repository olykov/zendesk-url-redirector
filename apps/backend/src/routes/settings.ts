import type { FastifyPluginAsync } from "fastify";
import {
  HealthSummarySchema,
  UpdateSettingsInputSchema,
  type HealthSummary,
  type Settings,
} from "@redirector/shared";
import type { DB } from "../db/client.js";
import { SETTING_KEYS, getSetting, setSetting } from "../db/settings.js";
import type { HealthScheduler, SyncScheduler } from "../daemon/scheduler.js";

interface Deps {
  db: DB;
  scheduler: SyncScheduler;
  healthScheduler: HealthScheduler | null;
}

export const settingsRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, scheduler, healthScheduler },
) => {
  app.addHook("onRequest", app.authenticate);

  app.get("/settings", async () => {
    return readSettings(db, healthScheduler !== null);
  });

  app.put("/settings", async (req, reply) => {
    const parsed = UpdateSettingsInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_input", details: parsed.error.flatten() });
    }
    const { sync_interval_seconds, health_interval_seconds } = parsed.data;
    if (sync_interval_seconds !== undefined) {
      await setSetting(db, SETTING_KEYS.SYNC_INTERVAL_SECONDS, String(sync_interval_seconds));
      await scheduler.applyFromSettings();
    }
    if (health_interval_seconds !== undefined) {
      await setSetting(db, SETTING_KEYS.HEALTH_INTERVAL_SECONDS, String(health_interval_seconds));
      if (healthScheduler) await healthScheduler.applyFromSettings();
    }
    return readSettings(db, healthScheduler !== null);
  });

  app.post("/sync/run", async () => {
    const result = await scheduler.triggerOnce("manual");
    if (!result) return { skipped: true, reason: "already_running" };
    return result;
  });

  app.post("/health/run", async (_req, reply) => {
    if (!healthScheduler) {
      return reply.code(400).send({ error: "health_check_disabled" });
    }
    const result = await healthScheduler.triggerOnce("manual");
    if (!result) return { skipped: true, reason: "already_running" };
    return result;
  });
};

async function readSettings(db: DB, healthCheckEnabled: boolean): Promise<Settings> {
  const interval = Number((await getSetting(db, SETTING_KEYS.SYNC_INTERVAL_SECONDS)) ?? "300");
  const lastAt = await getSetting(db, SETTING_KEYS.LAST_SYNC_AT);
  const lastStatusRaw = await getSetting(db, SETTING_KEYS.LAST_SYNC_STATUS);
  const lastError = await getSetting(db, SETTING_KEYS.LAST_SYNC_ERROR);

  const healthInterval = Number(
    (await getSetting(db, SETTING_KEYS.HEALTH_INTERVAL_SECONDS)) ?? "3600",
  );
  const lastHealthAt = await getSetting(db, SETTING_KEYS.LAST_HEALTH_AT);
  const lastHealthSummaryRaw = await getSetting(db, SETTING_KEYS.LAST_HEALTH_SUMMARY);
  const lastHealthError = await getSetting(db, SETTING_KEYS.LAST_HEALTH_ERROR);

  let lastHealthSummary: HealthSummary | null = null;
  if (lastHealthSummaryRaw) {
    const parsed = HealthSummarySchema.safeParse(JSON.parse(lastHealthSummaryRaw));
    if (parsed.success) lastHealthSummary = parsed.data;
  }

  return {
    sync_interval_seconds: interval,
    last_sync_at: lastAt && lastAt.length > 0 ? lastAt : null,
    last_sync_status:
      lastStatusRaw === "ok" || lastStatusRaw === "error" ? lastStatusRaw : null,
    last_sync_error: lastError && lastError.length > 0 ? lastError : null,
    health_check_enabled: healthCheckEnabled,
    health_interval_seconds: healthInterval,
    last_health_at: lastHealthAt && lastHealthAt.length > 0 ? lastHealthAt : null,
    last_health_summary: lastHealthSummary,
    last_health_error: lastHealthError && lastHealthError.length > 0 ? lastHealthError : null,
  };
}
