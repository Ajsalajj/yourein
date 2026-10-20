"use client";
import { create } from "zustand";
import type { Caption, Cut, Position, Project, StyleProps, TextLayer, Zoom } from "@/lib/project";
import { uid } from "@/lib/project";
import * as ops from "@/lib/captions/ops";
import { regroupCaptions } from "@/lib/captions/grouping";
import { getTemplate } from "@/remotion/templates/registry";
import { normalizeCuts } from "@/lib/timeline";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
const MAX_HISTORY = 100;

interface Selection {
  captionId: string | null;
  zoomId: string | null;
  cutId: string | null;
  textId: string | null;
}

interface EditorState {
  project: Project | null;
  past: Project[];
  future: Project[];
  saveState: SaveState;
  saveError: string | null;
  selection: Selection;
  /** frame of the Remotion Player (output timeline) */
  frame: number;
  lastCoalesce: { key: string; at: number } | null;
  /** true while the server is writing a transcript, so autosave does not overwrite it */
  busy: boolean;
  /** increments on every edit; autosave compares it to know whether newer edits arrived mid-save */
  rev: number;

  load: (p: Project) => void;
  /** Replace the project WITHOUT creating history (server-side changes such as transcription). */
  replaceFromServer: (p: Project) => void;
  commit: (fn: (p: Project) => Project, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  setFrame: (f: number) => void;
  select: (s: Partial<Selection>) => void;
  markSaved: (updatedAt: string, revAtSend: number) => void;
  setSaveState: (s: SaveState, err?: string | null) => void;
  setBusy: (b: boolean) => void;

  // domain actions (all undoable)
  rename: (name: string) => void;
  setAspect: (a: Project["aspect"]) => void;
  setStyle: (patch: Partial<StyleProps>) => void;
  setPosition: (pos: Position) => void;
  applyTemplate: (templateId: string, keepOverrides?: boolean) => void;
  setCaptions: (fn: (c: Caption[]) => Caption[], key?: string) => void;
  regroup: () => void;
  patchCaption: (id: string, patch: Partial<Caption>) => void;
  addCut: (startMs: number, endMs: number, reason?: Cut["reason"]) => void;
  addCuts: (cuts: { startMs: number; endMs: number }[], reason: Cut["reason"]) => void;
  removeCut: (id: string) => void;
  clearCuts: (reason?: Cut["reason"]) => void;
  setZooms: (fn: (z: Zoom[]) => Zoom[], key?: string) => void;
  setAudio: (patch: Partial<Project["audio"]>) => void;
  setTextLayers: (fn: (t: TextLayer[]) => TextLayer[], key?: string) => void;
  setFps: (fps: number) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  saveState: "idle",
  saveError: null,
  selection: { captionId: null, zoomId: null, cutId: null, textId: null },
  frame: 0,
  lastCoalesce: null,
  busy: false,
  rev: 0,

  load: (p) => set({ rev: 0, project: p, past: [], future: [], saveState: "idle", saveError: null, selection: { captionId: null, zoomId: null, cutId: null, textId: null }, lastCoalesce: null }),
  replaceFromServer: (p) => set({ project: p, saveState: "saved", saveError: null }),
  commit: (fn, key) => {
    const { project, past, lastCoalesce } = get();
    if (!project) return;
    const next = fn(project);
    if (next === project) return;
    const now = Date.now();
    const coalesce = !!key && lastCoalesce?.key === key && now - lastCoalesce.at < 800;
    set({
      project: next,
      past: coalesce ? past : [...past.slice(-(MAX_HISTORY - 1)), project],
      future: [],
      saveState: "dirty",
      rev: get().rev + 1,
      lastCoalesce: key ? { key, at: now } : null,
    });
  },
  undo: () => {
    const { past, project, future } = get();
    if (!past.length || !project) return;
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], saveState: "dirty", rev: get().rev + 1, lastCoalesce: null });
  },
  redo: () => {
    const { future, project, past } = get();
    if (!future.length || !project) return;
    set({ project: future[0], future: future.slice(1), past: [...past, project], saveState: "dirty", rev: get().rev + 1, lastCoalesce: null });
  },
  setFrame: (f) => set({ frame: f }),
  select: (s) => set({ selection: { ...get().selection, ...s } }),
  markSaved: (updatedAt, revAtSend) => {
    const cur = get().project;
    if (!cur) return;
    set({ project: { ...cur, updatedAt }, saveState: get().rev === revAtSend ? "saved" : "dirty", saveError: null });
  },
  setSaveState: (s, err = null) => set({ saveState: s, saveError: err }),
  setBusy: (b) => set({ busy: b }),

  rename: (name) => get().commit((p) => ({ ...p, name: name.slice(0, 120) || p.name }), "rename"),
  setAspect: (aspect) => get().commit((p) => ({ ...p, aspect })),
  setFps: (fps) => get().commit((p) => ({ ...p, fps })),
  setStyle: (patch) => get().commit((p) => ({ ...p, captionStyle: { ...p.captionStyle, overrides: { ...p.captionStyle.overrides, ...patch } } }), `style:${Object.keys(patch).join(",")}`),
  setPosition: (position) => get().commit((p) => ({ ...p, captionStyle: { ...p.captionStyle, position } }), "position"),
  applyTemplate: (templateId, keepOverrides = false) => {
    const t = getTemplate(templateId);
    get().commit((p) => ({
      ...p,
      captionStyle: { templateId: t.id, overrides: keepOverrides ? p.captionStyle.overrides : {}, position: t.position },
      captions: p.captions.map((c) => (c.styleId || c.animationId ? { ...c, styleId: null, animationId: null } : c)),
    }));
  },
  setCaptions: (fn, key) => get().commit((p) => ({ ...p, captions: fn(p.captions) }), key),
  regroup: () =>
    get().commit((p) => {
      const t = getTemplate(p.captionStyle.templateId);
      const n = { ...t.style, ...p.captionStyle.overrides }.wordsPerGroup;
      return { ...p, captions: regroupCaptions(p.captions, { wordsPerGroup: n }) };
    }),
  patchCaption: (id, patch) => get().commit((p) => ({ ...p, captions: p.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), `cap:${id}:${Object.keys(patch).join(",")}`),
  addCut: (startMs, endMs, reason = "manual") => get().addCuts([{ startMs, endMs }], reason),
  addCuts: (cuts, reason) =>
    get().commit((p) => {
      const dur = p.sourceAssetId ? p.assets[p.sourceAssetId]?.durationMs ?? 0 : 0;
      const merged = normalizeCuts([...p.cuts, ...cuts], dur);
      // keep the reason of the first cut that overlaps, default to the new reason
      const withReason: Cut[] = merged.map((m) => ({ id: uid("x_"), startMs: m.startMs, endMs: m.endMs, reason: p.cuts.find((c) => c.startMs < m.endMs && c.endMs > m.startMs)?.reason ?? reason }));
      return { ...p, cuts: withReason };
    }),
  removeCut: (id) => get().commit((p) => ({ ...p, cuts: p.cuts.filter((c) => c.id !== id) })),
  clearCuts: (reason) => get().commit((p) => ({ ...p, cuts: reason ? p.cuts.filter((c) => c.reason !== reason) : [] })),
  setZooms: (fn, key) => get().commit((p) => ({ ...p, zooms: fn(p.zooms) }), key),
  setAudio: (patch) => get().commit((p) => ({ ...p, audio: { ...p.audio, ...patch } }), `audio:${Object.keys(patch).join(",")}`),
  setTextLayers: (fn, key) => get().commit((p) => ({ ...p, textLayers: fn(p.textLayers) }), key),
}));

export { ops };
