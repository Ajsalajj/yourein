# Architecture

```
Browser (Next.js app router, React 19, Zustand)
 ├─ Editor UI ── Remotion <Player> ── Studio composition (src/remotion)  ◄── same code ──┐
 │                                                                                         │
 └─ /api/* (Next route handlers)                                                           │
      ├─ projects CRUD, upload, media (Range), analyze (ffmpeg), export jobs               │
      ├─ ──HTTP──► AI service (FastAPI): jobs, engines (faster-whisper | pocketsphinx)     │
      └─ spawn ──► scripts/render-worker.ts ─ Remotion bundler + renderer + Chromium ──────┘
 data/projects/<id>/{project.json, assets/, exports/<job>/{input.json,job.json,output.mp4}}
```

## Decisions

* **Simplest reliable first.** Persistence is one atomic-written JSON file per project (schema versioned, validated by zod); jobs are in-process with state on disk. The storage module (`src/server/storage.ts`) is the only place that touches the filesystem, so a Prisma/PostgreSQL implementation can replace it without touching callers. Redis/workers are not needed until there are multiple users.
* **Source time is the authoring clock.** Captions, zooms and cuts are stored in milliseconds of the *original* video. The edit-decision list (`cuts`) is the only thing that maps source → output (`src/lib/timeline.ts`). Hence: deleting caption text never deletes footage, and removing footage never rewrites text. Mapping is frame-aligned (cumulative rounding) so audio and video cannot drift; this is unit-tested over 200 random cuts.
* **One composition for preview and export.** `src/remotion/Studio.tsx` takes `{project, mediaUrls}`. Preview = `@remotion/player`, export = `renderMedia` with identical props. Metadata (size, fps, duration) comes from `getCompositionMeta` in both. The worker refuses to render if the composition metadata differs from what the server expects.
* **Deterministic animation.** Behaviours (`src/remotion/animations/behaviors.ts`) are pure functions of `{frame, fps, word timing, style}` using Remotion `spring`/interpolation; a test fails the build if the engine uses `Math.random`, `Date.now`, timers or rAF. Layout is computed once per caption group (balanced line breaking + `measureText` fit-to-width) with all words always laid out, so nothing reflows as words appear.
* **Template registry.** `animations/behaviors.ts` (30 engines) ← referenced by ← `templates/registry.ts` (42 templates = engine + full style). Adding a template = one `T(...)` line.
* **Complex scripts.** Per-glyph animations split by *grapheme cluster* (`Intl.Segmenter`), never code point. Letter-spacing and uppercase are skipped for Indic text. Every font stack ends in Noto Sans Malayalam/Devanagari/Tamil. Gradient-fill styles use a stroke/shadow layer underneath because `background-clip:text` is transparent.
* **Separate render process.** Keeps Chromium/webpack out of the Next server and makes cancel = kill the process group.
* **Transcription** is behind `/v1/jobs/transcribe` with engine selection, progress, and an honest `warnings[]` list. The raw ASR result (`project.transcript`) is immutable; editable `captions` are separate. Each word records `timingSource` (`asr | interpolated | manual | import`) and `confidence`. WhisperX forced alignment was investigated but **not enabled**: it needs PyTorch and per-language alignment models that are not guaranteed for Malayalam/Tamil; the documented fallback is Whisper's native word timestamps → even spreading flagged `interpolated` → manual timing editor.

## Data model (project.json, schemaVersion 1)

`assets{}` (media registry, relative storage keys only) · `transcript` (raw ASR) · `captions[]` `{id,text,startMs,endMs,confidence,speakerId,styleId,animationId,position,words[]}` · `captionStyle{templateId,overrides,position}` · `cuts[]` · `zooms[]` · `textLayers[]` · `audio{originalVolume,fades,music{…}}` · `aspect`, `fps`.
`styleId` = per-caption template override, `animationId` = per-caption animation override.

## Licences / compatibility checked

Remotion 4.0.537 (all `@remotion/*` pinned to the same version), Next 16.4, React 19, Node 22. See README for licence terms.
