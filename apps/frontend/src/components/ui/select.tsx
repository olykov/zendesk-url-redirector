"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "h-8 w-full appearance-none rounded-[6px] border border-line bg-surface px-2.5 pr-8",
        "text-[13px] text-fg",
        "transition-[border,background] duration-150",
        "hover:border-line-strong",
        "focus-visible:outline-none focus-visible:border-fg-3 focus-visible:bg-surface-2",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
  </div>
));
Select.displayName = "Select";
