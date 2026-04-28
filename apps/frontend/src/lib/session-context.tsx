"use client";

import { createContext, useContext, type ReactNode } from "react";

interface SessionTokenContext {
  accessToken: string | null;
  via: "basic" | "keycloak" | null;
}

const Ctx = createContext<SessionTokenContext>({ accessToken: null, via: null });

export function SessionTokenProvider({
  accessToken,
  via,
  children,
}: {
  accessToken: string | null;
  via?: "basic" | "keycloak" | null;
  children: ReactNode;
}) {
  return <Ctx.Provider value={{ accessToken, via: via ?? null }}>{children}</Ctx.Provider>;
}

export function useAccessToken(): string | undefined {
  return useContext(Ctx).accessToken ?? undefined;
}

export function useAuthVia(): "basic" | "keycloak" | null {
  return useContext(Ctx).via;
}
