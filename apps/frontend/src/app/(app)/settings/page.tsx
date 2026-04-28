"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/ui/status-dot";
import { api } from "@/lib/api";
import { useAccessToken } from "@/lib/session-context";

const SYNC_PRESETS = [
  { label: "30 sec", value: 30 },
  { label: "1 min", value: 60 },
  { label: "5 min", value: 300 },
  { label: "15 min", value: 900 },
  { label: "1 hour", value: 3600 },
];

const HEALTH_PRESETS = [
  { label: "1 hour", value: 3600 },
  { label: "3 hours", value: 10800 },
  { label: "6 hours", value: 21600 },
  { label: "12 hours", value: 43200 },
  { label: "1 day", value: 86400 },
];

export default function SettingsPage() {
  const token = useAccessToken();
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(token),
  });

  const [syncInterval, setSyncInterval] = useState<string>("");
  const [healthInterval, setHealthInterval] = useState<string>("");
  useEffect(() => {
    if (settings.data) {
      setSyncInterval(String(settings.data.sync_interval_seconds));
      setHealthInterval(String(settings.data.health_interval_seconds));
    }
  }, [settings.data]);

  const saveSync = useMutation({
    mutationFn: (sec: number) => api.updateSettings({ sync_interval_seconds: sec }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
  const saveHealth = useMutation({
    mutationFn: (sec: number) => api.updateSettings({ health_interval_seconds: sec }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  const sync = useMutation({
    mutationFn: () => api.triggerSync(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["redirects"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
  const health = useMutation({
    mutationFn: () => api.triggerHealth(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["redirects"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const syncStatus = settings.data?.last_sync_status;
  const syncTone =
    syncStatus === "ok" ? "success" : syncStatus === "error" ? "danger" : "muted";

  const healthSummary = settings.data?.last_health_summary ?? null;
  const healthEnabled = settings.data?.health_check_enabled ?? false;
  const healthTone = settings.data?.last_health_error
    ? "danger"
    : healthSummary && healthSummary.red > 0
      ? "danger"
      : healthSummary && healthSummary.yellow > 0
        ? "warn"
        : healthSummary
          ? "success"
          : "muted";

  return (
    <div className="space-y-1">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Configure sync and health-check schedules. Both schedulers run inside the backend container."
      />

      <div className="space-y-8">
        {/* Sync schedule */}
        <section className="rounded-[8px] border border-line bg-surface">
          <div className="border-b border-line px-5 py-3.5">
            <div className="text-[13.5px] font-semibold text-fg">Sync schedule</div>
            <div className="text-[12px] text-fg-3 mt-0.5">
              How often the daemon pulls redirect rules from Zendesk into the local mirror.
            </div>
          </div>

          <form
            className="px-5 py-5 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              const num = Number(syncInterval);
              if (Number.isFinite(num)) saveSync.mutate(num);
            }}
          >
            <div className="space-y-2 max-w-[220px]">
              <Label htmlFor="sync-interval">Interval (seconds)</Label>
              <Input
                id="sync-interval"
                type="number"
                min={10}
                max={86400}
                value={syncInterval}
                onChange={(e) => setSyncInterval(e.target.value)}
                className="tabular"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SYNC_PRESETS.map((p) => (
                <PresetButton
                  key={p.value}
                  label={p.label}
                  active={Number(syncInterval) === p.value}
                  onClick={() => setSyncInterval(String(p.value))}
                />
              ))}
            </div>
            <Button type="submit" variant="primary" disabled={saveSync.isPending}>
              {saveSync.isPending ? "Saving…" : "Save schedule"}
            </Button>
          </form>
        </section>

        {/* Last sync */}
        <section className="rounded-[8px] border border-line bg-surface">
          <div className="border-b border-line px-5 py-3.5 flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-semibold text-fg">Last sync</div>
              <div className="text-[12px] text-fg-3 mt-0.5">
                Manual triggers run immediately and respect the same lock as cron.
              </div>
            </div>
            <Button
              variant="secondary"
              size="default"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
              {sync.isPending ? "Syncing…" : "Sync now"}
            </Button>
          </div>

          <div className="divide-y divide-line">
            <Row label="Status">
              <div className="flex items-center gap-2">
                <StatusDot tone={syncTone} />
                <span className="text-[12.5px] text-fg-2">
                  {syncStatus === "ok" ? "Healthy" : syncStatus === "error" ? "Error" : "Idle"}
                </span>
              </div>
            </Row>
            <Row label="Last run">
              <code className="font-mono text-[12px] text-fg-2 break-all">
                {settings.data?.last_sync_at ?? "—"}
              </code>
            </Row>
            <Row label="Interval">
              <code className="font-mono text-[12px] text-fg-2">
                {settings.data?.sync_interval_seconds ?? "—"}s
              </code>
            </Row>
            {settings.data?.last_sync_error && (
              <Row label="Last error">
                <code className="font-mono text-[12px] text-danger break-all">
                  {settings.data.last_sync_error}
                </code>
              </Row>
            )}
          </div>

          {sync.data && "fetched" in sync.data && (
            <div className="border-t border-line bg-bg/40 px-5 py-3 text-[11.5px] text-fg-3 tabular flex flex-wrap gap-x-4 gap-y-1">
              <span>
                fetched <span className="text-fg font-mono">{sync.data.fetched}</span>
              </span>
              <span>
                inserted <span className="text-fg font-mono">{sync.data.inserted}</span>
              </span>
              <span>
                updated <span className="text-fg font-mono">{sync.data.updated}</span>
              </span>
              <span>
                removed <span className="text-fg font-mono">{sync.data.removed}</span>
              </span>
              <span>
                took <span className="text-fg font-mono">{sync.data.duration_ms}ms</span>
              </span>
            </div>
          )}
        </section>

        {/* Health checks */}
        {healthEnabled ? (
          <>
            <section className="rounded-[8px] border border-line bg-surface">
              <div className="border-b border-line px-5 py-3.5">
                <div className="text-[13.5px] font-semibold text-fg">Health-check schedule</div>
                <div className="text-[12px] text-fg-3 mt-0.5">
                  How often the daemon HEAD-probes every <code className="font-mono">redirect_from</code>{" "}
                  on the Help Center to verify the rule is applied. Polite throttle, min 1 hour.
                </div>
              </div>

              <form
                className="px-5 py-5 space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const num = Number(healthInterval);
                  if (Number.isFinite(num)) saveHealth.mutate(num);
                }}
              >
                <div className="space-y-2 max-w-[220px]">
                  <Label htmlFor="health-interval">Interval (seconds)</Label>
                  <Input
                    id="health-interval"
                    type="number"
                    min={3600}
                    max={86400}
                    value={healthInterval}
                    onChange={(e) => setHealthInterval(e.target.value)}
                    className="tabular"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {HEALTH_PRESETS.map((p) => (
                    <PresetButton
                      key={p.value}
                      label={p.label}
                      active={Number(healthInterval) === p.value}
                      onClick={() => setHealthInterval(String(p.value))}
                    />
                  ))}
                </div>
                <Button type="submit" variant="primary" disabled={saveHealth.isPending}>
                  {saveHealth.isPending ? "Saving…" : "Save schedule"}
                </Button>
              </form>
            </section>

            <section className="rounded-[8px] border border-line bg-surface">
              <div className="border-b border-line px-5 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[13.5px] font-semibold text-fg">Last health check</div>
                  <div className="text-[12px] text-fg-3 mt-0.5">
                    Snapshot of the most recent batch.
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="default"
                  onClick={() => health.mutate()}
                  disabled={health.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${health.isPending ? "animate-spin" : ""}`} />
                  {health.isPending ? "Checking…" : "Check now"}
                </Button>
              </div>

              <div className="divide-y divide-line">
                <Row label="Status">
                  <div className="flex items-center gap-2">
                    <StatusDot tone={healthTone} />
                    <span className="text-[12.5px] text-fg-2">
                      {settings.data?.last_health_error
                        ? "Error"
                        : healthSummary
                          ? `${healthSummary.green} healthy · ${healthSummary.yellow} suspicious · ${healthSummary.red} broken`
                          : "Not run yet"}
                    </span>
                  </div>
                </Row>
                <Row label="Last run">
                  <code className="font-mono text-[12px] text-fg-2 break-all">
                    {settings.data?.last_health_at ?? "—"}
                  </code>
                </Row>
                <Row label="Interval">
                  <code className="font-mono text-[12px] text-fg-2">
                    {settings.data?.health_interval_seconds ?? "—"}s
                  </code>
                </Row>
                {settings.data?.last_health_error && (
                  <Row label="Last error">
                    <code className="font-mono text-[12px] text-danger break-all">
                      {settings.data.last_health_error}
                    </code>
                  </Row>
                )}
              </div>

              {healthSummary && (
                <div className="border-t border-line bg-bg/40 px-5 py-3 text-[11.5px] text-fg-3 tabular flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    total <span className="text-fg font-mono">{healthSummary.total}</span>
                  </span>
                  <span>
                    green <span className="text-success font-mono">{healthSummary.green}</span>
                  </span>
                  <span>
                    yellow <span className="text-warn font-mono">{healthSummary.yellow}</span>
                  </span>
                  <span>
                    red <span className="text-danger font-mono">{healthSummary.red}</span>
                  </span>
                  <span>
                    errors <span className="text-fg font-mono">{healthSummary.errored}</span>
                  </span>
                  <span>
                    took <span className="text-fg font-mono">{healthSummary.duration_ms}ms</span>
                  </span>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-[8px] border border-dashed border-line bg-surface/40 px-5 py-4 flex items-start gap-3 text-[12.5px] text-fg-3">
            <AlertCircle className="h-4 w-4 mt-0.5 text-fg-4 shrink-0" />
            <div>
              <div className="font-medium text-fg-2 mb-0.5">Health checks disabled</div>
              Set <code className="font-mono text-fg-2">HELP_CENTER_URL</code> in the environment
              (e.g. <code className="font-mono">https://support.example.com</code>) and restart the
              backend to enable periodic HEAD probes against your Help Center.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function PresetButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-[4px] border px-2 py-1 text-[11.5px] transition-colors " +
        (active
          ? "border-fg-3 bg-surface-2 text-fg"
          : "border-line text-fg-3 hover:border-line-strong hover:text-fg-2")
      }
    >
      {label}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-4 px-5 py-3">
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-fg-4 font-medium">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
