export interface AuthenticatedUser {
  sub: string;
  name?: string;
  email?: string;
  via: "basic" | "keycloak";
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export {};
