/**
 * Payments. An invitation is published only after the server has verified a
 * payment signature; the browser saying "paid" is never enough.
 *
 * Razorpay is used when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.
 * Without them, a clearly labelled test mode runs the same verification path
 * with a local secret, so the whole flow can be tried before keys exist.
 * Test mode is on in development and off in production unless
 * YOUREIN_TEST_PAYMENTS=1 is set.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { CURRENCY, PRICE, SITE_NAME } from "@/config/site";
import { getTemplate } from "@/data/templates";
import { missingFields, namesOf } from "@/lib/invite";
import { appSecret, type User } from "../auth";
import { sql, transaction } from "../db";
import { ApiError } from "../http";
import { getOwned, publishInvitation, updateInvitation } from "../invitations";
import { adContextFor, deliverSoon, queuePurchase, trackInitiateCheckout, type Attribution, type Visit } from "../meta/events";

export type Provider = "razorpay" | "test";

const razorpayKeys = () => (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET } : null);

/** "test" for rzp_test_ keys, "live" for rzp_live_ keys, null when Razorpay is not configured. */
export function razorpayKeyMode(): "test" | "live" | null {
  const k = razorpayKeys();
  if (!k) return null;
  return k.id.startsWith("rzp_live_") ? "live" : "test";
}

export function paymentMode(): Provider | "off" {
  if (razorpayKeys()) return "razorpay";
  if (process.env.NODE_ENV !== "production" || process.env.YOUREIN_TEST_PAYMENTS === "1") return "test";
  return "off";
}

const AMOUNT = PRICE * 100; // paise

const sign = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("hex");
function sameSignature(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type Checkout =
  | { mode: "razorpay"; keyId: string; orderId: string; amount: number; currency: string; name: string; description: string; prefill: { name: string; email: string }; testKeys: boolean; metaEventId: string | null }
  | { mode: "test"; orderId: string; amount: number; currency: string; metaEventId: string | null }
  | { mode: "published"; slug: string };

/**
 * Step 1: create an order for this invitation. `ads` carries the visitor's consent and campaign tags for Meta
 * measurement; with no consent nothing about the visit is stored.
 */
export async function createOrder(user: User, invitationId: string, ads?: { visit: Visit; attribution: Attribution }): Promise<Checkout> {
  let inv = await getOwned(invitationId, user.id);
  if ((inv.status === "published" || inv.status === "archived") && inv.slug) return { mode: "published", slug: inv.slug };
  if (missingFields(inv.data).length) throw new ApiError(400, `Still needed: ${missingFields(inv.data).join(", ").toLowerCase()}.`, "incomplete");
  if (inv.status === "draft") inv = await updateInvitation(inv.id, user.id, { markReady: true });

  const mode = paymentMode();
  if (mode === "off") throw new ApiError(503, "Online payment is not set up on this site yet. Please check back soon.", "payments-off");

  const template = getTemplate(inv.templateSlug);
  let providerOrderId: string;
  if (mode === "razorpay") {
    const keys = razorpayKeys()!;
    const unreachable = () => new ApiError(502, "We could not reach the payment service. Please try again in a moment.");
    const res = await fetch(`${process.env.RAZORPAY_API_URL || "https://api.razorpay.com"}/v1/orders`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${keys.id}:${keys.secret}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: AMOUNT, currency: CURRENCY, receipt: inv.id.slice(0, 36), notes: { invitation_id: inv.id, template: inv.templateSlug } }),
      signal: AbortSignal.timeout(15_000),
    }).catch((e) => {
      console.error("[yourein] Razorpay could not be reached:", (e as Error).message);
      throw unreachable();
    });
    if (!res.ok) {
      console.error("[yourein] Razorpay order failed:", res.status, await res.text().catch(() => ""));
      throw unreachable();
    }
    providerOrderId = ((await res.json()) as { id: string }).id;
  } else {
    providerOrderId = `order_test_${randomBytes(9).toString("hex")}`;
  }

  const orderRowId = randomUUID();
  const adContext = ads ? adContextFor(ads.visit, ads.attribution) : null;
  await sql`insert into orders (id, invitation_id, user_id, amount, currency, provider, provider_order_id, ad_context)
    values (${orderRowId}, ${inv.id}, ${user.id}, ${AMOUNT}, ${CURRENCY}, ${mode}, ${providerOrderId}, ${adContext ? JSON.stringify(adContext) : null}::jsonb)`;
  const metaEventId = trackInitiateCheckout(
    { id: orderRowId, amount: AMOUNT, currency: CURRENCY, templateSlug: inv.templateSlug, provider: mode, keyMode: mode === "razorpay" ? razorpayKeyMode() : null },
    user, adContext,
  );

  if (mode === "razorpay") {
    return {
      mode, keyId: razorpayKeys()!.id, orderId: providerOrderId, amount: AMOUNT, currency: CURRENCY, name: SITE_NAME,
      description: `${template?.name ?? "Invitation"} for ${namesOf(inv.data)}`, prefill: { name: user.name, email: user.email },
      testKeys: razorpayKeyMode() === "test", metaEventId,
    };
  }
  return { mode, orderId: providerOrderId, amount: AMOUNT, currency: CURRENCY, metaEventId };
}

