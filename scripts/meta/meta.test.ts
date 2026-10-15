/**
 * Tests for Meta ads tracking.  npm run test:meta
 *
 * Part 1 is pure logic. Part 2 runs the real payment code (verify, webhooks, settle) against a throwaway embedded
 * database with Meta's API replaced by a stub, so no network, no Meta account and no real payment is involved.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { after as afterAll, before, test } from "node:test";

/* ---- environment for the whole file: set before any app module is loaded ---- */
const dataDir = mkdtempSync(path.join(os.tmpdir(), "yourein-meta-test-"));
Object.assign(process.env, {
  YOUREIN_DATA_DIR: dataDir,
  NEXT_PUBLIC_META_PIXEL_ID: "123456789012345",
  META_CAPI_ACCESS_TOKEN: "TEST_TOKEN_SHOULD_NEVER_BE_LOGGED",
  RAZORPAY_KEY_ID: "rzp_live_testonly",
  RAZORPAY_KEY_SECRET: "razorpay-secret",
  RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
  AUTH_SECRET: "auth-secret-for-tests",
});
delete process.env.DATABASE_URL;
delete process.env.META_CAPI_TEST_EVENT_CODE;

/* Meta's API stub: records every call; `metaReply` decides the answer */
type Call = { url: string; body: { data: Array<Record<string, any>>; access_token: string; test_event_code?: string } };
const calls: Call[] = [];
let metaReply: "ok" | "500" | "400" | "hang" = "500";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  if (!String(url).includes("graph.facebook.com")) return realFetch(url, init);
  calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
  if (metaReply === "hang") {
    return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }))));
  }
  if (metaReply === "ok") return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  if (metaReply === "400") return new Response(JSON.stringify({ error: { message: "Invalid parameter" } }), { status: 400 });
  return new Response("{}", { status: 500 });
}) as typeof fetch;

const warnings: string[] = [];
const realWarn = console.warn;
console.warn = (...a: unknown[]) => { warnings.push(a.map(String).join(" ")); };
afterAll(() => {
  console.warn = realWarn;
  globalThis.fetch = realFetch;
  rmSync(dataDir, { recursive: true, force: true });
});

const tick = (ms = 150) => new Promise((r) => setTimeout(r, ms));

let capi: typeof import("../../src/server/meta/capi");
let cfg: typeof import("../../src/config/meta");
let events: typeof import("../../src/server/meta/events");
let pay: typeof import("../../src/server/payments");
let db: typeof import("../../src/server/db");

before(async () => {
  capi = await import("../../src/server/meta/capi");
  cfg = await import("../../src/config/meta");
  events = await import("../../src/server/meta/events");
  pay = await import("../../src/server/payments");
  db = await import("../../src/server/db");
});

/* =============================================================== part 1: logic */

test("tracking is off without a valid Pixel ID or without the access token", () => {
  assert.equal(capi.metaConfig({}), null);
  assert.equal(capi.metaConfig({ NEXT_PUBLIC_META_PIXEL_ID: "123456789012345" }), null);
  assert.equal(capi.metaConfig({ META_CAPI_ACCESS_TOKEN: "x" }), null);
  assert.equal(capi.metaConfig({ NEXT_PUBLIC_META_PIXEL_ID: "not-a-number", META_CAPI_ACCESS_TOKEN: "x" }), null);
  assert.equal(cfg.pixelIdFrom(undefined), null);
  assert.equal(cfg.pixelIdFrom(""), null);
  assert.equal(cfg.pixelIdFrom(" 123456789012345 "), "123456789012345");
  const c = capi.metaConfig({ NEXT_PUBLIC_META_PIXEL_ID: "123456789012345", META_CAPI_ACCESS_TOKEN: "x" })!;
  assert.equal(c.version, capi.GRAPH_API_VERSION);
  assert.equal(c.testEventCode, null, "no test code unless one is set");
  assert.equal(capi.metaConfig({ NEXT_PUBLIC_META_PIXEL_ID: "123456789012345", META_CAPI_ACCESS_TOKEN: "x", META_CAPI_TEST_EVENT_CODE: "TEST123" })!.testEventCode, "TEST123");
});

