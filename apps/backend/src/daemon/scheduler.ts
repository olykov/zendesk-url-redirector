import cron, { type ScheduledTask } from "node-cron";
import type { FastifyBaseLogger } from "fastify";
import type { DB } from "../db/client.js";
import { SETTING_KEYS, getSetting, setSetting } from "../db/settings.js";
import type { ZendeskClient } from "../zendesk/client.js";
import { runSync } from "./sync.js";
import { runHealthCheck, type HealthOptions } from "./health.js";

function expressionForSeconds(seconds: number): string {
  if (seconds < 60) {
    const safe = Math.max(10, seconds);
    return `*/${safe} * * * * *`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `*/${minutes} * * * *`;
}

abstract class BaseScheduler {
  protected task: ScheduledTask | null = null;
  protected currentExpression: string | null = null;
  protected running = false;

  constructor(protected readonly log: FastifyBaseLogger) {}

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      this.currentExpression = null;
    }
  }

  protected scheduleEverySeconds(seconds: number, label: string, onTick: () => void): void {
    const expression = expressionForSeconds(seconds);
    if (this.currentExpression === expression && this.task) return;
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.currentExpression = expression;
    this.task = cron.schedule(expression, onTick);
    this.log.info({ expression, seconds }, `${label} scheduled`);
  }
}

export class SyncScheduler extends BaseScheduler {
  constructor(
    private readonly db: DB,
    private readonly zendesk: ZendeskClient,
    log: FastifyBaseLogger,
  ) {
    super(log);
  }

  async start(): Promise<void> {
    await this.applyFromSettings();
  }

  async applyFromSettings(): Promise<void> {
    const raw = await getSetting(this.db, SETTING_KEYS.SYNC_INTERVAL_SECONDS);
    const seconds = raw ? Number(raw) : 300;
    this.scheduleEverySeconds(seconds, "sync daemon", () => {
      void this.triggerOnce("cron");
    });
  }

  async triggerOnce(reason: "cron" | "manual"): Promise<ReturnType<typeof runSync> | null> {
    if (this.running) {
      this.log.warn({ reason }, "sync skipped: previous run still in progress");
      return null;
    }
    this.running = true;
    try {
      this.log.info({ reason }, "sync starting");
      const result = await runSync(this.db, this.zendesk);
      this.log.info({ reason, ...result }, "sync finished");
      return result;
    } catch (err) {
      this.log.error({ err, reason }, "sync failed");
      throw err;
    } finally {
      this.running = false;
    }
  }
}

export class HealthScheduler extends BaseScheduler {
  constructor(
    private readonly db: DB,
    private readonly opts: HealthOptions,
    log: FastifyBaseLogger,
  ) {
    super(log);
  }

  async start(): Promise<void> {
    await this.applyFromSettings();
  }

  async applyFromSettings(): Promise<void> {
    const raw = await getSetting(this.db, SETTING_KEYS.HEALTH_INTERVAL_SECONDS);
    const seconds = Math.max(3600, raw ? Number(raw) : 3600);
    this.scheduleEverySeconds(seconds, "health daemon", () => {
      void this.triggerOnce("cron");
    });
  }

  async triggerOnce(
    reason: "cron" | "manual",
  ): Promise<ReturnType<typeof runHealthCheck> | null> {
    if (this.running) {
      this.log.warn({ reason }, "health skipped: previous run still in progress");
      return null;
    }
    this.running = true;
    try {
      this.log.info({ reason }, "health check starting");
      const result = await runHealthCheck(this.db, this.opts);
      this.log.info({ reason, ...result }, "health check finished");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error({ err, reason }, "health check failed");
      await setSetting(this.db, SETTING_KEYS.LAST_HEALTH_ERROR, message);
      throw err;
    } finally {
      this.running = false;
    }
  }
}
