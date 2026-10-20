"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteNav } from "@/components/Logo";
import { TemplateGallery } from "@/components/TemplateGallery";
import { api } from "@/lib/client";
import type { Project } from "@/lib/project";
import { TEMPLATES } from "@/remotion/templates/registry";

export default function TemplatesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    api<{ projects: { id: string; name: string }[] }>("/api/projects").then((r) => { setProjects(r.projects); setTarget(r.projects[0]?.id ?? ""); }).catch(() => {});
  }, []);
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Caption templates</h1>
        <p className="mb-6 mt-1 text-[13px] text-mute">{TEMPLATES.length} templates on 30 animation engines. Previews are live Remotion renders.</p>
        <div className="panel mb-6 flex flex-wrap items-center gap-3 rounded-xl p-3 text-[13px]">
          <label htmlFor="target" className="text-mute">Apply a template to</label>
          <select id="target" className="field !w-64" value={target} onChange={(e) => setTarget(e.target.value)} disabled={!projects.length}>
            {projects.length === 0 ? <option>No projects yet</option> : projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="text-mute" aria-live="polite">{msg ?? (projects.length ? "then click a template." : "Upload a video first, or just browse.")}</span>
        </div>
        <TemplateGallery
          actionLabel={target ? "Use in project →" : undefined}
          onPick={async (t) => {
            if (!target) return;
            const { project } = await api<{ project: Project }>(`/api/projects/${target}`);
            await api(`/api/projects/${target}`, { method: "PUT", body: JSON.stringify({ ...project, captionStyle: { templateId: t.id, overrides: {}, position: t.position }, captions: project.captions.map((c) => ({ ...c, styleId: null, animationId: null })) }) });
            setMsg(`Applied “${t.name}”.`);
            router.push(`/editor/${target}`);
          }}
        />
      </main>
    </>
  );
}
