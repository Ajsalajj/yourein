/**
 * Browser check of Meta Pixel + Conversions API behaviour.  npm run test:meta:browser
 *
 * Meta is never contacted: fbevents.js is replaced by a recorder, and the server's Conversions API calls go to a local
 * stub started by this script. Payments use the site's simulated test mode (no money, no Razorpay).
 *
 * With tracking configured (the default), start the site like this, then run the script:
 *   NEXT_PUBLIC_META_PIXEL_ID=123456789012345 META_CAPI_ACCESS_TOKEN=dummy META_CAPI_TEST_EVENT_CODE=TEST_E2E \
 *   META_GRAPH_API_URL=http://127.0.0.1:3999 npm run dev -- -p 3001
 *   BASE=http://localhost:3001 npm run test:meta:browser
 *
 * Against a site with no Pixel ID, run with EXPECT=off to check that nothing loads at all.
 */
import { createServer } from "node:http";
import { chromium } from "playwright";

const base = process.env.BASE || "http://localhost:3000";
const OFF = process.env.EXPECT === "off";
let fail = 0;
const ok = (name, cond, extra = "") => { if (!cond) fail++; console.log(cond ? "PASS" : "FAIL", name, extra ? `(${extra})` : ""); };

/* ---- local stand-in for graph.facebook.com ---- */
const capi = [];
const stub = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try { capi.push({ url: req.url, ...JSON.parse(body) }); } catch {}
    res.writeHead(200, { "Content-Type": "application/json" }).end('{"events_received":1}');
  });
});
if (!OFF) await new Promise((r) => stub.listen(3999, "127.0.0.1", r));
const capiEvents = (name) => capi.flatMap((c) => c.data.map((d) => ({ ...d, token: c.access_token, test: c.test_event_code }))).filter((d) => d.event_name === name);
const waitFor = async (fn, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return fn(); };

/* ---- fake fbevents.js: keeps Meta's stub, records every call ---- */
const FAKE = `(function(){var f=window.fbq;window.__fbqLoads=(window.__fbqLoads||0)+1;window.__fbq=window.__fbq||[];
f.callMethod=function(){window.__fbq.push(Array.prototype.slice.call(arguments))};
(f.queue||[]).forEach(function(a){window.__fbq.push(Array.prototype.slice.call(a))});f.queue=[];})();`;

const browser = await chromium.launch();
async function visitor() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const net = { fb: 0, relay: [] };
  await ctx.route("https://connect.facebook.net/**", (route) => { net.fb++; route.fulfill({ contentType: "text/javascript", body: FAKE }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (r.url().endsWith("/api/meta/event")) net.relay.push(JSON.parse(r.postData() || "{}")); });
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }));
  return { ctx, page, net, errors };
}
const fbq = (page) => page.evaluate(() => window.__fbq || []);
const count = (calls, ...match) => calls.filter((c) => match.every((m, i) => m === undefined || c[i] === m)).length;
const banner = (page) => page.locator(".ad-consent");

if (OFF) {
  const v = await visitor();
  for (const p of ["/", "/templates/rose-garden", "/create"]) await v.page.goto(base + p, { waitUntil: "networkidle" });
  ok("no Pixel ID: no consent banner", (await banner(v.page).count()) === 0);
  ok("no Pixel ID: fbevents.js is never requested", v.net.fb === 0);
  ok("no Pixel ID: no events are relayed", v.net.relay.length === 0);
  ok("no Pixel ID: no fbq on the page", await v.page.evaluate(() => typeof window.fbq === "undefined"));
  ok("no page errors", v.errors.length === 0, v.errors[0]);
  await browser.close();
  console.log(fail ? `\n${fail} failed` : "\nall passed");
  process.exit(fail ? 1 : 0);
}

