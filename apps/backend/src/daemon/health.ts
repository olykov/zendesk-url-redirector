import { eq } from "drizzle-orm";
import type { HealthStatus, HealthSummary } from "@redirector/shared";
import type { DB } from "../db/client.js";
import { redirects } from "../db/schema.js";
import { SETTING_KEYS, setSetting } from "../db/settings.js";

export interface HealthOptions {
  helpCenterUrl: string;
  concurrency: number;
  timeoutMs: number;
  userAgent: string;
  requestDelayMs: number;
}

interface ProbeResult {
  statusCode: number | null;
  error: string | null;
  rateLimited: boolean;
}

interface RuleProbe {
  id: string;
  redirectFrom: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const RATE_LIMIT_CODES = new Set([425, 429, 503]);

function classify(probe: ProbeResult): HealthStatus {
  if (probe.error !== null) return "yellow"; // network/transient — anti-flap
  const code = probe.statusCode;
  if (code === 301 || code === 302) return "green";
  if (code === 404) return "red";
  return "yellow";
}

function trimError(message: string): string {
  return message.length > 200 ? message.slice(0, 200) + "…" : message;
}

async function performHead(url: string, opts: HealthOptions): Promise<ProbeResult> {
  const tryOnce = async (): Promise<{ status: number; retryAfter: number | null }> => {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: { "user-agent": opts.userAgent, accept: "*/*" },
    });
    const ra = res.headers.get("retry-after");
    return { status: res.status, retryAfter: ra ? Number(ra) : null };
  };

  // Up to 3 attempts total. Origin 5xx and rate-limit codes get longer backoffs;
  // network errors get a fast retry.
  let networkErr: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { status, retryAfter } = await tryOnce();

      if (RATE_LIMIT_CODES.has(status)) {
        if (attempt < 2) {
          const wait = (retryAfter && retryAfter > 0 ? retryAfter : 5 * (attempt + 1)) * 1000;
          await sleep(wait);
          continue;
        }
        return {
          statusCode: status,
          error: `rate limited by host (HTTP ${status})`,
          rateLimited: true,
        };
      }

      if (status >= 500) {
        if (attempt < 2) {
          await sleep(2000);
          continue;
        }
      }

      return { statusCode: status, error: null, rateLimited: false };
    } catch (err) {
      networkErr = trimError((err as Error).message);
      if (attempt < 2) {
        await sleep(2000);
        continue;
      }
    }
  }
  return { statusCode: null, error: networkErr ?? "unknown error", rateLimited: false };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  perWorkerDelayMs: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      let first = true;
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        if (!first && perWorkerDelayMs > 0) await sleep(perWorkerDelayMs);
        first = false;
        results[i] = await worker(items[i]!, i);
      }
    }),
  );
  return results;
}

function buildUrl(host: string, path: string): string {
  return `${host.replace(/\/+$/, "")}${path}`;
}

function skippedProbe(): SingleProbeResult {
  return {
    status: "yellow",
    statusCode: null,
    error: "skipped: batch aborted",
    rateLimited: true, // treated like rate-limited so health_status is preserved
    checkedAt: new Date().toISOString(),
  };
}

export interface SingleProbeResult {
  status: HealthStatus;
  statusCode: number | null;
  error: string | null;
  rateLimited: boolean;
  checkedAt: string;
}

export async function probeOne(
  rule: RuleProbe,
  opts: HealthOptions,
): Promise<SingleProbeResult> {
  const url = buildUrl(opts.helpCenterUrl, rule.redirectFrom);
  const probe = await performHead(url, opts);
  return {
    status: classify(probe),
    statusCode: probe.statusCode,
    error: probe.error,
    rateLimited: probe.rateLimited,
    checkedAt: new Date().toISOString(),
  };
}

export async function recheckOne(
  db: DB,
  ruleId: string,
  opts: HealthOptions,
): Promise<SingleProbeResult | null> {
  const rows = await db
    .select({ id: redirects.id, redirectFrom: redirects.redirectFrom })
    .from(redirects)
    .where(eq(redirects.id, ruleId))
    .limit(1);
  const rule = rows[0];
  if (!rule) return null;

  const result = await probeOne(rule, opts);

  // For rate-limited results we keep the previous health_status to avoid
  // flipping a previously-green rule to yellow because of host-side throttling.
  // Only the timestamp + error are refreshed.
  if (result.rateLimited) {
    await db
      .update(redirects)
      .set({ healthCheckedAt: result.checkedAt, healthError: result.error })
      .where(eq(redirects.id, ruleId));
  } else {
    await db
      .update(redirects)
      .set({
        healthStatus: result.status,
        healthStatusCode: result.statusCode,
        healthCheckedAt: result.checkedAt,
        healthError: result.error,
      })
      .where(eq(redirects.id, ruleId));
  }
  return result;
}

// Circuit-breaker: if `BREAKER_THRESHOLD` consecutive probes return rate-limit
// statuses, abort the batch. The host is blanket-blocking us and continuing
// only wastes time and worsens our reputation with their WAF.
const BREAKER_THRESHOLD = 8;

class RateLimitedError extends Error {
  constructor() {
    super("aborted: host is rate-limiting all requests");
  }
}

export async function runHealthCheck(db: DB, opts: HealthOptions): Promise<HealthSummary> {
  const startTs = Date.now();

  const rules = await db
    .select({ id: redirects.id, redirectFrom: redirects.redirectFrom })
    .from(redirects);

  let consecutiveRateLimited = 0;
  let aborted = false;

  const probed = await runWithConcurrency(
    rules,
    opts.concurrency,
    opts.requestDelayMs,
    async (rule) => {
      if (aborted) {
        // Once the breaker trips, all remaining workers exit early with a marker
        // so the bulk update preserves their existing health_status untouched.
        return { id: rule.id, ...skippedProbe() };
      }
      const result = await probeOne(rule, opts);
      if (result.rateLimited) {
        consecutiveRateLimited++;
        if (consecutiveRateLimited >= BREAKER_THRESHOLD) aborted = true;
      } else {
        consecutiveRateLimited = 0;
      }
      return { id: rule.id, ...result };
    },
  );

  if (aborted) {
    // Mark batch as failed; UI surfaces the message in last_health_error.
    throw new RateLimitedError();
  }

  const checkedAt = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const r of probed) {
      if (r.rateLimited) {
        // Preserve previous health_status; only refresh timestamp + error message.
        await tx
          .update(redirects)
          .set({ healthCheckedAt: checkedAt, healthError: r.error })
          .where(eq(redirects.id, r.id));
      } else {
        await tx
          .update(redirects)
          .set({
            healthStatus: r.status,
            healthStatusCode: r.statusCode,
            healthCheckedAt: checkedAt,
            healthError: r.error,
          })
          .where(eq(redirects.id, r.id));
      }
    }
  });

  const decisive = probed.filter((r) => !r.rateLimited);
  const summary: HealthSummary = {
    total: probed.length,
    green: decisive.filter((r) => r.status === "green").length,
    red: decisive.filter((r) => r.status === "red").length,
    yellow: decisive.filter((r) => r.status === "yellow").length,
    errored: probed.filter((r) => r.error !== null).length,
    duration_ms: Date.now() - startTs,
  };

  await setSetting(db, SETTING_KEYS.LAST_HEALTH_AT, checkedAt);
  await setSetting(db, SETTING_KEYS.LAST_HEALTH_SUMMARY, JSON.stringify(summary));
  await setSetting(db, SETTING_KEYS.LAST_HEALTH_ERROR, "");

  return summary;
}
