import { cn } from "@/lib/utils";

type Tone = "success" | "danger" | "warn" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success shadow-[0_0_0_3px_oklch(72%_0.13_165/0.15)]",
  danger: "bg-danger shadow-[0_0_0_3px_oklch(64%_0.22_25/0.18)]",
  warn: "bg-warn shadow-[0_0_0_3px_oklch(78%_0.16_75/0.18)]",
  muted: "bg-fg-4",
};

export function StatusDot({ tone = "muted", className }: { tone?: Tone; className?: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", TONE_CLASS[tone], className)} />;
}
