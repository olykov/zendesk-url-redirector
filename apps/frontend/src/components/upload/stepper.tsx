"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardStep } from "./types";

const ORDER: WizardStep[] = ["upload", "map", "validate", "review", "apply"];
const LABELS: Record<WizardStep, string> = {
  upload: "Upload",
  map: "Map columns",
  validate: "Validate",
  review: "Review",
  apply: "Apply",
};

export function Stepper({
  current,
  onJump,
  reachable,
}: {
  current: WizardStep;
  onJump: (step: WizardStep) => void;
  reachable: (step: WizardStep) => boolean;
}) {
  const currentIdx = ORDER.indexOf(current);
  return (
    <ol className="flex items-center gap-1 mb-8">
      {ORDER.map((step, idx) => {
        const isCurrent = step === current;
        const isPast = idx < currentIdx;
        const canJump = reachable(step) && !isCurrent;
        return (
          <li key={step} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => canJump && onJump(step)}
              disabled={!canJump}
              className={cn(
                "group flex items-center gap-2 rounded-[6px] px-2.5 py-1.5",
                "text-[12px] font-medium transition-colors",
                isCurrent && "bg-surface-2 text-fg",
                isPast && "text-fg-2 hover:text-fg hover:bg-surface-2",
                !isCurrent && !isPast && "text-fg-4 cursor-not-allowed",
                canJump && "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full border text-[10.5px] font-semibold tabular",
                  isCurrent && "border-fg bg-fg text-bg",
                  isPast && "border-fg-3 bg-surface-2 text-fg-2",
                  !isCurrent && !isPast && "border-line text-fg-4",
                )}
              >
                {isPast ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : idx + 1}
              </span>
              <span>{LABELS[step]}</span>
            </button>
            {idx < ORDER.length - 1 && (
              <span
                className={cn(
                  "h-px w-6 mx-1 transition-colors",
                  idx < currentIdx ? "bg-fg-3" : "bg-line",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
