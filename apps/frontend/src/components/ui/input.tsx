"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, mono, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full rounded-[6px] border border-line bg-surface px-2.5",
        "text-[13px] text-fg placeholder:text-fg-4",
        "transition-[border,background] duration-150",
        "hover:border-line-strong",
        "focus-visible:outline-none focus-visible:border-fg-3 focus-visible:bg-surface-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        mono && "font-mono text-[12.5px]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
