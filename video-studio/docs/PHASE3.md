# Phase 3 - AI editing & cinematic effects

Everything below was added **on top of** the existing editor (54→65 motion engines, 73→84 templates, per-word styling, transcription, timeline and MP4 export are unchanged and still pass their tests). Each subsystem was validated on **rendered MP4 output** (not on React state); the scripts are in `scripts/validate-*.ts` / `scripts/dev/verify_*.py` and the raw reports are in `docs/demo/*-report.json`.

Honesty legend used in this file: **Verified** = measured on a real export in this environment · **Unit-tested** = pure logic with tests only · **Unverified** = implemented but not exercised against the real thing (reason given).

## 1. Phase-2 visual defects (fixed, with regression tests)

| Defect | Cause | Fix | Evidence |
|---|---|---|---|
| Low-contrast neon captions over footage | bright cyan/pink glow with no dark edge has almost no luminance contrast on light footage | every glowing look now has a dark stroke or contact shadow (Neon Cyan, Glow Pulse, Floating Word, Pink Gradient, Rainbow) | `docs/screens/neon-contrast-before-after.png`, `tests/regressions.test.ts` (rule: *every glowing template has a dark edge*) |
| "IT BIG" read as "ITBIG" in Purple 3D | the 24 px extrusion is painted to the right of each glyph and ate the 0.28 em word gap; the punch entry also scaled up to 2.1× over the previous word | new `wordGap` style (em) + automatic gap = default + horizontal reach of the extrusion; punch entry capped at ≤1.5× | `docs/screens/purple-3d-spacing-after.png`, 3 regression tests |
| Clipping / animation defects in the contact sheets | none found beyond the two above in the re-rendered five-style comparison (clipping check = **pass** for all five) | - | `scripts/validate-phase2.ts` re-run, report in `docs/demo/phase2-validation-report.json` |

## 2. After-Effects-style motion presets

The Pro Presets ZIP was provided later and **decoded read-only**; see [AE_PRESET_ANALYSIS.md](AE_PRESET_ANALYSIS.md). Eight presets use parameters taken from the files (word/char range selectors, keyframes, fps, tracking, randomisation seeds) through an original selector engine (`src/lib/aeselector.ts`); Type Animation In & Out and Ramp Up Zoom Text depend on plugin/expression data that is not stored in the files and remain my own designs; Random Up Text and Text Tracking are partly decoded. `.ffx` files are never imported. Not compared against real AE renders.

Word Blink · Smooth Fade In & Out · Alphabet Blink · Bottom to Up Blurred · Fade Up & Out Smooth · Letter Flicker · Type Animation In & Out · Bouncext · Text Tracking · Random Up Text · Ramp Up Zoom Text.

## 3. AI B-roll

* **Analysis** (`src/lib/broll.ts`): sentences → concrete/visual concepts (lexicon + proper nouns, abstractions penalised) → suggestions anchored on the keyword, ≥1.5 s apart, inside one kept segment (never across a cut), ≤40 % coverage, hook (first 1.5 s) left on the speaker. Deterministic, rule-based - **no model call**.
* **Providers** (`src/server/broll/*`): independent abstraction. **My B-roll folder** (`DATA_DIR/library/broll`, optional `name.txt` tags) is fully local and **verified end to end**. **Pexels** and **Pixabay** adapters implement the documented search APIs (`PEXELS_API_KEY`, `PIXABAY_API_KEY`) with a download host allowlist (https only, no redirects out of it). **Unverified against the live services**: this environment cannot reach them and has no API keys; they are unit-tested against local mock servers that reproduce the documented response shapes. **AI generation** is a generic HTTP adapter (`BROLL_GEN_ENDPOINT`, documented JSON contract incl. polling) - not tied to any vendor, unit-tested with a fake service, **not configured by default**.
* **Editor**: analyse → per-sentence query (editable) → results grid → *Use*; *Auto-fill all*; replace; own clip upload; placed clips on a timeline lane (move/resize), per-clip layout and in/out transitions.
* **Layouts**: full frame, overlay (opacity), split-screen top/bottom/left/right (the speaker is re-fitted into the other half), picture-in-picture. Clips are fitted to the slot automatically (trim from ~1 s in when longer; shorter clips shorten the slot - never stretched).
* **Speaker audio is never touched**: the exported audio with B-roll differs from the no-B-roll export by **-155 dB** (bit-identical in practice).
* **Verified on a real export** (`scripts/validate-broll.ts`): full-frame mid-frame differs from the expected clip frame by 5.97 (MAD, 0-255) vs 80.7 from the speaker; split-top: top half 6.78 from the clip, bottom half 0.88 from the re-fitted speaker (vs 79.8 unrefitted); 50 % overlay 3.33 from the expected blend; PiP panel region differs 113 from the control while the rest differs 1.2; flash-in peaks at luma 237 (control 119); fade-out dips to 25; far from the clips the export equals the control (max diff 0.5).
* Limits: stills/images are not supported as B-roll (video only); stock results are not previewed with licence text beyond the summary; "AI" here means rule-based concept extraction, not a language model.

