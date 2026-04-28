import { sql } from "drizzle-orm";
import type { DB } from "./client.js";

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS redirects (
    id              TEXT PRIMARY KEY,
    brand_id        TEXT,
    redirect_from   TEXT NOT NULL,
    redirect_to     TEXT NOT NULL,
    redirect_status TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    synced_at       TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'zendesk'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_redirects_from ON redirects(redirect_from)`,
  `CREATE INDEX IF NOT EXISTS idx_redirects_synced_at ON redirects(synced_at)`,
  // Health-check columns (added in v0.2). Idempotent for both fresh and
  // already-running instances.
  `ALTER TABLE redirects ADD COLUMN IF NOT EXISTS health_status      TEXT`,
  `ALTER TABLE redirects ADD COLUMN IF NOT EXISTS health_status_code INTEGER`,
  `ALTER TABLE redirects ADD COLUMN IF NOT EXISTS health_checked_at  TEXT`,
  `ALTER TABLE redirects ADD COLUMN IF NOT EXISTS health_error       TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_redirects_health_status ON redirects(health_status)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_log (
    id           BIGSERIAL PRIMARY KEY,
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    status       TEXT NOT NULL,
    fetched      INTEGER,
    inserted     INTEGER,
    updated      INTEGER,
    removed      INTEGER,
    error        TEXT
  )`,
];

export async function initSchema(db: DB): Promise<void> {
  for (const stmt of SCHEMA_SQL) {
    await db.execute(sql.raw(stmt));
  }
}