test("sending with nothing configured makes no request and does not throw", async () => {
  const before = calls.length;
  const r = await capi.sendEvents([capi.buildEvent({ name: "PageView", id: "abcdefgh", person: {} })], { env: {} });
  assert.deepEqual(r, { ok: false, retryable: false, error: "not-configured" });
  assert.equal(calls.length, before);
});

test("email and account id are normalized and SHA-256 hashed; IP, user agent, fbp and fbc are not", () => {
  const u = capi.userData({ email: "  Priya.S@Example.COM ", userId: "user-1", ip: "203.0.113.9", userAgent: "Mozilla/5.0", fbp: "fb.1.1700000000000.123456", fbc: "fb.1.1700000000000.AbC_dEf" });
  assert.deepEqual(u.em, [capi.sha256("priya.s@example.com")]);
  assert.deepEqual(u.external_id, [capi.sha256("user-1")]);
  assert.equal(u.client_ip_address, "203.0.113.9");
  assert.equal(u.client_user_agent, "Mozilla/5.0");
  assert.equal(u.fbp, "fb.1.1700000000000.123456");
  assert.equal(u.fbc, "fb.1.1700000000000.AbC_dEf");
  assert.equal(JSON.stringify(u).includes("priya"), false, "the raw email never appears");
  assert.equal(capi.userData({ fbp: "garbage", ip: "local" }).fbp, undefined);
  assert.deepEqual(capi.userData({}), {}, "nothing is invented");
});

test("events keep only the allowed custom fields, so invitation details cannot leak in", () => {
  const e = capi.buildEvent({
    name: "Purchase", id: "purchase_x", person: {},
    custom: { value: 999, currency: "INR", content_ids: ["rose-garden"], ...({ guest_list: ["Asha"], venue: "Taj", couple: "A & B", rsvp: "yes" } as object) },
  });
  assert.deepEqual(Object.keys(e.custom_data!).sort(), ["content_ids", "currency", "value"]);
  assert.equal(e.action_source, "website");
  assert.equal(typeof e.event_time, "number");
});

test("event source URLs lose query strings, ids and other sites", () => {
  const o = "https://www.yourein.in";
  assert.equal(capi.cleanSourceUrl("https://www.yourein.in/templates/rose-garden?utm_source=fb&fbclid=xyz", o), "https://www.yourein.in/templates/rose-garden");
  assert.equal(capi.cleanSourceUrl("https://www.yourein.in/pay/3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f", o), "https://www.yourein.in/pay");
  assert.equal(capi.cleanSourceUrl("https://evil.example/templates/x", o), undefined);
  assert.equal(capi.cleanSourceUrl("/", o), "https://www.yourein.in/");
});

test("tracking never runs on guests' invitations or the admin area", () => {
  for (const p of ["/i/aarav-meera", "/i/aarav-meera/rsvp", "/admin", "/admin/payments", "/shot/x"]) assert.equal(cfg.trackingAllowedOn(p), false, p);
  for (const p of ["/", "/create", "/templates/rose-garden", "/pay/abc", "/success/abc", "/signin", "/india"]) assert.equal(cfg.trackingAllowedOn(p), true, p);
});

test("consent is only ever 'granted' or 'denied'; anything else means no choice", () => {
  assert.equal(cfg.consentFrom("granted"), "granted");
  assert.equal(cfg.consentFrom("denied"), "denied");
  assert.equal(cfg.consentFrom("yes"), null);
  assert.equal(cfg.consentFrom(undefined), null);
});

test("campaign tags are cleaned and limited", () => {
  const a = events.cleanAttribution({ utm_source: "facebook", utm_campaign: "diwali<script>", fbclid: "IwAR0abc_DEF-123", landing_page: "https://evil.example", guest: "x", captured_at: Date.now() });
  assert.equal(a.utm_source, "facebook");
  assert.equal(a.utm_campaign, "diwaliscript");
  assert.equal(a.fbclid, "IwAR0abc_DEF-123");
  assert.equal(a.landing_page, undefined);
  assert.equal((a as Record<string, unknown>).guest, undefined);
  assert.deepEqual(events.cleanAttribution("nope"), {});
  assert.equal(events.fbcFrom("IwAR0abc", 1700000000000), "fb.1.1700000000000.IwAR0abc");
});

