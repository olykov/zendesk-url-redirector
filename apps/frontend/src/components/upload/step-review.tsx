"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, AlertTriangle, AlertCircle, Plus, MinusCircle } from "lucide-react";
import type { BatchItemInput, BatchPreviewItem, BatchPreviewResponse } from "@redirector/shared";
import { Button } from "@/components/ui/button";
import { ConfirmApplyDialog } from "./confirm-apply-dialog";
import { api } from "@/lib/api";
import { useAccessToken } from "@/lib/session-context";
import { cn } from "@/lib/utils";
import type { ValidatedRow } from "./types";

type Tab = "create" | "exists" | "conflict";

const TAB_META: Record<Tab, { label: string; tone: string; icon: typeof Plus }> = {
  create: { label: "Will create", tone: "text-fg-2", icon: Plus },
  exists: { label: "Already exists", tone: "text-fg-3", icon: MinusCircle },
  conflict: { label: "Conflicts", tone: "text-warn", icon: AlertTriangle },
};

export function StepReview({
  validated,
  preview,
  onPreview,
  applyOptions,
  onChangeOptions,
  onBack,
  onApplied,
}: {
  validated: ValidatedRow[];
  preview: BatchPreviewResponse | null;
  onPreview: (data: BatchPreviewResponse) => void;
  applyOptions: { skipExisting: boolean; skipConflicts: boolean; throttleMs: number };
  onChangeOptions: (next: { skipExisting: boolean; skipConflicts: boolean; throttleMs: number }) => void;
  onBack: () => void;
  onApplied: (data: import("@redirector/shared").BatchApplyResponse) => void;
}) {
  const token = useAccessToken();

  const candidates: BatchItemInput[] = useMemo(
    () =>
      validated
        .filter((r) => r.kind === "ready" || r.kind === "warning")
        .map((r) => ({
          redirect_from: r.from,
          redirect_to: r.to,
          redirect_status: r.status as "301" | "302",
        })),
    [validated],
  );

  const previewMutation = useMutation({
    mutationFn: () => api.batchPreview(candidates, token),
    onSuccess: (data) => onPreview(data),
  });

  useEffect(() => {
    if (preview === null && candidates.length > 0) {
      previewMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = useState<Tab>("create");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const finalItems: BatchItemInput[] = useMemo(() => {
    if (!preview) return [];
    return preview.items
      .filter((i) => {
        if (i.status === "create") return true;
        if (i.status === "exists") return !applyOptions.skipExisting;
        if (i.status === "conflict") return !applyOptions.skipConflicts;
        return false;
      })
      .map((i) => ({
        redirect_from: i.redirect_from,
        redirect_to: i.redirect_to,
        redirect_status: i.redirect_status,
      }));
  }, [preview, applyOptions]);

  const applyMutation = useMutation({
    mutationFn: () => api.batchApply(finalItems, token, applyOptions.throttleMs),
    onSuccess: (data) => {
      setConfirmOpen(false);
      onApplied(data);
    },
  });

  if (previewMutation.isPending || preview === null) {
    return (
      <div className="rounded-[8px] border border-line bg-surface px-6 py-12 text-center text-[13px] text-fg-3">
        {previewMutation.isError ? (
          <span className="text-danger">{(previewMutation.error as Error).message}</span>
        ) : (
          "Checking against local mirror…"
        )}
      </div>
    );
  }

  const groups: Record<Tab, BatchPreviewItem[]> = {
    create: preview.items.filter((i) => i.status === "create"),
    exists: preview.items.filter((i) => i.status === "exists"),
    conflict: preview.items.filter((i) => i.status === "conflict"),
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(groups) as Tab[]).map((k) => {
          const meta = TAB_META[k];
          const Icon = meta.icon;
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center gap-3 rounded-[8px] border bg-surface px-4 py-3 text-left transition-colors",
                active ? "border-fg-3" : "border-line hover:border-line-strong",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", meta.tone)} />
              <div className="min-w-0">
                <div className="text-[10.5px] uppercase tracking-[0.1em] text-fg-4 font-semibold">
                  {meta.label}
                </div>
                <div className="text-[18px] font-semibold tabular text-fg leading-tight mt-0.5">
                  {groups[k].length.toLocaleString()}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <ReviewTable rows={groups[tab]} kind={tab} />

      <section className="rounded-[8px] border border-line bg-surface p-5 space-y-3">
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-fg-4 font-semibold">
          Apply options
        </div>
        <Toggle
          checked={applyOptions.skipExisting}
          onChange={(v) => onChangeOptions({ ...applyOptions, skipExisting: v })}
          label={`Skip ${groups.exists.length.toLocaleString()} already existing (identical)`}
        />
        <Toggle
          checked={applyOptions.skipConflicts}
          onChange={(v) => onChangeOptions({ ...applyOptions, skipConflicts: v })}
          label={`Skip ${groups.conflict.length.toLocaleString()} conflicts (different target — Zendesk would 422)`}
        />
        {!applyOptions.skipConflicts && groups.conflict.length > 0 && (
          <div className="flex items-start gap-2 rounded-[6px] border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] text-warn">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Conflicts will likely fail with 422. Resolve them by deleting the existing rule first.
            </span>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => setConfirmOpen(true)}
          disabled={finalItems.length === 0}
        >
          Apply {finalItems.length.toLocaleString()}{" "}
          {finalItems.length === 1 ? "redirect" : "redirects"}
        </Button>
      </div>

      <ConfirmApplyDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!applyMutation.isPending) setConfirmOpen(o);
        }}
        count={finalItems.length}
        throttleMs={applyOptions.throttleMs}
        pending={applyMutation.isPending}
        error={applyMutation.error ? (applyMutation.error as Error).message : null}
        onConfirm={() => applyMutation.mutate()}
      />
    </div>
  );
}

function ReviewTable({ rows, kind }: { rows: BatchPreviewItem[]; kind: Tab }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-line bg-surface/30 px-6 py-10 text-center text-[13px] text-fg-3">
        Nothing in this category.
      </div>
    );
  }
  const showExisting = kind !== "create";
  return (
    <div className="rounded-[8px] border border-line overflow-hidden">
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-[12px] tabular">
          <thead className="bg-surface sticky top-0">
            <tr className="border-b border-line text-left">
              <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                From
              </th>
              <th className="px-3 py-2 w-6" />
              <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                To
              </th>
              <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4 w-[55px] text-right">
                Code
              </th>
              {showExisting && (
                <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                  Existing target
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 1000).map((r, i) => (
              <tr key={i} className="border-b border-line last:border-b-0 hover:bg-surface-2/40">
                <td className="px-3 py-1.5 font-mono text-fg-2 truncate max-w-[280px]">{r.redirect_from}</td>
                <td className="px-1 py-1.5 text-fg-4">
                  <ArrowRight className="h-3 w-3" />
                </td>
                <td className="px-3 py-1.5 font-mono text-fg-2 truncate max-w-[280px]">{r.redirect_to}</td>
                <td className="px-3 py-1.5 text-right font-mono text-fg-3">{r.redirect_status}</td>
                {showExisting && (
                  <td className="px-3 py-1.5 font-mono text-fg-3 truncate max-w-[280px]">
                    {r.existing_to ?? "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 1000 && (
          <div className="border-t border-line bg-surface px-3 py-2 text-[11px] text-fg-3">
            Showing first 1000 of {rows.length.toLocaleString()} rows.
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 text-[13px] text-fg-2 cursor-pointer select-none">
      <span
        className={
          "relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors " +
          (checked ? "bg-fg-3" : "bg-line")
        }
      >
        <span
          className={
            "absolute top-0.5 h-3 w-3 rounded-full bg-bg transition-transform " +
            (checked ? "translate-x-3.5" : "translate-x-0.5")
          }
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
