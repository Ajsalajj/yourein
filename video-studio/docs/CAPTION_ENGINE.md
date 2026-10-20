# Caption engine

Source: `src/remotion/` · registry `templates/registry.ts` · engines `animations/behaviors.ts` · the 30-preset list `templates/core30.ts`.

## How a caption frame is produced

1. `captionsToOutput` projects captions (source time) onto the output timeline using the edit-decision list.
2. `CaptionLayer` renders **each caption inside its own `<Sequence>`** (`layout="none"`), so Remotion owns its lifetime.
3. `CaptionGroup` reads `useCurrentFrame()` / `useVideoConfig()`, converts to ms (`frame * 1000 / fps`) and builds a context per word: `sinceWord`, `wordP` (0..1 through the spoken span), `state` (future/active/past), `isCurrent`, group `enter`/`exit`, `spr()` (Remotion `spring()` stretched to the enter duration), `ease()`, `hlP` (highlight ramp), word/line indices and measured word rectangles.
4. The engine (`Behavior`) is a pure function of that context → CSS for the word (`style`, `inner`, `fill`, `decoration`), per-glyph style (`char`) or per-group wrapper/overlay (`group`). Nothing reads the wall clock; a test fails if `Math.random`, `Date.now`, timers or `requestAnimationFrame` appear in `src/remotion`.
5. Layout is computed **once per group** (balanced line breaking → `measureText` fit-to-width → word rectangles) with every word always occupying its final slot, so words appear without reflow. Grouping: `groupWords` (phrase-aware) or `groupWithRemotionCaptions` (`@remotion/captions` `createTikTokStyleCaptions`, time-window pages).

`@remotion/captions`: our words are converted to Remotion `Caption` objects (`toRemotionCaptions`) and grouped by `createTikTokStyleCaptions`; used by "Regroup by time".

## Motion properties (every template, in the Animation panel)

| Property | Field | Effect |
|---|---|---|
| Enter duration | `animationDurationMs` | length of entrances and the spring stretch |
| Exit duration | `exitMs` | length of the exit tail (default min(200 ms, 25 % of caption)) |
| Spring stiffness / damping | `springStiffness`, `springDamping` | override **every** spring of the preset (unset = designed values) |
| Overall intensity | `intensity` | distances, blur radius, glow strength |
| Scale intensity | `scaleIntensity` | only scale-based motion (pop, squash, slam, push-in) |
| Animation offset | `offsetMs` | shifts the animation clock against the spoken timestamps (negative = leads the speech) |
| Highlight duration | `highlightMs` | ramp time of the active-word highlight (glow, scale tick, emphasis spring) |
| Transition easing | `easing` | cubic / expo / sine / back / linear for the preset's ease-out moves |
| Text case | `textTransform` | none / upper / lower / capitalise (never applied to Indic scripts) |

Plus font family/weight/size, colours, stroke, shadow, letter-spacing, line-height, alignment, max words per line, max lines, words per group, position.

## The core 30

| # | Requested style | Template → engine | What the motion actually is |
|---|---|---|---|
| 1 | Karaoke word highlighting | `karaoke` | gradient fill whose edge travels through each word at its spoken progress (`wordP`); finished words stay filled |
| 2 | Animated color switching | `color-switch` | each word flashes white then settles in a hue-rotated palette colour; scale tick on the current word |
| 3 | Spring word pop | `word-pop` | word absent until spoken, then spring from 35 % scale with overshoot |
| 4 | Elastic bounce | `elastic-bounce` | words drop from above on a low-damping spring with squash on landing, staggered by index |
| 5 | Smooth scaling | `smooth-scale` | whole block eases from 86 % scale; active word swells with the highlight ramp |
| 6 | Blur reveal | `blur-reveal` | per word: blur 22 px → 0, opacity and scale 125 % → 100 % |
| 7 | Cinematic fade | `cinematic-serif` | slow per-word fade/de-blur, 4.5 % push-in over the caption's life, gold hairlines drawing in |
| 8 | Word slide | `slide-up` | each word rises out of an overflow mask line |
| 9 | Gradient sweep | `gradient-highlight` | moving liquid-metal gradient clipped to the active word |
| 10 | Neon active-word glow | `neon-pulse` | multi-layer glow that breathes (sine of frame), flicker on power-on, active word hot-white |
| 11 | Moving background boxes | `sliding-box` | **one** box springs between measured word rectangles, resizing to each word |
| 12 | Animated underline | `animated-underline` | underline bar scales 0→1 over the word's spoken span |
| 13 | Text squash and stretch | `squash-stretch` | volume-preserving: stretch while falling, squash on impact, settle on a spring |
| 14 | Typewriter | `typewriter` | per-glyph reveal paced to the word's duration, blinking caret (frame-based) |
| 15 | Letter-by-letter reveal | `char-stagger` | every grapheme springs in with its own offset, rotation and scale |
| 16 | Rotating words | `word-rotation` | 3D flip from −95° about the baseline with depth |
| 17 | Bouncy multiline captions | `bouncy-lines` | each **line** bounces in as a unit; a decaying sine wave runs along the letters |
| 18 | Editorial serif titles | `editorial-serif` (`minimal-editorial`) | left-aligned serif wipes in beside a growing vertical rule |
| 19 | Minimal white typography | `minimal-white` (`fade-in`) | calm cross-fade, spoken word at full opacity, no colour or stroke |
| 20 | Yellow active-word emphasis | `yellow-emphasis` | three reading states: upcoming dim, current yellow with snap + glow, past white |
| 21 | Shadow pop | `soft-shadow-pop` | ease-up with a shadow whose offset/blur deepen with the pop |
| 22 | Kinetic headline | `kinetic-multi-line` | words sized by weight, staggered lines alternating left/right, sliding from alternating sides |
| 23 | Glitch accent | `glitch-accent` | RGB split, skew and clipped slices (deterministic hash noise) for 260 ms after each word starts |
| 24 | Retro subtitles | `retro-subtitle` | pixel type on a console strip, stepped blink-in, moving CRT scanlines |
| 25 | Animated pill highlighting | `background-pill` | a pill pops behind each spoken word with a drop glow |
| 26 | Vertical stacked words | `vertical-stack` | single column; the new word pushes earlier words up, shrinking and fading |
| 27 | Smooth word tracking | `smooth-tracking` | words converge from a wide spread (transform only: no reflow) |
| 28 | Comic caption bounce | `comic-bounce` | per-word random tilt (hash), squash-and-stretch jump, alternating colours |
| 29 | Bold cinematic typography | `bold-cinematic` | heavy capitals focus in word by word, slow push-in, anamorphic light streak across the block |
| 30 | Luxury minimal captions | `luxury-title` | wide-tracked gold capitals, per-letter fade-up (gradient painted per glyph), expanding rules |

`tests/animations.test.ts` asserts: 30 entries, all templates exist, **30 different engines**; engines are deterministic, animate over time, and have pairwise different frame sequences. The rendered validation (below) additionally measures presence, motion, distinctness and sync from the exported MP4.

## Behind-the-speaker, masking, tracking, perspective

See `docs/ADVANCED_EFFECTS.md`.
