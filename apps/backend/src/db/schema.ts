import { bigserial, integer, pgTable, text } from "drizzle-orm/pg-core";

export const redirects = pgTable("redirects", {
  id: text("id").primaryKey(),
  brandId: text("brand_id"),
  redirectFrom: text("redirect_from").notNull(),
  redirectTo: text("redirect_to").notNull(),
  redirectStatus: text("redirect_status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  syncedAt: text("synced_at").notNull(),
  source: text("source").notNull().default("zendesk"),
  healthStatus: text("health_status"),
  healthStatusCode: integer("health_status_code"),
  healthCheckedAt: text("health_checked_at"),
  healthError: text("health_error"),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const syncLog = pgTable("sync_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
  fetched: integer("fetched"),
  inserted: integer("inserted"),
  updated: integer("updated"),
  removed: integer("removed"),
  error: text("error"),
});

export type RedirectRow = typeof redirects.$inferSelect;
export type RedirectInsert = typeof redirects.$inferInsert;
export type SettingRow = typeof settings.$inferSelect;
export type SyncLogRow = typeof syncLog.$inferSelect;
