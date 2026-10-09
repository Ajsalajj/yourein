import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appSecret } from "./auth";

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const mac = (v: string) => createHmac("sha256", appSecret()).update(v).digest("base64url");

/** A signed value carrying where to return after Google. */
export function makeState(next: string) {
  const payload = Buffer.from(JSON.stringify({ n: next, r: randomBytes(12).toString("hex"), t: Date.now() })).toString("base64url");
  return `${payload}.${mac(payload)}`;
}

export function readState(state: string | null, cookieState: string | undefined): string | null {
  if (!state || !cookieState || state !== cookieState) return null;
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(mac(payload)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { n, t } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Date.now() - t < 10 * 60_000 ? String(n) : null;
  } catch {
    return null;
  }
}

export function googleAuthUrl(origin: string, state: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function googleProfile(origin: string, code: string): Promise<{ sub: string; email: string; name: string } | null> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return null;
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return null;
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!info.sub || !info.email || info.email_verified === false) return null;
  return { sub: info.sub, email: info.email, name: info.name || "" };
}