test("payments made without live keys reach Meta only while a Test Events code is set", () => {
  const env = { NEXT_PUBLIC_META_PIXEL_ID: "123456789012345", META_CAPI_ACCESS_TOKEN: "x" };
  assert.equal(events.paymentReportable("razorpay", "live", env), true);
  assert.equal(events.paymentReportable("razorpay", "test", env), false);
  assert.equal(events.paymentReportable("test", null, env), false);
  assert.equal(events.paymentReportable("razorpay", "test", { ...env, META_CAPI_TEST_EVENT_CODE: "TEST1" }), true);
  assert.equal(events.paymentReportable("razorpay", "live", {}), false, "nothing without configuration");
});

test("Meta errors and timeouts are reported, never thrown, and the token is never logged or put in the URL", async () => {
  const ev = [capi.buildEvent({ name: "ViewContent", id: "evt_12345678", person: {} })];
  metaReply = "500";
  let n = calls.length;
  let r = await capi.sendEvents(ev, { timeoutMs: 200 });
  assert.equal(r.ok, false);
  assert.equal(calls.length - n, 2, "a server error is retried once");

  metaReply = "400";
  n = calls.length;
  r = await capi.sendEvents(ev, { timeoutMs: 200 });
  assert.deepEqual(r, { ok: false, retryable: false, error: "HTTP 400: Invalid parameter" });
  assert.equal(calls.length - n, 1, "a rejected request is not retried");

  metaReply = "hang";
  r = await capi.sendEvents(ev, { timeoutMs: 100, retries: 0 });
  assert.deepEqual(r, { ok: false, retryable: true, error: "timeout" });

  metaReply = "ok";
  r = await capi.sendEvents(ev);
  assert.deepEqual(r, { ok: true, received: 1 });
  const last = calls.at(-1)!;
  assert.equal(last.url, `https://graph.facebook.com/${capi.GRAPH_API_VERSION}/123456789012345/events`);
  assert.equal(last.url.includes("TEST_TOKEN"), false);
  assert.equal(last.body.test_event_code, undefined, "no test code in normal operation");
  assert.equal(warnings.some((w) => w.includes("TEST_TOKEN")), false, "the token never reaches the logs");
  metaReply = "500";
});

/* =============================================================== part 2: real payment paths */

const sign = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");

async function makeOrder(opts: { consent?: boolean; provider?: "razorpay" | "test"; amount?: number } = {}) {
  const userId = randomUUID(), invId = randomUUID(), orderId = randomUUID(), providerOrderId = `order_${randomUUID().slice(0, 12)}`;
  const email = `buyer-${userId.slice(0, 6)}@example.com`;
  await db.sql`insert into users (id, email, name) values (${userId}, ${email}, 'Buyer')`;
  const data = { name1: "Aarav", name2: "Meera", date: "2026-11-21", time: "18:00", venueName: "Secret Garden Venue", message: "Private family message" };
  await db.sql`insert into invitations (id, user_id, template_slug, status, data) values (${invId}, ${userId}, 'rose-garden', 'ready', ${JSON.stringify(data)}::jsonb)`;
  const ad = opts.consent === false ? null : { consent: "granted", person: { ip: "203.0.113.7", userAgent: "Mozilla/5.0 (test)", fbp: "fb.1.1700000000000.42", fbc: null }, attribution: { utm_source: "facebook" }, sourceUrl: "https://www.yourein.in/pay" };
  await db.sql`insert into orders (id, invitation_id, user_id, amount, currency, provider, provider_order_id, ad_context)
    values (${orderId}, ${invId}, ${userId}, ${opts.amount ?? 99900}, 'INR', ${opts.provider ?? "razorpay"}, ${providerOrderId}, ${ad ? JSON.stringify(ad) : null}::jsonb)`;
  return { userId, invId, orderId, providerOrderId, email };
}

