import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { BasicAuth } from "./basic.js";
import type { KeycloakVerifier } from "./keycloak.js";
import "./types.js";

export interface UnifiedAuthOptions {
  basic: BasicAuth | null;
  keycloak: KeycloakVerifier | null;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

const unifiedAuthPlugin: FastifyPluginAsync<UnifiedAuthOptions> = async (app, opts) => {
  const { basic, keycloak } = opts;

  app.decorate("authenticate", async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.toLowerCase().startsWith("bearer ")) {
      throw Object.assign(new Error("missing bearer token"), { statusCode: 401 });
    }
    const token = header.slice(7).trim();

    const payload = decodeJwtPayload(token);
    const via = (payload?.["via"] ?? "") as string;

    try {
      if (via === "basic") {
        if (!basic) throw new Error("basic auth disabled");
        req.user = await basic.verifyToken(token);
        return;
      }
      // anything else (incl. Keycloak access tokens which have no `via`) → Keycloak
      if (!keycloak) throw new Error("keycloak auth disabled");
      req.user = await keycloak.verify(token);
    } catch (err) {
      app.log.debug({ err: (err as Error).message }, "auth failed");
      throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
    }
  });
};

export default fp(unifiedAuthPlugin, { name: "unified-auth" });
