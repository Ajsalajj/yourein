# Test results

Run on 2026-10-20 in the cloud sandbox (4 vCPU, Node 22, Python 3.13, ffmpeg 6.1, Playwright Chromium as render browser). **Network limits:** only npm/PyPI/apt were reachable - Hugging Face was not, so Whisper weights could not be downloaded (see KNOWN_LIMITATIONS.md).

| Suite | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | clean |
| Lint | `npm run lint` | clean (0 errors, 0 warnings) |
| Unit tests (TS) | `npm test` | **56 / 56 pass** |
| AI service (Python) | `npm run ai:test` | **8 / 8 pass** |
| Full workflow vs running app | `npx tsx scripts/e2e.ts` | **27 / 27 checks pass** |
| Real-browser UI | `node scripts/dev/ui-check.mjs` | **20 / 20 checks pass**, no console/page errors |
| Other aspect ratios | `npx tsx scripts/dev/export-aspects.ts` | 16:9 → `h264 1920×1080 30fps`, 1:1 → `h264 1080×1080 30fps` (first run printed FAIL only because the script compared against ffprobe CSV with a trailing comma; values were correct and the script is fixed) |

## Coverage of the requested test areas

| Requirement | Where |
|---|---|
| Caption timing, grouping | `tests/captions.test.ts` |
| Animation frame behaviour (determinism, distinctness, per-frame values, no wall-clock APIs) | `tests/animations.test.ts` |
| Complex-script text layout (Malayalam/Hindi/Tamil graphemes, balancing) | `tests/captions.test.ts`; rendering verified visually through the real renderer (stills) |
| Timeline edit operations (split/merge/shift/resize/cuts/undo model) | `tests/captions.test.ts`, `tests/timeline.test.ts` |
| Export dimensions | `tests/timeline.test.ts` + real ffprobe of 3 exported files |
| Audio synchronisation | frame-aligned segment mapping over 200 random cuts (`tests/timeline.test.ts`); exported duration equals EDL expectation (e2e); music ducking envelope test |
| File validation | `tests/server.test.ts` + e2e (wrong extension, fake mp4 text, corrupt mp4, traversal) |
| Project persistence | `tests/server.test.ts` (disk round trip, duplicate, delete, corrupt, atomic writes) + e2e reload + UI "edit survives refresh" |

## The e2e workflow (what actually happened)

`upload → transcribe → edit → style → cuts → zoom → save → export → verify`, demo clip = 15.5 s synthetic video + espeak speech:

* Whisper could not load (proxy 403) → service fell back to pocketsphinx and reported that in `transcript.warnings`.
* ASR output: *"oh and we won and will kill you to do we are going to learn how to op ed it really old weekly …"* for the script *"Hello everyone and welcome to the channel. Today we are going to learn how to edit videos quickly …"* - i.e. the offline engine is poor, which is why the editing step matters. The e2e corrects text with the same `editCaptionText` operation the UI uses.
* Silence analysis found 4 silences → 2 conservative cuts (0.53 s); smart zoom proposed 4 zooms.
* Export (Bold Creator template): **H.264 1080×1920 30 fps + AAC, 14.976 s** (EDL-expected 14.967 s, source 15.495 s), ~80 s render.
* **Caption proof from pixels:** the MP4 and a control render of the identical project with captions hidden were compared in the caption region: mean difference 13.9 (control noise 0.55); the caption-only layer changes by 12.6 between frames inside one caption group, i.e. the captions are present and animating in the final file. Frames: `docs/demo/` (compressed copy of the output).

## Visual review

All 42 templates were rendered as stills (4 frames each) over the demo video and reviewed; Malayalam, Hindi and Tamil text were rendered through 6 templates each. One bug was found this way (Luxury Title invisible because `background-clip:text` does not reach transformed children) and fixed. Screenshots of the editor are in `docs/screens/`.

## Not tested

Real Whisper transcription; any non-English recognition; HEVC/ProRes sources; videos longer than ~15 s; 60 fps export; GPU rendering; Safari/Firefox; screen readers.
