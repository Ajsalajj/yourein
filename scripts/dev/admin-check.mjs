/**
 * Checks the admin area over HTTP: who can get in, the unlock step, that the pages show real payments, and the CSV.
 * Run it after scripts/dev/pay-live-path.mjs, against the same site, so there are orders to look at:
 *
 *   RAZORPAY_KEY_ID=rzp_test_local RAZORPAY_KEY_SECRET=local_key_secret RAZORPAY_WEBHOOK_SECRET=local_hook_secret \
 *   RAZORPAY_API_URL=http://127.0.0.1:4010 YOUREIN_DATA_DIR=/tmp/yourein-paycheck AUTH_SECRET=local-auth-secret \
 *   ADMIN_EMAILS=admin@example.com ADMIN_ACCESS_CODE=local-admin-code-1234 npx next start -p 3001
 *
 *   BASE=http://localhost:3001 node scripts/dev/pay-live-path.mjs
 *   BASE=http://localhost:3001 node scripts/dev/admin-check.mjs
 */
import { createServer } from "node:http";

const base = process.env.BASE || "http://localhost:3001";
const ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(",")[0].trim() || "admin@example.com";
const CODE = process.env.ADMIN_ACCESS_CODE || "local-admin-code-1234";
const KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_local";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "local_key_secret";

let fail = 0;
const ok = (name, cond, extra = "") => { if (!cond) fail++; console.log(cond ? "PASS" : "FAIL", name, extra ? `(${extra})` : ""); };

/* a stand-in for the one Razorpay call the admin makes: GET /v1/orders?count=1 */
const mock = createServer((req, res) => {
  const auth = Buffer.from((req.headers.authorization || "").replace("Basic ", ""), "base64").toString();
  if (req.method === "GET" && req.url.startsWith("/v1/orders") && auth === `${KEY_ID}:${KEY_SECRET}`) res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ entity: "collection", count: 0, items: [] }));
  else res.writeHead(401).end("{}");
}).listen(4010, "127.0.0.1");

