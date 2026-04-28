"use client";

import { useMemo } from "react";
import { CheckCircle2, XCircle, Download, RefreshCw } from "lucide-react";
import type { BatchApplyResponse } from "@redirector/shared";
import { Button } from "@/components/ui/button";

export function StepApply({
  apply,
  onReset,
}: {
  apply: BatchApplyResponse;
  onReset: () => void;
}) {
  const successRate = apply.total > 0 ? Math.round((apply.created / apply.total) * 100) : 0;
  const failed = apply.results.filter((r) => !r.ok);

  const csvUrl = useMemo(() => {
    const header = "redirect_from,redirect_to,redirect_status,ok,id,error\n";
    const escape = (v: string | null) => {
      if (v === null) return "";
      if (v.includes(",") || v.includes('"') || v.includes("\n"))
        return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const body = apply.results
      .map((r) =>
        [
          escape(r.redirect_from),
          escape(r.redirect_to),
          r.redirect_status,
          r.ok ? "1" : "0",
          escape(r.id),
          escape(r.error),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    return URL.createObjectURL(blob);
  }, [apply]);

  const reportName = `batch-report-${new Date(Date.now()).toISOString().replace(/[:.]/g, "-")}.csv`;

  return (
    <div className="space-y-6">
      {/* hero summary */}
      <section className="rounded-[8px] border border-line bg-surface p-6">
        <div className="flex items-center gap-4">
          <div
            className={
              "grid h-10 w-10 place-items-center rounded-full " +
              (apply.failed === 0
                ? "bg-success/15 text-success"
                : "bg-warn/15 text-warn")
            }
          >
            {apply.failed === 0 ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-semibold tracking-tight text-fg leading-tight">
              {apply.created.toLocaleString()} created · {apply.failed.toLocaleString()} failed
            </div>
            <div className="mt-1 text-[12.5px] text-fg-3 tabular">
              {apply.total.toLocaleString()} total · {(apply.duration_ms / 1000).toFixed(1)}s ·{" "}
              {successRate}% success
            </div>
          </div>
        </div>

        {apply.total > 0 && (
          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-bg/60">
            <div className="flex h-full">
              <div
                className="h-full bg-success"
                style={{ width: `${(apply.created / apply.total) * 100}%` }}
              />
              <div
                className="h-full bg-danger"
                style={{ width: `${(apply.failed / apply.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href={csvUrl} download={reportName}>
              <Download className="h-3.5 w-3.5" />
              Download report
            </a>
          </Button>
          <Button variant="ghost" onClick={onReset}>
            <RefreshCw className="h-3.5 w-3.5" />
            Start a new batch
          </Button>
        </div>
      </section>

      {failed.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-fg-4 font-semibold">
              Failures · {failed.length.toLocaleString()}
            </div>
          </div>
          <div className="rounded-[8px] border border-line overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-[12px] tabular">
                <thead className="bg-surface sticky top-0">
                  <tr className="border-b border-line text-left">
                    <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                      From
                    </th>
                    <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                      To
                    </th>
                    <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failed.slice(0, 500).map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-1.5 font-mono text-fg-2 truncate max-w-[280px]">
                        {r.redirect_from}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-fg-2 truncate max-w-[280px]">
                        {r.redirect_to}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-danger break-all">
                        {r.error ?? "unknown"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {failed.length > 500 && (
                <div className="border-t border-line bg-surface px-3 py-2 text-[11px] text-fg-3">
                  Showing first 500 of {failed.length.toLocaleString()}. Download report for full
                  list.
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
