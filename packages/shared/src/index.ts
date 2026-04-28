import { z } from "zod";

export const RedirectStatusSchema = z.enum(["301", "302"]);
export type RedirectStatus = z.infer<typeof RedirectStatusSchema>;

export const HealthStatusSchema = z.enum(["green", "red", "yellow"]);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const RedirectSchema = z.object({
  id: z.string().min(1),
  brand_id: z.string().nullable(),
  redirect_from: z.string().min(1),
  redirect_to: z.string().min(1),
  redirect_status: RedirectStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  synced_at: z.string(),
  source: z.enum(["zendesk", "local-pending"]),
  health_status: HealthStatusSchema.nullable(),
  health_status_code: z.number().int().nullable(),
  health_checked_at: z.string().nullable(),
  health_error: z.string().nullable(),
});
export type Redirect = z.infer<typeof RedirectSchema>;

const pathOrUrl = z
  .string()
  .min(1)
  .transform((value) => {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const u = new URL(value);
      return u.pathname + (u.search ?? "");
    }
    return value.startsWith("/") ? value : `/${value}`;
  });

export const CreateRedirectInputSchema = z.object({
  redirect_from: pathOrUrl,
  redirect_to: pathOrUrl,
  redirect_status: RedirectStatusSchema.default("301"),
  brand_id: z.string().optional(),
});
export type CreateRedirectInput = z.infer<typeof CreateRedirectInputSchema>;

export const HealthSummarySchema = z.object({
  total: z.number().int(),
  green: z.number().int(),
  red: z.number().int(),
  yellow: z.number().int(),
  errored: z.number().int(),
  duration_ms: z.number().int(),
});
export type HealthSummary = z.infer<typeof HealthSummarySchema>;

export const SettingsSchema = z.object({
  sync_interval_seconds: z.number().int().min(10).max(86_400),
  last_sync_at: z.string().nullable(),
  last_sync_status: z.enum(["ok", "error"]).nullable(),
  last_sync_error: z.string().nullable(),
  health_check_enabled: z.boolean(),
  health_interval_seconds: z.number().int().min(3600).max(86_400),
  last_health_at: z.string().nullable(),
  last_health_summary: HealthSummarySchema.nullable(),
  last_health_error: z.string().nullable(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const UpdateSettingsInputSchema = z
  .object({
    sync_interval_seconds: z.number().int().min(10).max(86_400).optional(),
    health_interval_seconds: z.number().int().min(3600).max(86_400).optional(),
  })
  .refine(
    (d) => d.sync_interval_seconds !== undefined || d.health_interval_seconds !== undefined,
    { message: "at least one of sync_interval_seconds, health_interval_seconds is required" },
  );
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

export const SyncRunResultSchema = z.object({
  fetched: z.number().int(),
  inserted: z.number().int(),
  updated: z.number().int(),
  removed: z.number().int(),
  duration_ms: z.number().int(),
});
export type SyncRunResult = z.infer<typeof SyncRunResultSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/* ============== Batch upload ============== */

export const BatchItemInputSchema = z.object({
  redirect_from: z.string().min(1),
  redirect_to: z.string().min(1),
  redirect_status: RedirectStatusSchema.default("301"),
});
export type BatchItemInput = z.infer<typeof BatchItemInputSchema>;

export const BatchPreviewRequestSchema = z.object({
  items: z.array(BatchItemInputSchema).min(1).max(50_000),
});

export const BatchPreviewItemSchema = z.object({
  redirect_from: z.string(),
  redirect_to: z.string(),
  redirect_status: RedirectStatusSchema,
  status: z.enum(["create", "exists", "conflict"]),
  existing_id: z.string().nullable(),
  existing_to: z.string().nullable(),
});
export type BatchPreviewItem = z.infer<typeof BatchPreviewItemSchema>;

export const BatchPreviewResponseSchema = z.object({
  items: z.array(BatchPreviewItemSchema),
  summary: z.object({
    total: z.number().int(),
    create: z.number().int(),
    exists: z.number().int(),
    conflict: z.number().int(),
  }),
});
export type BatchPreviewResponse = z.infer<typeof BatchPreviewResponseSchema>;

export const BatchApplyRequestSchema = z.object({
  items: z.array(BatchItemInputSchema).min(1).max(50_000),
  throttle_ms: z.number().int().min(0).max(5000).default(50),
});

export const BatchApplyResultItemSchema = z.object({
  redirect_from: z.string(),
  redirect_to: z.string(),
  redirect_status: RedirectStatusSchema,
  ok: z.boolean(),
  id: z.string().nullable(),
  error: z.string().nullable(),
});
export type BatchApplyResultItem = z.infer<typeof BatchApplyResultItemSchema>;

export const BatchApplyResponseSchema = z.object({
  total: z.number().int(),
  created: z.number().int(),
  failed: z.number().int(),
  duration_ms: z.number().int(),
  results: z.array(BatchApplyResultItemSchema),
});
export type BatchApplyResponse = z.infer<typeof BatchApplyResponseSchema>;
