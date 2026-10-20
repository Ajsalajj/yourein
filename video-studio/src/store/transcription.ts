"use client";
import { create } from "zustand";
import { api } from "@/lib/client";
import type { Project } from "@/lib/project";
import { useEditor } from "./editor";

interface TState {
  phase: "idle" | "running" | "done" | "error";
  progress: number;
  stage: string;
  error: string | null;
  start: (projectId: string, opts: { language: string | null; engine: string }) => Promise<void>;
  resume: (projectId: string) => void;
}

const key = (id: string) => `cadence:transcribe:${id}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function poll(projectId: string, jobId: string, set: (p: Partial<TState>) => void) {
  const editor = useEditor.getState();
  editor.setBusy(true);
  set({ phase: "running", error: null });
  try {
    for (;;) {
      const s = await api<{ status: string; progress: number; stage: string; error: string | null }>(`/api/projects/${projectId}/transcribe?jobId=${jobId}`);
      if (s.status === "failed") throw new Error(s.error ?? "Transcription failed");
      set({ progress: s.progress, stage: s.stage });
      if (s.status === "done") break;
      await sleep(800);
    }
    const { project } = await api<{ project: Project }>(`/api/projects/${projectId}`);
    useEditor.getState().load(project);
    try { localStorage.removeItem(key(projectId)); } catch { /* storage unavailable */ }
    set({ phase: "done", progress: 1, stage: "done" });
  } catch (e) {
    try { localStorage.removeItem(key(projectId)); } catch { /* ignore */ }
    set({ phase: "error", error: (e as Error).message });
  } finally {
    useEditor.getState().setBusy(false);
  }
}

export const useTranscription = create<TState>((set) => ({
  phase: "idle",
  progress: 0,
  stage: "",
  error: null,
  start: async (projectId, opts) => {
    set({ phase: "running", progress: 0, stage: "starting", error: null });
    try {
      const { jobId } = await api<{ jobId: string }>(`/api/projects/${projectId}/transcribe`, { method: "POST", body: JSON.stringify({ language: opts.language, engine: opts.engine }) });
      try { localStorage.setItem(key(projectId), jobId); } catch { /* ignore */ }
      await poll(projectId, jobId, set);
    } catch (e) {
      set({ phase: "error", error: (e as Error).message });
    }
  },
  resume: (projectId) => {
    let jobId: string | null = null;
    try { jobId = localStorage.getItem(key(projectId)); } catch { /* ignore */ }
    if (jobId) void poll(projectId, jobId, set);
  },
}));
