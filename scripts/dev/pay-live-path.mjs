/**
 * Exercises the real Razorpay code path on the server (order → signature check → publish, and the webhook)
 * without touching Razorpay: a tiny stand-in answers the Orders API on port 4010.
 *
 * Start the site with placeholder keys pointed at the stand-in, then run this:
 *
 *   RAZORPAY_KEY_ID=rzp_test_local RAZORPAY_KEY_SECRET=local_key_secret RAZORPAY_WEBHOOK_SECRET=local_hook_secret \
 *   RAZORPAY_API_URL=http://127.0.0.1:4010 YOUREIN_DATA_DIR=/tmp/yourein-paycheck npx next start -p 3001
 *
 *   BASE=http://localhost:3001 node scripts/dev/pay-live-path.mjs
 *
 * It cannot cover Razorpay's own checkout window; that needs real test keys and a browser.
 */
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const base = process.env.BASE || "http://localhost:3001";
const KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_local";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "local_key_secret";
const HOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "local_hook_secret";
const hmac = (secret, text) => createHmac("sha256", secret).update(text).digest("hex");

let fail = 0;
const ok = (name, cond, extra = "") => { if (!cond) fail++; console.log(cond ? "PASS" : "FAIL", name, extra ? `(${extra})` : ""); };

/* ---- the stand-in for api.razorpay.com ---- */
const seen = [];
const mock = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const auth = Buffer.from((req.headers.authorization || "").replace("Basic ", ""), "base64").toString();
    if (req.method !== "POST" || req.url !== "/v1/orders" || auth !== `${KEY_ID}:${KEY_SECRET}`) { res.writeHead(401).end("{}"); return; }
    const body = JSON.parse(raw);
    seen.push(body);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ id: `order_mock${Date.now()}${seen.length}`, amount: body.amount, currency: body.currency, status: "created" }));
  });
}).listen(4010, "127.0.0.1");

/* ---- a signed-in host ---- */
let cookie = "";
const call = async (method, url, data, headers = {}) => {
  const res = await fetch(base + url, { method, headers: { Origin: base, Cookie: cookie, ...(data !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, body: data === undefined ? undefined : typeof data === "string" ? data : JSON.stringify(data), redirect: "manual" });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const ready = async (name1, name2) => {
  const { id } = (await call("POST", "/api/invitations", { template: "rose-garden", tz: "Asia/Kolkata" })).body;
  const d = (await call("GET", `/api/invitations/${id}`)).body.invitation.data;
  Object.assign(d, { name1, name2, date: "2027-03-01", time: "11:00", venueName: "The Orchard" });
  await call("PATCH", `/api/invitations/${id}`, { data: d });
  return id;
};
const status = async (id) => (await call("GET", `/api/invitations/${id}`)).body.invitation.status;

await call("POST", "/api/auth/signup", { name: "Pay Check", email: `pay${Date.now()}@example.com`, password: "password123" });

/* ---- checkout path ---- */
const a = await ready("Mira", "Jai");
const o1 = await call("POST", "/api/pay/order", { invitationId: a });
ok("order is created through the Razorpay Orders API for ₹999 in paise", o1.status === 200 && o1.body.mode === "razorpay" && o1.body.keyId === KEY_ID && seen.at(-1)?.amount === 99900 && seen.at(-1)?.currency === "INR", JSON.stringify(seen.at(-1) ?? o1.body).slice(0, 120));
ok("the key secret never reaches the browser", !JSON.stringify(o1.body).includes(KEY_SECRET));
ok("the simulated gateway is off once live keys are set", (await call("POST", "/api/pay/test", { orderId: o1.body.orderId })).status === 403);

const forged = await call("POST", "/api/pay/verify", { orderId: o1.body.orderId, paymentId: "pay_forged", signature: hmac("wrong secret", `${o1.body.orderId}|pay_forged`) });
ok("a callback with a wrong signature is refused and nothing is published", forged.status === 400 && (await status(a)) === "ready", `${forged.status} ${forged.body.error || ""}`.slice(0, 90));
ok("still no public page", (await fetch(`${base}/i/mira-jai`)).status === 404);

const o2 = await call("POST", "/api/pay/order", { invitationId: a });
const pay = "pay_mock_checkout1";
const good = await call("POST", "/api/pay/verify", { orderId: o2.body.orderId, paymentId: pay, signature: hmac(KEY_SECRET, `${o2.body.orderId}|${pay}`) });
ok("a correctly signed callback publishes the invitation", good.status === 200 && (await status(a)) === "published", JSON.stringify(good.body));
ok("and its page is live", (await fetch(`${base}/i/${good.body.slug}`)).status === 200, good.body.slug);
const twice = await call("POST", "/api/pay/verify", { orderId: o2.body.orderId, paymentId: pay, signature: hmac(KEY_SECRET, `${o2.body.orderId}|${pay}`) });
ok("verifying the same payment twice is harmless", twice.status === 200 && twice.body.slug === good.body.slug);

/* ---- webhook path: the customer closed the tab right after paying ---- */
const b = await ready("Noor", "Kian");
const o3 = await call("POST", "/api/pay/order", { invitationId: b });
const hook = (event, entity) => JSON.stringify({ event, payload: { payment: { entity } } });
const send = (raw, sig) => call("POST", "/api/pay/webhook", raw, { "Content-Type": "application/json", "X-Razorpay-Signature": sig, Origin: "https://api.razorpay.com", Cookie: "" });

const unsigned = hook("payment.captured", { id: "pay_mock_hook1", order_id: o3.body.orderId, status: "captured", amount: 99900 });
ok("webhook with a bad signature is refused", (await send(unsigned, "nope")).status === 400 && (await status(b)) === "ready");
const short = hook("payment.captured", { id: "pay_mock_short", order_id: o3.body.orderId, status: "captured", amount: 100 });
ok("webhook for less than the price is ignored", (await send(short, hmac(HOOK_SECRET, short))).body.ignored === true && (await status(b)) === "ready");
const other = hook("payment.failed", { id: "pay_mock_failed", order_id: o3.body.orderId, status: "failed", amount: 99900 });
ok("webhook for a failed payment is ignored", (await send(other, hmac(HOOK_SECRET, other))).body.ignored === true && (await status(b)) === "ready");
const first = await send(unsigned, hmac(HOOK_SECRET, unsigned));
ok("a signed payment.captured webhook publishes without the browser", first.status === 200 && (await status(b)) === "published", JSON.stringify(first.body));
const replay = await send(unsigned, hmac(HOOK_SECRET, unsigned));
ok("a replayed webhook changes nothing", replay.status === 200 && (await status(b)) === "published");

mock.close();
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
