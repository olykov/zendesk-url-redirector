import type {
  BatchApplyResponse,
  BatchItemInput,
  BatchPreviewResponse,
  CreateRedirectInput,
  Redirect,
  Settings,
  SyncRunResult,
} from "@redirector/shared";

// All API calls are relative — Next.js rewrites (next.config.ts) proxy
// `/api/*` to the backend over the internal network. The browser only ever
// talks to the frontend origin.
const BASE = "";

/**
 * Thrown when a request returns 401. Components can detect by `name` and avoid
 * rendering a red error banner — the API client has already kicked off a sign-out
 * + redirect, so the page is unmounting within ~100-300ms anyway.
 */
export class SessionExpiredError extends Error {
  override name = "SessionExpiredError";
  constructor() {
    super("Session expired");
  }
}

// Module-level guard so a burst of 401s (e.g. table + settings firing in parallel)
// triggers signOut exactly once instead of racing.
let signingOut = false;

async function handleUnauthorized(): Promise<void> {
  if (signingOut || typeof window === "undefined") return;
  signingOut = true;
  const here = `${window.location.pathname}${window.location.search}`;
  const callbackUrl = `/login?reason=expired&callbackUrl=${encodeURIComponent(here)}`;
  try {
    const { signOut } = await import("next-auth/react");
    await signOut({ callbackUrl, redirect: true });
  } catch {
    // Fallback: hard-navigate if the next-auth client throws for any reason.
    window.location.assign(callbackUrl);
  }
}

async function call<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Accept", "application/json");
  if (rest.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...rest, headers, cache: "no-store" });

  if (res.status === 401) {
    void handleUnauthorized();
    throw new SessionExpiredError();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listRedirects: (token?: string) => call<Redirect[]>("/api/redirects", { token }),
  getRedirect: (id: string, token?: string) =>
    call<Redirect>(`/api/redirects/${encodeURIComponent(id)}`, { token }),
  createRedirect: (input: CreateRedirectInput, token?: string) =>
    call<Redirect>("/api/redirects", { method: "POST", body: JSON.stringify(input), token }),
  deleteRedirect: (id: string, token?: string) =>
    call<void>(`/api/redirects/${encodeURIComponent(id)}`, { method: "DELETE", token }),
  getSettings: (token?: string) => call<Settings>("/api/settings", { token }),
  updateSettings: (
    input: { sync_interval_seconds?: number; health_interval_seconds?: number },
    token?: string,
  ) =>
    call<Settings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(input),
      token,
    }),
  triggerSync: (token?: string) =>
    call<SyncRunResult | { skipped: true; reason: string }>("/api/sync/run", {
      method: "POST",
      token,
    }),
  triggerHealth: (token?: string) =>
    call<
      | import("@redirector/shared").HealthSummary
      | { skipped: true; reason: string }
    >("/api/health/run", { method: "POST", token }),
  recheckRedirect: (id: string, token?: string) =>
    call<Redirect>(`/api/redirects/${encodeURIComponent(id)}/recheck`, {
      method: "POST",
      token,
    }),
  batchPreview: (items: BatchItemInput[], token?: string) =>
    call<BatchPreviewResponse>("/api/redirects/batch/preview", {
      method: "POST",
      body: JSON.stringify({ items }),
      token,
    }),
  batchApply: (items: BatchItemInput[], token?: string, throttleMs = 50) =>
    call<BatchApplyResponse>("/api/redirects/batch/apply", {
      method: "POST",
      body: JSON.stringify({ items, throttle_ms: throttleMs }),
      token,
    }),
};

export function isSessionExpired(err: unknown): boolean {
  return err instanceof Error && err.name === "SessionExpiredError";
}
