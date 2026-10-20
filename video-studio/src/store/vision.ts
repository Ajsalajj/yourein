"use client";
import { create } from "zustand";
import { api } from "@/lib/client";
import type { Project } from "@/lib/project";
import { useEditor } from "./editor";

type Phase = "idle" | "running" | "done" | "error";
export interface Roi { x: number; y: number; w: number; h: number }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface State {
  seg: { phase: Phase; progress: number; stage: string; error: string | null };
  faces: { phase: Phase; progress: number; stage: string; error: string | null };
  track: { phase: Phase; progress: number; stage: string; error: string | null; lastTrackId: string | null };
  /** region picking on the preview */
  picking: boolean;
  roi: Roi | null;
  setPicking: (b: boolean) => void;
  setRoi: (r: Roi | null) => void;
  segment: (projectId: string) => Promise<void>;
  analyseFaces: (projectId: string) => Promise<void>;
  removeFaces: (projectId: string) => Promise<void>;
  removeSegmentation: (projectId: string) => Promise<void>;
  trackRegion: (projectId: string, roi: Roi, startMs: number, label: string) => Promise<string | null>;
  removeTrack: (projectId: string, trackId: string) => Promise<void>;
}

/** The analysis block is server-owned; refresh it without creating history or marking the project dirty. */
async function refreshAnalysis(projectId: string) {
  const { project } = await api<{ project: Project }>(`/api/projects/${projectId}`);
  const st = useEditor.getState();
  if (!st.project) return;
  useEditor.setState({ project: { ...st.project, analysis: project.analysis, captionsBehindSubject: st.project.captionsBehindSubject && !!project.analysis.segmentation, textLayers: st.project.textLayers.map((t) => ({ ...t, behind: t.behind && !!project.analysis.segmentation, trackId: t.trackId && project.analysis.tracks[t.trackId] ? t.trackId : null })) } });
}

export const useVision = create<State>((set) => ({
  seg: { phase: "idle", progress: 0, stage: "", error: null },
  faces: { phase: "idle", progress: 0, stage: "", error: null },
  track: { phase: "idle", progress: 0, stage: "", error: null, lastTrackId: null },
  picking: false,
  roi: null,
  setPicking: (picking) => set({ picking }),
  setRoi: (roi) => set({ roi }),

  segment: async (projectId) => {
    set({ seg: { phase: "running", progress: 0, stage: "starting", error: null } });
    try {
      const { jobId, maskId } = await api<{ jobId: string; maskId: string }>(`/api/projects/${projectId}/segment`, { method: "POST" });
      for (;;) {
        const s = await api<{ status: string; progress: number; stage: string; error: string | null }>(`/api/projects/${projectId}/segment?jobId=${jobId}&maskId=${maskId}`);
        if (s.status === "failed") throw new Error(s.error ?? "Segmentation failed");
        set({ seg: { phase: "running", progress: s.progress, stage: s.stage, error: null } });
        if (s.status === "done") break;
        await sleep(700);
      }
      await refreshAnalysis(projectId);
      set({ seg: { phase: "done", progress: 1, stage: "done", error: null } });
    } catch (e) {
      set({ seg: { phase: "error", progress: 0, stage: "", error: (e as Error).message } });
    }
  },
  analyseFaces: async (projectId) => {
    set({ faces: { phase: "running", progress: 0, stage: "starting", error: null } });
    try {
      const { jobId, facesId } = await api<{ jobId: string; facesId: string }>(`/api/projects/${projectId}/faces`, { method: "POST" });
      for (;;) {
        const s = await api<{ status: string; progress: number; stage: string; error: string | null }>(`/api/projects/${projectId}/faces?jobId=${jobId}&facesId=${facesId}`);
        if (s.status === "failed") throw new Error(s.error ?? "Face detection failed");
        set({ faces: { phase: "running", progress: s.progress, stage: s.stage, error: null } });
        if (s.status === "done") break;
        await sleep(700);
      }
      await refreshAnalysis(projectId);
      set({ faces: { phase: "done", progress: 1, stage: "done", error: null } });
    } catch (e) {
      set({ faces: { phase: "error", progress: 0, stage: "", error: (e as Error).message } });
    }
  },
  removeFaces: async (projectId) => {
    await api(`/api/projects/${projectId}/faces`, { method: "DELETE" });
    await refreshAnalysis(projectId);
    useEditor.getState().setReframe({ mode: "off" });
    set({ faces: { phase: "idle", progress: 0, stage: "", error: null } });
  },
  removeSegmentation: async (projectId) => {
    await api(`/api/projects/${projectId}/segment`, { method: "DELETE" });
    await refreshAnalysis(projectId);
    set({ seg: { phase: "idle", progress: 0, stage: "", error: null } });
  },

  trackRegion: async (projectId, roi, startMs, label) => {
    set({ track: { phase: "running", progress: 0, stage: "starting", error: null, lastTrackId: null } });
    try {
      const { jobId, trackId } = await api<{ jobId: string; trackId: string }>(`/api/projects/${projectId}/track`, { method: "POST", body: JSON.stringify({ roi, startMs, label }) });
      for (;;) {
        const s = await api<{ status: string; progress: number; stage: string; error: string | null }>(`/api/projects/${projectId}/track?jobId=${jobId}&trackId=${trackId}&label=${encodeURIComponent(label)}`);
        if (s.status === "failed") throw new Error(s.error ?? "Tracking failed");
        set({ track: { phase: "running", progress: s.progress, stage: s.stage, error: null, lastTrackId: null } });
        if (s.status === "done") break;
        await sleep(600);
      }
      await refreshAnalysis(projectId);
      set({ track: { phase: "done", progress: 1, stage: "done", error: null, lastTrackId: trackId }, roi: null });
      return trackId;
    } catch (e) {
      set({ track: { phase: "error", progress: 0, stage: "", error: (e as Error).message, lastTrackId: null } });
      return null;
    }
  },
  removeTrack: async (projectId, trackId) => {
    await api(`/api/projects/${projectId}/track?trackId=${trackId}`, { method: "DELETE" });
    await refreshAnalysis(projectId);
  },
}));