## 4. Cinematic transitions

Ten types - smooth zoom, radial zoom blur, directional blur, whip pan, motion blur slide, camera push, flash, mask reveal, slide, cinematic fade. They run **between real decoded clips**: on any join of the edit (cut / silence removal) the outgoing shot continues into the removed footage and the incoming one starts from before the cut (output length unchanged, speaker audio untouched), and on B-roll in/out against the speaker footage.

* Blur types are genuine: directional/whip/motion use an SVG Gaussian along one axis; **radial zoom blur accumulates 16 scaled copies of the real frame on a canvas** (uniform average along each radius).
* **Verified** (`scripts/validate-transitions.ts`, 11 real exports on a 12 s four-scene clip): every type leaves the footage untouched outside its window (max diff 1.2), blends continuously into both clips at the window edges (≤ 1.9 at the end), and passes its type-specific pixel test - flash peaks >215 luma, cinematic fade dips <15 % of the neighbours' luma, directional/whip/motion reduce horizontal gradient energy to 0.30/0.42/0.36 of the control, radial zoom blur reduces radial-vs-tangential gradient ratio to 0.027, slide shows the two scenes side by side, mask reveal shows the new scene only in the centre; all ten looks differ pairwise by ≥22.8 (MAD).
* Fixed on the way: an off-by-time bug (static `startFrom` + per-frame offset ran clips at 2× speed) found by the edge-continuity check.

## 5. Sound effects

Independent SFX track (source-time anchored), 13-sound **original CC0 library** synthesised by `scripts/make-sfx.py` (no samples, no third-party audio) + user uploads; timeline lane with drag; per-clip volume, fades, trim, duck-music flag; track volume; optional ducking under speech; **word-synced** placement (the sound follows the word when captions are retimed/edited); transition sounds placed on the join; **rule-based suggestions** (numbers/success → ding, emphasis words → impact, CTA → click, photo → shutter, tech → glitch, zoom starts → whoosh, cuts → soft whoosh, optional sound on every caption) with spacing and per-minute caps.

**Verified on real exports** (`scripts/validate-sfx.ts`, speech muted so only effects/music are heard): each effect appears at the planned time with **0.0 ms error**, correlation ≥0.986 with the library WAV, gain within 3 % of the planned volume; music inside the effect windows is ducked to **0.349** of its level (target 0.35) and untouched (1.000) away from them. Note: Remotion mixes mono sources to stereo with an equal-power pan law (-3 dB per channel) - applies equally to speech and effects, so balances are preserved.

## 6. Face-aware auto zoom / reframing

