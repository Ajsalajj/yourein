# Cadence - local-first AI captions & video editor

Upload a clip → transcribe locally → pick one of 42 animated caption templates (30 animation engines) → fix words and timing → trim silence / add zooms / music → export a watermark-free MP4. The preview and the exporter render **the same Remotion composition**.

> Self-contained app living in `video-studio/` of this repository. It shares nothing with the invitation site in the repo root.

## Quick start

Requirements: Node ≥ 20.9, Python ≥ 3.10, `ffmpeg` + `ffprobe` on PATH.

```bash
cd video-studio
cp .env.example .env.local        # optional - defaults work for localhost
npm install
npm run ai:setup                  # python venv + FastAPI + faster-whisper + pocketsphinx
npm run ai                        # terminal 1: AI service on :8100
npm run dev                       # terminal 2: app on http://127.0.0.1:3100
```

Open http://127.0.0.1:3100, **Settings** shows live health of every dependency.

**Try the sample:** `npm run sample:import` creates a project from `samples/` (clip + saved captions, cuts, zooms, style) and prints its URL. A rendered result is in `docs/demo/demo-captioned-bold-creator.mp4`.

### Transcription engines (read this)

| Engine | Languages | Needs | Status |
|---|---|---|---|
| `faster-whisper` (default when its model is cached) | auto-detect; English, Malayalam, Hindi, Tamil and every language the model supports | model weights downloaded once from Hugging Face (`WHISPER_MODEL`, default `small`) | Adapter implemented and unit-tested with a stub model. **Not run against real weights in the development sandbox** (Hugging Face was unreachable there). |
| `pocketsphinx` (automatic fallback) | English only | nothing - model ships in the wheel | Verified end to end. Low accuracy - expect to correct the text. |

With `engine: auto` the service uses Whisper if its model is cached or downloadable, otherwise falls back to pocketsphinx for English and says so in the transcript warnings. For Malayalam/Hindi/Tamil you need Whisper. To pre-download: `cd ai-service && .venv/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('small', download_root='models')"`. Larger models (`medium`, `large-v3`) are markedly better for Indic languages: set `WHISPER_MODEL`.

### Export / rendering

Exports run in a separate Node process (`scripts/render-worker.ts`) using Remotion's renderer and Chrome Headless Shell. If Remotion cannot download its browser (offline), set `BROWSER_EXECUTABLE` to a Chrome Headless Shell build (Playwright's `chromium_headless_shell-*/…/headless_shell` works). First export bundles the composition (~10 s, cached afterwards). Rendering is software-GL by default and takes roughly 5 s per second of video on 4 CPU cores for 1080×1920.

## What is implemented

See [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) for the full, honest status. Summary:

| Area | Status |
|---|---|
| Upload (MP4/MOV/WebM), validation, ffprobe metadata, thumbnail, progress, errors | ✅ |
| Local transcription, word timestamps, language detect, editing, SRT/VTT import/export | ✅ (Whisper path unverified with real weights here) |
| 30 caption animations, 42 templates, gallery, search, categories, live preview | ✅ |
| Editable captions: text, split, merge, delete, word timing, grouping, search & jump | ✅ |
| Edit-decision list (cuts) separate from caption text | ✅ |
| Silence removal (energy based), smart zoom (transcript based), music + ducking, fades | ✅ |
| Timeline: ruler, scrub, waveform, drag/resize, split, cut range, zoom, undo/redo | ✅ |
| MP4 export (H.264+AAC, 9:16 / 16:9 / 1:1, 30 or 60 fps), progress, cancel, verification | ✅ |
| Projects: create, rename, duplicate, delete, autosave, versioned JSON | ✅ |
| B-roll, transitions, SFX track, noise reduction, face-aware zoom, 4K, image layers | ❌ not built |
| Subject masking, text behind person, tracking, 3D text (milestone 4) | ❌ not built |
| PostgreSQL/Prisma, Redis workers | ❌ intentionally deferred (JSON files + in-process jobs) |

## Commands

| | |
|---|---|
| `npm run dev` / `build` / `start` | app (port 3100, bound to 127.0.0.1) |
| `npm run ai` | AI service (port 8100, bound to 127.0.0.1) |
| `npm run test:all` | typecheck + lint + 56 TS tests + Python tests |
| `npm run sample` | regenerate the synthetic demo clip (needs `espeak-ng`) |
| `npx tsx scripts/e2e.ts [templateId]` | **full workflow against the running app**: upload → transcribe → edit → style → cuts → zoom → export → pixel-verify the MP4 |
| `node scripts/dev/ui-check.mjs` | drives the real UI in Chromium (needs `playwright-core` + a Chromium) |
| `npx tsx scripts/dev/stills.ts <dir> [ids]` | renders still frames of templates (design review) |

## Security notes

Servers bind to 127.0.0.1. Uploads are streamed to disk with a size cap, checked by extension + magic bytes + ffprobe. Media is served only for registered assets with ids validated against a strict pattern; the AI service only reads files under `STORAGE_ROOT`. Cross-site writes are rejected. Set `STUDIO_ACCESS_TOKEN` / `AI_SERVICE_TOKEN` if the app is exposed beyond localhost. No secrets reach the browser.

## Licences

Remotion is free for individuals, non-profits and for-profit companies of up to 3 people; larger companies need a [Remotion company licence](https://www.remotion.dev/license). Fonts: SIL OFL 1.1 except Permanent Marker (Apache-2.0), shipped unmodified via Fontsource - full table in [docs/FONTS.md](docs/FONTS.md). MediaPipe selfie-segmentation model: Apache-2.0. faster-whisper MIT, pocketsphinx BSD, FastAPI MIT, Next.js MIT, Zustand MIT. FFmpeg/Chromium are used as external programs (note FFmpeg's x264 encoder is GPL - relevant only if you redistribute binaries).
