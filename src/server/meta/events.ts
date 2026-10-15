/**
 * The customer-journey events sent to Meta from the server, and the Purchase outbox.
 *
 * Rules this file enforces:
 * - Nothing is sent unless Meta is configured and the visitor allowed advertising cookies (yi_ads_consent=granted).
 *   Signing in is not consent.
 * - Purchase is queued inside the same database transaction that records a verified payment, keyed by the order
 *   (event_id "purchase_<order id>"), so duplicate webhooks, retries and refreshes can never create a second one.
 * - Payments made with simulated payments or Razorpay test keys only reach Meta when META_CAPI_TEST_EVENT_CODE is set,
 *   so test purchases land in Test Events and never in live ad reporting.
 * - A Meta failure never affects payment or publishing: delivery runs after the response and failures are retried later.
 */
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { CONSENT_COOKIE, consentFrom, META_PIXEL_ID } from "@/config/meta";
import { CURRENCY, PRICE, SITE_URL } from "@/config/site";
import { getTemplate } from "@/data/templates";
import { sql, type Sql } from "../db";
import { buildEvent, cleanSourceUrl, metaConfig, sendEvents, type CustomData, type Person, type ServerEvent } from "./capi";



export const purchaseEventId = (orderId: string) => `purchase_${orderId}`;
export const checkoutEventId = (orderId: string) => `checkout_${orderId}`;
export const registrationEventId = (userId: string) => `signup_${userId}`;

const MAX_ATTEMPTS = 6;

/** Campaign tags kept for a visit, as sent by the browser at checkout. Each value is short and plain. */
export type Attribution = Partial<Record<"landing_page" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term" | "fbclid", string>> & { captured_at?: number };
const ATTR_KEYS = ["landing_page", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

export function cleanAttribution(raw: unknown): Attribution {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Attribution = {};
  for (const k of ATTR_KEYS) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, k === "fbclid" ? 500 : 100).replace(/[^\w\-./:~%+]/g, "");
  }
  if (out.landing_page && !out.landing_page.startsWith("/")) delete out.landing_page;
  if (typeof r.captured_at === "number" && r.captured_at > 1.5e12 && r.captured_at <= Date.now() + 60_000) out.captured_at = Math.floor(r.captured_at);
  return out;
}

const originFrom = (host: string | null, proto: string | null) =>
  host ? `${proto || (/^(localhost|127\.)/.test(host) ? "http" : "https")}://${host}` : undefined;

/** What the current request tells us, for events sent while the person is on the site. */
export type Visit = { consent: boolean; person: Person; referer: string | null; origin?: string };