* **Detection** (`ai-service/app/faces.py`): MediaPipe BlazeFace short-range (Apache-2.0) via ai-edge-litert with SSD decoding written here; multi-scale windows (the 128 px network misses small faces), windowed re-detection around the tracked face, containment NMS (drops head+shoulder/helmet false positives), confidence-first primary selection, gated association so a second person does not steal the track.
* **Virtual camera** (`src/lib/reframe.ts`): outlier rejection, gap bridging (≤0.9 s), hold (1.2 s) then ease back to the centre fallback, dead zone, critically damped spring with speed limit, **velocity look-ahead** (a plain damped follower lagged by 70 % of the half-window; with look-ahead ≤0.3), manual override ranges, tightness and smoothness controls; **vertical reframing** 16:9→9:16 is the same camera (the crop window follows the face). Centre crop remains the fallback with no data / mode off.
* **Verified on a real export** (`scripts/validate-reframe.ts`, synthetic 16:9 footage with a known moving face incl. a 1.5 s detection gap, exported to 9:16): face visible in 100 % of sampled frames (centre crop: 55 %), fully inside the frame 89 % (45 %), median face height 0.30 of the frame (target 0.30), median offset from centre 0.12 (0.19), no jump above 0.06 frame-widths per 3 frames. Detector tests (`ai-service/tests/test_faces.py`): median centre error 0.002 on known motion, gaps reported honestly, two faces do not swap.
* Limits: single primary subject (no multi-person switching), BlazeFace short-range assumes faces not tiny relative to the frame (multi-scale mitigates this), tracked-text layers assume the default crop, split-screen B-roll uses a plain crop for the speaker.

## 7. Text behind people

Pipeline: network matte (256 px) → bicubic upsample → **guided filter against the video frame** → **motion-compensated temporal smoothing** (Farneback flow warps the previous matte; trusted only where it explains the frame) → contrast curve → grow/shrink → feather. Raw network output is stored, so **feather, grow/shrink, temporal weight and the guided filter are adjustable afterwards** without re-running the network (≈3 s of processing per second of video; the preview and export read the same PNG mattes - the preview is real-time, only the refinement is not). The behind-subject cut-out follows the face-aware camera.

* **Objective comparison with exact ground truth** (`ai-service/tests/test_matte.py`; synthetic composite whose alpha is known by construction): IoU 0.722→0.736, boundary F1 0.430→0.494, temporal error 0.195→0.173 versus the old pipeline. These are **modest gains**: the 256 px network, not the post-processing, dominates the error on this hard moving background.
* **Alignment on a real export** (`scripts/validate-mask.ts`): over the subject's solid core **100 %** of the title pixels are hidden; outside the subject **99.95 %** remain visible; grow +4 enlarges the subject region 6 % (842k→894k px); feathering widens the partially transparent edge band.
* Limits: single clear person works best; hair/hands/held props can be soft; a static overlay is **not** a mask - without an analysed matte "behind" layers fall back to the front and the UI says so.

## 8. Advanced motion graphics - what is true 3D and what is not

| Effect | How it is made | True 3D? | Verified |
|---|---|---|---|
| Text on a circular path (+ arc sweep, spin, inside/outside, ccw) | per-glyph placement by measured advance, tangent rotation | **No** - flat 2D geometry | median glyph radius 173.0 px vs 172.8 requested; arc spans ±69.8° for a 140° sweep |
| Shattered / broken text (in, out, both) | jittered triangle mesh, one clipped copy of the text per shard, ballistic poses | **No** - 2D polygons | shards reconstruct 99.3 % of the intact text at minimal spread; 98.5 % of pixels leave the text box mid-break |
| Perspective typography | CSS 3D transforms (`perspective`, `rotateX/Y/Z`) on a flat layer | **No** - 2.5D | phase-2 trapezoid check |
| "3D" extrusion | stacked text-shadows along an angle | **No** - 2.5D illusion | rendered stills |
| Camera-aware spatial text | a layer pinned to a point of the SOURCE picture, projected through smart zoom / the face camera, with a parallax (depth) factor | **No** - 2D projection | `tests/motiongraphics.test.ts` (exact projection maths) |
| Radial zoom-blur transitions | 16-sample accumulation of the real frame | **No** - 2D post effect | see §4 |

There is **no 3D scene, mesh or renderer** in this project; nothing above should be described as true 3D geometry.

## 9. Rendering performance

See `docs/RENDER_BENCHMARKS.md` (benchmarks before/after, what changed and what did not).

## 10. Tests

See `docs/TEST_RESULTS.md` (Phase 3 section) for the full list and results.
