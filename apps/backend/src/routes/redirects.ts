import type { FastifyPluginAsync } from "fastify";
import { CreateRedirectInputSchema, type HealthStatus } from "@redirector/shared";
import { desc, eq } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { redirects } from "../db/schema.js";
import { ZendeskApiError, type ZendeskClient } from "../zendesk/client.js";
import type { SyncScheduler } from "../daemon/scheduler.js";
import { recheckOne, type HealthOptions } from "../daemon/health.js";

interface Deps {
  db: DB;
  zendesk: ZendeskClient;
  defaultBrandId?: string;
  scheduler: SyncScheduler;
  healthOptions: HealthOptions | null;
}

export const redirectsRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, zendesk, defaultBrandId, healthOptions },
) => {
  app.addHook("onRequest", app.authenticate);

  app.get("/redirects", async () => {
    const rows = await db.select().from(redirects).orderBy(desc(redirects.createdAt));
    return rows.map(rowToDto);
  });

  app.get<{ Params: { id: string } }>("/redirects/:id", async (req, reply) => {
    const rows = await db
      .select()
      .from(redirects)
      .where(eq(redirects.id, req.params.id))
      .limit(1);
    const row = rows[0];
    if (!row) return reply.code(404).send({ error: "not_found" });
    return rowToDto(row);
  });

  app.post("/redirects", async (req, reply) => {
    const parsed = CreateRedirectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_input", details: parsed.error.flatten() });
    }
    const input = parsed.data;
    try {
      const created = await zendesk.createRedirectRule({
        redirect_from: input.redirect_from,
        redirect_to: input.redirect_to,
        redirect_status: input.redirect_status,
        brand_id: input.brand_id ?? defaultBrandId,
      });
      const nowIso = new Date().toISOString();
      await db
        .insert(redirects)
        .values({
          id: created.id,
          brandId: created.brand_id,
          redirectFrom: created.redirect_from,
          redirectTo: created.redirect_to,
          redirectStatus: created.redirect_status,
          createdAt: created.created_at,
          updatedAt: created.updated_at,
          syncedAt: nowIso,
          source: "zendesk",
        })
        .onConflictDoUpdate({
          target: redirects.id,
          set: {
            brandId: created.brand_id,
            redirectFrom: created.redirect_from,
            redirectTo: created.redirect_to,
            redirectStatus: created.redirect_status,
            updatedAt: created.updated_at,
            syncedAt: nowIso,
          },
        });
      const rows = await db.select().from(redirects).where(eq(redirects.id, created.id)).limit(1);
      return reply.code(201).send(rows[0] ? rowToDto(rows[0]) : null);
    } catch (err) {
      if (err instanceof ZendeskApiError) {
        return reply.code(err.status >= 400 && err.status < 500 ? err.status : 502).send({
          error: "zendesk_error",
          details: { status: err.status, body: err.body.slice(0, 500) },
        });
      }
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/redirects/:id", async (req, reply) => {
    const id = req.params.id;
    const rows = await db.select().from(redirects).where(eq(redirects.id, id)).limit(1);
    const existing = rows[0];
    try {
      await zendesk.deleteRedirectRule(id);
    } catch (err) {
      if (err instanceof ZendeskApiError) {
        return reply.code(err.status >= 400 && err.status < 500 ? err.status : 502).send({
          error: "zendesk_error",
          details: { status: err.status, body: err.body.slice(0, 500) },
        });
      }
      throw err;
    }
    if (existing) {
      await db.delete(redirects).where(eq(redirects.id, id));
    }
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/redirects/:id/recheck", async (req, reply) => {
    if (!healthOptions) {
      return reply.code(400).send({ error: "health_check_disabled" });
    }
    const result = await recheckOne(db, req.params.id, healthOptions);
    if (!result) return reply.code(404).send({ error: "not_found" });
    const rows = await db.select().from(redirects).where(eq(redirects.id, req.params.id)).limit(1);
    return rows[0] ? rowToDto(rows[0]) : reply.code(404).send({ error: "not_found" });
  });
};

function rowToDto(row: typeof redirects.$inferSelect) {
  return {
    id: row.id,
    brand_id: row.brandId,
    redirect_from: row.redirectFrom,
    redirect_to: row.redirectTo,
    redirect_status: row.redirectStatus as "301" | "302",
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    synced_at: row.syncedAt,
    source: row.source as "zendesk" | "local-pending",
    health_status: (row.healthStatus as HealthStatus | null) ?? null,
    health_status_code: row.healthStatusCode,
    health_checked_at: row.healthCheckedAt,
    health_error: row.healthError,
  };
}
