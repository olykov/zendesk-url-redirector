import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Code({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <code
      className={cn(
        "font-mono text-[12px] text-fg-2 break-all",
        className,
      )}
      {...props}
    />
  );
}

export function CodeBlock({ className, ...props }: HTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      className={cn(
        "rounded-[6px] border border-line bg-bg/60 px-3 py-2.5 text-[12px] font-mono text-fg-2",
        "overflow-x-auto",
        className,
      )}
      {...props}
    />
  );
}
