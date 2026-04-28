// Module augmentation file. Must be a module (top-level import/export) so that
// the `declare module` blocks below are treated as augmentations of existing
// types rather than fresh module declarations.

import type {} from "next-auth";
import type {} from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    via?: "basic" | "keycloak";
    error?: string;
  }
  interface User {
    accessToken?: string;
    via?: "basic" | "keycloak";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    via?: "basic" | "keycloak";
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }
}
