/**
 * Server-side helpers to decide which auth providers are configured.
 *
 * These read raw env vars and must NOT be imported into client components.
 */

export function isBasicEnabled(): boolean {
  const v = (process.env.BASIC_AUTH_ENABLED ?? "true").toLowerCase();
  return v !== "false" && v !== "0" && v !== "";
}

export function isKeycloakEnabled(): boolean {
  return Boolean(
    process.env.KEYCLOAK_ISSUER &&
      process.env.KEYCLOAK_CLIENT_ID &&
      process.env.KEYCLOAK_CLIENT_SECRET &&
      process.env.KEYCLOAK_AUDIENCE,
  );
}

/**
 * Backend URL for server-side fetches (NextAuth Credentials authorize, Next.js
 * rewrites). In Docker this points to the backend container over the internal
 * network; in local dev it falls back to localhost.
 */
export function internalApiUrl(): string {
  return process.env.INTERNAL_API_URL ?? "http://localhost:4000";
}
