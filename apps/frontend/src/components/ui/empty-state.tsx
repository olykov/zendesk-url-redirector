import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-16",
        "rounded-[8px] border border-dashed border-line bg-surface/30",
        className,
      )}
    >
      <div className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 mb-3">
        <Icon className="h-4 w-4 text-fg-3" />
      </div>
      <div className="text-[14px] font-medium text-fg">{title}</div>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
