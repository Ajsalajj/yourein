import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql, transaction } from "./db";
import { ApiError } from "./http";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "yi_session";
const SESSION_DAYS = 30;

/** `guest` is a visitor customizing a design before signing in: no email, and only allowed to edit their own drafts. */
export type User = { id: string; email: string; name: string; hasPassword: boolean; google: boolean; guest: boolean };

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, salt, key] = stored.split("$");
  if (algo !== "scrypt" || !salt || !key) return false;
  const want = Buffer.from(key, "base64");
  const got = await scrypt(password, Buffer.from(salt, "base64"), want.length);
  return timingSafeEqual(want, got);
}

export function normalEmail(email: unknown): string {
  const e = String(email ?? "").trim().toLowerCase();
  if (e.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new ApiError(400, "Enter a valid email address.");
  return e;
}

export function checkPassword(password: unknown): string {
  const p = String(password ?? "");
  if (p.length < 8) throw new ApiError(400, "Use at least 8 characters for your password.");
  if (p.length > 200) throw new ApiError(400, "That password is too long.");
  return p;
}

type UserRow = { id: string; email: string | null; name: string; password_hash: string | null; google_sub: string | null; guest?: boolean };
const toUser = (r: UserRow): User => ({ id: r.id, email: r.email ?? "", name: r.name, hasPassword: !!r.password_hash, google: !!r.google_sub, guest: !!r.guest });

/**
 * Signs the browser in as this user. If the browser was a guest until now,
 * the drafts it made move to this account and the guest account is removed.
 */
export async function createSession(userId: string, opts: { guest?: boolean } = {}) {
  const previous = await getUser();
  if (previous?.guest && previous.id !== userId) await claimGuest(previous.id, userId);
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sql`insert into sessions (id, user_id, token_hash, expires_at) values (${randomUUID()}, ${userId}, ${sha256(token)}, ${expires})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  /* not a secret: lets static pages show "My invitations" instead of "Sign in" */
  if (opts.guest) return;
  (await cookies()).set("yi_in", "1", { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
  jar.delete("yi_in");
}

/** The signed-in user, or null. */
export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<UserRow>`
    select u.id, u.email, u.name, u.password_hash, u.google_sub, u.guest
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`;
  return rows[0] ? toUser(rows[0]) : null;
}

/** For API routes. Guests are treated as signed out unless the route only touches their own drafts. */
export async function requireUser(opts: { allowGuest?: boolean } = {}): Promise<User> {
  const user = await getUser();
  if (!user || (user.guest && !opts.allowGuest)) throw new ApiError(401, "Please sign in to continue.", "signed-out");
  return user;
}

/** For pages: sends signed-out visitors (and guests, unless allowed) to sign in, then back to where they were going. */
export async function requireUserPage(returnTo: string, opts: { allowGuest?: boolean } = {}): Promise<User> {
  const user = await getUser();
  if (!user || (user.guest && !opts.allowGuest)) redirect(`/signin?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/* ------------------------------------------------------------------ guests */

/** A temporary account so a visitor can customize a design before signing in. */
export async function startGuest(): Promise<void> {
  /* drafts nobody came back to; guests cannot pay, so nothing published is ever removed */
  await sql`delete from users where guest and created_at < now() - interval '30 days'`;
  const id = randomUUID();
  await sql`insert into users (id, email, name, guest) values (${id}, null, '', true)`;
  await createSession(id, { guest: true });
}

/** Moves a guest's drafts and uploads to the account they signed in to, then removes the guest. */
async function claimGuest(guestId: string, userId: string) {
  await transaction(async (q) => {
    const rows = await q<{ guest: boolean }>`select guest from users where id = ${guestId}`;
    if (!rows[0]?.guest) return;
    await q`update invitations set user_id = ${userId} where user_id = ${guestId}`;
    await q`update photos set user_id = ${userId} where user_id = ${guestId}`;
    await q`delete from users where id = ${guestId}`;
  });
}

export async function signUp(emailIn: unknown, passwordIn: unknown, nameIn: unknown): Promise<User> {
  const email = normalEmail(emailIn);
  const password = checkPassword(passwordIn);
  const name = String(nameIn ?? "").trim().slice(0, 80);
  const existing = await sql<UserRow>`select id, email, name, password_hash, google_sub from users where email = ${email}`;
  if (existing[0]) {
    if (existing[0].password_hash) throw new ApiError(409, "An account with this email already exists. Sign in instead.", "exists");
    throw new ApiError(409, "This email is registered with Google. Continue with Google instead.", "google");
  }
  const id = randomUUID();
  await sql`insert into users (id, email, name, password_hash) values (${id}, ${email}, ${name}, ${await hashPassword(password)})`;
  return { id, email, name, hasPassword: true, google: false, guest: false };
}

export async function signIn(emailIn: unknown, passwordIn: unknown): Promise<User> {
  const email = normalEmail(emailIn);
  const key = `signin:${email}`;
  const recent = await sql<{ n: number }>`select count(*)::int as n from auth_attempts where key = ${key} and created_at > now() - interval '15 minutes'`;
  if ((recent[0]?.n ?? 0) >= 8) throw new ApiError(429, "Too many attempts. Please wait 15 minutes, or reset your password.");
  const rows = await sql<UserRow>`select id, email, name, password_hash, google_sub from users where email = ${email}`;
  const user = rows[0];
  const good = await verifyPassword(String(passwordIn ?? ""), user?.password_hash ?? null);
  if (!user || !good) {
    await sql`insert into auth_attempts (key) values (${key})`;
    if (user && !user.password_hash && user.google_sub) throw new ApiError(401, "This email is registered with Google. Continue with Google instead.", "google");
    throw new ApiError(401, "That email and password do not match.");
  }
  await sql`delete from auth_attempts where key = ${key}`;
  return toUser(user);
}

/** Sign in with a verified Google identity, creating or linking the account. */
export async function googleUser(sub: string, emailIn: string, name: string): Promise<User> {
  const email = normalEmail(emailIn);
  const bySub = await sql<UserRow>`select id, email, name, password_hash, google_sub from users where google_sub = ${sub}`;
  if (bySub[0]) return toUser(bySub[0]);
  const byEmail = await sql<UserRow>`select id, email, name, password_hash, google_sub from users where email = ${email}`;
  if (byEmail[0]) {
    await sql`update users set google_sub = ${sub}, name = case when name = '' then ${name} else name end where id = ${byEmail[0].id}`;
    return toUser({ ...byEmail[0], google_sub: sub });
  }
  const id = randomUUID();
  await sql`insert into users (id, email, name, google_sub) values (${id}, ${email}, ${name.slice(0, 80)}, ${sub})`;
  return { id, email, name, hasPassword: false, google: true, guest: false };
}

/** Returns a one-hour reset token for the account, or null when there is none. */
export async function startPasswordReset(emailIn: unknown): Promise<{ token: string; email: string; name: string } | null> {
  const email = normalEmail(emailIn);
  const rows = await sql<UserRow>`select id, email, name, password_hash, google_sub from users where email = ${email}`;
  if (!rows[0]) return null;
  const token = newToken();
  await sql`insert into password_resets (id, user_id, token_hash, expires_at) values (${randomUUID()}, ${rows[0].id}, ${sha256(token)}, ${new Date(Date.now() + 3600_000)})`;
  return { token, email, name: rows[0].name };
}

export async function finishPasswordReset(token: unknown, passwordIn: unknown): Promise<string> {
  const password = checkPassword(passwordIn);
  const rows = await sql<{ id: string; user_id: string }>`
    select id, user_id from password_resets where token_hash = ${sha256(String(token ?? ""))} and used_at is null and expires_at > now()`;
  if (!rows[0]) throw new ApiError(400, "This reset link has expired or was already used. Ask for a new one.");
  await sql`update users set password_hash = ${await hashPassword(password)} where id = ${rows[0].user_id}`;
  await sql`update password_resets set used_at = now() where id = ${rows[0].id}`;
  await sql`delete from sessions where user_id = ${rows[0].user_id}`;
  return rows[0].user_id;
}

/** Secret for signing short-lived values (OAuth state, test payments). Set AUTH_SECRET in production. */
export function appSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && !process.env.YOUREIN_ALLOW_DEV_SECRET) {
    console.warn("[yourein] AUTH_SECRET is not set. Set it to a long random string.");
  }
  return "yourein-dev-secret-change-me";
}
