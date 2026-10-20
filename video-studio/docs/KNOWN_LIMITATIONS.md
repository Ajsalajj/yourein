# Known limitations (honest status)

## Not built
* **B-roll** (stock search/insert/crop), **transitions**, **separate sound-effects track**, **automatic sound suggestions**, **noise reduction**, **image layers**, **4K export presets**. The UI marks these "Not implemented yet"; there are no dead buttons for them.
* **Milestone 4**: subject segmentation, text behind the person, spatial/3D text, motion tracking. These need real segmentation/tracking; nothing was simulated.
* **Face-aware smart zoom** - zooms centre on the frame (focus is editable per zoom). Suggestions use transcript timing only.
* **Neural VAD** - silence detection is ffmpeg `silencedetect` (energy threshold) with conservative padding.
* **PostgreSQL/Prisma, Redis, multi-user auth** - deliberately deferred. Single-user, local JSON storage, in-process render jobs (a server restart marks running exports failed).

## Partly verified
* **Whisper (faster-whisper)** is implemented and unit-tested with a stub model, but was **never run with real weights** in the development sandbox (Hugging Face unreachable). Malayalam/Hindi/Tamil *recognition* is therefore unverified here; *rendering* of those scripts is verified (stills, see TEST_RESULTS.md). Accuracy for Indic languages depends on model size - use `medium`/`large-v3`.
* The offline fallback (pocketsphinx) is English-only and inaccurate (≈ half the words wrong on synthetic speech); it exists so the pipeline works without a download and is labelled as such.
* **Forced alignment** (WhisperX) is not enabled - see ARCHITECTURE.md.
* The **browser preview needs a browser that can decode the video** (H.264 in Chrome/Edge/Safari/Firefox are fine). Open-source Chromium builds without H.264 cannot play MP4 previews (WebM works). iPhone **HEVC .mov** may not preview in Chrome on some platforms (export still works because the renderer decodes with FFmpeg). A proxy-transcode on upload is the planned fix.
* **Preview vs export**: same composition, but the preview uses `<video>` seeking while export uses frame extraction; tiny frame-timing differences on very long edit lists are possible. Many tiny cuts mean many `<video>` remounts in the preview.
* Preview performance on long (>10 min) videos with hundreds of cuts has not been profiled.
* Music is looped/ducked using **caption timing** as a proxy for speech presence.
* Timeline is in *source* time; dragging captions across a cut moves them by source ms.
* The text-layer tool is basic (static text, no animation).
* Export speed: software GL ≈ 5 s render per video second at 1080×1920 on 4 cores. 60 fps doubles it.
* Safe-zone guides are approximate, not platform-exact.
* Accessibility: controls are labelled and keyboard reachable, but a full screen-reader/keyboard audit of the timeline (pointer-driven drag) was not done; keyboard equivalents exist for split/delete/undo/seek only.
* Remotion licence: free for individuals / ≤3-person companies; larger companies need a licence.

## Phase 2 additions - honest status

**Complete (verified on rendered output):** per-word styles with stable ids that survive text edits/split/merge; click-a-word-in-the-preview to style it; Typography & Effects panel (font, weight, size, spacing, case, gradient with animation/shine, outline, multiple shadows, glow, extrusion, background, rotation/skew/perspective, per-word motion curve/spring/delay/duration, saved word-style presets); licensed font upload with a licence confirmation; 18 new motion engines (54 total) and 22 new templates (73 total) in four families; frame-driven springs/overshoot/bounce; entry blur; optional temporal motion blur (`@remotion/motion-blur`, slows preview/export).

**Needs a matte or track (works only after the Effects panel's analysis has run):** text behind the speaker (`behind-person-typography`, `kinetic-scatter` used around a subject); tracked callouts.

**Not built:** text on a circular/curved path; per-glyph shatter ("Broken" in reference 3); real 3D-geometry letters (extrusion is stacked shadows, perspective is CSS 3D); radial zoom-blur *transitions between video clips* (the zoom-blur on outgoing words is implemented); a font-identity match to the reference videos (impossible from the files - see `REFERENCE_STYLE_ANALYSIS.md`); 16:9 / 1:1 comparison exports were not rendered in this phase.

**Caveats:** motion blur multiplies render cost by its sample count (6-16×) for the caption layer; Indic scripts with per-character animations rely on grapheme splitting and were verified in phase 1, not re-rendered against every phase-2 template.
