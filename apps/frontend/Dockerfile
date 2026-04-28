# syntax=docker/dockerfile:1.7

# ---- base ----
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/frontend apps/frontend

# NEXT_PUBLIC_* are inlined into the JS bundle at build time. Pass them via
# `--build-arg` (compose does this from .env).
ARG NEXT_PUBLIC_HELP_CENTER_URL
ARG NEXT_PUBLIC_INSTANCE_LABEL
ARG NEXT_PUBLIC_OPENID_BUTTON_LABEL
# Next.js bakes the result of `rewrites()` into routes-manifest.json at build time,
# so INTERNAL_API_URL must be present during the build, not just at runtime.
ARG INTERNAL_API_URL
ENV NEXT_PUBLIC_HELP_CENTER_URL=${NEXT_PUBLIC_HELP_CENTER_URL}
ENV NEXT_PUBLIC_INSTANCE_LABEL=${NEXT_PUBLIC_INSTANCE_LABEL}
ENV NEXT_PUBLIC_OPENID_BUTTON_LABEL=${NEXT_PUBLIC_OPENID_BUTTON_LABEL}
ENV INTERNAL_API_URL=${INTERNAL_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter frontend build

# ---- runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Next.js standalone output bundles its own minimal node_modules; outputFileTracingRoot
# points at the monorepo root, so /repo paths from the build show up here as ./
COPY --from=build /repo/apps/frontend/.next/standalone ./
COPY --from=build /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /repo/apps/frontend/public ./apps/frontend/public

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]
