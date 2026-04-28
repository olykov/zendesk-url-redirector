import { eq, lt } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { redirects, syncLog } from "../db/schema.js";
import { SETTING_KEYS, setSetting } from "../db/settings.js";
import type { ZendeskClient, ZendeskRule } from "../zendesk/client.js";

export interface SyncResult {
  fetched: number;
  inserted: number;
  updated: number;
  removed: number;
  duration_ms: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function runSync(db: DB, zendesk: ZendeskClient): Promise<SyncResult> {
  const startedAt = nowIso();
  const startTs = Date.now();
  const [logEntry] = await db
    .insert(syncLog)
    .values({ startedAt, status: "running" })
    .returning({ id: syncLog.id });
  const logId = logEntry!.id;

  let fetched = 0;
  let inserted = 0;
  let updated = 0;

  try {
    for await (const rule of zendesk.iterateRedirectRules()) {
      fetched++;
      const result = await upsertRule(db, rule, startedAt);
      if (result === "inserted") inserted++;
      else if (result === "updated") updated++;
    }

    const removedRows = await db
      .delete(redirects)
      .where(lt(redirects.syncedAt, startedAt))
      .returning({ id: redirects.id });
    const removed = removedRows.length;

    const finishedAt = nowIso();
    await db
      .update(syncLog)
      .set({ finishedAt, status: "ok", fetched, inserted, updated, removed })
      .where(eq(syncLog.id, logId));

    await setSetting(db, SETTING_KEYS.LAST_SYNC_AT, finishedAt);
    await setSetting(db, SETTING_KEYS.LAST_SYNC_STATUS, "ok");
    await setSetting(db, SETTING_KEYS.LAST_SYNC_ERROR, "");

    return { fetched, inserted, updated, removed, duration_ms: Date.now() - startTs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finishedAt = nowIso();
    await db
      .update(syncLog)
      .set({ finishedAt, status: "error", error: message, fetched, inserted, updated })
      .where(eq(syncLog.id, logId));
    await setSetting(db, SETTING_KEYS.LAST_SYNC_AT, finishedAt);
    await setSetting(db, SETTING_KEYS.LAST_SYNC_STATUS, "error");
    await setSetting(db, SETTING_KEYS.LAST_SYNC_ERROR, message);
    throw err;
  }
}

async function upsertRule(
  db: DB,
  rule: ZendeskRule,
  syncedAt: string,
): Promise<"inserted" | "updated" | "noop"> {
  const existingRows = await db
    .select()
    .from(redirects)
    .where(eq(redirects.id, rule.id))
    .limit(1);
  const existing = existingRows[0];

  if (!existing) {
    await db.insert(redirects).values({
      id: rule.id,
      brandId: rule.brand_id,
      redirectFrom: rule.redirect_from,
      redirectTo: rule.redirect_to,
      redirectStatus: rule.redirect_status,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
      syncedAt,
      source: "zendesk",
    });
    return "inserted";
  }

  const changed =
    existing.brandId !== rule.brand_id ||
    existing.redirectFrom !== rule.redirect_from ||
    existing.redirectTo !== rule.redirect_to ||
    existing.redirectStatus !== rule.redirect_status ||
    existing.updatedAt !== rule.updated_at;

  await db
    .update(redirects)
    .set({
      brandId: rule.brand_id,
      redirectFrom: rule.redirect_from,
      redirectTo: rule.redirect_to,
      redirectStatus: rule.redirect_status,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
      syncedAt,
      source: "zendesk",
    })
    .where(eq(redirects.id, rule.id));
  return changed ? "updated" : "noop";
}
