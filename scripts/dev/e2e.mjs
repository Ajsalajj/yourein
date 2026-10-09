/**
 * End-to-end check of the whole customer journey on a phone-sized screen:
 * browse → preview → customize → sign up → edit → RSVP setup → preview → pay → publish → share → guest RSVP → host dashboard.
 *
 *   npm run dev            (or build + start with YOUREIN_TEST_PAYMENTS=1)
 *   node scripts/dev/e2e.mjs [screenshot-dir]
 *   VIDEO=<dir> SLOWMO=120 node scripts/dev/e2e.mjs      also records each phone as a .webm
 *
 * Uses test payments, so it must run against a site without live Razorpay keys.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.BASE || "http://localhost:3000";
const shots = process.argv[2];
const W = Number(process.env.W || 390), H = Number(process.env.H || 800);
if (shots) mkdirSync(shots, { recursive: true });

let fail = 0, n = 0;
const ok = (name, cond, extra = "") => { if (!cond) fail++; console.log(cond ? "PASS" : "FAIL", name, extra ? `(${extra})` : ""); };
const browser = await chromium.launch({ slowMo: Number(process.env.SLOWMO || 0) });
const phone = { viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...(process.env.VIDEO ? { recordVideo: { dir: process.env.VIDEO, size: { width: W, height: H } } } : {}) };
const host = await browser.newContext(phone);
const page = await host.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const snap = async (p, name) => { if (shots) await p.screenshot({ path: `${shots}/${String(++n).padStart(2, "0")}-${name}.png` }); if (process.env.VIDEO) await p.waitForTimeout(1100); };
const hideDev = (p) => p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
const email = `host${Date.now()}@example.com`;

/* ---------- browse ---------- */
await page.goto(base + "/", { waitUntil: "networkidle" });
await hideDev(page);
await snap(page, "home");
const cols = await page.evaluate(() => getComputedStyle(document.querySelector(".grid")).gridTemplateColumns.split(" ").length);
ok("catalog shows 2 designs per row on a phone", cols === 2, `${cols} columns`);
ok("no WhatsApp order buttons anywhere on the home page", (await page.locator('a[href*="wa.me"]').count()) === 0 && !(await page.content()).includes("Order on WhatsApp"));
ok("every card has Preview and Customize", (await page.locator(".grid .card").count()) === 15 && (await page.locator(".grid .card [data-customize]").count()) === 15 && (await page.locator(".grid .card .card-actions button").count()) === 15);
const fit = await page.evaluate(() => {
  const card = document.querySelector(".grid .card"), pm = card.querySelector(".pm:not(.pm-back)");
  return { ratio: pm.getBoundingClientRect().width / card.getBoundingClientRect().width, over: document.documentElement.scrollWidth - innerWidth, nameLines: Math.max(...[...document.querySelectorAll(".card-name")].map((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))) };
});
ok("phone mockup takes 75 to 85% of the card width", fit.ratio >= 0.75 && fit.ratio <= 0.85, fit.ratio.toFixed(2));
ok("no horizontal overflow, names within 2 lines", fit.over <= 0 && fit.nameLines <= 2, JSON.stringify(fit));
await page.locator("#templates").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await snap(page, "catalog");

/* ---------- preview (no login needed) ---------- */
await page.locator('.card:has(a[href="/templates/royal-emerald"]) .card-actions button').click();
await page.waitForSelector(".pv .inv-hero");
await page.waitForTimeout(700);
await snap(page, "preview-sealed");
ok("preview opens without signing in", page.url().startsWith(base + "/") && !(page.url().includes("signin")));
const pv = await page.evaluate(() => { const s = document.querySelector(".pv-screen").getBoundingClientRect(); return { w: s.width / innerWidth, h: s.height / innerHeight, bar: document.querySelector(".pv-bar").textContent, top: document.querySelector(".pv-title").textContent }; });
ok("mobile preview fills the screen, no phone frame", pv.w > 0.99 && pv.h > 0.8, `${(pv.w * 100) | 0}% x ${(pv.h * 100) | 0}%`);
ok("preview has template name on top and ₹999 + Customize below", pv.top === "Royal Emerald" && pv.bar.includes("₹999") && pv.bar.includes("Customize"));
await page.locator(".open-hit").click();
await page.waitForSelector('.inv[data-phase="open"]', { timeout: 15000 });
await page.waitForTimeout(500);
await snap(page, "preview-open");

