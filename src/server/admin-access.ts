/**
 * Who may open /admin. Pure functions (no database, no cookies), so they are easy to test.
 *
 * Two things are needed, and both are set in the environment:
 *   ADMIN_EMAILS       comma-separated emails of people who may be admins
 *   ADMIN_ACCESS_CODE  a long secret (12+ characters), typed once per session at /admin/unlock
 *
 * The code exists because signing up does not verify that someone owns their email address: an allowlist alone
 * would let anyone who registered an admin's address first walk in. Without the code they get a 404, like any unknown page.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type Env = Record<string, string | undefined>;

export const ADMIN_COOKIE = "yi_admin";
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
export const MIN_CODE_LENGTH = 12;

export function adminEmails(env: Env): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

/** Admin is switched on only when there is at least one email and a strong enough code. */
export function adminConfigured(env: Env): boolean {
  return adminEmails(env).length > 0 && (env.ADMIN_ACCESS_CODE ?? "").length >= MIN_CODE_LENGTH;
}

export function isAdminEmail(email: string | null | undefined, env: Env): boolean {
  return !!email && adminConfigured(env) && adminEmails(env).includes(email.trim().toLowerCase());
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function codeMatches(input: unknown, env: Env): boolean {
  const code = env.ADMIN_ACCESS_CODE ?? "";
  return code.length >= MIN_CODE_LENGTH && typeof input === "string" && safeEqual(input, code);
}

const mac = (secret: string, userId: string, exp: number) => createHmac("sha256", secret).update(`admin|${userId}|${exp}`).digest("hex");

/** A cookie value that proves "this user typed the access code recently". Bound to the user and signed with the app secret. */
export function makeAdminToken(secret: string, userId: string, now: number = Date.now()): string {
  const exp = now + ADMIN_SESSION_MS;
  return `${exp}.${mac(secret, userId, exp)}`;
}

export function verifyAdminToken(secret: string, token: string | undefined | null, userId: string, now: number = Date.now()): boolean {
  if (!token) return false;
  const [expText, given] = token.split(".");
  const exp = Number(expText);
  if (!given || !Number.isFinite(exp) || exp < now || exp > now + ADMIN_SESSION_MS + 60_000) return false;
  return safeEqual(mac(secret, userId, exp), given);
}
