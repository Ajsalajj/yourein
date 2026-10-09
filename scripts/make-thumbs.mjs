/**
 * Renders every design's first screen to WebP for the catalog.
 *
 *   1. npm run build && npm run start      (or: npm run dev)
 *   2. npm run thumbs                      (in a second terminal)
 *
 * Writes public/thumbs/<slug>.webp (the catalog image) and <slug>-alt.webp
 * (the other state: sealed or opened), plus public/og.jpg for link previews.
 * Run it again whenever artwork or sample names change.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = path.resolve("public/thumbs");
const only = process.argv.slice(2);

const src = await readFile("src/data/templates.ts", "utf8");
const templates = [...src.matchAll(/slug: "([^"]+)"[\s\S]*?couple:/g)].map((m) => ({ slug: m[1], cover: /thumbCover: true/.test(m[0]) }));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

for (const t of templates) {
  if (only.length && !only.includes(t.slug)) continue;
  for (const [state, file] of [[t.cover ? "sealed" : "open", t.slug], [t.cover ? "open" : "sealed", `${t.slug}-alt`]]) {
    await page.goto(`${BASE}/shot/${t.slug}?state=${state}`, { waitUntil: "networkidle" });
    await page.waitForSelector('#shot[data-ready="true"]', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(350);
    const png = await page.screenshot({ type: "png" });
    await sharp(png).resize(780).webp({ quality: 80, effort: 6 }).toFile(path.join(OUT, `${file}.webp`));
    console.log("wrote", `${file}.webp`);
  }
}

if (!only.length) {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}.hp .pm{animation:none!important}" });
  await page.waitForTimeout(900);
  const png = await page.screenshot({ type: "png" });
  await sharp(png).resize(1200, 630).jpeg({ quality: 84, mozjpeg: true }).toFile(path.resolve("public/og.jpg"));
  console.log("wrote og.jpg");
}
await browser.close();