/* ---------- 1. before any choice: nothing loads ---------- */
{
  const v = await visitor();
  await v.page.goto(base + "/templates/rose-garden", { waitUntil: "networkidle" });
  ok("the consent banner is shown on first visit", await banner(v.page).isVisible());
  ok("nothing loads before a choice", v.net.fb === 0 && v.net.relay.length === 0);

  /* ---------- 2. declining: still nothing, and it is remembered ---------- */
  await v.page.getByRole("button", { name: "No thanks" }).click();
  await v.page.waitForTimeout(600);
  ok("after No thanks: fbevents.js never loads and nothing is relayed", v.net.fb === 0 && v.net.relay.length === 0);
  await v.page.reload({ waitUntil: "networkidle" });
  ok("the choice is remembered (no banner after reload)", (await banner(v.page).count()) === 0);
  ok("still nothing loads after reload", v.net.fb === 0);
  ok("no page errors", v.errors.length === 0, v.errors[0]);
  await v.ctx.close();
}

/* ---------- 3. allowing: one Pixel, one init, one PageView per page ---------- */
{
  const v = await visitor();
  await v.page.goto(base + "/", { waitUntil: "networkidle" });
  await v.page.getByRole("button", { name: "Allow" }).click();
  await v.page.waitForFunction(() => (window.__fbq || []).some((c) => c[1] === "PageView"));
  let calls = await fbq(v.page);
  ok("Pixel script loaded once", v.net.fb === 1 && (await v.page.evaluate(() => window.__fbqLoads)) === 1);
  ok("init called once with the Pixel ID (Strict Mode safe)", count(calls, "init", "123456789012345") === 1);
  ok("automatic configuration is off", count(calls, "set", "autoConfig", false) === 1);
  ok("automatic history tracking is off", await v.page.evaluate(() => window.fbq.disablePushState === true));
  ok("one PageView for the landing page", count(calls, "track", "PageView") === 1);

  /* client-side navigation through Next links */
  await v.page.locator('.foot-acct a[href="/create"]').first().click();
  await v.page.waitForURL("**/create");
  await v.page.waitForTimeout(800);
  calls = await fbq(v.page);
  ok("client-side navigation sends exactly one more PageView", count(calls, "track", "PageView") === 2, `${count(calls, "track", "PageView")}`);
  ok("the Pixel was not loaded or initialised again", v.net.fb === 1 && count(calls, "init") === 1);

  await v.page.goto(base + "/templates/rose-garden", { waitUntil: "networkidle" });
  await v.page.waitForFunction(() => (window.__fbq || []).some((c) => c[1] === "ViewContent"));
  calls = await fbq(v.page);
  const vc = calls.filter((c) => c[1] === "ViewContent");
  ok("ViewContent fires once on a design page", vc.length === 1, `${vc.length}`);
  ok("ViewContent carries public design details only", vc[0]?.[2]?.content_ids?.[0] === "rose-garden" && vc[0][2].content_type === "product" && !!vc[0][2].content_name);
  const relayed = v.net.relay.find((r) => r.event === "ViewContent");
  ok("the server gets ViewContent with the same event_id", !!relayed && relayed.eventId === vc[0]?.[3]?.eventID);
  await waitFor(() => capiEvents("ViewContent").some((e) => e.event_id === relayed?.eventId));
  const sv = capiEvents("ViewContent").find((e) => e.event_id === relayed?.eventId);
  ok("Conversions API received ViewContent with that event_id", !!sv);
  ok("server event: action_source website, clean source URL, UA unhashed", sv?.action_source === "website" && sv?.event_source_url?.endsWith("/templates/rose-garden") && /Mozilla/.test(sv?.user_data?.client_user_agent ?? ""), JSON.stringify({ u: sv?.event_source_url, ua: sv?.user_data?.client_user_agent }));
  ok("server event: test code present only because this run sets it", sv?.test === "TEST_E2E");

  /* preview and customize */
  const viewsBefore = count(calls, "track", "PageView");
  await v.page.locator('button[aria-label^="Preview "]').first().click();
  await v.page.waitForFunction(() => (window.__fbq || []).some((c) => c[1] === "TemplatePreview"));
  calls = await fbq(v.page);
  ok("TemplatePreview is a custom event", count(calls, "trackCustom", "TemplatePreview") === 1);
  ok("opening a preview is not a PageView", count(calls, "track", "PageView") === viewsBefore, `${count(calls, "track", "PageView")}`);
  await v.page.goBack();
  await v.page.waitForTimeout(600);
  ok("closing a preview is not a PageView either", count(await fbq(v.page), "track", "PageView") === viewsBefore);

  /* reopening the choice from the footer and withdrawing */
  await v.page.getByRole("button", { name: "Cookie settings" }).click();
  ok("Cookie settings reopens the choice", await banner(v.page).isVisible());
  await v.page.getByRole("button", { name: "No thanks" }).click();
  calls = await fbq(v.page);
  ok("withdrawing tells the Pixel to stop", count(calls, "consent", "revoke") === 1);
  const before = calls.length;
  await v.page.locator('button[aria-label^="Preview "]').first().click();
  await v.page.waitForTimeout(700);
  ok("no events after withdrawing", (await fbq(v.page)).length === before);
  ok("no page errors", v.errors.length === 0, v.errors[0]);
  await v.ctx.close();
}

