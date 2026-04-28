import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-6 pb-6", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-fg-3 mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] font-semibold tracking-tight text-fg leading-none">{title}</h1>
        {description && (
          <p className="mt-2 text-[13px] text-fg-3 max-w-2xl leading-relaxed">{description}</p>
        )}
        {meta && <div className="mt-3 flex items-center gap-3 text-[12px] text-fg-3">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
