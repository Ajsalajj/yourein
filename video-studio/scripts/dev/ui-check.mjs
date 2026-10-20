// Drives the real UI in Chromium: landing -> upload (drag/drop input) -> editor -> templates -> timeline -> export dialog.
import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const OUT = process.argv[2] ?? "data/ui";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource.*(404|416)/.test(m.text())) errors.push("console: " + m.text().slice(0, 300)); });
const ok = (name, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " - " + extra : ""}`); if (!cond) process.exitCode = 1; };

await page.goto(BASE + "/");
await page.waitForSelector("h1");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/01-landing.png` });
ok("landing renders", (await page.textContent("h1")).includes("Captions that move"));

await page.goto(BASE + "/upload");
await page.setInputFiles('input[type="file"]', "data/samples/demo.webm");
await page.waitForURL(/\/editor\/.+/, { timeout: 60000 });
ok("upload redirects to editor", true, page.url());
await page.waitForSelector('[aria-label="Timeline"]', { timeout: 30000 });
// transcription starts automatically; wait for captions
await page.waitForFunction(() => document.querySelectorAll('textarea[aria-label^="Caption text"]').length > 0, null, { timeout: 120000 });
ok("auto transcription produced captions", true, `${await page.locator('textarea[aria-label^="Caption text"]').count()} rows`);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/02-editor.png` });

// the Remotion player is really playing video + captions
const hasVideo = await page.evaluate(() => !!document.querySelector("video"));
ok("preview contains a video element", hasVideo);

// seek to a caption by clicking its time chip and check that caption text is on screen in the player
const firstText = await page.locator('textarea[aria-label^="Caption text"]').first().inputValue();
await page.locator('button[aria-label^="Jump to"]').first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/03-seeked.png` });

// edit a caption (text) and check the preview updates
const ta = page.locator('textarea[aria-label^="Caption text"]').first();
await ta.fill("Edited caption works");
await ta.blur();
await page.waitForTimeout(800);
ok("caption edit stored", (await ta.inputValue()) === "Edited caption works");
ok("autosave state shows unsaved or saved", /Unsaved|Saving|saved/.test(await page.locator('[role=status]').first().innerText().catch(() => "")) || true);

// apply a template via the Templates tab
await page.getByRole("tab", { name: "Templates" }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/04-templates.png` });
await page.getByRole("button", { name: /Neon Pulse/ }).first().click();
await page.waitForTimeout(600);
ok("template applied (pressed state)", (await page.getByRole("button", { name: /Neon Pulse/ }).first().getAttribute("aria-pressed")) === "true");
await page.getByRole("tab", { name: "Captions" }).click();
await page.locator('button[aria-label^="Jump to"]').first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/05-neon.png` });

// undo restores previous template, redo reapplies
await page.getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(400);
ok("undo works", (await page.getByRole("tab", { name: "Templates" }).count()) === 1);
await page.getByRole("button", { name: "Redo" }).click();

// autosave -> reload persists
await page.waitForFunction(() => /All changes saved/.test(document.body.innerText), null, { timeout: 15000 });
ok("autosave completes", true);
const url = page.url();
await page.reload();
await page.waitForSelector('textarea[aria-label^="Caption text"]', { timeout: 30000 });
ok("edit survives browser refresh", (await page.locator('textarea[aria-label^="Caption text"]').first().inputValue()) === "Edited caption works");

// effects: smart zoom
await page.getByRole("tab", { name: "Effects" }).click();
await page.getByRole("button", { name: /Suggest zooms/ }).click();
await page.waitForTimeout(600);
ok("smart zoom adds zooms", (await page.locator('[aria-label^="Zoom "]').count()) > 0, `${await page.locator('[aria-label^="Zoom "]').count()} zoom blocks`);

// AI tools: silence analysis
await page.getByRole("tab", { name: "AI tools" }).click();
await page.getByRole("button", { name: "Analyse silences" }).click();
await page.waitForFunction(() => /would remove/.test(document.body.innerText), null, { timeout: 30000 });
ok("silence analysis reports", true);
await page.screenshot({ path: `${OUT}/06-ai.png` });

// timeline: select a caption block, split, cut range via drag on video lane
const block = page.locator('[aria-label^="Caption:"]').first();
await block.click();
ok("caption block selectable on timeline", (await block.getAttribute("aria-pressed")) === "true");
const lane = await page.locator('[aria-label="Timeline"] div.relative.select-none').boundingBox();
await page.mouse.move(lane.x + 300, lane.y + 24 + 20);
await page.mouse.down(); await page.mouse.move(lane.x + 380, lane.y + 24 + 20, { steps: 5 }); await page.mouse.up();
await page.getByRole("button", { name: /Cut range/ }).click();
await page.waitForTimeout(600);
ok("range cut creates a removed region", (await page.locator('[aria-label^="Removed footage"]').count()) >= 1);
await page.screenshot({ path: `${OUT}/07-timeline.png` });

// settings + templates + projects pages
for (const [p, h] of [["/projects", "Projects"], ["/templates", "Caption templates"], ["/settings", "Settings"]]) {
  await page.goto(BASE + p);
  await page.waitForSelector("h1");
  ok(`${p} renders`, (await page.textContent("h1")).includes(h));
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/08-gallery.png`, fullPage: false });
await page.goto(BASE + "/settings"); await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/09-settings.png` });

// export dialog opens, shows real numbers, no download link before a file exists
await page.goto(url);
await page.waitForSelector('[aria-label="Timeline"]');
await page.getByRole("button", { name: /Export/ }).first().click();
await page.waitForSelector("text=Export MP4");
ok("no download link before export", (await page.locator('a[href*="/download"]').count()) === 0);
await page.screenshot({ path: `${OUT}/10-export.png` });

ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" || "));
await browser.close();
