import { eq } from "drizzle-orm";
import type { DB } from "./client.js";
import { settings } from "./schema.js";

export const SETTING_KEYS = {
  SYNC_INTERVAL_SECONDS: "sync_interval_seconds",
  LAST_SYNC_AT: "last_sync_at",
  LAST_SYNC_STATUS: "last_sync_status",
  LAST_SYNC_ERROR: "last_sync_error",
  HEALTH_INTERVAL_SECONDS: "health_interval_seconds",
  LAST_HEALTH_AT: "last_health_at",
  LAST_HEALTH_SUMMARY: "last_health_summary",
  LAST_HEALTH_ERROR: "last_health_error",
} as const;

export async function getSetting(db: DB, key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(db: DB, key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function ensureDefaultSettings(
  db: DB,
  defaults: { syncIntervalSeconds: number; healthIntervalSeconds: number },
): Promise<void> {
  if ((await getSetting(db, SETTING_KEYS.SYNC_INTERVAL_SECONDS)) === null) {
    await setSetting(db, SETTING_KEYS.SYNC_INTERVAL_SECONDS, String(defaults.syncIntervalSeconds));
  }
  if ((await getSetting(db, SETTING_KEYS.HEALTH_INTERVAL_SECONDS)) === null) {
    await setSetting(
      db,
      SETTING_KEYS.HEALTH_INTERVAL_SECONDS,
      String(defaults.healthIntervalSeconds),
    );
  }
}
