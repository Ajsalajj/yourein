/**
 * The paths the main journey test does not walk: returning users, password reset, Google when it is not set up,
 * switching design, a single-host invitation, very long names, hiding an invitation, closed and switched-off RSVPs,
 * and one account trying to reach another's invitation.
 *
 *   node scripts/dev/e2e-extra.mjs [screenshot-dir]        (dev server, or a build started with YOUREIN_TEST_PAYMENTS=1)
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.BASE || "http://localhost:3000";
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
let fail = 0, n = 0;
const ok = (name, cond, extra = "") => { if (!cond) fail++; console.log(cond ? "PASS" : "FAIL", name, extra ? `(${extra})` : ""); };
const browser = await chromium.launch();
const phone = { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const ctx = await browser.newContext(phone);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const hideDev = (p) => p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
const snap = async (p, name) => { if (shots) { await hideDev(p); await p.screenshot({ path: `${shots}/${String(++n).padStart(2, "0")}-${name}.png` }); } };
const call = async (c, method, url, data) => { const r = await c.request.fetch(base + url, { method, data, failOnStatusCode: false }); return { status: r.status(), body: await r.json().catch(() => ({})) }; };
const must = async (c, method, url, data) => { const r = await call(c, method, url, data); if (r.status >= 400) throw new Error(`${method} ${url} ${r.status} ${JSON.stringify(r.body)}`); return r.body; };
const publish = async (c, id) => { const o = await must(c, "POST", "/api/pay/order", { invitationId: id }); const p = await must(c, "POST", "/api/pay/test", { orderId: o.orderId }); return (await must(c, "POST", "/api/pay/verify", p)).slug; };
const stamp = Date.now();
const email = `extra${stamp}@example.com`;

/* ---------- account: sign up, sign out, come back ---------- */
await must(ctx, "POST", "/api/auth/signup", { name: "Dev Menon", email, password: "first password 1" });
await page.goto(base + "/account", { waitUntil: "networkidle" });
await page.locator("text=Sign out of YoureIn").click();
await page.waitForURL((u) => !u.pathname.startsWith("/account"), { timeout: 15000 });
await page.goto(base + "/dashboard", { waitUntil: "networkidle" });
ok("after signing out the dashboard asks for sign-in", page.url().includes("/signin"));

/* Google when it has no keys */
await page.goto(base + "/signin?next=%2Fstart%2Frose-garden", { waitUntil: "networkidle" });
await page.locator("text=Continue with Google").click();
await page.waitForURL(/error=google-off/);
ok("Google without keys explains itself and keeps the chosen design", (await page.locator(".form-error").textContent()).includes("not set up") && (await page.locator(".auth-tpl").textContent()).includes("Rose Garden"));
await snap(page, "google-off");

