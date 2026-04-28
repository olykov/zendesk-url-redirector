import type { FastifyPluginAsync } from "fastify";
import {
  BatchApplyRequestSchema,
  BatchPreviewRequestSchema,
  type BatchApplyResponse,
  type BatchApplyResultItem,
  type BatchPreviewResponse,
} from "@redirector/shared";
import type { DB } from "../db/client.js";
import { redirects } from "../db/schema.js";
import { ZendeskApiError, type ZendeskClient } from "../zendesk/client.js";

interface Deps {
  db: DB;
  zendesk: ZendeskClient;
  defaultBrandId?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let applyInFlight = false;

export const redirectsBatchRoutes: FastifyPluginAsync<Deps> = async (
  app,
  { db, zendesk, defaultBrandId },
) => {
  app.addHook("onRequest", app.authenticate);

  app.post("/redirects/batch/preview", async (req, reply) => {
    const parsed = BatchPreviewRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_input", details: parsed.error.flatten() });
    }

    const existingRows = await db
      .select({
        id: redirects.id,
        from: redirects.redirectFrom,
        to: redirects.redirectTo,
      })
      .from(redirects);
    const byFrom = new Map<string, { id: string; to: string }>();
    for (const r of existingRows) byFrom.set(r.from, { id: r.id, to: r.to });

    const items: BatchPreviewResponse["items"] = parsed.data.items.map((it) => {
      const existing = byFrom.get(it.redirect_from);
      if (!existing) {
        return { ...it, status: "create" as const, existing_id: null, existing_to: null };
      }
      if (existing.to === it.redirect_to) {
        return {
          ...it,
          status: "exists" as const,
          existing_id: existing.id,
          existing_to: existing.to,
        };
      }
      return {
        ...it,
        status: "conflict" as const,
        existing_id: existing.id,
        existing_to: existing.to,
      };
    });

    const summary = {
      total: items.length,
      create: items.filter((i) => i.status === "create").length,
      exists: items.filter((i) => i.status === "exists").length,
      conflict: items.filter((i) => i.status === "conflict").length,
    };

    return { items, summary };
  });

  app.post("/redirects/batch/apply", async (req, reply) => {
    const parsed = BatchApplyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_input", details: parsed.error.flatten() });
    }

    if (applyInFlight) {
      return reply.code(409).send({ error: "batch_in_progress" });
    }
    applyInFlight = true;

    const startTs = Date.now();
    const results: BatchApplyResultItem[] = [];
    let created = 0;
    let failed = 0;

    try {
      const { items, throttle_ms } = parsed.data;
      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        try {
          const rule = await zendesk.createRedirectRule({
            redirect_from: it.redirect_from,
            redirect_to: it.redirect_to,
            redirect_status: it.redirect_status,
            brand_id: defaultBrandId,
          });
          const nowIso = new Date().toISOString();
          await db
            .insert(redirects)
            .values({
              id: rule.id,
              brandId: rule.brand_id,
              redirectFrom: rule.redirect_from,
              redirectTo: rule.redirect_to,
              redirectStatus: rule.redirect_status,
              createdAt: rule.created_at,
              updatedAt: rule.updated_at,
              syncedAt: nowIso,
              source: "zendesk",
            })
            .onConflictDoUpdate({
              target: redirects.id,
              set: {
                brandId: rule.brand_id,
                redirectFrom: rule.redirect_from,
                redirectTo: rule.redirect_to,
                redirectStatus: rule.redirect_status,
                updatedAt: rule.updated_at,
                syncedAt: nowIso,
              },
            });
          results.push({
            redirect_from: it.redirect_from,
            redirect_to: it.redirect_to,
            redirect_status: it.redirect_status,
            ok: true,
            id: rule.id,
            error: null,
          });
          created++;
        } catch (err) {
          const msg =
            err instanceof ZendeskApiError
              ? `Zendesk ${err.status}: ${err.body.slice(0, 200)}`
              : err instanceof Error
                ? err.message
                : String(err);
          results.push({
            redirect_from: it.redirect_from,
            redirect_to: it.redirect_to,
            redirect_status: it.redirect_status,
            ok: false,
            id: null,
            error: msg,
          });
          failed++;
        }
        if (throttle_ms > 0 && i < items.length - 1) await sleep(throttle_ms);
      }

      const response: BatchApplyResponse = {
        total: items.length,
        created,
        failed,
        duration_ms: Date.now() - startTs,
        results,
      };
      app.log.info(
        { total: response.total, created, failed, duration_ms: response.duration_ms },
        "batch apply finished",
      );
      return response;
    } finally {
      applyInFlight = false;
    }
  });
};
