# Reference analysis (Task 1): Moonshot - what could and could not be verified

**Status: the reference site could not be inspected from this environment. No Moonshot facts are recorded here.**

## What was attempted

| Target | Result |
|---|---|
| `https://makemoonshot.co/caption-templates` | `WebFetch`: DNS resolution failed (`ENOTFOUND`). `curl` through the session's egress proxy: `connect_rejected` - the host is not on the session's network allow-list. |
| `https://makemoonshot.co/animated-captions` | same |
| `https://makemoonshot.co/licenses` | same |
| Web search for the site and its template names | no result from `makemoonshot.co`; the engine returned only other products (Kapwing, Captions.ai, CapCut, Bytecap, FlexClip, AutoCaption), which are *not* Moonshot and were not used as a source of Moonshot facts. |

Because nothing could be read, the following were **not** determined and are deliberately **not** guessed: Moonshot's template names/categories, documented font families and weights, font sizes and positions, stroke/shadow values, colour systems, caption grouping, word-level animations, entry/exit transitions, spring parameters, timing/easing, highlight animations, or how its "behind-the-person" effect works. Its licences page is likewise unread, so no statement is made about its licence terms.

Nothing was extracted from Moonshot's code, templates or artwork. Everything in this repository is original work.

## Documented facts (from the reference): none

| Item | Value | Source |
|---|---|---|
| *(empty - nothing retrievable)* | | |

## Where the implementation's requirements came from instead

1. **The brief itself**: the list of 30 named motion styles, the required animation properties and the effect types. These are *requirements supplied by the user*, not verified Moonshot facts.
2. **Engineering judgement (estimates, not facts about Moonshot)**: sizes, spring values and timings in `src/remotion/templates/registry.ts` and `animations/behaviors.ts` are my own design choices, tuned by looking at rendered frames. They are described in code and are tunable per template (enter/exit duration, spring stiffness/damping, scale intensity, offset, highlight duration, easing). The general conventions followed - large heavy sans for vertical video, word-level emphasis of the spoken word, bottom-third placement away from platform UI, stroke + shadow for legibility on arbitrary footage - are common short-form practice and are labelled as such, not attributed to Moonshot.

## How to complete this task properly

Any one of these unblocks a real analysis:
* paste the text of the three pages (or screenshots of the template previews) into the conversation;
* add `makemoonshot.co` to the session's network allow-list (see the environment settings) and ask again;
* export a few Moonshot template previews you are licensed to use and share their frame sequences for *measurement only*.

Measurements would then be recorded in a table split into **Documented** (stated on the page) and **Estimated** (measured from previews, with the measuring method), and used to tune the existing presets - never to copy artwork or code.

## Core 30: what each preset does in this engine

The table that maps the requested 30 names to implemented motion is generated from `src/remotion/templates/core30.ts`; `tests/animations.test.ts` asserts that all 30 use **different** animation engines, and `docs/CAPTION_ENGINE.md` documents each engine's behaviour and the validation render.