/* ---------- customize → sign up ---------- */
await page.locator(".pv-bar [data-customize]").click();
await page.waitForURL(/\/signin\?next=/);
await hideDev(page);
await snap(page, "auth");
ok("Customize asks a signed-out visitor to sign in", (await page.locator("h1").textContent()) === "Make it yours." && (await page.locator("text=Continue with Google").count()) === 1 && (await page.locator("text=Continue with Email").count()) === 1);
ok("auth page remembers the chosen design", (await page.locator(".auth-tpl").textContent()).includes("Royal Emerald"));
await page.locator("text=Continue with Email").click();
await page.locator('input[autocomplete="name"]').fill("Asha Rao");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill("correct horse battery");
await snap(page, "auth-email");
await page.locator('button[type="submit"]').click();
await page.waitForURL(/\/edit\//, { timeout: 20000 });
await hideDev(page);
const editUrl = page.url();
const id = editUrl.match(/edit\/([0-9a-f-]+)/)[1];
ok("after sign-up the editor opens for the chosen design", (await page.locator(".ed-title b").textContent()) === "Royal Emerald");

/* ---------- edit ---------- */
await page.waitForSelector(".ed-h");
await snap(page, "edit-names-empty");
const edLayout = await page.evaluate(() => ({ side: getComputedStyle(document.querySelector(".ed-side")).display, bar: [...document.querySelectorAll(".ed-bar .btn")].map((b) => b.textContent) }));
ok("mobile editor is one step at a time with Preview and Next below", edLayout.side === "none" && edLayout.bar[0] === "Preview" && edLayout.bar[1].startsWith("Next"), edLayout.bar.join(" | "));
await page.locator(".ed-bar .btn-solid").click();
ok("Next is blocked until a name is entered", (await page.locator(".field-error").count()) === 1 && (await page.locator(".ed-h").textContent()).includes("Who"));
await page.getByLabel("First name (bride or groom)").fill("Aarav");
await page.getByLabel("Second name").fill("Meera");
await page.getByLabel("Hosted by").fill("Mr. & Mrs. Malhotra and Mr. & Mrs. Kapoor");
await snap(page, "edit-names");
await page.locator(".ed-bar .btn-solid").click();

await page.getByLabel("Date").fill("2026-11-21");
await page.getByLabel("Time", { exact: true }).fill("18:30");
await page.getByLabel("Venue", { exact: true }).fill("Amber Niwas");
await page.getByLabel("Address", { exact: true }).fill("Lake Road, Udaipur, Rajasthan");
await page.getByLabel("Google Maps link").fill("https://maps.app.goo.gl/example123");
await snap(page, "edit-when");
await page.locator(".ed-bar .btn-solid").click();

/* photos: a generated image stands in for a phone photo */
const png = await page.evaluate(async () => {
  const c = document.createElement("canvas"); c.width = 900; c.height = 1200;
  const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 0, 1200); gr.addColorStop(0, "#f2b9a0"); gr.addColorStop(1, "#7a5a8a"); g.fillStyle = gr; g.fillRect(0, 0, 900, 1200);
  g.fillStyle = "#2b2130"; g.beginPath(); g.arc(380, 520, 70, 0, 7); g.arc(540, 480, 78, 0, 7); g.fill(); g.fillRect(300, 590, 160, 500); g.fillRect(470, 560, 160, 540);
  return c.toDataURL("image/png").split(",")[1];
});
const file = { name: "us.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") };
await page.locator('.portrait-slot + .chips input[type="file"]').setInputFiles(file);
await page.waitForSelector(".portrait-slot img", { timeout: 20000 });
await page.locator('.thumb-add input[type="file"]').setInputFiles([file, { ...file, name: "two.png" }, { ...file, name: "three.png" }]);
await page.waitForFunction(() => { const im = [...document.querySelectorAll(".thumbs .thumb img, .portrait-slot img")]; return im.length === 4 && im.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 30000 });
await snap(page, "edit-photos");
ok("photos upload: 1 main photo and 3 gallery photos", (await page.locator(".thumbs .thumb img").count()) === 3);
await page.locator(".ed-bar .btn-solid").click();

await page.locator("text=+ Add an event").click();
await page.getByLabel("Title").fill("Sangeet");
await page.locator(".event-card").getByLabel("Date").fill("2026-11-20");
await page.locator(".event-card").getByLabel("Time").fill("19:30");
await page.locator("text=+ Add an event").click();
await page.locator(".event-card").nth(1).getByLabel("Title").fill("Wedding");
await page.locator(".event-card").nth(1).getByLabel("Time").fill("18:30");
await snap(page, "edit-events");
await page.locator(".ed-bar .btn-solid").click();

