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

## Phase 2 - reference-driven caption engine

Run date: see git history. Commands: `npm run typecheck`, `npm run lint`, `npm test` (**82 TS tests pass**: 72 earlier + new `tests/wordstyle.test.ts`, animations now asserts all **54** behaviours), `npm run ai:test` (**12 pass**), `node scripts/dev/ui-check.mjs` (all checks pass, including *new*: preview exposes stable `data-word-id`, clicking a preview word opens the Type FX panel, selected word gets an outline).

### Visual comparison (real MP4 export, `scripts/validate-phase2.ts`)
One 9:16 export (1080×1920, 30 fps, person sample) with five captions, one per style: white bold kinetic, green italic emphasis, purple 3D, neon glow, cinematic yellow - plus an identical no-caption control render. "Ink" = pixels that differ between the two MP4s, so every number below is from **rendered output**, not React state.

| Style | first ink after caption start | ink before start | ink after exit | overshoot (peak/settled, after last word) | clipped when settled |
|---|---|---|---|---|---|
| white-kinetic | 33 ms | 0 | 0 | 1.55 | no |
| green-italic | 0 ms | 0 | 0 | 1.07 | no |
| purple-3d | 33 ms | 0 | 0 | 1.12 | no |
| neon-glow | 0 ms | 0 | 0 | 0.92 (glow breathes; no overshoot) | no |
| cinematic-yellow | 100 ms | 0 | 0 | 1.24 | no |

* **Per-word style independence:** a single word in caption 1 was restyled (`#ff2d55`, 1.15×). 12 958 px of that colour appear in its caption window, 5 px (noise) anywhere else - the style did not leak to other words or captions.
* Frames at *before / entry / peak / settled / exit* are in `docs/screens/phase2-comparison-contact-sheet.png`; the full export is `docs/demo/demo-phase2-style-families.mp4`; raw numbers in `docs/demo/phase2-validation-report.json`.
* The overshoot ratio is an **ink-area** proxy: it shows motion exists and is bounded, not that a curve equals a specific reference's curve.
* Caveats seen in the review of the sheet: the *neon-glow* text is low-contrast over the sample's collar area (placement, not a renderer fault); "IT BIG" briefly shows a collapsed space mid-animation in *purple-3d*.
* An earlier run of the same script flagged `clipped` for purple-3d (entry deliberately starts huge) and showed ink after "exit" (next caption was 100 ms behind); the harness was corrected (clip judged once settled; 300 ms gaps) rather than the renderer.

### Not re-verified in this phase
Behind-subject rendering was verified in the earlier phase (`docs/ADVANCED_EFFECTS.md`) and is unchanged; the `behind-person-typography` template was not separately exported. 16:9 and 1:1 exports of the comparison project were not rendered (`ASPECT=16:9 npx tsx scripts/validate-phase2.ts` runs them).

## Phase 3

Automated: `npm test` (TypeScript; **172 tests**, all pass at the time of writing), `npm run ai:test` (Python: transcription path, vision, **face detection/tracking 4**, **matte pipeline 5**), `npx tsc --noEmit`, `npx eslint src scripts tests`, `node scripts/dev/ui-check.mjs` (extended with SFX / Transitions / B-roll / face-framing panel checks).

New test files: `tests/regressions.test.ts` (neon dark edge, extrusion word gap, punch scale cap, motion-blur and cut-out gating), `sfx.test.ts` (library WAVs, placement through cuts, word sync, gains, ducking, suggestions), `transitions.test.ts` (40 type×direction continuity cases, blur/distinctness, placement on joins), `broll.test.ts` (sentences, concepts, suggestions, fitting, timing through cuts, split layouts, Pexels/Pixabay mapping + mock servers, host allowlist, generator adapter), `broll-library.test.ts` (real ffprobe/thumbnail library search), `reframe.test.ts` (camera path: fallback, vertical reframing, lag, speed/acceleration bounds, outliers, gaps, overrides, no black bars), `motiongraphics.test.ts` (circle layout, shard mesh tiling/motion, scene projection), plus `ai-service/tests/test_faces.py` and `test_matte.py` (exact ground truth).

Rendered/exported verification (reports in `docs/demo/`, sheets in `docs/screens/`): see [PHASE3.md](PHASE3.md) - SFX mixing (`sfx-validation-report.json`), transitions (`transitions-validation-report.json`), B-roll (`broll-validation-report.json`), reframing (`reframe-validation-report.json`), text-behind alignment (`mask-validation-report.json`), motion-graphics geometry (`motion-graphics-report.json`), phase-2 re-check after the visual fixes (`phase2-validation-report.json`). Benchmarks: [RENDER_BENCHMARKS.md](RENDER_BENCHMARKS.md).

`scripts/validate-reliability.ts` (repeat / cancel / edit-during-export / missing asset / concurrent exports) is written but **its results are not recorded here unless listed below**.

### Motion blur (verified on a rendered still)
Same project, same frame (133 ms, mid-entry of "STOP"), `motionBlur` 0 vs 1: 4 514 pixels differ (>20/255) with blur on versus 8 at a settled frame (166 ms), i.e. the blur only appears while the text moves. Side-by-side: `docs/screens/motion-blur-off-vs-on.png` (left off, right on). It is applied by the project's template/overrides to the whole caption layer; per-caption template overrides (`styleId`) do not carry their own motion-blur setting.
