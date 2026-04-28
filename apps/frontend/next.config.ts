import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(here, "..", "..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@redirector/shared"],
  async rewrites() {
    // Resolve at request time so the value reflects the runtime env, not the
    // env at build time (which is empty inside Docker until the container starts).
    const internalApi = process.env.INTERNAL_API_URL ?? "http://localhost:4000";
    return [
      // NextAuth handles `/api/auth/*` itself (App Router route).
      // Everything else under `/api/*` is proxied to the backend.
      { source: "/api/redirects/:path*", destination: `${internalApi}/api/redirects/:path*` },
      { source: "/api/redirects", destination: `${internalApi}/api/redirects` },
      { source: "/api/settings", destination: `${internalApi}/api/settings` },
      { source: "/api/sync/:path*", destination: `${internalApi}/api/sync/:path*` },
      { source: "/api/health/:path*", destination: `${internalApi}/api/health/:path*` },
    ];
  },
};

export default nextConfig;
