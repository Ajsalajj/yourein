// Admin session + API access. The session lives in sessionStorage only, so
// closing the tab signs out; admin rights are enforced by the API (role +
// MFA), never by this client.

const API = import.meta.env.VITE_API_URL as string;
const SB = (import.meta.env.VITE_SUPABASE_URL as string)?.replace(/\/$/, "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const configured = Boolean(API && SB && ANON);

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string; factors?: { id: string; factor_type: string; status: string }[] };
}

const KEY = "orvane.admin.session";
export const loadSession = (): Session | null => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};
const saveSession = (s: Session | null) => (s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY));

async function auth<T>(path: string, body: object | null, token?: string, method = "POST"): Promise<T> {
  const res = await fetch(`${SB}/auth/v1${path}`, {
    method,
    headers: { apikey: ANON, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.msg ?? j.error_description ?? j.message ?? `Auth error ${res.status}`);
  return j as T;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const s = await auth<Session>("/token?grant_type=password", { email, password });
  saveSession(s);
  return s;
}

export function signOut() {
  const s = loadSession();
  if (s) void auth("/logout", {}, s.access_token).catch(() => {});
  saveSession(null);
}

/** Returns the verified TOTP factor id, if any. */
export async function totpFactor(s: Session): Promise<string | null> {
  const user = await auth<Session["user"]>("/user", null, s.access_token, "GET");
  return user.factors?.find((f) => f.factor_type === "totp" && f.status === "verified")?.id ?? null;
}

export async function enrollTotp(s: Session): Promise<{ id: string; qr: string; secret: string }> {
  const j = await auth<{ id: string; totp: { qr_code: string; secret: string } }>("/factors", { factor_type: "totp", friendly_name: "Orvane admin" }, s.access_token);
  return { id: j.id, qr: j.totp.qr_code, secret: j.totp.secret };
}

/** Completes MFA; the returned session carries aal2, which the API requires. */
export async function verifyTotp(s: Session, factorId: string, code: string): Promise<Session> {
  const ch = await auth<{ id: string }>(`/factors/${factorId}/challenge`, {}, s.access_token);
  const next = await auth<Session>(`/factors/${factorId}/verify`, { challenge_id: ch.id, code }, s.access_token);
  saveSession(next);
  return next;
}

async function fresh(): Promise<Session> {
  const s = loadSession();
  if (!s) throw new Error("signed_out");
  if (s.expires_at * 1000 - Date.now() > 60_000) return s;
  const next = await auth<Session>("/token?grant_type=refresh_token", { refresh_token: s.refresh_token });
  saveSession(next);
  return next;
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message?: string) {
    super(message ?? code);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = await fresh();
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${s.access_token}`, ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error?.code ?? `http_${res.status}`, j.error?.message);
  return j as T;
}

export const fmtBytes = (n: number | null | undefined) => {
  if (n == null) return "—";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0, v = n;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return `${v.toFixed(i === 0 || v >= 100 ? 0 : 1)} ${u[i]}`;
};
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : "—");
