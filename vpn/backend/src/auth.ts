import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Config } from "./config.js";
import { unauthorized } from "./errors.js";

export interface Principal {
  userId: string;
  email: string;
  /** Set only via Supabase app_metadata (service role), never by users. */
  role: "user" | "admin";
  /** Authentication assurance level: aal2 = MFA completed. */
  aal: string;
}

export type Verifier = (bearer: string) => Promise<Principal>;

interface SupabaseClaims extends JWTPayload {
  email?: string;
  aal?: string;
  role?: string;
  app_metadata?: { orvane_role?: string };
}

/**
 * Verifies Supabase-issued access tokens.
 *
 * Projects using asymmetric signing keys are verified against the
 * project's JWKS; projects on the legacy shared secret use HS256.
 * Issuer and audience are always checked.
 */
export function supabaseVerifier(config: Pick<Config, "SUPABASE_URL" | "SUPABASE_JWT_SECRET">): Verifier {
  const issuer = `${config.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;
  const key = config.SUPABASE_JWT_SECRET
    ? new TextEncoder().encode(config.SUPABASE_JWT_SECRET)
    : createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { cacheMaxAge: 10 * 60_000 });

  return async (token) => {
    let payload: SupabaseClaims;
    try {
      const res = await jwtVerify<SupabaseClaims>(token, key as never, {
        issuer,
        audience: "authenticated",
        algorithms: config.SUPABASE_JWT_SECRET ? ["HS256"] : ["RS256", "ES256"],
        clockTolerance: 5,
      });
      payload = res.payload;
    } catch {
      throw unauthorized();
    }
    if (!payload.sub || payload.role !== "authenticated") throw unauthorized();
    return {
      userId: payload.sub,
      email: payload.email ?? "",
      role: payload.app_metadata?.orvane_role === "admin" ? "admin" : "user",
      aal: payload.aal ?? "aal1",
    };
  };
}

export function bearerFrom(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return m?.[1] ?? null;
}