export async function currentVisit(): Promise<Visit> {
  try {
    const [h, jar] = await Promise.all([headers(), cookies()]);
    const consent = consentFrom(jar.get(CONSENT_COOKIE)?.value) === "granted";
    if (!consent) return { consent, person: {}, referer: null };
    return {
      consent,
      referer: h.get("referer"),
      origin: originFrom(h.get("x-forwarded-host") || h.get("host"), h.get("x-forwarded-proto")),
      person: {
        ip: (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null,
        userAgent: h.get("user-agent"),
        fbp: jar.get("_fbp")?.value ?? null,
        fbc: jar.get("_fbc")?.value ?? null,
      },
    };
  } catch {
    return { consent: false, person: {}, referer: null };
  }
}

/** fbc from a stored fbclid when the Pixel's _fbc cookie is missing (format from Meta's fbc parameter docs). */
export const fbcFrom = (fbclid: string | undefined, capturedAt: number | undefined) => (fbclid ? `fb.1.${capturedAt ?? Date.now()}.${fbclid}` : null);

export const trackingOn = () => !!metaConfig() && !!META_PIXEL_ID;

/** Payments made without live Razorpay keys are only reported while a Test Events code is set. */
export function paymentReportable(provider: string, keyMode: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  const cfg = metaConfig(env);
  if (!cfg) return false;
  if (provider === "razorpay" && keyMode === "live") return true;
  return !!cfg.testEventCode;
}

/** Runs work after the response is sent (Vercel keeps the function alive for it); outside a request it just starts it. */
export function later(fn: () => Promise<unknown>) {
  const safe = () => fn().catch((e) => console.warn("[yourein] Meta delivery failed:", (e as Error).message));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

const templateData = (slug: string): CustomData => {
  const t = getTemplate(slug);
  return { content_ids: [slug], content_type: "product", ...(t ? { content_name: t.name, content_category: t.category } : {}) };
};

/* ------------------------------------------------------------ browser-relayed events */

/** ViewContent, TemplatePreview and CustomizeInvitation, sent with the same event_id the Pixel used. */
export function relayEvent(name: string, eventId: string, templateSlug: string, pageUrl: string | null, visit: Visit) {
  if (!visit.consent || !trackingOn()) return false;
  const event = buildEvent({ name, id: eventId, sourceUrl: cleanSourceUrl(pageUrl ?? visit.referer, visit.origin ?? SITE_URL) ?? cleanSourceUrl(pageUrl ?? visit.referer, SITE_URL), person: visit.person, custom: templateData(templateSlug) });
  later(() => sendEvents([event]));
  return true;
}

/* ------------------------------------------------------------ registration */

/** A new account was created. Returns the event_id for the Pixel, or null when nothing was sent. */
export function trackRegistration(user: { id: string; email: string }, visit: Visit, sourceUrl = `${SITE_URL}/signin`): string | null {
  if (!visit.consent || !trackingOn()) return null;
  const id = registrationEventId(user.id);
  const event = buildEvent({ name: "CompleteRegistration", id, sourceUrl, person: { ...visit.person, email: user.email, userId: user.id } });
  later(() => sendEvents([event]));
  return id;
}

/* ------------------------------------------------------------ checkout */

/** Stored on the order when the customer starts checkout with consent, so a later webhook can still send Purchase. */
export type AdContext = { consent: "granted"; person: Person; attribution: Attribution; sourceUrl?: string };

export function adContextFor(visit: Visit, attribution: Attribution): AdContext | null {
  if (!visit.consent) return null;
  const person = { ...visit.person, fbc: visit.person.fbc || fbcFrom(attribution.fbclid, attribution.captured_at) };
  return { consent: "granted", person, attribution, sourceUrl: `${SITE_URL}/pay` };
}

/** InitiateCheckout for a newly created order. Returns the event_id for the Pixel, or null. */
export function trackInitiateCheckout(order: { id: string; amount: number; currency: string; templateSlug: string; provider: string; keyMode: string | null }, user: { id: string; email: string }, ctx: AdContext | null): string | null {
  if (!ctx || !trackingOn() || !paymentReportable(order.provider, order.keyMode)) return null;
  const id = checkoutEventId(order.id);
  const event = buildEvent({
    name: "InitiateCheckout",
    id,
    sourceUrl: ctx.sourceUrl,
    person: { ...ctx.person, email: user.email, userId: user.id },
    custom: { ...templateData(order.templateSlug), value: order.amount / 100, currency: order.currency, num_items: 1 },
  });
  later(() => sendEvents([event]));
  return id;
}

/* ------------------------------------------------------------ purchase (outbox) */

/**
 * Inside the payment transaction: queue one Purchase for this order. Amount and currency come from the order row
 * (set by the server when the order was created), never from the browser. Returns the event_id if queued.
 */
export async function queuePurchase(q: Sql, orderId: string, keyMode: string | null): Promise<string | null> {
  if (!trackingOn()) return null;
  const rows = await q<{ amount: number; currency: string; provider: string; provider_order_id: string; ad_context: AdContext | null; user_id: string; email: string | null; invitation_id: string; template_slug: string }>`
    select o.amount, o.currency, o.provider, o.provider_order_id, o.ad_context, o.user_id, u.email, o.invitation_id, i.template_slug
    from orders o join users u on u.id = o.user_id join invitations i on i.id = o.invitation_id where o.id = ${orderId}`;
  const o = rows[0];
  if (!o || o.ad_context?.consent !== "granted" || !paymentReportable(o.provider, keyMode)) return null;
  const id = purchaseEventId(orderId);
  const event = buildEvent({
    name: "Purchase",
    id,
    sourceUrl: o.ad_context.sourceUrl,
    person: { ...o.ad_context.person, email: o.email, userId: o.user_id },
    custom: { ...templateData(o.template_slug), value: o.amount / 100, currency: o.currency, num_items: 1, order_id: o.provider_order_id },
  });
  await q`insert into meta_events (event_id, event_name, invitation_id, payload) values (${id}, 'Purchase', ${o.invitation_id}, ${JSON.stringify(event)}::jsonb)
    on conflict (event_id) do nothing`;
  /* the visit details have done their job; do not keep them on the order */
  await q`update orders set ad_context = null where id = ${orderId}`;
  return id;
}

/** Sends queued events (oldest first). Safe to run from several places at once: each row is claimed before sending. */
export async function flushOutbox(limit = 10, opts: { fetchImpl?: typeof fetch } = {}) {
  if (!metaConfig()) return { sent: 0, failed: 0 };
  /* Meta rejects website events older than 7 days */
  await sql`update meta_events set status = 'failed', last_error = 'older than 7 days' where status = 'pending' and created_at < now() - interval '7 days'`;
  const claimed = await sql<{ event_id: string; payload: ServerEvent }>`
    update meta_events set attempts = attempts + 1, claimed_at = now()
    where event_id in (
      select event_id from meta_events where status = 'pending' and (claimed_at is null or claimed_at < now() - interval '2 minutes')
      order by created_at limit ${limit}
    ) returning event_id, payload`;
  let sent = 0, failed = 0;
  for (const row of claimed) {
    const res = await sendEvents([row.payload], { fetchImpl: opts.fetchImpl });
    if (res.ok) {
      sent++;
      await sql`update meta_events set status = 'sent', sent_at = now(), last_error = '' where event_id = ${row.event_id}`;
    } else {
      failed++;
      await sql`update meta_events set last_error = ${res.error}, claimed_at = null,
        status = case when ${!res.retryable} or attempts >= ${MAX_ATTEMPTS} then 'failed' else 'pending' end where event_id = ${row.event_id}`;
    }
  }
  /* keep personal data no longer than needed: delivered or abandoned events are removed after 30 days */
  await sql`delete from meta_events where status in ('sent', 'failed') and created_at < now() - interval '30 days'`;
  await sql`update orders set ad_context = null where ad_context is not null and created_at < now() - interval '30 days'`;
  return { sent, failed };
}

/** Called after a payment is recorded: try to deliver straight away; anything left is retried by the next flush. */
export function deliverSoon(eventId: string | null) {
  if (eventId) later(() => flushOutbox(5));
}

/**
 * The success page asks once for the Purchase the browser should also report, with the same event_id.
 * The claim is atomic, so refreshing the page never reports it again.
 */
export async function claimBrowserPurchase(invitationId: string): Promise<{ eventId: string; value: number; currency: string; contentIds: string[]; contentName?: string } | null> {
  if (!trackingOn()) return null;
  const rows = await sql<{ event_id: string; payload: ServerEvent }>`
    update meta_events set browser_claimed_at = now()
    where invitation_id = ${invitationId} and event_name = 'Purchase' and browser_claimed_at is null and created_at > now() - interval '1 day'
    returning event_id, payload`;
  const r = rows[0];
  if (!r?.payload.custom_data) return null;
  const c = r.payload.custom_data;
  return { eventId: r.event_id, value: c.value ?? PRICE, currency: c.currency ?? CURRENCY, contentIds: c.content_ids ?? [], contentName: c.content_name };
}

export const newEventId = () => randomUUID().replace(/-/g, "");
