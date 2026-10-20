# Render benchmarks (phase 3, task 9)

Machine: 4 vCPU, 16 GB, software GL (`swangle`), Chromium headless shell, Remotion 4.0.537, x264. All runs: 1080×1920, 30 fps, 226 frames (7.5 s) unless noted, driven by `scripts/bench-render.ts` (runs `scripts/render-worker.ts` directly, records phase times; fidelity = PSNR/SSIM of the MP4 against a reference render with ffmpeg). Raw rows: `data/bench/results.jsonl` (not committed); the numbers below are copied from it.

## Findings

**The renderer is CPU-bound on this machine and does not scale with more workers.** `top` during a render shows all four cores busy (headless shell tabs, ffmpeg/x264 at >100 %, compositor). Captions cost little (153 ms/frame without captions vs 165 ms with), so the floor for a plain 1080×1920 export here is ≈150-165 ms/frame (≈6 fps, ≈1.2× real time).

| Experiment (captions scenario, ms per frame, lower is better) | ms/frame | PSNR vs PNG-frame reference | file |
|---|---|---|---|
| Reference: PNG intermediate frames, concurrency 2 | 260 | - | 2.6 MB |
| **Baseline (before): JPEG q80, concurrency auto (=2)** | **165** | 46.04 dB | 4.05 MB |
| concurrency 1 / 3 / 4 | 198 / 165 / 163 | 45.6 / 45.3 / 45.3 dB | 4.0 MB |
| x264 preset veryfast / medium / slow | 152 / 165 / 177 | 45.19 / 46.04 / 46.08 dB | 3.26 / 4.05 / 3.75 MB |
| OffthreadVideo cache 512 MB | 162 | 46.04 dB | 4.06 MB |
| JPEG quality 60 / 80 / **95** | 165 / 165 / **163** | 44.89 / 46.04 / **46.55** dB | 5.80 / 4.05 / **2.92 MB** |
| captions hidden (video only) | 153 | - | 3.6 MB |

What this means:
* **Concurrency, OffthreadVideo cache and font handling do not help** (the machine is saturated; fonts are loaded once per tab and the caption layer is only ~8 % of the frame cost). They were left as they were (auto = min(4, cores/2)).
* **x264 `veryfast`** is 8 % faster but loses 0.85 dB and is not taken: the brief says not to trade fidelity for speed.
* **JPEG quality 95 is free**: same time, **+0.5 dB** and a **28 % smaller file** (cleaner frames compress better). Adopted as the default (`jpegQuality` 80 → 95).
* Bundling is cached by source fingerprint (2.6-4.7 s when sources changed, 0 s otherwise); selecting the composition costs ≈0.5 s.

## Changes that did help

| Scenario | Before | After | Fidelity after vs before | Change |
|---|---|---|---|---|
| Captions **behind the subject** (captions in the first 40 % of the clip) | 449 ms/frame (106 s) | **286 ms/frame (66 s) = -36 %** | 50.9 dB, SSIM 0.9965 | the subject cut-out (a second video decode + a matte per frame) is mounted only while something is drawn behind the subject (`behindContentActive`, unit-tested) |
| Motion blur 0.5 (11 samples, ungated) | 840 ms/frame (≈5× the plain frame) | **771 ms/frame (-8 %)** with 8 samples + gating | 45.9 dB vs a 24-sample reference (before: 46.5 dB) | sample count 6-16 → 5-10 and blur skipped while no caption word can be moving (`captionMotionActive`). A small gain only: it stays ≈4.8× a plain frame |
| Plain captions, new defaults (JPEG q95) | 165 ms/frame, 4.05 MB, 46.04 dB | **160 ms/frame, 2.91 MB (-28 %), 46.56 dB** | +0.5 dB | JPEG quality 95 |

Motion-blur cost is almost entirely the number of full-frame composited samples (≈63 ms per extra sample here). Quality check against a 24-sample reference (1590 ms/frame): 6 samples 45.94 dB / 527 ms, 10 samples 47.05 dB / 762 ms, 11 samples 46.55 dB / 846 ms; blur **off** is only 30.55 dB, i.e. the blur is clearly visible and 6 samples already reproduce it to within the JPEG noise floor. Gating saves little on dense speech (a word starts every ~0.4 s, so something is almost always moving); it helps with pauses.

## Heavy scenario (3 transitions incl. radial zoom blur, split-screen B-roll, kinetic captions; 270 frames)

concurrency auto 280 ms/frame (77 s) vs concurrency 4 263 ms/frame (76 s), PSNR 47.2 dB between them - again no meaningful scaling.

## Not done / not possible

* No GPU: `swangle` software GL is the only option here; a machine with a GPU or more cores will scale differently and should re-run `scripts/bench-render.ts`.
* Frame caching across identical frames (static captions over a static shot) is not available in Remotion's renderer; not implemented.
* Faster export would require lower resolution, a faster x264 preset or fewer blur samples - all of which change output quality and were deliberately **not** applied by default.
