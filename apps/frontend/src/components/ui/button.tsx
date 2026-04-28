"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none",
    "rounded-[6px] text-[13px] font-medium leading-none",
    "transition-[background,color,border,opacity] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:opacity-40",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg hover:bg-fg-2 active:bg-fg-3",
        secondary:
          "bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong",
        ghost: "bg-transparent text-fg-2 hover:bg-surface-2 hover:text-fg",
        outline:
          "bg-transparent text-fg border border-line hover:bg-surface-2 hover:border-line-strong",
        danger: "bg-danger text-danger-fg hover:opacity-90 active:opacity-100",
        "danger-outline":
          "bg-transparent border border-danger/40 text-danger hover:bg-danger/10 hover:border-danger",
      },
      size: {
        sm: "h-7 px-2.5 text-[12px]",
        default: "h-8 px-3",
        lg: "h-10 px-4 text-[14px]",
        icon: "h-8 w-8",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: { variant: "secondary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
