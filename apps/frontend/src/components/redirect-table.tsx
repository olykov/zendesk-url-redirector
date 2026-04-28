"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Download, Inbox, RefreshCw, Search, Trash2 } from "lucide-react";
import type { Redirect } from "@redirector/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { EmptyState } from "@/components/ui/empty-state";
import { HealthDot } from "@/components/ui/health-dot";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RuleDetailSheet } from "@/components/rule-detail-sheet";
import { api, isSessionExpired } from "@/lib/api";
import { useAccessToken } from "@/lib/session-context";
import { cn } from "@/lib/utils";

const PUBLIC_HOST = process.env.NEXT_PUBLIC_HELP_CENTER_URL || undefined;

export function RedirectTable() {
  const token = useAccessToken();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirm, setConfirm] = useState<Redirect | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const list = useQuery({
    queryKey: ["redirects"],
    queryFn: () => api.listRedirects(token),
  });

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(token),
  });
  const healthEnabled = settings.data?.health_check_enabled ?? false;

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRedirect(id, token),
    onSuccess: (_v, id) => {
      qc.invalidateQueries({ queryKey: ["redirects"] });
      setConfirm(null);
      setConfirmError(null);
      if (selectedId === id) {
        setSheetOpen(false);
        setSelectedId(null);
      }
    },
    onError: (err) => setConfirmError((err as Error).message),
  });

  // Derive the selected rule from the live query data on every render so any
  // background mutation (recheck, sync) immediately reflects in the open sheet.
  const selected = useMemo(
    () => (selectedId ? (list.data?.find((r) => r.id === selectedId) ?? null) : null),
    [list.data, selectedId],
  );

  // Focus filter on `/`
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        filterRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = useMemo(() => {
    const items = list.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.redirect_from.toLowerCase().includes(q) ||
        r.redirect_to.toLowerCase().includes(q),
    );
  }, [list.data, filter]);

  const total = list.data?.length ?? 0;
  const showing = filtered.length;
  const isFiltered = filter.trim().length > 0;

  function exportCsv() {
    const rows = filtered;
    if (rows.length === 0) return;
    const header = [
      "id",
      "brand_id",
      "redirect_from",
      "redirect_to",
      "redirect_status",
      "created_at",
      "updated_at",
    ];
    const escape = (v: string | null | undefined): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.id,
          r.brand_id,
          r.redirect_from,
          r.redirect_to,
          r.redirect_status,
          r.created_at,
          r.updated_at,
        ]
          .map(escape)
          .join(","),
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const suffix = isFiltered ? "filtered" : "all";
    const a = document.createElement("a");
    a.href = url;
    a.download = `redirects-${stamp}-${suffix}-${rows.length}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-4">
      {/* command bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-4" />
          <Input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by id, from, or to…"
            mono
            className="pl-8 pr-12 h-9"
          />
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            <Kbd>/</Kbd>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-[12px] text-fg-3 tabular">
            {list.isLoading ? (
              "Loading…"
            ) : (
              <>
                <span className="text-fg font-medium">{showing.toLocaleString()}</span>
                {showing !== total && <span className="text-fg-4"> / {total.toLocaleString()}</span>}
                <span className="text-fg-4"> rules</span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportCsv}
            disabled={showing === 0}
            title={isFiltered ? `Export ${showing} filtered rules to CSV` : `Export all ${showing} rules to CSV`}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => list.refetch()}
            disabled={list.isFetching}
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", list.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {list.isError && !isSessionExpired(list.error) && (
        <div className="rounded-[8px] border border-danger/40 bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger break-all">
          {(list.error as Error).message}
        </div>
      )}

      {/* table */}
      <div className="rounded-[8px] border border-line bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] tabular">
            <thead>
              <tr className="border-b border-line text-left">
                {healthEnabled && <th className="pl-3 pr-1 py-2 w-6" aria-label="Health" />}
                <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.1em] text-fg-4 w-[220px]">
                  ID
                </th>
                <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.1em] text-fg-4">
                  From
                </th>
                <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.1em] text-fg-4 w-8" />
                <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.1em] text-fg-4">
                  To
                </th>
                <th className="px-3 py-2 font-medium text-[10.5px] uppercase tracking-[0.1em] text-fg-4 w-[60px] text-right">
                  Code
                </th>
                <th className="px-3 py-2 w-9" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => {
                    setSelectedId(r.id);
                    setSheetOpen(true);
                  }}
                  className={cn(
                    "border-b border-line last:border-b-0 cursor-pointer group",
                    "hover:bg-surface-2 transition-colors",
                  )}
                >
                  {healthEnabled && (
                    <td className="pl-3 pr-1 py-2">
                      <HealthDot
                        status={r.health_status}
                        statusCode={r.health_status_code}
                        checkedAt={r.health_checked_at}
                        error={r.health_error}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 font-mono text-[11.5px] text-fg-3 truncate max-w-[220px]">
                    {r.id}
                  </td>
                  <td className="px-3 py-2 font-mono text-fg-2 truncate max-w-[280px]">
                    {r.redirect_from}
                  </td>
                  <td className="px-1 py-2 text-fg-4">
                    <ArrowRight className="h-3 w-3" />
                  </td>
                  <td className="px-3 py-2 font-mono text-fg-2 truncate max-w-[280px]">
                    {r.redirect_to}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-fg-3">
                    {r.redirect_status}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmError(null);
                        setConfirm(r);
                      }}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-[4px] text-fg-4",
                        "opacity-0 group-hover:opacity-100",
                        "hover:bg-danger/15 hover:text-danger transition-[opacity,background,color]",
                      )}
                      aria-label="Delete rule"
                      title="Delete rule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!list.isLoading && filtered.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={Inbox}
              title={total === 0 ? "No redirects yet" : "No matches"}
              description={
                total === 0
                  ? "Create a redirect or wait for the next sync to pull rules from Zendesk."
                  : `Nothing matches "${filter}". Try a different query.`
              }
            />
          </div>
        )}
      </div>

      {/* detail sheet */}
      <RuleDetailSheet
        rule={selected}
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setSelectedId(null);
        }}
        publicHost={PUBLIC_HOST}
        healthEnabled={healthEnabled}
        onRequestDelete={() => {
          if (selected) {
            setConfirmError(null);
            setConfirm(selected);
          }
        }}
      />

      {/* confirm dialog */}
      {confirm && (
        <ConfirmDeleteDialog
          open={!!confirm}
          onOpenChange={(o) => {
            if (!o) {
              setConfirm(null);
              setConfirmError(null);
            }
          }}
          ruleId={confirm.id}
          redirectFrom={confirm.redirect_from}
          redirectTo={confirm.redirect_to}
          pending={remove.isPending}
          error={confirmError}
          onConfirm={() => remove.mutateAsync(confirm.id)}
        />
      )}
    </div>
  );
}
