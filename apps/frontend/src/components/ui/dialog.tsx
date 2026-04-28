"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { variant?: "default" | "danger" }
>(({ className, children, variant = "default", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] animate-overlay" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
        "rounded-[12px] border border-line-strong bg-surface shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]",
        "animate-dialog",
        variant === "danger" && "border-t-2 border-t-danger",
        className,
      )}
      {...props}
    >
      <div className="p-5">{children}</div>
      <DialogPrimitive.Close className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-2 hover:text-fg transition-colors">
        <X className="h-3.5 w-3.5" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-5 space-y-1.5 pr-6", className)} {...props} />
);

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-5 flex justify-end gap-2", className)} {...props} />
);
