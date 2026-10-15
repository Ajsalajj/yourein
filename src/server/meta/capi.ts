/**
 * Meta Conversions API: builds and sends server events. Server only: the access token never leaves this file.
 *
 * Endpoint: POST https://graph.facebook.com/{version}/{pixel_id}/events
 * Version: v26.0, the current Graph API version per Meta's changelog
 * (https://developers.facebook.com/docs/graph-api/changelog/versions, checked 2026-10-15). Override with META_GRAPH_API_VERSION.
 *
 * Hashing follows Meta's customer information parameter rules: em and external_id are normalized and SHA-256 hashed;
 * client_ip_address, client_user_agent, fbp and fbc must never be hashed.
 * Nothing about an invitation's content, its guests or their replies is ever put in an event.
 */
import { createHash } from "node:crypto";
import { pixelIdFrom } from "@/config/meta";

export const GRAPH_API_VERSION = "v26.0";

type Env = Record<string, string | undefined>;

export type MetaConfig = { pixelId: string; token: string; version: string; baseUrl: string; testEventCode: string | null };

/** Null (tracking off) unless both the Pixel ID and the access token are set. */
export function metaConfig(env: Env = process.env): MetaConfig | null {
  const pixelId = pixelIdFrom(env.NEXT_PUBLIC_META_PIXEL_ID);
  const token = (env.META_CAPI_ACCESS_TOKEN ?? "").trim();
  if (!pixelId || !token) return null;
  const version = /^v\d{2}\.\d$/.test(env.META_GRAPH_API_VERSION ?? "") ? env.META_GRAPH_API_VERSION! : GRAPH_API_VERSION;
  const testEventCode = (env.META_CAPI_TEST_EVENT_CODE ?? "").trim() || null;
  return { pixelId, token, version, baseUrl: (env.META_GRAPH_API_URL || "https://graph.facebook.com").replace(/\/$/, ""), testEventCode };
}

let warnedTestCode = false;
/** A test code left in production would divert live events to Test Events, so say so loudly (once per instance). */
function warnIfTestCodeInProduction(cfg: MetaConfig, env: Env) {
  if (warnedTestCode || !cfg.testEventCode || (env.VERCEL_ENV ?? env.NODE_ENV) !== "production") return;
  warnedTestCode = true;
  console.warn("[yourein] META_CAPI_TEST_EVENT_CODE is set in production: server events go to Meta Test Events. Remove it before running ads.");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const normalizeEmail = (e: string) => e.trim().toLowerCase();
const isHashed = (s: string) => /^[a-f0-9]{64}$/.test(s);

/** What we know about the person, as collected on our own site. Only set what was really collected. */
export type Person = {
  email?: string | null;
  /** Our own account id. Hashed before sending. */
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

export type UserData = { em?: string[]; external_id?: string[]; client_ip_address?: string; client_user_agent?: string; fbp?: string; fbc?: string };

export function userData(p: Person): UserData {
  const u: UserData = {};
  const email = p.email ? normalizeEmail(p.email) : "";
  if (email) u.em = [isHashed(email) ? email : sha256(email)];
  if (p.userId) u.external_id = [isHashed(p.userId) ? p.userId : sha256(p.userId)];
  if (p.ip && p.ip !== "local") u.client_ip_address = p.ip.slice(0, 64);
  if (p.userAgent) u.client_user_agent = p.userAgent.slice(0, 512);
  if (p.fbp && /^fb\.\d\.\d+\.[\w.-]+$/.test(p.fbp)) u.fbp = p.fbp;
  if (p.fbc && /^fb\.\d\.\d+\.[\w.-]+$/.test(p.fbc)) u.fbc = p.fbc;
  return u;
}

/** Only these keys may appear in custom_data, so nothing private can slip in by accident. */
export type CustomData = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_name?: string;
  content_category?: string;
  content_type?: "product";
  num_items?: number;
  order_id?: string;
};
const CUSTOM_KEYS = new Set<keyof CustomData>(["value", "currency", "content_ids", "content_name", "content_category", "content_type", "num_items", "order_id"]);

export type ServerEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url?: string;
  user_data: UserData;
  custom_data?: CustomData;
};

/** Strips the query string and any id segments, so a URL never carries campaign tags, tokens or invitation ids. */
export function cleanSourceUrl(url: string | null | undefined, origin: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url, origin);
    if (u.origin !== new URL(origin).origin) return undefined;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const path = u.pathname.split("/").filter((seg) => !uuid.test(seg)).join("/").replace(/\/+$/, "") || "/";
    return `${u.origin}${path}`;
  } catch {
    return undefined;
  }
}

export function buildEvent(input: { name: string; id: string; time?: Date; sourceUrl?: string; person: Person; custom?: CustomData }): ServerEvent {
  const custom: CustomData = {};
  for (const [k, v] of Object.entries(input.custom ?? {})) if (CUSTOM_KEYS.has(k as keyof CustomData) && v !== undefined) (custom as Record<string, unknown>)[k] = v;
  return {
    event_name: input.name,
    event_time: Math.floor((input.time ?? new Date()).getTime() / 1000),
    event_id: input.id,
    action_source: "website",
    ...(input.sourceUrl ? { event_source_url: input.sourceUrl } : {}),
    user_data: userData(input.person),
    ...(Object.keys(custom).length ? { custom_data: custom } : {}),
  };
}

export type SendResult = { ok: true; received: number } | { ok: false; retryable: boolean; error: string };

/**
 * Sends events with a timeout and one quick retry on network errors, 429 and 5xx.
 * Never throws. Logs only the event names and ids and Meta's error message: never the token or the payload.
 */
export async function sendEvents(events: ServerEvent[], opts: { env?: Env; fetchImpl?: typeof fetch; timeoutMs?: number; retries?: number } = {}): Promise<SendResult> {
  const env = opts.env ?? process.env;
  const cfg = metaConfig(env);
  if (!cfg) return { ok: false, retryable: false, error: "not-configured" };
  if (!events.length) return { ok: true, received: 0 };
  warnIfTestCodeInProduction(cfg, env);
  const doFetch = opts.fetchImpl ?? fetch;
  const body = JSON.stringify({ data: events, access_token: cfg.token, ...(cfg.testEventCode ? { test_event_code: cfg.testEventCode } : {}) });
  const label = events.map((e) => `${e.event_name}:${e.event_id}`).join(", ");
  let last: SendResult = { ok: false, retryable: true, error: "not-sent" };
  for (let attempt = 0; attempt <= (opts.retries ?? 1); attempt++) {
    try {
      const res = await doFetch(`${cfg.baseUrl}/${cfg.version}/${cfg.pixelId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
      });
      const out = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string; code?: number } };
      if (res.ok) return { ok: true, received: out.events_received ?? events.length };
      const retryable = res.status === 429 || res.status >= 500;
      last = { ok: false, retryable, error: `HTTP ${res.status}${out.error?.message ? `: ${out.error.message.slice(0, 200)}` : ""}` };
      if (!retryable) break;
    } catch (e) {
      last = { ok: false, retryable: true, error: (e as Error).name === "TimeoutError" ? "timeout" : "network error" };
    }
  }
  console.warn(`[yourein] Meta Conversions API did not accept ${label}: ${last.ok ? "" : last.error}`);
  return last;
}