/** Test mode only: stands in for the gateway and returns what Razorpay's checkout would return. */
export async function testGatewayPay(user: User, providerOrderId: string) {
  if (paymentMode() !== "test") throw new ApiError(403, "Test payments are turned off.");
  const rows = await sql<{ id: string }>`select id from orders where provider_order_id = ${providerOrderId} and user_id = ${user.id} and provider = 'test'`;
  if (!rows[0]) throw new ApiError(404, "That order was not found.");
  const paymentId = `pay_test_${randomBytes(9).toString("hex")}`;
  return { orderId: providerOrderId, paymentId, signature: sign(appSecret(), `${providerOrderId}|${paymentId}`) };
}

/** Step 2: verify the signature, record the payment, publish. Safe to call twice. */
export async function verifyAndPublish(user: User | null, input: { orderId?: unknown; paymentId?: unknown; signature?: unknown }): Promise<{ slug: string; invitationId: string }> {
  const orderId = String(input.orderId ?? ""), paymentId = String(input.paymentId ?? ""), signature = String(input.signature ?? "");
  if (!orderId || !paymentId || !signature) throw new ApiError(400, "The payment details were incomplete.");

  const rows = await sql<{ id: string; invitation_id: string; user_id: string; amount: number; currency: string; status: string; provider: Provider }>`
    select id, invitation_id, user_id, amount, currency, status, provider from orders where provider_order_id = ${orderId}`;
  const order = rows[0];
  if (!order || (user && order.user_id !== user.id)) throw new ApiError(404, "That order was not found.");

  const secret = order.provider === "razorpay" ? razorpayKeys()?.secret : paymentMode() === "test" ? appSecret() : undefined;
  if (!secret) throw new ApiError(503, "Payments are not configured.");
  if (!sameSignature(sign(secret, `${orderId}|${paymentId}`), signature)) {
    await sql`update orders set status = 'failed' where id = ${order.id} and status = 'created'`;
    throw new ApiError(400, "We could not verify this payment. If money left your account, contact us with your payment ID.", "bad-signature");
  }
  return settle(order, paymentId, signature, { source: "checkout", keyMode: order.provider === "razorpay" ? razorpayKeyMode() : "simulated" });
}

type OrderRow = { id: string; invitation_id: string; amount: number; currency: string; status: string };

async function settle(order: OrderRow, paymentId: string, signature: string, raw: object) {
  let metaEventId: string | null = null;
  const out = await transaction(async (q) => {
    const prev = await q<{ status: string; provider: Provider }>`select status, provider from orders where id = ${order.id} for update`;
    const done = await q<{ id: string }>`select id from payments where provider_payment_id = ${paymentId}`;
    if (!done[0]) {
      await q`insert into payments (id, order_id, provider_payment_id, amount, currency, status, signature, paid_at, raw)
        values (${randomUUID()}, ${order.id}, ${paymentId}, ${order.amount}, ${order.currency}, 'captured', ${signature}, now(), ${JSON.stringify(raw)}::jsonb)`;
    }
    await q`update orders set status = 'paid' where id = ${order.id}`;
    const slug = await publishInvitation(q, order.invitation_id);
    /* the first time this order becomes paid, queue its one Purchase for Meta. A savepoint keeps any tracking
       error from undoing the payment or the publishing. */
    if (prev[0] && prev[0].status !== "paid") {
      await q`savepoint meta_purchase`;
      try {
        metaEventId = await queuePurchase(q, order.id, prev[0].provider === "razorpay" ? razorpayKeyMode() : null);
        await q`release savepoint meta_purchase`;
      } catch (e) {
        await q`rollback to savepoint meta_purchase`;
        console.warn("[yourein] Meta Purchase could not be queued:", (e as Error).message);
      }
    }
    return { slug, invitationId: order.invitation_id };
  });
  deliverSoon(metaEventId);
  return out;
}

