"use client";
import { api } from "@/lib/client";
import type { Project } from "@/lib/project";
import { useEditor } from "./editor";

let chain: Promise<void> = Promise.resolve();

/** Serialised full-document save. Safe to call repeatedly; later calls queue behind earlier ones. */
export function saveNow(): Promise<void> {
  chain = chain.then(async () => {
    const { project, rev, busy, setSaveState, markSaved } = useEditor.getState();
    if (!project || busy) return;
    setSaveState("saving");
    try {
      const r = await api<{ project: Project }>(`/api/projects/${project.id}`, { method: "PUT", body: JSON.stringify(project) });
      markSaved(r.project.updatedAt, rev);
    } catch (e) {
      setSaveState("error", (e as Error).message);
    }
  });
  return chain;
}