/* ---------- 4. events before the choice wait, and go out on Allow ---------- */
{
  const v = await visitor();
  await v.page.goto(base + "/templates/rose-garden", { waitUntil: "networkidle" });
  ok("ViewContent waits while the visitor decides", v.net.relay.length === 0 && v.net.fb === 0);
  await v.page.getByRole("button", { name: "Allow" }).click();
  await v.page.waitForFunction(() => (window.__fbq || []).some((c) => c[1] === "ViewContent"));
  const calls = await fbq(v.page);
  ok("on Allow, the waiting PageView and ViewContent are sent once each", count(calls, "track", "PageView") === 1 && count(calls, "track", "ViewContent") === 1);
  await v.ctx.close();
}

/* ---------- 5. guests' invitations and admin never track ---------- */
{
  const v = await visitor();
  await v.ctx.addCookies([{ name: "yi_ads_consent", value: "granted", url: base }]);
  await v.page.goto(base + "/admin", { waitUntil: "networkidle" });
  await v.page.goto(base + "/i/no-such-invitation", { waitUntil: "networkidle" });
  ok("no Pixel on /admin or /i/… even with consent", v.net.fb === 0 && (await banner(v.page).count()) === 0);
  await v.ctx.close();
}

/* ---------- 6. registration, checkout and a verified purchase ---------- */
{
  const v = await visitor();
  await v.ctx.addCookies([{ name: "yi_ads_consent", value: "granted", url: base }]);
  await v.page.goto(base + "/signin", { waitUntil: "networkidle" });
  const r = v.page.request;
  const email = `meta${Date.now()}@example.com`;
  const signup = await (await r.post(`${base}/api/auth/signup`, { data: { name: "Meta Test", email, password: "password123" } })).json();
  ok("sign-up returns the CompleteRegistration event_id", typeof signup.metaEventId === "string" && signup.metaEventId.startsWith("signup_"));
  await waitFor(() => capiEvents("CompleteRegistration").some((e) => e.event_id === signup.metaEventId));
  const reg = capiEvents("CompleteRegistration").find((e) => e.event_id === signup.metaEventId);
  ok("Conversions API got CompleteRegistration with a hashed email", !!reg && /^[a-f0-9]{64}$/.test(reg.user_data.em?.[0] ?? "") && !JSON.stringify(reg).includes(email));
  ok("the access token goes in the body, not the URL", reg?.token === "dummy" && !capi.some((c) => c.url.includes("dummy")));

  const created = await (await r.post(`${base}/api/invitations`, { data: { template: "rose-garden", tz: "Asia/Kolkata" } })).json();
  const id = created.id;
  const cur = (await (await r.get(`${base}/api/invitations/${id}`)).json()).invitation;
  const data = { ...cur.data, name1: "Aarav", name2: "Meera", date: "2027-02-14", time: "18:00", venueName: "Private Venue Name", message: "Private message text" };
  await r.patch(`${base}/api/invitations/${id}`, { data: { data } });

  const order = await (await r.post(`${base}/api/pay/order`, { data: { invitationId: id, attribution: { utm_source: "facebook", utm_campaign: "test", fbclid: "IwAR_test_click_1234" } } })).json();
  ok("starting checkout returns the InitiateCheckout event_id", typeof order.metaEventId === "string" && order.metaEventId.startsWith("checkout_"), order.error);
  await waitFor(() => capiEvents("InitiateCheckout").some((e) => e.event_id === order.metaEventId));
  const ic = capiEvents("InitiateCheckout").find((e) => e.event_id === order.metaEventId);
  ok("InitiateCheckout has the server's INR amount", !!ic && ic.custom_data.currency === "INR" && ic.custom_data.value === order.amount / 100);
  ok("InitiateCheckout has an fbc built from the ad click", ic?.user_data?.fbc?.endsWith(".IwAR_test_click_1234"));

  /* visiting the success page before paying never yields a Purchase */
  await v.page.goto(`${base}/success/${id}`, { waitUntil: "networkidle" });
  ok("an unpaid invitation's success page sends no Purchase", count(await fbq(v.page), "track", "Purchase") === 0 && capiEvents("Purchase").length === 0);

  const t = await (await r.post(`${base}/api/pay/test`, { data: { orderId: order.orderId } })).json();
  await r.post(`${base}/api/pay/verify`, { data: { orderId: t.orderId, paymentId: t.paymentId, signature: "0".repeat(64) } });
  ok("a bad signature sends no Purchase", (await v.page.waitForTimeout(800), capiEvents("Purchase").length === 0));
  const verified = await r.post(`${base}/api/pay/verify`, { data: t });
  ok("the verified payment publishes", verified.ok());

  await v.page.goto(`${base}/success/${id}`, { waitUntil: "networkidle" });
  await v.page.waitForFunction(() => (window.__fbq || []).some((c) => c[1] === "Purchase"), null, { timeout: 8000 }).catch(() => {});
  const calls = await fbq(v.page);
  const bp = calls.filter((c) => c[1] === "Purchase");
  ok("the browser sends Purchase once on the success page", bp.length === 1);
  await waitFor(() => capiEvents("Purchase").length > 0);
  const sp = capiEvents("Purchase");
  ok("the server sends exactly one Purchase", sp.length === 1, `${sp.length}`);
  ok("browser and server Purchase share the event_id", !!bp[0] && bp[0][3]?.eventID === sp[0]?.event_id && sp[0].event_id.startsWith("purchase_"));
  ok("Purchase value and currency come from the order", bp[0]?.[2]?.currency === "INR" && bp[0][2].value === order.amount / 100 && sp[0]?.custom_data?.value === order.amount / 100);
  ok("no invitation details in any event", !JSON.stringify(capi).match(/Aarav|Meera|Private Venue|Private message|2027-02-14/) && !JSON.stringify(bp).match(/Aarav|Meera/));

  await v.page.reload({ waitUntil: "networkidle" });
  await v.page.waitForTimeout(1200);
  ok("refreshing the success page sends no second Purchase", count(await fbq(v.page), "track", "Purchase") === 0 && capiEvents("Purchase").length === 1);
  await r.post(`${base}/api/pay/verify`, { data: t });
  await v.page.waitForTimeout(800);
  ok("verifying the same payment again sends no second Purchase", capiEvents("Purchase").length === 1);
  ok("no page errors", v.errors.length === 0, v.errors[0]);
  await v.ctx.close();
}

await browser.close();
stub.close();
console.log(fail ? `\n${fail} failed` : "\nall passed");
process.exit(fail ? 1 : 0);
