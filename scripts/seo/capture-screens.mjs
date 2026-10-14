// Captures real product screenshots for the feature pages (/features/*).
// Needs the dev server running with simulated payments:  npm run dev   then   node scripts/seo/capture-screens.mjs
// Creates a demo invitation with made-up guests and replies, screenshots key screens at phone size and writes
// optimized WebP files to public/features/. Nothing here uses real people or real data.
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const base = process.env.BASE || "http://localhost:3000";
const out = join(process.cwd(), "public", "features");
const tmp = join(tmpdir(), "yourein-shots");
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const api = async (method, url, data) => {
  const r = await ctx.request.fetch(base + url, { method, data });
  if (!r.ok()) throw new Error(`${method} ${url} ${r.status()} ${await r.text()}`);
  return r.json().catch(() => ({}));
};

await api("POST", "/api/auth/signup", { name: "Demo Host", email: `shots${Date.now()}@example.com`, password: "password123" });
const { id } = await api("POST", "/api/invitations", { template: "ivory-wax-seal", tz: "Asia/Kolkata" });
const { invitation } = await api("GET", `/api/invitations/${id}`);
const d = invitation.data;
Object.assign(d, { name1: "Aarav", name2: "Meera", date: "2027-02-14", time: "17:30", venueName: "Rosewood Gardens", venueAddress: "12 Lake Road, Udaipur", hostedBy: "The Malhotra and Kapoor families" });
d.events = [
  { id: "mehendi", title: "Mehendi", date: "2027-02-12", time: "16:00", place: "Rosewood Gardens, lawn", note: "", dressCode: "Bright colours", private: false },
  { id: "wedding", title: "Wedding ceremony", date: "2027-02-14", time: "17:30", place: "Rosewood Gardens, main hall", note: "", dressCode: "Traditional", private: false },
  { id: "reception", title: "Reception dinner", date: "2027-02-14", time: "20:30", place: "Rosewood Gardens, terrace", note: "", dressCode: "", private: false },
];
d.rsvp = { ...d.rsvp, enabled: true, askMeal: true, perEvent: true, maxPerInvite: 6 };
await api("PATCH", `/api/invitations/${id}`, { data: d });
const order = await api("POST", "/api/pay/order", { invitationId: id });
const pay = await api("POST", "/api/pay/test", { orderId: order.orderId });
const { slug } = await api("POST", "/api/pay/verify", pay);

const names = ["The Mehtas", "Priya and Rahul", "The D’Souzas", "Uncle Dev", "Kabir and Aditi", "Zoya Khan", "The Nairs", "Meera’s cousins"];
for (const [i, n] of names.entries()) await api("POST", `/api/invitations/${id}/guests`, { name: n, group: i % 2 ? "Bride’s side" : "Groom’s side", invited: 2 + (i % 4), max: 2 + (i % 4) });
const anon = await browser.newContext();
/* counts stay within each family's limit (2 + index % 4), so the dashboard totals look natural */
const replies = [["the-mehtas", "yes", 2, "Vegetarian", "Cannot wait!"], ["priya-and-rahul", "yes", 3, "Vegetarian", ""], ["the-d-souzas", "yes", 4, "Non-vegetarian", "So happy for you both."], ["uncle-dev", "maybe", 1, "", "Will confirm after travel plans"], ["kabir-and-aditi", "yes", 2, "", ""], ["zoya-khan", "no", 0, "", "Sending all my love"], ["the-nairs", "yes", 3, "Vegetarian", ""]];
for (const [g, status, count, meal, message] of replies) await anon.request.post(base + "/api/rsvp", { data: { invitation: slug, guest: g, status, count, meal, message } });

const hide = () => page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
const save = async (name, clip) => {
  const png = join(tmp, `${name}.png`);
  await page.screenshot({ path: png, clip });
  await sharp(png).resize({ width: 560 }).webp({ quality: 78 }).toFile(join(out, `${name}.webp`));
  const m = await sharp(join(out, `${name}.webp`)).metadata();
  console.log(name, m.width, m.height);
};
/* Show the real domain instead of localhost in link boxes, so screenshots look like the live site. */
const dress = () => page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue?.includes("localhost:3000")) n.nodeValue = n.nodeValue.replace("localhost:3000", "yourein.in"); });
const visit = async (path, wait = 1500) => { await page.goto(base + path, { waitUntil: "networkidle" }); await hide(); await page.waitForTimeout(wait); await dress(); };
const open = async () => {
  await visit(`/i/${slug}`, 1800);
  const btn = page.locator(".inv-open, [data-open], button:has-text('Open')").first();
  if (await btn.count()) await btn.click().catch(() => {});
  await page.waitForTimeout(3500);
};
const toSection = async (sel) => {
  await page.evaluate((s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: "start" }); }, sel);
  await page.waitForTimeout(1500);
};
/* scroll so the heading with this text sits near the top of the screen */
const toText = async (text, offset = 90) => {
  const h = page.getByText(text, { exact: true }).first();
  await h.waitFor({ state: "visible", timeout: 15000 });
  await h.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.evaluate((o) => window.scrollBy(0, -o), offset);
  await page.waitForTimeout(1500);
  console.log("scrolled to", text, "scrollY", await page.evaluate(() => Math.round(scrollY)));
};

await visit(`/invites/${id}/rsvps`);
await save("rsvp-host-dashboard");
await visit(`/invites/${id}/guests`);
await save("guest-list-tracking");
await visit(`/invites/${id}`);
await save("share-invitation-qr-code");
await open();
await toSection("#rsvp");
await save("rsvp-reply-form");
await toText("Counting the days", 120);
await save("invitation-countdown");
await toText("The celebrations", 120);
await save("invitation-events");
await visit(`/edit/${id}?step=design`, 2200);
/* the editor's music card: captured as an element, top part only */
{
  const card = page.getByText("Background music", { exact: true }).first().locator("xpath=ancestor::div[contains(@class,'ed-group')][1]");
  await page.addStyleTag({ content: "header, .ed-bar, .ed-steps, .tabbar { visibility: hidden !important; }" });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const png = join(tmp, "music-picker.png");
  await card.screenshot({ path: png });
  const meta = await sharp(png).metadata();
  const resized = await sharp(png).resize({ width: 560 }).toBuffer();
  const rm = await sharp(resized).metadata();
  await sharp(resized).extract({ left: 0, top: 0, width: rm.width, height: Math.min(rm.height, 1100) }).webp({ quality: 78 }).toFile(join(out, "music-picker.webp"));
  const m2 = await sharp(join(out, "music-picker.webp")).metadata();
  console.log("music-picker", m2.width, m2.height, "from", meta.height);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
