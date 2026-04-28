# syntax=docker/dockerfile:1.7

# ---- base ----
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile

# ---- source ----
FROM deps AS source
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/backend apps/backend

# ---- runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable

# Pull in the full workspace (sources + node_modules). Backend runs via tsx,
# so no build/transpile step is required inside the image.
COPY --from=source /repo /app

EXPOSE 4000
WORKDIR /app/apps/backend
CMD ["pnpm", "exec", "node", "--import", "tsx", "./src/server.ts"]
