import { randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { AppConfig } from "../config.js";
import type { AuthenticatedUser } from "./types.js";

const ALG = "HS256";
const TOKEN_TTL_SECONDS = 12 * 60 * 60;
const ISSUER = "redirector/basic";

function constantTimeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still do a compare to keep timing roughly constant.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export class BasicAuth {
  private readonly secret: Uint8Array;

  constructor(private readonly cfg: AppConfig) {
    const raw =
      cfg.BASIC_AUTH_JWT_SECRET ??
      cfg.AUTH_SECRET ??
      randomBytes(32).toString("base64url");
    this.secret = new TextEncoder().encode(raw);
  }

  verifyCredentials(username: string, password: string): boolean {
    return (
      constantTimeStringEqual(username, this.cfg.BASIC_AUTH_USERNAME) &&
      constantTimeStringEqual(password, this.cfg.BASIC_AUTH_PASSWORD)
    );
  }

  async issueToken(username: string): Promise<{ token: string; expiresAt: number }> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + TOKEN_TTL_SECONDS;
    const token = await new SignJWT({ via: "basic", name: username })
      .setProtectedHeader({ alg: ALG })
      .setIssuer(ISSUER)
      .setSubject(`basic:${username}`)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(this.secret);
    return { token, expiresAt: exp };
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    const { payload } = await jwtVerify(token, this.secret, {
      issuer: ISSUER,
      algorithms: [ALG],
    });
    if ((payload as JWTPayload & { via?: string }).via !== "basic") {
      throw new Error("not a basic-auth token");
    }
    return {
      sub: payload.sub ?? "basic:unknown",
      name: (payload as JWTPayload & { name?: string }).name,
      via: "basic",
    };
  }
}
