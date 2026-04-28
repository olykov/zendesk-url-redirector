"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileState, MappingConfig, ValidatedRow } from "./types";
import { normalizePath } from "./csv";

function validate(file: FileState, mapping: MappingConfig): ValidatedRow[] {
  const out: ValidatedRow[] = [];
  const seenFrom = new Map<string, number>(); // from → first lineNo

  for (let i = 0; i < file.rows.length; i++) {
    const row = file.rows[i]!;
    const lineNo = mapping.hasHeader ? i + 2 : i + 1;
    const rawFrom = mapping.fromIdx !== null ? (row[mapping.fromIdx] ?? "") : "";
    const rawTo = mapping.toIdx !== null ? (row[mapping.toIdx] ?? "") : "";
    const rawStatus = mapping.statusIdx !== null ? (row[mapping.statusIdx] ?? "") : "";

    let from = rawFrom;
    let to = rawTo;
    let status = rawStatus;
    if (mapping.trim) {
      from = from.trim();
      to = to.trim();
      status = status.trim();
    }

    if (mapping.skipEmpty && from === "" && to === "") continue;

    if (from === "") {
      out.push({ kind: "invalid", from, to, status, raw: row, lineNo, reason: "empty `from`" });
      continue;
    }
    if (to === "") {
      out.push({ kind: "invalid", from, to, status, raw: row, lineNo, reason: "empty `to`" });
      continue;
    }

    const normFrom = normalizePath(from);
    const normTo = normalizePath(to);

    let normalizedStatus: "301" | "302" = mapping.defaultStatus;
    if (status !== "") {
      if (status === "301" || status === "302") normalizedStatus = status;
      else {
        out.push({
          kind: "invalid",
          from: normFrom,
          to: normTo,
          status,
          raw: row,
          lineNo,
          reason: `bad status "${status}" (must be 301 or 302)`,
        });
        continue;
      }
    }

    const dupOf = seenFrom.get(normFrom);
    if (dupOf !== undefined) {
      out.push({
        kind: "duplicate-in-file",
        from: normFrom,
        to: normTo,
        status: normalizedStatus,
        raw: row,
        lineNo,
        firstSeenLine: dupOf,
      });
      continue;
    }
    seenFrom.set(normFrom, lineNo);

    if (normFrom === normTo) {
      out.push({
        kind: "warning",
        from: normFrom,
        to: normTo,
        status: normalizedStatus,
        raw: row,
        lineNo,
        reason: "from === to (no-op redirect)",
      });
      continue;
    }
    if (normFrom.length > 2000 || normTo.length > 2000) {
      out.push({
        kind: "warning",
        from: normFrom,
        to: normTo,
        status: normalizedStatus,
        raw: row,
        lineNo,
        reason: "very long path (>2000 chars)",
      });
      continue;
    }

    out.push({
      kind: "ready",
      from: normFrom,
      to: normTo,
      status: normalizedStatus,
      raw: row,
      lineNo,
    });
  }

  return out;
}

type Tab = "ready" | "warning" | "invalid" | "duplicate-in-file";

const TAB_META: Record<Tab, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  ready: { label: "Ready", tone: "text-success", icon: CheckCircle2 },
  warning: { label: "Warnings", tone: "text-warn", icon: AlertTriangle },
  invalid: { label: "Invalid", tone: "text-danger", icon: XCircle },
  "duplicate-in-file": { label: "Duplicates in file", tone: "text-fg-3", icon: Files },
};

export function StepValidate({
  file,
  mapping,
  onBack,
  onNext,
}: {
  file: FileState;
  mapping: MappingConfig;
  onBack: () => void;
  onNext: (validated: ValidatedRow[]) => void;
}) {
  const validated = useMemo(() => validate(file, mapping), [file, mapping]);

  const groups: Record<Tab, ValidatedRow[]> = {
    ready: [],
    warning: [],
    invalid: [],
    "duplicate-in-file": [],
  };
  for (const r of validated) groups[r.kind].push(r);

  const [tab, setTab] = useState<Tab>("ready");
  const readyCount = groups.ready.length + groups.warning.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(Object.keys(groups) as Tab[]).map((k) => {
          const meta = TAB_META[k];
          const Icon = meta.icon;
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={
                "flex items-center gap-3 rounded-[8px] border bg-surface px-4 py-3 text-left transition-colors " +
                (active
                  ? "border-fg-3"
                  : "border-line hover:border-line-strong")
              }
            >
              <Icon className={"h-3.5 w-3.5 " + meta.tone} />
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

      <ValidationTable rows={groups[tab]} kind={tab} />

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={() => onNext(validated)}
          disabled={readyCount === 0}
        >
          Continue with {readyCount.toLocaleString()} valid {readyCount === 1 ? "row" : "rows"}
        </Button>
      </div>
    </div>
  );
}

function ValidationTable({ rows, kind }: { rows: ValidatedRow[]; kind: Tab }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-line bg-surface/30 px-6 py-10 text-center text-[13px] text-fg-3">
        Nothing in this category.
      </div>
    );
  }
  const showReason = kind !== "ready";
  return (
    <div className="rounded-[8px] border border-line overflow-hidden">
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-[12px] tabular">
          <thead className="bg-surface sticky top-0">
            <tr className="border-b border-line text-left">
              <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4 w-[60px]">
                Line
              </th>
              <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                From
              </th>
              <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                To
              </th>
              <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4 w-[55px] text-right">
                Code
              </th>
              {showReason && (
                <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4 w-[260px]">
                  Reason
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 1000).map((r, i) => (
              <tr key={i} className="border-b border-line last:border-b-0 hover:bg-surface-2/40">
                <td className="px-3 py-1.5 text-fg-4 font-mono">{r.lineNo}</td>
                <td className="px-3 py-1.5 font-mono text-fg-2 truncate max-w-[320px]">{r.from}</td>
                <td className="px-3 py-1.5 font-mono text-fg-2 truncate max-w-[320px]">{r.to}</td>
                <td className="px-3 py-1.5 text-right font-mono text-fg-3">{r.status}</td>
                {showReason && (
                  <td className="px-3 py-1.5 text-fg-3">
                    {r.kind === "duplicate-in-file" ? (
                      <>also at line <span className="font-mono text-fg-2">{r.firstSeenLine}</span></>
                    ) : r.kind === "invalid" || r.kind === "warning" ? (
                      r.reason
                    ) : null}
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