/** A browser-like client with its own cookies. */
function client() {
  let jar = {};
  const header = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  return async (method, url, data, opts = {}) => {
    const res = await fetch(base + url, { method, redirect: "manual", headers: { Origin: base, Cookie: header(), ...(data !== undefined ? { "Content-Type": "application/json" } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const [k, v] = [pair.slice(0, i), pair.slice(i + 1)];
      if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c) || v === "") delete jar[k]; else jar[k] = v;
    }
    const text = await res.text();
    let json = {}; try { json = JSON.parse(text); } catch {}
    return { status: res.status, location: res.headers.get("location") || "", headers: res.headers, text, json, ...opts };
  };
}

const anon = client();
const stranger = client();
const admin = client();

/* ---- not signed in ---- */
const a1 = await anon("GET", "/admin");
ok("signed out: /admin sends you to sign in", [302, 307].includes(a1.status) && a1.location.startsWith("/signin"), `${a1.status} ${a1.location}`);
ok("signed out: the CSV export is a 404", (await anon("GET", "/api/admin/payments/export")).status === 404);
ok("signed out: the Razorpay check is a 404", (await anon("POST", "/api/admin/check-razorpay", {})).status === 404);

/* ---- a signed-in customer who is not an admin ---- */
await stranger("POST", "/api/auth/signup", { name: "Some Customer", email: `cust${Date.now()}@example.com`, password: "password123" });
for (const path of ["/admin", "/admin/payments", "/admin/customers", "/admin/invitations", "/admin/setup", "/admin/unlock"]) {
  ok(`customer: ${path} looks like a missing page`, (await stranger("GET", path)).status === 404);
}
const strangerPage = await stranger("GET", "/admin/payments");
ok("customer: the 404 shows nothing of the admin area", strangerPage.status === 404 && !/adm-nav|Admin sections|class="adm"|Net revenue/.test(strangerPage.text));
ok("customer: cannot try the access code", (await stranger("POST", "/api/admin/unlock", { code: CODE })).status === 404);
ok("customer: the CSV export is a 404", (await stranger("GET", "/api/admin/payments/export")).status === 404);

/* ---- the admin: allowlisted, but locked until the code is typed ---- */
const signup = await admin("POST", "/api/auth/signup", { name: "Admin Person", email: ADMIN_EMAIL, password: "password123" });
if (signup.status !== 200) await admin("POST", "/api/auth/signin", { email: ADMIN_EMAIL, password: "password123" });
const locked = await admin("GET", "/admin");
ok("admin without the code is sent to the unlock page", [302, 307].includes(locked.status) && locked.location === "/admin/unlock", `${locked.status} ${locked.location}`);
ok("admin without the code cannot use the export or the Razorpay check", (await admin("GET", "/api/admin/payments/export")).status === 404 && (await admin("POST", "/api/admin/check-razorpay", {})).status === 404);
ok("the unlock page opens", (await admin("GET", "/admin/unlock")).status === 200);

const wrong = await admin("POST", "/api/admin/unlock", { code: "not-the-code" });
ok("a wrong code is refused", wrong.status === 403 && !admin.toString().includes("yi_admin"), String(wrong.status));
ok("and still locked", [302, 307].includes((await admin("GET", "/admin")).status));

const right = await admin("POST", "/api/admin/unlock", { code: CODE });
ok("the right code unlocks", right.status === 200);
const cookieHeader = right.headers.getSetCookie().find((c) => c.startsWith("yi_admin=")) || "";
ok("the admin cookie is HttpOnly and SameSite=Strict", /HttpOnly/i.test(cookieHeader) && /SameSite=Strict/i.test(cookieHeader), cookieHeader.replace(/yi_admin=[^;]+/, "yi_admin=…"));

/* ---- the pages ---- */
const home = await admin("GET", "/admin");
ok("the overview opens and shows revenue", home.status === 200 && home.text.includes("Net revenue") && home.text.includes("Latest orders"));
ok("admin pages are never indexed", /noindex/i.test(home.headers.get("x-robots-tag") || "") && /<meta name="robots" content="noindex/i.test(home.text));
const pays = await admin("GET", "/admin/payments");
ok("the payments page lists the orders made by the payment test", pays.status === 200 && pays.text.includes("pay_mock_checkout1") && pays.text.includes("pay_mock_hook1"), pays.text.includes("pay_mock_checkout1") ? "" : "run pay-live-path.mjs first");
ok("it shows paid, failed and refunded orders", pays.text.includes("Paid") && pays.text.includes("Refunded") && pays.text.includes("Not completed"));
const paid = await admin("GET", "/admin/payments?state=paid");
ok("the Paid filter hides the others", paid.status === 200 && !paid.text.includes("Not completed</span>"));
const failed = await admin("GET", "/admin/payments?state=failed");
ok("the Failed filter shows an order whose payment failed, with the reason", failed.status === 200 && failed.text.includes("Insufficient funds") && !failed.text.includes("pay_mock_checkout1"));
const search = await admin("GET", "/admin/payments?q=pay_mock_checkout1");
ok("searching by payment id finds exactly that order", search.status === 200 && search.text.includes("pay_mock_checkout1") && !search.text.includes("pay_mock_hook1"));
ok("the search box cannot break the query", (await admin("GET", `/admin/payments?q=${encodeURIComponent("'; drop table orders; --")}`)).status === 200 && (await admin("GET", "/admin/payments?q=%25&state=bogus&page=-4&from=nope")).status === 200);
ok("customers, invitations and setup open", (await admin("GET", "/admin/customers")).status === 200 && (await admin("GET", "/admin/invitations?status=published")).status === 200 && (await admin("GET", "/admin/setup")).status === 200);
const setup = await admin("GET", "/admin/setup");
ok("setup shows the webhook URL and never a secret", setup.text.includes("/api/pay/webhook") && !setup.text.includes(KEY_SECRET) && !setup.text.includes(CODE) && !setup.text.includes("local_hook_secret"));
const conn = await admin("POST", "/api/admin/check-razorpay", {});
ok("the Razorpay connection check passes with valid keys", conn.status === 200 && conn.json.ok === true, conn.json.message);

/* ---- CSV ---- */
const csv = await admin("GET", "/api/admin/payments/export");
ok("the CSV downloads with a header and the payments", csv.status === 200 && /text\/csv/.test(csv.headers.get("content-type") || "") && csv.text.startsWith("Created (IST),Status,Amount (INR)") && csv.text.includes("pay_mock_checkout1"));
ok("the CSV is not cached", /no-store/.test(csv.headers.get("cache-control") || ""));
ok("the CSV honours filters", !(await admin("GET", "/api/admin/payments/export?state=failed")).text.includes("pay_mock_checkout1"));

/* ---- brute force ---- */
const brute = client();
await brute("POST", "/api/auth/signin", { email: ADMIN_EMAIL, password: "password123" });
let limited = false;
for (let i = 0; i < 12 && !limited; i++) limited = (await brute("POST", "/api/admin/unlock", { code: `guess-${i}` })).status === 429;
ok("repeated wrong codes are rate limited", limited);

/* ---- locking ---- */
await admin("POST", "/api/admin/lock", {});
ok("locking ends the admin session", [302, 307].includes((await admin("GET", "/admin")).status));

/* ---- robots ---- */
const robots = await (await fetch(`${base}/robots.txt`)).text();
ok("robots.txt keeps crawlers out of /admin", /Disallow: \/admin/.test(robots));

mock.close();
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
