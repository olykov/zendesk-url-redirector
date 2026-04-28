"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 animate-overlay" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed right-0 top-0 z-50 h-full w-full max-w-[480px]",
        "border-l border-line-strong bg-surface",
        "shadow-[-24px_0_48px_-12px_rgba(0,0,0,0.5)]",
        "animate-sheet flex flex-col",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-2 hover:text-fg transition-colors">
        <X className="h-3.5 w-3.5" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-b border-line px-5 py-4 pr-12",
        className,
      )}
      {...props}
    />
  );
}

export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-t border-line px-5 py-3 flex items-center justify-end gap-2", className)}
      {...props}
    />
  );
}
