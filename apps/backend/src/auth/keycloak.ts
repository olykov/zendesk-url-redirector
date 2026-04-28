import { createVerify } from "node:crypto";
import jwksClient from "jwks-rsa";
import type { FastifyBaseLogger } from "fastify";
import type { AuthenticatedUser } from "./types.js";

interface JwtHeader {
  kid?: string;
  alg?: string;
}

interface JwtPayload {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  preferred_username?: string;
  email?: string;
  sub?: string;
  name?: string;
}

export interface KeycloakOptions {
  issuer: string;
  audience: string;
}

export class KeycloakVerifier {
  private readonly jwks;

  constructor(
    private readonly opts: KeycloakOptions,
    private readonly log: FastifyBaseLogger,
  ) {
    this.jwks = jwksClient({
      jwksUri: `${opts.issuer.replace(/\/$/, "")}/protocol/openid-connect/certs`,
      cache: true,
      rateLimit: true,
    });
  }

  private async getKey(kid: string): Promise<string> {
    const key = await this.jwks.getSigningKey(kid);
    return key.getPublicKey();
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("malformed token");
    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8")) as JwtHeader;
    if (!header.kid) throw new Error("missing kid");
    const publicKey = await this.getKey(header.kid);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    if (!verifier.verify(publicKey, signatureB64, "base64url")) {
      throw new Error("bad signature");
    }

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as JwtPayload;
    if (payload.iss !== this.opts.issuer) throw new Error(`bad issuer: ${payload.iss}`);
    if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error("token expired");

    const aud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    if (this.opts.audience && !aud.includes(this.opts.audience)) {
      this.log.debug(
        { aud, expected: this.opts.audience },
        "audience claim missing/mismatched (tolerated)",
      );
    }

    return {
      sub: payload.sub ?? "",
      name: payload.name ?? payload.preferred_username,
      email: payload.email,
      via: "keycloak",
    };
  }
}