/* RSVP setup */
ok("RSVP step is reached", (await page.locator(".ed-h").textContent()).includes("Know who"));
await page.locator('.switch:has-text("Meal preference")').click();
await page.getByLabel("Event capacity").fill("6");
await page.locator('.switch:has-text("Stop replies when full")').click();
await snap(page, "edit-rsvp");
await page.locator(".ed-bar .btn-solid").click();

await page.getByLabel("Your story").fill("Seven years, two cities and one very long train ride later, we are finally doing this.");
await page.getByLabel("Contact 1 name").fill("Rohan");
await page.locator(".row2").first().getByLabel("Phone").fill("+91 98200 12345");
await snap(page, "edit-design");
await page.locator(".ed-bar .btn-solid").click();
await page.waitForSelector(".checklist");
await page.waitForFunction(() => document.querySelector(".ed-save")?.textContent === "Saved", null, { timeout: 10000 });
await snap(page, "edit-review");
ok("review lists everything as complete", (await page.locator('.check[data-ok="false"]').count()) === 0);

/* autosave survives a reload */
await page.reload({ waitUntil: "networkidle" });
await hideDev(page);
await page.locator('.ed-step:has-text("Names")').click();
ok("autosave keeps the details after a reload", (await page.getByLabel("First name (bride or groom)").inputValue()) === "Aarav");
await page.locator('.ed-step:has-text("Preview")').click();

/* ---------- preview with their own content ---------- */
await page.locator(".ed-bar .btn-quiet").click();
await page.waitForSelector(".pv .inv-hero");
await page.waitForTimeout(600);
await page.locator(".open-hit").click();
await page.waitForSelector('.inv[data-phase="open"]', { timeout: 15000 });
await page.waitForTimeout(700);
await snap(page, "own-preview");
const own = await page.evaluate(() => ({ names: document.querySelector(".pv .hero-names").getAttribute("aria-label"), bar: [...document.querySelectorAll(".pv-bar .btn")].map((b) => b.textContent), date: document.querySelector(".pv .hero-date").textContent, photo: !!document.querySelector(".pv .frame-photo"), gallery: document.querySelectorAll(".pv .gallery-photos img").length, events: document.querySelectorAll(".pv .event").length }));
ok("preview shows the customer's own names, date, photo, gallery and events", own.names === "Aarav & Meera" && own.date === "21 November 2026" && own.photo && own.gallery === 3 && own.events === 2, JSON.stringify(own));
ok("preview offers Back to Edit and Proceed to Payment", own.bar[0] === "Back to Edit" && own.bar[1] === "Proceed to Payment");
await page.locator(".pv-bar .btn-solid").click();