const outbox = (invId: string) => db.sql<{ event_id: string; event_name: string; status: string; payload: any }>`select event_id, event_name, status, payload from meta_events where invitation_id = ${invId}`;

function webhook(event: string, entity: Record<string, unknown>) {
  const raw = JSON.stringify({ event, payload: { payment: { entity } } });
  return pay.handleWebhook(raw, sign("webhook-secret", raw));
}

test("a failed payment never produces a Purchase", async () => {
  const o = await makeOrder();
  await webhook("payment.failed", { id: `pay_f_${o.orderId.slice(0, 8)}`, order_id: o.providerOrderId, amount: 99900, status: "failed" });
  assert.equal((await outbox(o.invId)).length, 0);
});

test("an unverified payment (bad signature) never produces a Purchase", async () => {
  const o = await makeOrder();
  await assert.rejects(pay.verifyAndPublish(null, { orderId: o.providerOrderId, paymentId: "pay_fake", signature: "0".repeat(64) }));
  await assert.rejects(pay.handleWebhook(JSON.stringify({ event: "payment.captured" }), "bad"));
  assert.equal((await outbox(o.invId)).length, 0);
  const inv = await db.sql<{ status: string }>`select status from invitations where id = ${o.invId}`;
  assert.equal(inv[0].status, "ready", "and nothing is published");
});

test("an underpaid webhook is ignored", async () => {
  const o = await makeOrder();
  assert.deepEqual(await webhook("payment.captured", { id: "pay_under", order_id: o.providerOrderId, amount: 100 }), { ignored: true });
  assert.equal((await outbox(o.invId)).length, 0);
});

let paid: Awaited<ReturnType<typeof makeOrder>>;
const paymentId = `pay_${randomUUID().slice(0, 10)}`;

test("a verified payment queues exactly one Purchase with the server's INR amount and a stable id", async () => {
  paid = await makeOrder();
  await pay.verifyAndPublish(null, { orderId: paid.providerOrderId, paymentId, signature: sign("razorpay-secret", `${paid.providerOrderId}|${paymentId}`) });
  const rows = await outbox(paid.invId);
  assert.equal(rows.length, 1);
  const e = rows[0].payload;
  assert.equal(rows[0].event_id, `purchase_${paid.orderId}`);
  assert.equal(e.event_name, "Purchase");
  assert.equal(e.event_id, rows[0].event_id);
  assert.equal(e.custom_data.value, 999);
  assert.equal(e.custom_data.currency, "INR");
  assert.equal(e.custom_data.order_id, paid.providerOrderId);
  assert.deepEqual(e.custom_data.content_ids, ["rose-garden"]);
  assert.equal(e.action_source, "website");
  assert.deepEqual(e.user_data.em, [capi.sha256(paid.email)]);
  assert.equal(e.user_data.client_ip_address, "203.0.113.7");
  const order = await db.sql<{ ad_context: unknown }>`select ad_context from orders where id = ${paid.orderId}`;
  assert.equal(order[0].ad_context, null, "visit details are cleared from the order once used");
});

test("no invitation content, guest data or raw email is in the Purchase payload", async () => {
  const text = JSON.stringify((await outbox(paid.invId))[0].payload);
  for (const secret of ["Aarav", "Meera", "Secret Garden", "Private family", "2026-11-21", paid.email, paid.invId]) assert.equal(text.includes(secret), false, secret);
});

test("duplicate webhooks and a repeat verification never create a second Purchase", async () => {
  await webhook("payment.captured", { id: paymentId, order_id: paid.providerOrderId, amount: 99900 });
  await webhook("payment.captured", { id: paymentId, order_id: paid.providerOrderId, amount: 99900 });
  await webhook("order.paid", { id: paymentId, order_id: paid.providerOrderId, amount: 99900 });
  await pay.verifyAndPublish(null, { orderId: paid.providerOrderId, paymentId, signature: sign("razorpay-secret", `${paid.providerOrderId}|${paymentId}`) });
  const rows = await outbox(paid.invId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_id, `purchase_${paid.orderId}`);
});

