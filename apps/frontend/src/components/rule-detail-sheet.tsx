"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Trash2, Check, RefreshCw, AlertCircle } from "lucide-react";
import type { HealthStatus, Redirect } from "@redirector/shared";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { HealthDot } from "@/components/ui/health-dot";
import { api, isSessionExpired } from "@/lib/api";
import { useAccessToken } from "@/lib/session-context";

interface Props {
  rule: Redirect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestDelete: () => void;
  publicHost?: string;
  healthEnabled: boolean;
}

const HEALTH_LABEL: Record<HealthStatus, string> = {
  green: "Healthy",
  red: "Broken",
  yellow: "Suspicious",
};

function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      className="grid h-6 w-6 place-items-center rounded-[4px] text-fg-4 hover:bg-surface-2 hover:text-fg-2 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function Field({
  label,
  value,
  copy,
  children,
}: {
  label: string;
  value?: string | null;
  copy?: boolean;
  children?: ReactNode;
}) {
  const showCopy = copy && value !== null && value !== undefined && value !== "";
  return (
    <div className="grid grid-cols-[120px_1fr_28px] items-start gap-3 py-2.5 border-b border-line last:border-b-0">
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-fg-4 font-medium pt-1">
        {label}
      </div>
      <div className="min-w-0 pt-0.5">
        {children ?? <Code className="text-[12.5px]">{value ?? "—"}</Code>}
      </div>
      <div className="pt-0.5 flex justify-end">
        {showCopy && <CopyButton value={value as string} />}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-1">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-fg-3 font-semibold">
        {title}
      </div>
      {action}
    </div>
  );
}

export function RuleDetailSheet({
  rule,
  open,
  onOpenChange,
  onRequestDelete,
  publicHost,
  healthEnabled,
}: Props) {
  const token = useAccessToken();
  const qc = useQueryClient();
  const recheck = useMutation({
    mutationFn: (id: string) => api.recheckRedirect(id, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["redirects"] });
    },
  });

  if (!rule) return null;
  const fromUrl = publicHost ? `${publicHost}${rule.redirect_from}` : null;
  const toUrl = publicHost ? `${publicHost}${rule.redirect_to}` : null;

  const checkedRel = formatRelative(rule.health_checked_at);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-fg-4 font-semibold mb-1">
            Redirect rule
          </div>
          <SheetTitle asChild>
            <div className="font-mono text-[13px] text-fg break-all">{rule.id}</div>
          </SheetTitle>
        </SheetHeader>

        <SheetBody>
          {/* Rule */}
          <section className="mb-7">
            <SectionHeader title="Rule" />
            <Field label="Code" value={`HTTP ${rule.redirect_status}`} />
            <Field label="From" value={rule.redirect_from} copy />
            <Field label="To" value={rule.redirect_to} copy />
            <Field label="Brand ID" value={rule.brand_id} copy />
          </section>

          {/* Health */}
          {healthEnabled && (
            <section className="mb-7">
              <SectionHeader
                title="Health"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => recheck.mutate(rule.id)}
                    disabled={recheck.isPending}
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${recheck.isPending ? "animate-spin" : ""}`}
                    />
                    {recheck.isPending ? "Checking…" : "Recheck"}
                  </Button>
                }
              />
              <Field label="Status">
                <div className="flex items-center gap-2 text-[12.5px] text-fg-2">
                  <HealthDot
                    status={rule.health_status}
                    statusCode={rule.health_status_code}
                    checkedAt={rule.health_checked_at}
                    error={rule.health_error}
                  />
                  <span>
                    {rule.health_status ? HEALTH_LABEL[rule.health_status] : "Not checked yet"}
                  </span>
                </div>
              </Field>
              <Field
                label="HTTP code"
                value={
                  rule.health_status_code !== null ? String(rule.health_status_code) : null
                }
              />
              <Field label="Last checked">
                {rule.health_checked_at ? (
                  <div className="flex flex-col gap-0.5">
                    <Code className="text-[12px]">{rule.health_checked_at}</Code>
                    {checkedRel && (
                      <span className="text-[11px] text-fg-4">{checkedRel}</span>
                    )}
                  </div>
                ) : (
                  <Code className="text-[12.5px]">—</Code>
                )}
              </Field>
              {rule.health_error && (
                <Field label="Error">
                  <Code className="text-[12px] text-danger break-all">
                    {rule.health_error}
                  </Code>
                </Field>
              )}
              {recheck.isError && !isSessionExpired(recheck.error) && (
                <div className="mt-3 flex items-start gap-2 rounded-[6px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span className="break-all">{(recheck.error as Error).message}</span>
                </div>
              )}
            </section>
          )}

          {/* Open in browser */}
          {publicHost && (fromUrl || toUrl) && (
            <section className="mb-7">
              <SectionHeader title="Open in browser" />
              <div className="space-y-1.5 pt-2">
                {fromUrl && <ExternalLinkRow href={fromUrl} />}
                {toUrl && <ExternalLinkRow href={toUrl} />}
              </div>
            </section>
          )}

          {/* Timestamps */}
          <section className="mb-7">
            <SectionHeader title="Timestamps" />
            <Field label="Created" value={rule.created_at} />
            <Field label="Updated" value={rule.updated_at} />
            <Field label="Synced" value={rule.synced_at} />
            <Field label="Source" value={rule.source} />
          </section>
        </SheetBody>

        <SheetFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="danger-outline" size="sm" onClick={onRequestDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete rule
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ExternalLinkRow({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-[12px] font-mono text-fg-2 hover:bg-surface-2 hover:border-line-strong transition-colors"
    >
      <ExternalLink className="h-3 w-3 text-fg-4 shrink-0" />
      <span className="truncate">{href}</span>
    </a>
  );
}
