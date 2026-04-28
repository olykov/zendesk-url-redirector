"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
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

const PHRASE = "CREATE";

export function ConfirmApplyDialog({
  open,
  onOpenChange,
  count,
  throttleMs,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  throttleMs: number;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toUpperCase() === PHRASE;

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  // Estimate: throttle * count + ~250ms per call (conservative)
  const estSeconds = Math.round(((throttleMs + 250) * count) / 1000);
  const estStr =
    estSeconds < 60
      ? `${estSeconds}s`
      : `${Math.floor(estSeconds / 60)}m ${estSeconds % 60}s`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-fg/10 text-fg">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <DialogTitle className="text-[15px] font-semibold tracking-tight text-fg">
              Apply batch to Zendesk
            </DialogTitle>
          </div>
          <DialogDescription className="text-[13px] text-fg-3 leading-relaxed">
            Each rule is created via Zendesk API and inserted into the local mirror.
            The browser must stay open until completion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-[6px] border border-line bg-bg/60 divide-y divide-line">
            <Row label="Rules" value={count.toLocaleString()} />
            <Row label="Throttle" value={`${throttleMs}ms between calls`} />
            <Row label="Estimated" value={estStr} mono />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-apply">
              Type <span className="font-mono text-fg">{PHRASE}</span> to enable
            </Label>
            <Input
              id="confirm-apply"
              mono
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={PHRASE}
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-[6px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger break-all">
              {error}
            </div>
          )}

          {pending && (
            <div className="rounded-[6px] border border-line bg-bg/60 px-3 py-2.5 text-[12px] text-fg-3 leading-relaxed">
              <div className="flex items-center gap-2 font-medium text-fg-2 mb-1">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-fg-3 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-fg-2" />
                </span>
                Applying batch — keep this tab open
              </div>
              The backend creates each rule sequentially with a {throttleMs}ms throttle.
              Estimated completion in ~{estStr}.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!matches || pending} onClick={onConfirm}>
            {pending ? "Applying…" : `Apply ${count.toLocaleString()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3 px-3 py-2 text-[12.5px]">
      <span className="text-fg-4 uppercase tracking-[0.08em] text-[10.5px] font-medium">{label}</span>
      <span className={mono ? "font-mono text-fg" : "text-fg"}>{value}</span>
    </div>
  );
}
