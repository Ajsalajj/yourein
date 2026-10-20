# Reference style analysis (Phase 2)

Four reference videos were supplied (WhatsApp-compressed MP4s). They were analysed **locally** with `ffprobe`, frame sampling and colour-class masks (`scripts/dev/ref_sheets.py`, `ref_strip.py`, `ref_measure.py`). They are third-party material: **no frame from them is committed** (`data/` is git-ignored) and nothing was copied from them. This document records *what was observed* and clearly separates it from *what is estimated*.

Legend: **[V]** verified by measurement or direct frame inspection · **[E]** estimate / interpretation (cannot be proven from compressed video).

## What can and cannot be known from these files

* **[V]** All four are 576×1024, 9:16, H.264, 24–30 fps (ref1 ≈24.5 fps variable, ref2 30, ref3 30, ref4 ≈24.6) and 10–61 s long. They are re-encoded screen/phone captures with a small Instagram handle overlay baked in (top-right or bottom-left) - that overlay is **not** part of the caption styling and is ignored.
* **[V]** The files contain no font metadata, so **font families cannot be read, only inferred from glyph shapes**. Every font statement below is **[E]**.
* **[V]** At 576 px wide and WhatsApp compression, gradients/glows are partly smeared; exact hex values below are the colour *classes* measured on text pixels, not authoritative brand values.
* **[V]** The caption "engine" used in the references (After Effects / Premiere templates, visible in the screen-recorded tutorial segments of ref2 and ref4) uses 3D cameras, shine effects and Gain/Contrast tools. Those are authoring tools; this project reproduces the *look* in Remotion rather than the tools.

## Reference 1 - bold kinetic typography (≈44 s, tutorial reel about captions)

**[V] Observed**
* One to three words on screen at a time; words are **placed freely around the subject** (left edge, centre, right, above/below the person) rather than in a fixed caption bar. Position changes every word.
* Very **large, ultra-heavy sans** in white, sometimes filling most of the frame width ("feel polished", "game changer", "place … moment" on a red background). Mixed sizes within a phrase (a hero word large, connecting words ~⅓ size: "or", "and", "the", "on").
* Zoom-blur / radial-blur **transition** on the word "this" at ≈2 s (word smeared horizontally, then resolves).
* Text sits **behind the subject** at several points (the head/arm of the speaker overlaps the letters: "place m**e**nt", "finally", "keep") - i.e. a subject matte is used. A white-bg "here or down" section has the person cut-out beside black text.
* Gradient (purple→blue) on a keyword ("gradients") and a bold sans in dark grey/black on light backgrounds ("here").
* A bottom "regular captions" comparison line in small warm-yellow regular-weight text.
* Late section: letters at a tilted perspective with a soft drop shadow ("how it's your turn") fading into dark.

**[E] Estimated**
* Font ≈ a heavy neo-grotesque (Inter/Helvetica Black class); condensed ultra-heavy for the red slide.
* Entry ≈ 3-5 frames with hard cut and scale-up from ~85 %; exit ≈ zoom-blur; the hold is one word per beat.

**How it maps here:** `bold-white-kinetic`, `kinetic-scatter` (free placement + measured clamp), `zoomed-keyword`, `behind-person-typography` (needs a matte), `perspective-title`, the **Bold Kinetic** family.

## Reference 2 - cinematic yellow/white headlines (≈61 s, tutorial on "3D text")

