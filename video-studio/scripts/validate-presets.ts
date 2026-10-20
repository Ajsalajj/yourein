/**
 * Caption-engine validation (needs `npm run dev` + `npm run ai` NOT required; only the app).
 * Builds ONE test video where each of the core-30 presets captions a spoken 5-word phrase, with EXACT word
 * timestamps (each word synthesised separately by espeak-ng, durations measured with ffprobe), over a static
 * background so every pixel change is caused by the caption animation. Exports it through the real export
 * pipeline and verifies the MP4 from pixels + audio (scripts/dev/verify_presets.py).
 *
 *   tsx scripts/validate-presets.ts [count]      # count = how many presets (default 30)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CORE_30 } from "../src/remotion/templates/core30";
import { TEMPLATE_MAP } from "../src/remotion/templates/registry";
import { captionFromWords } from "../src/lib/captions/grouping";
import type { Project, Word } from "../src/lib/project";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const OUT = path.resolve(process.env.VALIDATION_OUT ?? "data/validation");
const COUNT = Number(process.argv[2] ?? 30);
fs.mkdirSync(OUT, { recursive: true });
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8" });

const PHRASES = [
  "every word lands right now", "this caption follows my voice", "watch the highlight move along", "colours change with each beat",
  "fast clean motion matters", "bring the story into focus", "slow and cinematic fade", "words glide across the frame",
  "light sweeps through the text", "glowing neon sign tonight", "a box jumps between words", "lines draw under speech",
  "stretch squash and bounce", "typing every single letter", "letters arrive one by one", "words flip around slowly",
  "lines bounce into place", "quiet serif for stories", "simple white and calm", "yellow marks the spoken word",
  "soft shadows lift the text", "big headline energy today", "glitch hits the screen", "old school console style",
  "a pill follows the voice", "stack the words together", "tracking pulls words close", "comic pop goes boom",
  "heavy cinematic title card", "luxury needs space",
];

async function main() {
  const only = process.env.PRESET_IDS?.split(",").filter(Boolean);
  const presets = only ? CORE_30.filter((p) => only.includes(p.templateId)) : CORE_30.slice(0, COUNT);
  // 1. audio with exact word timing
  const words: { preset: number; text: string; startMs: number; endMs: number }[] = [];
  const parts: string[] = [];
  const gapWord = path.join(OUT, "gap_word.wav");
  const gapPreset = path.join(OUT, "gap_preset.wav");
  run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono", "-t", "0.11", gapWord]);
  run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono", "-t", "0.9", gapPreset]);
  let t = 400; // ms
  const lead = path.join(OUT, "lead.wav");
  run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono", "-t", "0.4", lead]);
  parts.push(lead);
  presets.forEach((p, pi) => {
    PHRASES[CORE_30.findIndex((c) => c.templateId === presets[pi].templateId)].split(" ").forEach((w, wi) => {
      const f = path.join(OUT, `w_${pi}_${wi}.wav`);
      run("espeak-ng", ["-v", "en-us", "-s", "135", "-w", f + ".raw.wav", w]);
      run("ffmpeg", ["-v", "error", "-y", "-i", f + ".raw.wav", "-ar", "22050", "-ac", "1", "-af", "silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=1:stop_threshold=-45dB:stop_duration=0.05", f]);
      const dur = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim()) * 1000;
      words.push({ preset: pi, text: w, startMs: Math.round(t), endMs: Math.round(t + dur) });
      t += dur + 110;
      parts.push(f, gapWord);
    });
    t += 790; // 0.9s total gap after a phrase (110 already added)
    parts.push(gapPreset);
  });
  const list = path.join(OUT, "list.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  const audio = path.join(OUT, "speech.wav");
  run("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-ar", "44100", audio]);
  const totalSec = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio]).trim());

  // 2. static background video + audio
  const input = path.join(OUT, "validation-input.mp4");
  run("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=0x232a4d:s=720x1280:r=30:d=${totalSec + 0.3},vignette=PI/4`, "-i", audio, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", input]);

  // 3. project via the real API
  const j = async (p: string, init?: RequestInit) => {
    const r = await fetch(BASE + p, { ...init, headers: init?.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {} });
    const b: any = await r.json();
    if (!r.ok) throw new Error(`${p}: ${b.error}`);
    return b;
  };
  const { project } = await j("/api/projects", { method: "POST", body: JSON.stringify({ name: "Core-30 validation", aspect: "9:16" }) });
  const up = await j(`/api/projects/${project.id}/upload?filename=validation-input.mp4&kind=video`, { method: "POST", body: fs.readFileSync(input) });
  const p: Project = up.project;
  p.captionStyle = { templateId: presets[0].templateId, overrides: {}, position: { x: 0.5, y: 0.5 } };
  p.captions = presets.map((pr, pi) => {
    const tpl = TEMPLATE_MAP[pr.templateId];
    const ws: Word[] = words.filter((w) => w.preset === pi).map((w, i) => ({ id: `w_${pi}_${i}_zz`, text: w.text, startMs: w.startMs, endMs: w.endMs, confidence: 1, timingSource: "asr" as const }));
    const cap = captionFromWords(ws, { styleId: tpl.id, position: tpl.position });
    // let the group stay up a moment after the last word, as real captions do
    return { ...cap, endMs: ws[ws.length - 1].endMs + 350 };
  });
  await j(`/api/projects/${project.id}`, { method: "PUT", body: JSON.stringify(p) });
  fs.writeFileSync(path.join(OUT, "truth.json"), JSON.stringify({ presets: presets.map((x, i) => ({ ...x, posY: TEMPLATE_MAP[x.templateId].position.y, startMs: words.filter((w) => w.preset === i)[0].startMs, endMs: p.captions[i].endMs })), words, durationMs: totalSec * 1000 }, null, 1));

  // 4. export
  const t0 = Date.now();
  let { job } = await j(`/api/projects/${project.id}/export`, { method: "POST", body: JSON.stringify({ quality: "standard" }) });
  let lastPct = -1;
  while (!["done", "failed", "cancelled"].includes(job.status)) {
    await new Promise((r) => setTimeout(r, 2000));
    job = (await j(`/api/projects/${project.id}/export/${job.id}`)).job;
    const pct = Math.floor(job.progress * 10);
    if (pct !== lastPct) { lastPct = pct; console.log(`  export ${job.status} ${Math.round(job.progress * 100)}% (${Math.round((Date.now() - t0) / 1000)}s)`); }
  }
  if (job.status !== "done") throw new Error(`export ${job.status}: ${job.error}`);
  const mp4 = path.join(OUT, "validation-core30.mp4");
  fs.writeFileSync(mp4, Buffer.from(await (await fetch(`${BASE}/api/projects/${project.id}/export/${job.id}/download`)).arrayBuffer()));
  console.log(`exported ${mp4} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB) in ${Math.round((Date.now() - t0) / 1000)}s`);

  // 5. verify from pixels + audio
  const out = run("ai-service/.venv/bin/python", ["-I", "scripts/dev/verify_presets.py", mp4, path.join(OUT, "truth.json"), OUT]);
  console.log(out);
}
main().catch((e) => { console.error("VALIDATION FAILED:", e.message); process.exit(1); });
