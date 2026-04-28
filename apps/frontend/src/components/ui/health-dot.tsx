import type { HealthStatus } from "@redirector/shared";
import { StatusDot } from "@/components/ui/status-dot";

const TONE_MAP = {
  green: "success",
  red: "danger",
  yellow: "warn",
} as const;

const LABEL: Record<HealthStatus, string> = {
  green: "Healthy",
  red: "Broken",
  yellow: "Suspicious",
};

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export function HealthDot({
  status,
  statusCode,
  checkedAt,
  error,
}: {
  status: HealthStatus | null;
  statusCode: number | null;
  checkedAt: string | null;
  error: string | null;
}) {
  if (!status) {
    return (
      <span title="Not checked yet" className="inline-flex">
        <StatusDot tone="muted" className="opacity-50" />
      </span>
    );
  }

  const tone = TONE_MAP[status];
  const ago = timeAgo(checkedAt);
  const codeOrErr = statusCode !== null ? `HTTP ${statusCode}` : error ? "network error" : null;

  // Single-line title — browsers don't render newlines in `title`.
  const parts = [LABEL[status], codeOrErr, ago].filter(Boolean) as string[];
  const title = parts.join(" · ");

  return (
    <span title={title} className="inline-flex">
      <StatusDot tone={tone} />
    </span>
  );
}
