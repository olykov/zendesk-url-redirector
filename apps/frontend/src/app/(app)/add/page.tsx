"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import {
  CreateRedirectInputSchema,
  type CreateRedirectInput,
  type Redirect,
} from "@redirector/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Code } from "@/components/ui/code";
import { api, isSessionExpired } from "@/lib/api";
import { useAccessToken } from "@/lib/session-context";

export default function AddPage() {
  const token = useAccessToken();
  const qc = useQueryClient();
  const [created, setCreated] = useState<Redirect | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<CreateRedirectInput>({
    resolver: zodResolver(CreateRedirectInputSchema),
    defaultValues: { redirect_status: "301", redirect_from: "", redirect_to: "" },
  });

  const create = useMutation({
    mutationFn: (input: CreateRedirectInput) => api.createRedirect(input, token),
    onSuccess: (rule) => {
      setCreated(rule);
      setErrorMsg(null);
      form.reset({ redirect_status: "301", redirect_from: "", redirect_to: "" });
      qc.invalidateQueries({ queryKey: ["redirects"] });
    },
    onError: (err) => {
      if (isSessionExpired(err)) return;
      setErrorMsg((err as Error).message);
      setCreated(null);
    },
  });

  return (
    <div className="space-y-1">
      <PageHeader
        eyebrow="Manage"
        title="New redirect"
        description="Create a Guide redirect rule. Paths or full URLs are accepted; full URLs are normalized to paths."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
        >
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              mono
              placeholder="/knowledge-base/articles/example"
              autoFocus
              {...form.register("redirect_from")}
            />
            {form.formState.errors.redirect_from && (
              <p className="text-[12px] text-danger">{form.formState.errors.redirect_from.message}</p>
            )}
          </div>

          <div className="flex justify-center text-fg-4">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              mono
              placeholder="/hc/en-us/articles/123-Example"
              {...form.register("redirect_to")}
            />
            {form.formState.errors.redirect_to && (
              <p className="text-[12px] text-danger">{form.formState.errors.redirect_to.message}</p>
            )}
          </div>

          <div className="space-y-2 max-w-[160px]">
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...form.register("redirect_status")}>
              <option value="301">301 — permanent</option>
              <option value="302">302 — temporary</option>
            </Select>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-[6px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="break-all">{errorMsg}</span>
            </div>
          )}

          {created && (
            <div className="flex items-start gap-2 rounded-[6px] border border-success/40 bg-success/10 px-3 py-2 text-[12.5px] text-success">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">Created</div>
                <div className="font-mono text-fg-2 break-all mt-0.5">{created.id}</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" variant="primary" size="lg" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create redirect"}
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/redirects">Cancel</Link>
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-[8px] border border-line bg-surface p-4">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-fg-4 font-semibold mb-2">
              Tips
            </div>
            <ul className="space-y-2 text-[12.5px] text-fg-3 leading-relaxed">
              <li>
                Full URLs are accepted (e.g. <Code>https://your-help-center/...</Code>)
                — only the path is stored.
              </li>
              <li>Source path must be unique. Zendesk rejects duplicates with 422.</li>
              <li>
                Rules apply on the Help Center host. Zendesk may take a few seconds
                to propagate.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
