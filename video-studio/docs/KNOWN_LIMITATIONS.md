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
