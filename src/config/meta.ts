/**
 * Meta (Facebook / Instagram) ads measurement: settings shared by the browser and the server.
 * Nothing secret lives here. The Conversions API token is read only in src/server/meta/capi.ts.
 *
 * Tracking is off unless NEXT_PUBLIC_META_PIXEL_ID is set, and even then nothing is sent for a visitor
 * until they allow advertising cookies (see src/components/meta/MetaTracking.tsx).
 */

/** A Pixel (dataset) ID is a long number. Anything else is treated as "not configured". */
export function pixelIdFrom(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  return /^\d{6,20}$/.test(v) ? v : null;
}

export const META_PIXEL_ID = pixelIdFrom(process.env.NEXT_PUBLIC_META_PIXEL_ID);

/** First-party cookie that remembers the visitor's choice: "granted" or "denied". No choice yet means no tracking. */
export const CONSENT_COOKIE = "yi_ads_consent";
export const CONSENT_DAYS = 180;
export type Consent = "granted" | "denied";

export const consentFrom = (raw: string | undefined | null): Consent | null => (raw === "granted" || raw === "denied" ? raw : null);

/**
 * Pages where the Pixel never loads and no banner is shown: the invitations guests open (their visits are not
 * our customers' and their RSVPs are private), the admin area, and internal render routes.
 */
export const NO_TRACKING_PREFIXES = ["/i/", "/admin", "/shot", "/og"];
export const trackingAllowedOn = (pathname: string) => !NO_TRACKING_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));

/** Events the browser may ask the server to forward. Purchase, InitiateCheckout and CompleteRegistration are server-originated only. */
export const BROWSER_RELAYED_EVENTS = ["ViewContent", "TemplatePreview", "CustomizeInvitation"] as const;
export type RelayedEvent = (typeof BROWSER_RELAYED_EVENTS)[number];
export const CUSTOM_EVENTS: ReadonlySet<string> = new Set(["TemplatePreview", "CustomizeInvitation"]);

/** event_id values are short opaque strings; anything else is rejected. */
export const isEventId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(v);
