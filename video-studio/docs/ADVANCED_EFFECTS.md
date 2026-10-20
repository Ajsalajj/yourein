# Advanced effects (real segmentation and tracking)

Everything here reads the actual video pixels. Nothing is a static overlay pretending to be an effect.

## 1. Subject masking → text behind the speaker

**Pipeline**
1. `POST /api/projects/:id/segment` starts an AI-service job (`app/vision.py::segment_video`).
2. ffmpeg decodes the clip at the project fps. Each frame is letter-boxed into 256×256 and run through MediaPipe's **selfie-segmentation** network (TFLite, executed with `ai-edge-litert`). The model file is the Apache-2.0 asset shipped inside the official `mediapipe==0.10.14` wheel on PyPI; `ai-service/scripts/fetch_models.py` extracts it (no Hugging Face / Google storage needed). No binary is committed.
3. Post-processing: temporal smoothing (0.65·now + 0.35·previous), edge sharpening (smoothstep 0.35–0.65) and a 1.2 px feather. Output: one **RGBA PNG per frame** (alpha = person) under `data/projects/<id>/masks/<maskId>/`, registered in `project.analysis.segmentation` (server-owned: the client cannot overwrite it).
4. Composition (`src/remotion/Studio.tsx`, `AdvancedLayers.tsx`): layer order is **video → "behind" text (and captions if enabled) → `SubjectCutout` → front text**. `SubjectCutout` is the same video again, muted, with CSS `mask-image` set to that frame's matte (`mask-size: cover`, which matches `object-fit: cover`). The matte image is loaded under `delayRender`, so a render frame is never captured before its matte is decoded; the preview keeps the previous matte until the next one is ready (no flicker).
5. Preview and export use the same components; the export worker receives `mask: {base, query, fps, frames}`.

**UI**: Effects → *Subject masking* → "Analyse subject"; then Text tab → "Behind the speaker" per layer, or Effects → "Captions behind the speaker".

**Limits (honest):** one small network (256×256 input) tuned for a single, mostly front-facing person. Hair and fingers are soft; objects held in front can be partly missed (in the test clip the black helmet in the foreground is only partly kept). Multiple people are masked together. Mattes are 480 px on the long side and are upscaled. No matting refinement network (e.g. RVM/MODNet) is included because those weights are not obtainable from PyPI/npm here. Analysis cost ≈ 20 ms/frame on 4 CPU cores.

## 2. Motion tracking → tracked text

`POST /api/projects/:id/track {roi, startMs}` → `vision.track_region`: Shi-Tomasi corners inside the region, **pyramidal Lucas-Kanade optical flow** frame to frame, median displacement (outlier-rejected) for position, median pairwise-distance ratio for scale, feature replenishment when fewer than 25 points survive. Result per frame: `[centreX, centreY, scale]` in normalised source coordinates, stored in `project.analysis.tracks`.

A text layer with `trackId` follows `followTrack()` (`src/lib/tracking.ts`): the layer's placement is the offset from the region's first position, mapped through the `object-fit: cover` transform, optionally scaled by the region's scale (`trackScale`). Tracks live in *source* time, so cuts never desynchronise a label.

**Measured accuracy** (pytest, ground truth = a textured patch moving on a known sinusoidal path with a known 0.75–1.25× scale change): mean position error < 4 px and max < 12 px on a 540×960 video; scale correlation > 0.8. A textureless region is refused with a clear message instead of producing nonsense.

**Limits:** 2-D position + uniform scale only (no rotation, no perspective/plane tracking); tracks can drift over long clips or lose a region that is fully occluded; the region needs visible texture.

## 3. Perspective and spatial typography

Text layers accept `perspective {rotateX, rotateY, rotateZ, depth}` → CSS `perspective()` + 3-D rotations, identical in preview and export. Combined with tracking and "behind the speaker" this gives layered, spatial-looking titles. It is **not** a depth-aware scene: there is no depth estimation, ground-plane detection or 3-D camera solve, so a "floor title" is a perspective-transformed text layer you place by eye.

## 4. Cinematic title compositions (`src/lib/titles.ts`)

| Composition | Needs | What it builds |
|---|---|---|
| Behind-the-subject headline | masking | 300 px Anton title, `behind`, tracking-in reveal |
| Spatial floor title | none | gold Montserrat, `rotateX 62°`, fade-up |
| Cinematic serif card | masking | italic Cormorant, `rotateY −14°`, behind, tracking-in |
| Motion-tracked callout | a track | label on a pill, follows the track's position and scale, spring scale-in |

Text-layer entrance animations: fade-up, tracking-in, spring scale-in, mask-reveal (all frame-driven).

## 5. Not built

Face/pose-aware framing, multi-person separation, non-person object segmentation, planar/3-D tracking, depth-from-video, generative B-roll.
