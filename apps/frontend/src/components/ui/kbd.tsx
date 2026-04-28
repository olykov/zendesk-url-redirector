import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[20px] items-center justify-center rounded-[4px]",
        "border border-line bg-surface-2 px-1.5",
        "font-mono text-[10.5px] text-fg-3 leading-none",
        className,
      )}
      {...props}
    />
  );
}
