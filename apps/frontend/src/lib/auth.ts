import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Keycloak from "next-auth/providers/keycloak";
import { internalApiUrl, isBasicEnabled, isKeycloakEnabled } from "./auth-flags";

// Module augmentations live in `src/types/next-auth.d.ts`.

const providers: Provider[] = [];

if (isKeycloakEnabled()) {
  providers.push(
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  );
}

if (isBasicEnabled()) {
  providers.push(
    Credentials({
      id: "basic",
      name: "Username & password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = String(credentials?.username ?? "");
        const password = String(credentials?.password ?? "");
        if (!username || !password) return null;

        const res = await fetch(`${internalApiUrl()}/api/auth/basic/login`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ username, password }),
          cache: "no-store",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          token: string;
          user: { sub: string; name: string; via: "basic" };
        };
        return {
          id: data.user.sub,
          name: data.user.name,
          accessToken: data.token,
          via: "basic",
        };
      },
    }),
  );
}

interface KeycloakRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function refreshKeycloakToken(refreshToken: string): Promise<KeycloakRefreshResponse> {
  const issuer = process.env.KEYCLOAK_ISSUER!.replace(/\/$/, "");
  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.KEYCLOAK_CLIENT_ID!,
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`refresh failed: HTTP ${res.status}`);
  return (await res.json()) as KeycloakRefreshResponse;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial OAuth sign-in (Keycloak). `account.access_token` is the marker.
      if (account && account.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? undefined;
        token.expiresAt = account.expires_at ?? undefined;
        token.via = "keycloak";
        token.error = undefined;
        return token;
      }

      // Initial Credentials sign-in (basic). `user` carries our HS256 token.
      if (user?.accessToken) {
        token.accessToken = user.accessToken;
        token.via = user.via ?? "basic";
        token.error = undefined;
        return token;
      }

      // Subsequent calls: refresh Keycloak access_token if it's near expiry.
      if (
        token.via === "keycloak" &&
        token.refreshToken &&
        token.expiresAt &&
        Date.now() / 1000 > token.expiresAt - 30
      ) {
        try {
          const refreshed = await refreshKeycloakToken(token.refreshToken);
          token.accessToken = refreshed.access_token;
          if (refreshed.refresh_token) token.refreshToken = refreshed.refresh_token;
          token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
          token.error = undefined;
        } catch {
          token.error = "RefreshAccessTokenError";
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.accessToken) session.accessToken = token.accessToken;
      if (token.via) session.via = token.via;
      if (token.error) session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