/* returning user: wrong password, then right */
await page.locator(".auth-alt >> text=Sign in").click();
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill("not the password");
await page.locator('button[type="submit"]').click();
await page.waitForSelector(".form-error");
ok("wrong password is refused with a plain message", /do not match/i.test(await page.locator(".form-error").textContent()), await page.locator(".form-error").textContent());
await page.locator('input[type="password"]').fill("first password 1");
await page.locator('button[type="submit"]').click();
await page.waitForURL(/\/edit\//, { timeout: 20000 });
await page.waitForSelector(".ed-title b");
ok("a returning user lands in the editor for the design they picked", (await page.locator(".ed-title b").textContent()) === "Rose Garden");
const roseId = page.url().match(/edit\/([0-9a-f-]+)/)[1];

/* ---------- forgot password ---------- */
await must(ctx, "POST", "/api/auth/signout");
await page.goto(base + "/signin", { waitUntil: "networkidle" });
await page.locator(".auth-alt >> text=Sign in").click();
await page.locator("text=Forgot password?").click();
await page.locator('input[type="email"]').fill(email);
await page.locator('button[type="submit"]').click();
await page.waitForSelector(".auth-done");
await snap(page, "forgot");
const link = await page.locator(".auth-done a").getAttribute("href").catch(() => null);
if (link) {
  await page.goto(link, { waitUntil: "networkidle" });
  await page.locator('input[type="password"]').fill("second password 2");
  await snap(page, "reset");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  ok("reset link sets a new password and signs in", true);
  const again = await call(ctx, "POST", "/api/auth/reset", { token: new URL(link).searchParams.get("token"), password: "third password 3" });
  ok("a reset link works only once", again.status >= 400, String(again.status));
  const anon = await browser.newContext();
  ok("old password no longer works, new one does", (await call(anon, "POST", "/api/auth/signin", { email, password: "first password 1" })).status === 401 && (await call(anon, "POST", "/api/auth/signin", { email, password: "second password 2" })).status === 200);
  await anon.close();
} else {
  /* a production build never shows the link on screen */
  ok("without email set up, a production build says reset is unavailable (no link leaked)", (await page.locator(".auth-done").textContent()).includes("not available"));
  await must(ctx, "POST", "/api/auth/signin", { email, password: "first password 1" });
}

/* ---------- editor: design switch keeps the words ---------- */
await page.goto(`${base}/edit/${roseId}`, { waitUntil: "networkidle" });
await page.getByLabel("First name (bride or groom)").fill("Ira");
await page.getByLabel("Second name").fill("Kabir");
await page.goto(`${base}/edit/${roseId}?step=design`, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForSelector(".tpl-pick");
await page.locator('.tpl-pick:has-text("Jasmine Moon")').click();
await page.waitForFunction(() => document.querySelector(".ed-title b")?.textContent === "Jasmine Moon");
await page.waitForFunction(() => /Saved/.test(document.querySelector(".ed-save")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
await snap(page, "design-switch");
const after = (await must(ctx, "GET", `/api/invitations/${roseId}`)).invitation;
ok("switching design in the editor keeps what was typed", after.templateSlug === "jasmine-moon" && after.data.name1 === "Ira" && after.data.name2 === "Kabir", `${after.templateSlug} ${after.data.name1} & ${after.data.name2}`);

/* ---------- a single host, and very long names, on a 360px phone ---------- */
const mk = async (template, patch) => {
  const { id } = await must(ctx, "POST", "/api/invitations", { template, tz: "Asia/Kolkata" });
  const d = (await must(ctx, "GET", `/api/invitations/${id}`)).invitation.data;
  Object.assign(d, { date: "2027-02-06", time: "17:00", venueName: "The Courtyard", venueAddress: "12 Residency Road, Bengaluru" }, patch);
  await must(ctx, "PATCH", `/api/invitations/${id}`, { data: d });
  return { id, d };
};
const guestCtx = await browser.newContext(phone);
const g = await guestCtx.newPage();
g.on("pageerror", (e) => errors.push("guest: " + e.message));
const heroFit = () => g.evaluate(() => {
  const hero = document.querySelector(".inv-hero").getBoundingClientRect();
  const bad = [...document.querySelectorAll(".inv-hero .hero-text *")].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.left < hero.left - 1 || b.right > hero.right + 1); }).length;
  return { bad, text: document.querySelector(".inv-hero .hero-text").innerText.replace(/\s+/g, " ").trim(), over: document.documentElement.scrollWidth - innerWidth };
});

const solo = await mk("garden-swing", { eventType: "Birthday", eventTitle: "Turns thirty", name1: "Naina", name2: "", hosts: "", inviteText: "Come celebrate" });
const soloSlug = await publish(ctx, solo.id);
await g.goto(`${base}/i/${soloSlug}`, { waitUntil: "networkidle" });
await g.waitForSelector(".open-hit");
await snap(g, "single-name-cover");
await g.locator(".open-hit").click();
await g.waitForSelector('.inv[data-phase="open"]', { timeout: 15000 });
await g.waitForTimeout(900);
await snap(g, "single-name");
const s1 = await heroFit();
ok("a single-host invitation shows one name and no stray ampersand", s1.text.includes("Naina") && !s1.text.includes("&") && s1.bad === 0, s1.text);
ok("its link is made from the one name", soloSlug.startsWith("naina"), soloSlug);

for (const template of ["ivory-wax-seal", "rose-garden", "royal-emerald", "kerala-ivory", "scenic-romance"]) {
  const long = await mk(template, { name1: "Anantha Padmanabhan", name2: "Venkatalakshmi Subramaniam" });
  const slug = await publish(ctx, long.id);
  await g.goto(`${base}/i/${slug}`, { waitUntil: "networkidle" });
  await g.waitForSelector(".open-hit");
  await g.locator(".open-hit").click();
  await g.waitForSelector('.inv[data-phase="open"]', { timeout: 15000 });
  await g.waitForTimeout(700);
  await snap(g, `long-${template}`);
  const f = await heroFit();
  ok(`very long names stay inside the screen on ${template}`, f.bad === 0 && f.over <= 0, JSON.stringify(f).slice(0, 140));
}

/* ---------- hide and show ---------- */
await page.goto(`${base}/invites/${solo.id}`, { waitUntil: "networkidle" });
await page.locator("text=Hide invitation").click();
await page.waitForSelector("text=Show it again", { timeout: 15000 });
await g.goto(`${base}/i/${soloSlug}`, { waitUntil: "networkidle" });
await snap(g, "hidden");
ok("a hidden invitation tells guests it is no longer available", (await g.locator("h1").textContent()).includes("no longer available") && (await g.locator(".inv-hero").count()) === 0);
const closed = await call(guestCtx, "POST", "/api/rsvp", { invitation: soloSlug, status: "yes", name: "Late Guest", count: 1 });
ok("a hidden invitation takes no replies", closed.status >= 400, `${closed.status} ${closed.body.error || ""}`);
await page.locator("text=Show it again").click();
await page.waitForSelector("text=Hide invitation", { timeout: 15000 });
await g.goto(`${base}/i/${soloSlug}`, { waitUntil: "networkidle" });
ok("showing it again brings the invitation back", (await g.locator(".inv-hero").count()) === 1);

/* ---------- RSVP closed by date, and switched off ---------- */
const late = await mk("botanical-vow", { name1: "Rhea", name2: "Arnav" });
late.d.rsvp = { ...late.d.rsvp, deadline: "2020-01-01" };
await must(ctx, "PATCH", `/api/invitations/${late.id}`, { data: late.d });
const lateSlug = await publish(ctx, late.id);
const lateTry = await call(guestCtx, "POST", "/api/rsvp", { invitation: lateSlug, status: "yes", name: "Too Late", count: 1 });
await g.goto(`${base}/i/${lateSlug}`, { waitUntil: "networkidle" });
ok("after the reply-by date the form is closed, on the page and on the server", lateTry.status >= 400 && /closed|passed/i.test(await g.locator("#rsvp").innerText()) && (await g.locator("#rsvp .rsvp-choice").count()) === 0, `${lateTry.status} ${lateTry.body.error || ""}`);

const off = await mk("pearl-vellum", { name1: "Tara", name2: "Vir" });
off.d.rsvp = { ...off.d.rsvp, enabled: false };
await must(ctx, "PATCH", `/api/invitations/${off.id}`, { data: off.d });
const offSlug = await publish(ctx, off.id);
const offTry = await call(guestCtx, "POST", "/api/rsvp", { invitation: offSlug, status: "yes", name: "No Form", count: 1 });
await g.goto(`${base}/i/${offSlug}`, { waitUntil: "networkidle" });
ok("with RSVP switched off there is no form and no way to reply", offTry.status >= 400 && (await g.locator("#rsvp").count()) === 0 && !(await g.locator(".pub-bar").innerText().catch(() => "")).includes("RSVP"), `${offTry.status}`);
ok("directions and calendar are still offered", (await g.locator('a[href*="google.com/maps"], a[href*="maps.app"]').count()) > 0 && (await g.locator("text=Add to calendar").count()) > 0);

/* ---------- drafts and other people's invitations ---------- */
const draft = await mk("temple-heritage", { name1: "Not", name2: "Paid" });
const guess = await g.goto(`${base}/i/not-paid`, { waitUntil: "networkidle" });
ok("an unpaid draft has no public page", guess.status() === 404);
const other = await browser.newContext(phone);
await must(other, "POST", "/api/auth/signup", { name: "Someone Else", email: `other${stamp}@example.com`, password: "another password" });
const peek = await Promise.all([
  call(other, "GET", `/api/invitations/${solo.id}`), call(other, "PATCH", `/api/invitations/${solo.id}`, { archived: true }), call(other, "GET", `/api/invitations/${solo.id}/guests`),
  call(other, "GET", `/api/invitations/${solo.id}/rsvps`), call(other, "POST", "/api/pay/order", { invitationId: draft.id }), call(other, "DELETE", `/api/invitations/${draft.id}`),
]);
ok("another account cannot read, change, pay for or delete it", peek.every((r) => r.status === 404 || r.status === 403), peek.map((r) => r.status).join(" "));
const op = await other.newPage();
const seen = [];
for (const u of [`/edit/${solo.id}`, `/invites/${solo.id}`, `/invites/${solo.id}/rsvps`, `/pay/${draft.id}`]) seen.push((await op.goto(base + u, { waitUntil: "domcontentloaded" })).status());
ok("nor open its editor, dashboard, replies or payment screen", seen.every((s) => s === 404), seen.join(" "));

/* delete a draft from its page */
await page.goto(`${base}/invites/${draft.id}`, { waitUntil: "networkidle" });
await page.locator("text=Delete draft").click();
await page.locator("text=Yes, delete it").click();
await page.waitForURL(/\/invites$/, { timeout: 15000 });
ok("a draft can be deleted", (await call(ctx, "GET", `/api/invitations/${draft.id}`)).status === 404);

ok("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
await browser.close();
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
