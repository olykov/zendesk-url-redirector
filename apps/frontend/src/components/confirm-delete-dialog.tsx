"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleId: string;
  redirectFrom: string;
  redirectTo: string;
  onConfirm: () => Promise<void> | void;
  pending?: boolean;
  error?: string | null;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  ruleId,
  redirectFrom,
  redirectTo,
  onConfirm,
  pending,
  error,
}: Props) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === ruleId;

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="danger" className="max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-danger/15 text-danger">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <DialogTitle className="text-[15px] font-semibold tracking-tight text-fg">
              Delete redirect
            </DialogTitle>
          </div>
          <DialogDescription className="text-[13px] text-fg-3 leading-relaxed">
            Permanently removes this rule from Zendesk Guide. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-[6px] border border-line bg-bg/60 divide-y divide-line">
            <div className="grid grid-cols-[60px_1fr] items-baseline gap-3 px-3 py-2 text-[12px]">
              <span className="text-fg-4 uppercase tracking-[0.08em] text-[10.5px] font-medium">id</span>
              <code className="font-mono text-fg break-all">{ruleId}</code>
            </div>
            <div className="grid grid-cols-[60px_1fr] items-baseline gap-3 px-3 py-2 text-[12px]">
              <span className="text-fg-4 uppercase tracking-[0.08em] text-[10.5px] font-medium">from</span>
              <code className="font-mono text-fg-2 break-all">{redirectFrom}</code>
            </div>
            <div className="grid grid-cols-[60px_1fr] items-baseline gap-3 px-3 py-2 text-[12px]">
              <span className="text-fg-4 uppercase tracking-[0.08em] text-[10.5px] font-medium">to</span>
              <code className="font-mono text-fg-2 break-all">{redirectTo}</code>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-id">Re-type the ID to confirm</Label>
            <Input
              id="confirm-id"
              mono
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={ruleId}
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-[6px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger break-all">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!matches || pending}
            onClick={() => onConfirm()}
          >
            {pending ? "Deleting…" : "Delete redirect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
