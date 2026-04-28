"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BasicForm({ callbackUrl }: { callbackUrl: string }) {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams?.get("error") === "CredentialsSignin" ? "Wrong username or password." : null,
  );
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn("basic", {
        username,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError("Wrong username or password.");
        return;
      }
      // Full reload so the (app)/layout server component re-runs `auth()` with
      // the freshly-set session cookie. router.push + router.refresh isn't reliable.
      window.location.assign(callbackUrl);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-[6px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