/* ---------- pay → publish ---------- */
await page.waitForURL(/\/pay\//, { timeout: 20000 });
await hideDev(page);
await snap(page, "pay");
const before = await (await host.request.get(`${base}/api/invitations/${id}`)).json();
ok("status is Ready to Pay and it is not public yet", before.invitation.status === "ready" && before.invitation.slug === null);
ok("payment screen shows template, names, ₹999 and what is included", (await page.locator(".pay-card").textContent()).match(/Royal Emerald.*Aarav & Meera.*₹999.*RSVP.*Shareable link/s) !== null);
await page.locator("text=Pay ₹999 & Publish").click();
await page.waitForSelector(".test-panel");
await snap(page, "pay-test");
await page.locator("text=Complete test payment").click();
await page.waitForURL(/\/success\//, { timeout: 20000 });
await hideDev(page);
await page.waitForTimeout(2600);
await snap(page, "success");
const link = "http://" + (await page.locator(".link-box code").textContent());
const slug = link.split("/i/")[1];
ok("success page: headline, link and next actions", (await page.locator("h1").textContent()).startsWith("Your invitation is live") && /\/i\/aarav-meera(-\d+)?$/.test(link) && (await page.locator("text=Share Invitation").count()) === 1 && (await page.locator("text=Manage Guests").count()) === 1 && (await page.locator("text=View RSVPs").count()) === 1);
const after = await (await host.request.get(`${base}/api/invitations/${id}`)).json();
ok("invitation is Published only after payment", after.invitation.status === "published" && after.invitation.slug === slug);

/* ---------- guests + share ---------- */
await page.locator("text=Manage Guests").click();
await page.waitForURL(/\/guests$/);
await hideDev(page);
await page.locator("text=+ Add guest").click();
await page.getByLabel("Name as it should appear").fill("Rahul & Family");
await page.locator(".modal").getByLabel("Phone").fill("+91 98765 43210");
await page.getByLabel("Number invited").fill("4");
await page.getByLabel("Max attendees").fill("4");
await snap(page, "guest-add");
await page.locator('.modal button[type="submit"]').click();
await page.waitForSelector(".row-card");
await snap(page, "guests");
const wa = decodeURIComponent(await page.locator(".row-card .btn-solid").getAttribute("href"));
ok("guest gets a personal link, shared through WhatsApp", wa.startsWith("https://wa.me/919876543210?text=") && wa.includes(`/i/${slug}/rahul-family`) && wa.includes("You’re invited") && wa.includes("Aarav & Meera"));
/* tapping it opens WhatsApp in a new tab and marks the guest as sent */
const [waTab] = await Promise.all([host.waitForEvent("page", { timeout: 8000 }).catch(() => null), page.locator(".row-card .btn-solid").click()]);
await waTab?.close().catch(() => {});
await page.waitForFunction(() => /(^|\s)Sent/.test(document.querySelector(".row-card")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
await page.goto(`${base}/invites/${id}`, { waitUntil: "networkidle" });
await hideDev(page);
await snap(page, "manage");
const shareText = decodeURIComponent(await page.locator(".share-grid a").first().getAttribute("href"));
ok("share page: WhatsApp, email, copy link and QR", shareText.includes("Open the invitation:") && (await page.locator('.share-grid a[href^="mailto:"]').count()) === 1 && (await page.locator(".qr svg").count()) === 1 && (await page.locator("text=Copy Link").count()) === 1);

/* ---------- guest RSVP (a different person, no account) ---------- */
const guestCtx = await browser.newContext(phone);
const g = await guestCtx.newPage();
g.on("pageerror", (e) => errors.push("guest: " + e.message));
await g.goto(`${base}/i/${slug}/rahul-family`, { waitUntil: "networkidle" });
await hideDev(g);
await g.waitForSelector(".inv-hero");
await g.waitForTimeout(600);
await snap(g, "guest-sealed");
await g.locator(".open-hit").click();
await g.waitForSelector('.inv[data-phase="open"]', { timeout: 15000 });
await g.waitForTimeout(600);
ok("guest opens the invitation without an account", (await g.locator(".hero-names").getAttribute("aria-label")) === "Aarav & Meera");
ok("guest sees quick actions: Directions, RSVP, Share", (await g.locator(".pub-actions").textContent()).replace(/\s+/g, " ").includes("Directions") && (await g.locator(".pub-actions .is-main").textContent()) === "RSVP");
ok("personal greeting is shown", (await g.locator(".msg-dear").textContent()) === "Dear Rahul & Family,");
ok("directions use the host's Google Maps link", (await g.locator(".pub-actions a").getAttribute("href")) === "https://maps.app.goo.gl/example123");
await g.locator(".pub-actions .is-main").click();
await g.waitForTimeout(1200);
const t0 = Date.now();
await g.locator('.rsvp-choice button:has-text("Yes, I’ll be there")').click();
for (let i = 0; i < 4; i++) await g.locator('.rsvp .inv-stepper button[aria-label="One more guest"]').click({ force: true }).catch(() => {});
const stepped = await g.locator(".rsvp .inv-stepper output").textContent();
ok("RSVP cannot go above this family's limit of 4", stepped === "4", stepped);
await g.locator('.rsvp-chips button:has-text("Vegetarian")').first().click();
await g.locator(".rsvp textarea").fill("So happy for you both!");
await snap(g, "guest-rsvp");
await g.locator('.rsvp button[type="submit"]').click();
await g.waitForSelector(".rsvp-done", { timeout: 10000 });
ok("guest RSVP is saved and confirmed on screen", (await g.locator(".rsvp-summary").textContent()).includes("4 guests"), `${Date.now() - t0}ms of interaction`);
await snap(g, "guest-rsvp-done");
const leak = await g.evaluate(() => document.body.innerText);
ok("guest page shows no dashboard or other guests", !/Total attending|Confirmed replies|Guest list/.test(leak));

/* a second guest on the general link */
const g2ctx = await browser.newContext(phone);
const g2 = await g2ctx.newPage();
await g2.goto(link, { waitUntil: "networkidle" });
await g2.waitForSelector(".inv-hero");
await g2.waitForTimeout(500);
await g2.locator(".open-hit").click();
await g2.waitForSelector('.inv[data-phase="open"]', { timeout: 15000 });
await g2.locator(".pub-actions .is-main").click();
await g2.waitForTimeout(1000);
await g2.locator('.rsvp-choice button:has-text("Yes, I’ll be there")').click();
await g2.locator('.rsvp input[autocomplete="name"]').fill("Priya Shah");
await g2.locator('.rsvp .inv-stepper button[aria-label="One more guest"]').click();
await g2.locator('.rsvp button[type="submit"]').click();
await g2.waitForSelector(".rsvp-error", { timeout: 10000 });
ok("hard capacity is enforced (6 places, 4 taken, 3 asked)", (await g2.locator(".rsvp-error").textContent()).includes("2 places are left"));
await g2.locator('.rsvp .inv-stepper button[aria-label="One fewer guest"]').click();
await g2.locator('.rsvp button[type="submit"]').click();
await g2.waitForSelector(".rsvp-done", { timeout: 10000 });
const g3 = await (await browser.newContext(phone)).newPage();
await g3.goto(link, { waitUntil: "networkidle" });
await g3.waitForSelector(".inv-hero");
await g3.locator(".open-hit").click();
await g3.waitForSelector('.inv[data-phase="open"]', { timeout: 15000 });
await g3.locator(".pub-actions .is-main").click();
await g3.waitForTimeout(1000);
await g3.locator('.rsvp-choice button:has-text("Sorry, can’t make it")').click();
await g3.locator('.rsvp input[autocomplete="name"]').fill("Uncle Dev");
await g3.locator('.rsvp button[type="submit"]').click();
await g3.waitForSelector(".rsvp-done", { timeout: 10000 });

/* ---------- host dashboard ---------- */
await page.goto(`${base}/invites/${id}/rsvps`, { waitUntil: "networkidle" });
await hideDev(page);
await snap(page, "rsvps");
const tiles = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".tile")].map((t) => [t.querySelector("span").textContent.replace(/ · \d+ on your list$/, ""), t.querySelector("b").textContent])));
ok("dashboard: 3 responses, 2 confirmed, 1 declined", tiles.Responses === "3" && tiles.Confirmed === "2" && tiles.Declined === "1", JSON.stringify(tiles));
ok("total attending counts people, not replies: 6", tiles["Total attending"] === "6");
ok("capacity bar shows 6 / 6", (await page.locator(".tile-main").textContent()).includes("6 / 6 confirmed attendees"));
ok("invitations sent counts the guest we shared with", tiles["Invitations sent"] === "1", tiles["Invitations sent"]);
await page.locator('.chip:has-text("Declined")').click();
ok("filter narrows the list", (await page.locator(".rows-as-table .row-card").count()) === 1);
await page.locator('.chip:has-text("All")').click();
await page.locator('input[type="search"]').fill("priya");
ok("search finds a guest by name", (await page.locator(".rows-as-table .row-card").count()) === 1 && (await page.locator(".rows-as-table .row-name").textContent()) === "Priya Shah");
const csv = await (await host.request.get(`${base}/api/invitations/${id}/rsvps/export`)).text();
ok("CSV export has every reply", csv.split("\r\n").filter(Boolean).length === 4 && csv.includes("Rahul & Family,Confirmed,4"));
if (shots) writeFileSync(`${shots}/rsvps.csv`, csv);
await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
await hideDev(page);
await snap(page, "dashboard");
const card = (await page.locator(".invite-card").first().textContent()).replace(/\s+/g, " ");
ok("home card: names, date, status, RSVPs, attending, views", /Aarav & Meera.*Wedding • 21 Nov 2026.*Published.*3 RSVPs.*6 attending.*\d+ views?/.test(card), card.slice(0, 120));
ok("bottom navigation: Home, Invites, Guests, Account", (await page.locator(".tabbar a").allTextContents()).join(",") === "Home,Invites,Guests,Account" && (await page.locator(".tabbar").isVisible()));
const anon = await browser.newContext();
const priv = await anon.request.get(`${base}/api/invitations/${id}/rsvps`);
ok("replies are private to the host", priv.status() === 401);
ok("no page errors during the whole journey", errors.length === 0, errors.slice(0, 3).join(" | "));

for (const c of browser.contexts()) await c.close(); // finishes any recordings
await browser.close();
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