/**
 * Razorpay webhook (optional but recommended): publishes even if the customer
 * closes the tab right after paying. Point it at /api/pay/webhook for the
 * "payment.captured" and "order.paid" events and set RAZORPAY_WEBHOOK_SECRET.
 */
export async function handleWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, "Webhook secret is not configured.");
  if (!signature || !sameSignature(sign(secret, rawBody), signature)) throw new ApiError(400, "Bad webhook signature.");
  const event = JSON.parse(rawBody) as WebhookEvent;
  const p = event.payload?.payment?.entity;

  if (event.event === "payment.failed") return recordFailedPayment(p);
  if (event.event === "refund.processed") return recordRefund(event.payload?.refund?.entity, p);

  if (!p?.id || !p.order_id || (event.event !== "payment.captured" && event.event !== "order.paid")) return { ignored: true };
  const rows = await sql<OrderRow>`select id, invitation_id, amount, currency, status from orders where provider_order_id = ${p.order_id} and provider = 'razorpay'`;
  if (!rows[0] || (p.amount ?? 0) < rows[0].amount) return { ignored: true };
  await settle(rows[0], p.id, "", { source: "webhook", event: event.event, keyMode: razorpayKeyMode() });
  return { ok: true };
}

type PaymentEntity = { id?: string; order_id?: string; status?: string; amount?: number; method?: string; error_description?: string; error_reason?: string };
type WebhookEvent = { event?: string; payload?: { payment?: { entity?: PaymentEntity }; refund?: { entity?: { id?: string; payment_id?: string; amount?: number } } } };

/**
 * A failed attempt is kept so the admin dashboard can see it. It never publishes anything and never marks the order
 * as failed: the customer can retry on the same order. A payment that already succeeded is never overwritten.
 */
async function recordFailedPayment(p: PaymentEntity | undefined) {
  if (!p?.id || !p.order_id) return { ignored: true };
  const rows = await sql<OrderRow>`select id, invitation_id, amount, currency, status from orders where provider_order_id = ${p.order_id} and provider = 'razorpay'`;
  if (!rows[0]) return { ignored: true };
  const raw = JSON.stringify({ source: "webhook", event: "payment.failed", keyMode: razorpayKeyMode(), method: p.method ?? null, reason: p.error_description ?? p.error_reason ?? null });
  await sql`insert into payments (id, order_id, provider_payment_id, amount, currency, status, signature, raw)
    values (${randomUUID()}, ${rows[0].id}, ${p.id}, ${p.amount ?? rows[0].amount}, ${rows[0].currency}, 'failed', '', ${raw}::jsonb)
    on conflict (provider_payment_id) do nothing`;
  return { recorded: "failed" };
}

/** Marks a payment refunded (or partially refunded). The invitation stays published: taking it down is a decision for a person. */
async function recordRefund(refund: { id?: string; payment_id?: string; amount?: number } | undefined, p: PaymentEntity | undefined) {
  const paymentId = refund?.payment_id ?? p?.id;
  if (!refund?.id || !paymentId) return { ignored: true };
  return transaction(async (q) => {
    const rows = await q<{ id: string; amount: number; raw: Record<string, unknown> }>`select id, amount, raw from payments where provider_payment_id = ${paymentId} for update`;
    const pay = rows[0];
    if (!pay) return { ignored: true };
    const refunds = { ...((pay.raw.refunds as Record<string, number> | undefined) ?? {}), [refund.id!]: refund.amount ?? 0 };
    const total = Object.values(refunds).reduce((n, x) => n + x, 0);
    const status = total >= pay.amount ? "refunded" : "partially_refunded";
    await q`update payments set status = ${status}, raw = ${JSON.stringify({ ...pay.raw, refunds })}::jsonb where id = ${pay.id}`;
    return { recorded: status };
  });
}