test("the success page gets the same event_id once; a refresh gets nothing", async () => {
  const first = await events.claimBrowserPurchase(paid.invId);
  assert.ok(first);
  assert.equal(first.eventId, `purchase_${paid.orderId}`, "browser and server share the event_id");
  assert.equal(first.value, 999);
  assert.equal(first.currency, "INR");
  assert.equal(await events.claimBrowserPurchase(paid.invId), null);
});

test("Meta being down never blocks payment, and the Purchase is retried until it is accepted", async () => {
  await tick();
  metaReply = "500";
  const o = await makeOrder();
  const pid = `pay_${randomUUID().slice(0, 10)}`;
  const out = await pay.verifyAndPublish(null, { orderId: o.providerOrderId, paymentId: pid, signature: sign("razorpay-secret", `${o.providerOrderId}|${pid}`) });
  assert.ok(out.slug, "published despite Meta failing");
  await tick(400);
  assert.equal((await outbox(o.invId))[0].status, "pending");
  metaReply = "ok";
  await db.sql`update meta_events set claimed_at = null`;
  await events.flushOutbox(50);
  assert.equal((await outbox(o.invId))[0].status, "sent");
  const sent = calls.filter((c) => c.body.data[0]?.event_id === `purchase_${o.orderId}`);
  assert.ok(sent.length >= 1);
  assert.equal(new Set(sent.map((c) => c.body.data[0].event_id)).size, 1, "every retry reuses the same event_id");
  metaReply = "500";
});

test("without advertising consent at checkout, a purchase is not reported", async () => {
  const o = await makeOrder({ consent: false });
  const pid = `pay_${randomUUID().slice(0, 10)}`;
  await pay.verifyAndPublish(null, { orderId: o.providerOrderId, paymentId: pid, signature: sign("razorpay-secret", `${o.providerOrderId}|${pid}`) });
  assert.equal((await outbox(o.invId)).length, 0);
});

test("Razorpay test-key payments are only reported to Meta Test Events", async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_only";
  try {
    const o = await makeOrder();
    const pid = `pay_${randomUUID().slice(0, 10)}`;
    await pay.verifyAndPublish(null, { orderId: o.providerOrderId, paymentId: pid, signature: sign("razorpay-secret", `${o.providerOrderId}|${pid}`) });
    assert.equal((await outbox(o.invId)).length, 0, "no test purchase in live data");

    process.env.META_CAPI_TEST_EVENT_CODE = "TEST4242";
    const o2 = await makeOrder();
    const pid2 = `pay_${randomUUID().slice(0, 10)}`;
    await pay.verifyAndPublish(null, { orderId: o2.providerOrderId, paymentId: pid2, signature: sign("razorpay-secret", `${o2.providerOrderId}|${pid2}`) });
    assert.equal((await outbox(o2.invId)).length, 1);
    metaReply = "ok";
    await db.sql`update meta_events set claimed_at = null`;
    await events.flushOutbox(50);
    const c = calls.filter((x) => x.body.data[0]?.event_id === `purchase_${o2.orderId}`).at(-1)!;
    assert.equal(c.body.test_event_code, "TEST4242");
  } finally {
    process.env.RAZORPAY_KEY_ID = "rzp_live_testonly";
    delete process.env.META_CAPI_TEST_EVENT_CODE;
    metaReply = "500";
  }
});

test("a Meta outage cannot stop the payment transaction even if queueing itself fails", async () => {
  const o = await makeOrder();
  await db.sql`alter table meta_events rename to meta_events_off`;
  try {
    const pid = `pay_${randomUUID().slice(0, 10)}`;
    const out = await pay.verifyAndPublish(null, { orderId: o.providerOrderId, paymentId: pid, signature: sign("razorpay-secret", `${o.providerOrderId}|${pid}`) });
    assert.ok(out.slug);
    const ord = await db.sql<{ status: string }>`select status from orders where id = ${o.orderId}`;
    assert.equal(ord[0].status, "paid");
  } finally {
    await db.sql`alter table meta_events_off rename to meta_events`;
  }
});
