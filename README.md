# Zendesk URL Redirector

Self-hosted UI to manage Zendesk Guide redirect rules: list, search, add (single or batch CSV), delete, export. A background daemon keeps a local mirror of Zendesk's rules in sync. Runs out of the box with a single command and `admin/redirector` credentials.

## Stack

- **Monorepo:** pnpm workspaces, Node.js 22, TypeScript
- **Backend:** Fastify 5, Drizzle ORM, node-cron, pino
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind v4, shadcn-style UI, TanStack Query
- **Auth:** built-in basic-auth (single admin) + optional Keycloak via NextAuth (Auth.js v5)
- **Validation:** Zod (shared between back/front via `@redirector/shared`)

## Layout

```
zendesk-redirector/
├── apps/
│   ├── backend/         # Fastify API + sync daemon
│   └── frontend/        # Next.js UI
├── packages/
│   └── shared/          # Shared zod schemas / types
└── docker-compose.yml
```

## Quick start

```bash
cp .env.example .env
# fill ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN, NEXTAUTH_SECRET
pnpm install
pnpm dev
```

Open <http://localhost:3000>, sign in as `admin` / `redirector`.

## Authentication

The app supports two providers and runs in three modes:

| Mode | When | Behavior |
|------|------|----------|
| **basic-only** *(default)* | Keycloak vars empty | Username/password form only |
| **keycloak-only** | `BASIC_AUTH_ENABLED=false` + all `KEYCLOAK_*` set | "Continue with Keycloak" button only |
| **dual** | `BASIC_AUTH_ENABLED=true` + all `KEYCLOAK_*` set | Both options on the login page |

Backend fails to start if neither method is enabled.

### Basic auth (default)

A single admin account configured via env. The default `admin/redirector` is for first-run convenience — **change `BASIC_AUTH_PASSWORD` before exposing the app to a network**, or disable basic auth and use Keycloak. Login attempts are rate-limited to 5/minute/IP.

For multi-user / SSO, use Keycloak.

### Keycloak

Set all four env vars together: `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_AUDIENCE`. Configure the client in Keycloak with redirect URI `http://localhost:3000/api/auth/callback/keycloak` (replace host for production).

## Pages

- `/redirects` — table of all rules from local mirror, click a row for details, inline filter, CSV export.
- `/add` — create a new rule.
- `/upload` — batch CSV upload wizard: upload → map columns → validate → review (server-side dedupe) → apply.
- `/delete` — delete by id with re-typed-id confirmation.
- `/settings` — sync interval, last sync status, manual "Sync now".

## Sync daemon

A `node-cron` job inside the backend process fetches all redirect rules from Zendesk Guide (`GET /api/v2/guide/redirect_rules`, cursor pagination), upserts into the local store by `id`, and removes locally any that disappeared upstream. Interval is read from the `settings` table; changing it through the UI re-schedules the job at runtime.
