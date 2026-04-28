import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { BasicAuth } from "../auth/basic.js";

interface Deps {
  basic: BasicAuth | null;
  keycloakEnabled: boolean;
}

const LoginSchema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(512),
});

export const authRoutes: FastifyPluginAsync<Deps> = async (app, { basic, keycloakEnabled }) => {
  app.get("/auth/config", async () => ({
    basic_enabled: basic !== null,
    keycloak_enabled: keycloakEnabled,
  }));

  if (!basic) return;

  app.post(
    "/auth/basic/login",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_input" });
      }
      const { username, password } = parsed.data;
      if (!basic.verifyCredentials(username, password)) {
        // Generic message; do not leak which field is wrong.
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      const { token, expiresAt } = await basic.issueToken(username);
      return {
        token,
        expires_at: expiresAt,
        user: { sub: `basic:${username}`, name: username, via: "basic" },
      };
    },
  );
};
