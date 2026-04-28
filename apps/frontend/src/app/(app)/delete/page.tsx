"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Redirect } from "@redirector/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { api, isSessionExpired } from "@/lib/api";
import { useAccessToken } from "@/lib/session-context";

export default function DeleteByIdPage() {
  const token = useAccessToken();
  const qc = useQueryClient();
  const [id, setId] = useState("");
  const [rule, setRule] = useState<Redirect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<Redirect | null>(null);

  const search = useMutation({
    mutationFn: (ruleId: string) => api.getRedirect(ruleId, token),
    onSuccess: (data) => {
      setRule(data);
      setError(null);
      setDeleted(null);
    },
    onError: (err) => {
      if (isSessionExpired(err)) return;
      setRule(null);
      setError((err as Error).message);
    },
  });

  const remove = useMutation({
    mutationFn: (ruleId: string) => api.deleteRedirect(ruleId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["redirects"] });
      setConfirmOpen(false);
      setConfirmError(null);
      setDeleted(rule);
      setRule(null);
      setId("");
    },
    onError: (err) => {
      if (isSessionExpired(err)) return;
      setConfirmError((err as Error).message);
    },
  });

  return (
    <div className="space-y-1">
      <PageHeader
        eyebrow="Manage"
        title="Delete by ID"
        description="Look up a rule by its Zendesk ID and remove it. Requires a re-typed ID confirmation."
      />

      <div className="max-w-xl space-y-6">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (id.trim()) search.mutate(id.trim());
          }}
        >
          <Label htmlFor="rule-id">Rule ID</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-4" />
              <Input
                id="rule-id"
                mono
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="01KQ6X3R7Z6C14DKGM75DN6A51"
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={search.isPending || !id.trim()}>
              {search.isPending ? "Looking up…" : "Find rule"}
            </Button>
          </div>
        </form>

        {error && (
          <div className="flex items-start gap-2 rounded-[6px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {rule && (
          <div className="rounded-[8px] border border-line bg-surface p-4">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-fg-4 font-semibold mb-3">
              Found
            </div>
            <div className="space-y-2.5 mb-4">
              <div className="grid grid-cols-[60px_1fr] items-baseline gap-3 text-[12.5px]">
                <span className="text-fg-4 uppercase tracking-[0.08em] text-[10.5px] font-medium">id</span>
                <code className="font-mono text-fg break-all">{rule.id}</code>
              </div>
              <div className="grid grid-cols-[60px_1fr] items-center gap-3 text-[12.5px]">
                <span className="text-fg-4 uppercase tracking-[0.08em] text-[10.5px] font-medium">code</span>
                <code className="font-mono text-fg-2">{rule.redirect_status}</code>
              </div>
              <div className="grid grid-cols-[60px_1fr] items-baseline gap-3 text-[12.5px]">
                <span className="text-fg-4 uppercase tracking-[0.08em] text-[10.5px] font-medium">from</span>
                <code className="font-mono text-fg-2 break-all">{rule.redirect_from}</code>
              </div>
              <div className="flex justify-center text-fg-4">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
              <div className="grid grid-cols-[60px_1fr] items-baseline gap-3 text-[12.5px]">
                <span className="text-fg-4 uppercase tracking-[0.08em] text-[10.5px] font-medium">to</span>
                <code className="font-mono text-fg-2 break-all">{rule.redirect_to}</code>
              </div>
            </div>
            <Button variant="danger-outline" onClick={() => setConfirmOpen(true)}>
              Delete this rule
            </Button>
          </div>
        )}

        {deleted && (
          <div className="flex items-start gap-2 rounded-[6px] border border-success/40 bg-success/10 px-3 py-2 text-[12.5px] text-success">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">Deleted</div>
              <div className="font-mono text-fg-2 break-all mt-0.5">{deleted.id}</div>
            </div>
          </div>
        )}
      </div>

      {rule && (
        <ConfirmDeleteDialog
          open={confirmOpen}
          onOpenChange={(o) => {
            setConfirmOpen(o);
            if (!o) setConfirmError(null);
          }}
          ruleId={rule.id}
          redirectFrom={rule.redirect_from}
          redirectTo={rule.redirect_to}
          pending={remove.isPending}
          error={confirmError}
          onConfirm={() => remove.mutateAsync(rule.id)}
        />
      )}
    </div>
  );
}
