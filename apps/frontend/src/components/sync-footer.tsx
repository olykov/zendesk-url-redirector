"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAccessToken } from "@/lib/session-context";
import { StatusDot } from "@/components/ui/status-dot";

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export function SyncFooter() {
  const token = useAccessToken();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(token),
    refetchInterval: 30_000,
  });

  const status = data?.last_sync_status;
  const tone = status === "ok" ? "success" : status === "error" ? "danger" : "muted";
  const label = status === "ok" ? "Synced" : status === "error" ? "Sync error" : "Idle";

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 text-[11.5px]">
      <StatusDot tone={tone} />
      <span className="text-fg-2 font-medium">{label}</span>
      <span className="ml-auto font-mono text-fg-4 tabular">{timeAgo(data?.last_sync_at)}</span>
    </div>
  );
}