**[V] Observed**
* Two type voices alternate: **white ultra-condensed/extended heavy capitals** ("WELL", "SAVE THIS FOR") and **golden-yellow (#f5c518-class) italic heavy capitals** ("SAVE THIS", "BREAK", "FUN PART", "CREATIVE").
* Words are huge (up to ~½ the frame width per word), stacked in 2-3 lines, with **depth**: the text recedes/pushes with camera dolly, sits behind the speaker, and appears with strong **blur-in / blur-out** (frames at 2 s, 4 s, 42 s are heavily blurred).
* Small lowercase connective words in white (≈ 4 % of frame height) next to the hero word.
* Soft, large black shadows under the yellow words give separation from the bright window background.
* Late: text on a circle path around the speaker (screen recording of the 3D-camera tutorial, 46 s).
* The lower thirds use small yellow-highlight keywords inside white sentences ("stationary", "captions", "keyframe", "further", "room").

**[E] Estimated**
* Font for the yellow voice: a **bold condensed italic grotesque** (Anton / Bebas-class, skewed ~10-12°).
* Motion: focus-in from blur over ~8 frames, slow push (≈ +6 % over the hold), recede on exit.

**How it maps here:** `cinematic-giant-headline`, `yellow-active-word`, `editorial-reveal`, `depth-push`, **Cinematic** family. **Not implemented:** text on a circular path.

## Reference 3 - caption-effect gallery pack (≈10 s, "Trendy Caption FX Pack")

**[V] Observed** - twelve named effects on black, each cycling in place: *Clean apple style*, *Shadow*, *Shiny Text* (cyan→blue with a diagonal highlight sweep), *Smooth Cross*, *Sliding Text* (green, slide-in), *Super Trendy* (white + orange), *Smooth Fade* (pink-red fade), *Smooth slide* (teal), *Hero Text* (violet italic), *Devin Jatho Text Effect* (cyan/white tube-style with glow), *Bounce Text* (white bounce), *Broken* (red, shattered letters), *Flicker Glowing Text* (yellow-green flicker), *Gradient Text* (orange-yellow), *Metallic Text* (italic silver serif), *White* (soft glow).
* Title "WANT THIS?" in a **condensed bold with cyan→blue vertical gradient and halo**.
* Cycles repeat roughly every 3 s per item with blur-in / fade / slide / bounce.

**[E]** Fonts: condensed sans (Anton-class), script-ish italic serif for Metallic, rounded sans for Smooth. Effects are generic After-Effects text presets.

**How it maps here:** the **Neon FX** family (`neon-cyan-glow`, `pink-gradient-pop`, `glow-pulse`, `neon-flicker`, shine sweeps via gradient `shine`). **Not implemented:** the shattered "Broken" effect (needs per-glyph fragmentation geometry).

## Reference 4 - creator captions with keyword colour swaps (≈40 s, tutorial)

**[V] Observed**
* **White heavy sans, sentence-case**, one to three words at the lower-centre; **no stroke**, a soft black shadow.
* The keyword is swapped to a **different style**: neon-green **bold serif italic** ("Editing", "Captions" in quotes), a violet→magenta 3D-looking bold ("Shine"), orange-red for "Shine" in the editing UI.
* Motion: words rise with small overshoot; the swapped keyword pops larger than its neighbours and sits slightly lower; a green blurred "ghost" trails behind the first keyword frame ("Have" smeared at 2 s) - an entry blur, not a separate layer.
* Underline/extra word fragments ("long....", "takes") demonstrate word-level layout inside one phrase.

**[E]** Fonts: Montserrat/Inter-class heavy sans; Abril Fatface/DM-Serif-Display-class italic serif for the green keyword.

**How it maps here:** `green-italic-impact`, `purple-3d-punch`, `yellow-active-word`, per-word styles, keyword emphasis (`emphasisLook`), **Creator** family.

## Measured common properties (applied as defaults)

| Property | Value | Basis |
|---|---|---|
| Hero word height | 8-20 % of frame height (kinetic), 5-7 % (creator subtitles) | **[E]** read off the contact sheets (visual, ±3 %); not a per-frame bbox series |
| Connective word height | ≈ 30-40 % of hero | **[E]** visual |
| Peak overshoot of pop-ins | ≈ 8-15 % (spring, one rebound) | **[E]** from area-over-time curves; limited by 24 fps sources and compression |
| Entry duration | 3-8 frames @ 24-30 fps (≈ 100-300 ms) | **[E]** (frame sequences at 2 s intervals plus short strips; not every entry was strip-measured) |
| Colour classes on emphasis | white, golden yellow, neon green, violet/magenta, cyan | **[V]** colour masks over the whole timeline |
| Shadow | soft, wide, ≈ 0.05-0.1 em blur, 60-80 % black | **[E]** |

## Honest limits

* No font identity can be confirmed. Closest *licensed, bundled* matches are used (Inter, Poppins, Montserrat, Archivo Black, Anton, Bebas Neue, Oswald, Abril Fatface, plus Noto Malayalam/Devanagari) and are recorded in `FONTS.md`. Matching to the references is by shape class, not identity.
* The references use After-Effects 3D cameras and tracked mattes. Here, "behind the subject" requires a real matte (MediaPipe segmentation in `ai-service`); without one it falls back to the front and the UI says so.
* Motion curves are *estimated* from 24-30 fps compressed footage; the shipped springs are tuned by eye against the frame sequences and verified on rendered output (`TEST_RESULTS.md`).
