"use client";

/**
 * Meta Pixel for the browser. The only place that talks to fbq.
 *
 * - Nothing loads and nothing is sent until NEXT_PUBLIC_META_PIXEL_ID is set AND the visitor allows advertising cookies.
 *   Events that happen before the visitor has chosen wait in memory; they are sent if they allow and dropped if not.
 * - The Pixel is loaded once per page load (guarded on window, so React Strict Mode and remounts cannot load it twice).
 * - Meta's automatic history tracking is turned off (fbq.disablePushState) and PageView is sent here once per path,
 *   so client-side navigation never produces duplicate PageViews. Automatic configuration (autoConfig), which reads
 *   buttons and page data on its own, is off too: only the events listed below are ever sent.
 * - Events also sent by the server carry the same event_id, so Meta counts them once.
 * - Never sends names, emails, invitation details, guests or replies. Only design slugs, prices and event ids.
 */
import { CONSENT_COOKIE, CONSENT_DAYS, consentFrom, CUSTOM_EVENTS, META_PIXEL_ID, type Consent, type RelayedEvent } from "@/config/meta";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; push: unknown; loaded: boolean; version: string; disablePushState?: boolean };
type W = Window & { fbq?: Fbq; _fbq?: Fbq; __yiPixel?: string };

export type PixelParams = { value?: number; currency?: string; content_ids?: string[]; content_name?: string; content_category?: string; content_type?: "product"; num_items?: number };

const CONSENT_EVENT = "yi:ads-consent";
let pending: Array<() => void> = [];
let lastPath: string | null = null;
const recent = new Map<string, number>();

export const pixelId = () => META_PIXEL_ID;

export function getConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return consentFrom(m?.[1]);
}

export function setConsent(choice: Consent) {
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${choice}; Max-Age=${CONSENT_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
    if (choice === "granted") {
      try {
        (window as W).fbq?.("consent", "grant");
      } catch {}
      const run = pending;
      pending = [];
      run.forEach((fn) => fn());
    } else {
      pending = [];
      revoke();
    }
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
  } catch {
    /* tracking must never break the page */
  }
}

export function onConsentChange(fn: (c: Consent) => void) {
  const h = (e: Event) => fn((e as CustomEvent<Consent>).detail);
  window.addEventListener(CONSENT_EVENT, h);
  return () => window.removeEventListener(CONSENT_EVENT, h);
}

/** Withdrawing consent: tell the Pixel and remove its first-party cookies. */
function revoke() {
  const w = window as W;
  try {
    w.fbq?.("consent", "revoke");
  } catch {}
  const host = location.hostname.replace(/^www\./, "");
  for (const name of ["_fbp", "_fbc"]) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${host}`;
  }
}

/** Loads the Pixel once. Returns false (and loads nothing) without a Pixel ID or consent. */
export function ensurePixel(): boolean {
  const id = META_PIXEL_ID;
  if (!id || typeof window === "undefined" || getConsent() !== "granted") return false;
  const w = window as W;
  if (w.__yiPixel === id && w.fbq) return true;
  try {
    if (!w.fbq) {
      /* Meta's base code, typed */
      const n = function (...args: unknown[]) {
        if (n.callMethod) n.callMethod(...args);
        else n.queue.push(args);
      } as Fbq;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      w.fbq = n;
      if (!w._fbq) w._fbq = n;
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(s);
    }
    w.fbq.disablePushState = true;
    w.fbq("consent", "grant");
    w.fbq("set", "autoConfig", false, id);
    w.fbq("init", id);
    w.__yiPixel = id;
    return true;
  } catch {
    return false;
  }
}

/** Runs now with consent, later if the visitor has not chosen yet, never if they declined. */
function whenAllowed(fn: () => void) {
  if (!META_PIXEL_ID || typeof window === "undefined") return;
  const c = getConsent();
  if (c === "granted") fn();
  else if (c === null && pending.length < 20) pending.push(fn);
}

function fire(name: string, params?: PixelParams, eventId?: string) {
  if (!ensurePixel()) return;
  try {
    const opts = eventId ? { eventID: eventId } : undefined;
    (window as W).fbq!(CUSTOM_EVENTS.has(name) ? "trackCustom" : "track", name, params ?? {}, ...(opts ? [opts] : []));
  } catch {}
}

/** Same event twice within a moment (Strict Mode effects, double clicks) counts once. */
function duplicate(key: string, ms = 2000) {
  const now = Date.now(), t = recent.get(key);
  recent.set(key, now);
  return t !== undefined && now - t < ms;
}

/** One PageView per path. Query-string changes (editor steps) are not new pages. */
export function trackPageView(path: string) {
  whenAllowed(() => {
    if (path === lastPath) return;
    lastPath = path;
    fire("PageView");
  });
}

export const newEventId = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 40);

/** A browsing event about one design: the Pixel and the server get the same event_id. */
export function trackDesignEvent(name: RelayedEvent, design: { slug: string; name?: string; category?: string }) {
  if (duplicate(`${name}:${design.slug}`)) return;
  const eventId = newEventId();
  whenAllowed(() => {
    fire(name, { content_ids: [design.slug], content_type: "product", ...(design.name ? { content_name: design.name } : {}), ...(design.category ? { content_category: design.category } : {}) }, eventId);
    void fetch("/api/meta/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: name, eventId, template: design.slug, url: location.origin + location.pathname }),
      keepalive: true,
    }).catch(() => {});
  });
}

/** For events the server already sent: the browser reports the same action with the server's event_id. */
export function trackServerEvent(name: "CompleteRegistration" | "InitiateCheckout" | "Purchase", eventId: string | null | undefined, params?: PixelParams) {
  if (!eventId || duplicate(`${name}:${eventId}`, 60_000)) return;
  whenAllowed(() => fire(name, params, eventId));
}
