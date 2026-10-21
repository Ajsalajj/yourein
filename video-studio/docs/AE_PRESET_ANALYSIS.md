# Pro Presets analysis (.ffx → Remotion behaviours)

The archive `Pro_Presets.zip` was received and analysed **read-only**. `.ffx` files are never imported or shipped; they were decoded with `scripts/dev/ffx_dump.py` (RIFX tree) and `scripts/dev/ffx_summary.py` (per-property keyframes) and the numbers re-implemented as original code:

* `src/lib/aeselector.ts` - an After-Effects-style text range selector (units chars/words, shapes square / ramp up / ramp down, start/end/offset, smoothness, ease high, randomise order + seed) plus the decoded parameter tables (`AE_PRESETS`).
* `src/remotion/animations/behaviors3.ts` - the eleven behaviours, frame-driven (no wall clock).
* `tests/aepresets.test.ts` - keyframe evaluation, permutation determinism, sweeps, entrance/exit end states, short-group compression.

## Status per preset

| Preset | Status | What came from the file |
|---|---|---|
| Word Blink | **decoded** | word selector, opacity animator, keyframed range |
| Smooth Fade In & Out | **decoded** | chars ramp-up in (58 f) / ramp-down out (60 f), tracking 0→5 over 94 f, 30 fps |
| Alphabet Blink | **decoded** | char selector sweep, opacity |
| Bottom to Up Blurred | **decoded** | position-Y and blur animators, ramp sweep |
| Fade Up & Out Smooth | **partly decoded** | word uncover (37 f) + char ramp-down exit; no position animator found, so no extra "up" move was invented |
| Letter Flicker | **decoded** | chars, square selector start 0→100 over 35 f, randomised, seed 0→172 (reshuffles each frame), ease high 56 |
| Bouncext | **decoded** (group motion) | rise distance, bounce frequency/decay |
| Text Tracking | **partly decoded** | tracking 0→12 over 73 f; further unnamed 1→0 keyframes are ambiguous and were **not** applied |
| Random Up Text | **partly decoded** | 24 f, rotation −79.7→0, delays ≤16/30 s; expression selectors/wiggly animators not recoverable → rise 60–120 px is my design |
| Type Animation In & Out | **not decodable** | driven by an Animation Composer plugin expression; implemented as my own design |
| Ramp Up Zoom Text | **not decodable** | expression selector; own design |

## Interpretation assumptions (inferred, not stored in the file)

* Ramp shapes extend beyond the selected region (ramp up: 0 at the left edge, 1 at the right), which makes the sweeps behave as entrance/exit waves.
* Exit sweeps are anchored to the caption end; entrances to its start. A caption group shorter than the preset (94 f etc.) plays the preset **time-compressed**, so entrance and exit do not overlap.
* Position 57 px / blur 59 px are taken on a 1080 px basis and scaled with the frame; Bouncext assumes the layer is as tall as the frame; tracking is 1/1000 em.
* Ease high/low are approximated by a smoothstep blend.
* Smooth Fade In & Out is a rolling wave by design: with the real keyframes not every letter is fully visible at the same moment (weakest letter peaks around 0.6-0.7 on a 1.5 s caption).

## Not verified

No After-Effects render of these presets was available, so frame-by-frame equality with AE is **not** claimed. Rendered stills of the nine decoded behaviours were reviewed visually only. To pin down Type In/Out, Random Up, Ramp Up Zoom and Text Tracking exactly, upload short AE-rendered exports (or the expression text / Animation Composer settings).
