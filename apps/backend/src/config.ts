import { z } from "zod";

const ConfigSchema = z
  .object({
    PORT: z.coerce.number().int().default(4000),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required (e.g. postgres://user:pass@host:5432/dbname)"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    ZENDESK_SUBDOMAIN: z.string().min(1),
    ZENDESK_EMAIL: z.string().email(),
    ZENDESK_API_TOKEN: z.string().min(1),
    ZENDESK_REQUEST_TIMEOUT_MS: z.coerce.number().int().default(30_000),
    ZENDESK_DEFAULT_BRAND_ID: z.string().optional(),

    SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(300),

    // Health checks — disabled unless HELP_CENTER_URL is set.
    HELP_CENTER_URL: z.string().url().optional(),
    // Hard minimum is 1 hour — any value below 3600 is silently clamped at
    // load time (a warning is logged in server.ts so the user notices).
    HEALTH_INTERVAL_SECONDS: z
      .coerce.number()
      .int()
      .default(3600)
      .transform((v) => (v < 3600 ? 3600 : v)),
    HEALTH_CHECK_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
    HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(8000),
    // Per-worker delay between consecutive HEAD requests. Cloudflare's WAF in
    // front of Zendesk Help Centers rate-limits aggressively — defaults are
    // tuned to stay well under the threshold (~6 req/sec total).
    HEALTH_CHECK_REQUEST_DELAY_MS: z.coerce.number().int().min(0).max(5000).default(300),
    HEALTH_CHECK_USER_AGENT: z
      .string()
      .default("zendesk-redirector-health/0.1 (+self-hosted)"),

    // Basic auth — enabled by default with admin/redirector. Override in production.
    BASIC_AUTH_ENABLED: z
      .union([z.literal("true"), z.literal("false")])
      .default("true")
      .transform((v) => v === "true"),
    BASIC_AUTH_USERNAME: z.string().min(1).default("admin"),
    BASIC_AUTH_PASSWORD: z.string().min(1).default("redirector"),
    // Optional. If unset, NEXTAUTH_SECRET is used as a fallback (recommended,
    // since you already have it set for the frontend). If both are unset, a random
    // ephemeral secret is generated at startup — basic-auth sessions are then
    // invalidated on every backend restart.
    BASIC_AUTH_JWT_SECRET: z.string().min(16).optional(),
    // Read so the backend can fall back to it for signing basic-auth JWTs.
    AUTH_SECRET: z.string().min(16).optional(),

    // Keycloak — fully optional. All four must be set for Keycloak to be active.
    KEYCLOAK_ISSUER: z.string().url().optional(),
    KEYCLOAK_CLIENT_ID: z.string().optional(),
    KEYCLOAK_CLIENT_SECRET: z.string().optional(),
    KEYCLOAK_AUDIENCE: z.string().optional(),
  })
  .superRefine((cfg, ctx) => {
    const kcSet = [
      cfg.KEYCLOAK_ISSUER,
      cfg.KEYCLOAK_CLIENT_ID,
      cfg.KEYCLOAK_CLIENT_SECRET,
      cfg.KEYCLOAK_AUDIENCE,
    ].filter(Boolean).length;
    if (kcSet > 0 && kcSet < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Partial Keycloak configuration: KEYCLOAK_ISSUER, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET, KEYCLOAK_AUDIENCE must all be set together — or all empty to disable.",
      });
    }
    const kcEnabled = kcSet === 4;
    if (!cfg.BASIC_AUTH_ENABLED && !kcEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "No authentication enabled: set BASIC_AUTH_ENABLED=true or configure all KEYCLOAK_* vars.",
      });
    }
  });

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): AppConfig {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  • ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

export function isKeycloakEnabled(cfg: AppConfig): boolean {
  return Boolean(
    cfg.KEYCLOAK_ISSUER &&
      cfg.KEYCLOAK_CLIENT_ID &&
      cfg.KEYCLOAK_CLIENT_SECRET &&
      cfg.KEYCLOAK_AUDIENCE,
  );
}

export function isHealthCheckEnabled(cfg: AppConfig): boolean {
  return Boolean(cfg.HELP_CENTER_URL);
}
