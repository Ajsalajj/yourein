"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES, searchTemplates, type Category, type CaptionTemplate } from "@/remotion/templates/registry";
import { TemplatePreview } from "./TemplatePreview";
import { cn } from "@/lib/cn";

export function TemplateGallery({ activeId, onPick, columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5", actionLabel }: { activeId?: string; onPick: (t: CaptionTemplate) => void; columns?: string; actionLabel?: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const list = useMemo(() => searchTemplates(q, cat), [q, cat]);
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
        <input className="field !pl-8" placeholder="Search templates (e.g. glow, karaoke, malayalam)…" aria-label="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Template categories">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1 text-[12px] transition-colors", cat === c ? "border-accent bg-accent/15 text-accent" : "border-line text-mute hover:text-text")}>{c}</button>
        ))}
      </div>
      <p className="text-[12px] text-mute" aria-live="polite">{list.length} template{list.length === 1 ? "" : "s"}</p>
      <div className={cn("grid gap-3", columns)}>
        {list.map((t) => (
          <button key={t.id} onClick={() => onPick(t)} aria-pressed={activeId === t.id} className={cn("group overflow-hidden rounded-xl border bg-panel text-left transition-all hover:-translate-y-0.5 hover:border-accent/60", activeId === t.id ? "border-accent ring-2 ring-accent/40" : "border-line")}>
            <TemplatePreview template={t} />
            <div className="space-y-0.5 p-2.5">
              <div className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-medium">{t.name}</span><span className="shrink-0 text-[10px] text-mute">{t.category}</span></div>
              <p className="line-clamp-2 text-[11px] leading-snug text-mute">{t.description}</p>
              {actionLabel ? <span className="mt-1 inline-block text-[11px] font-medium text-accent">{actionLabel}</span> : null}
            </div>
          </button>
        ))}
      </div>
      {list.length === 0 ? <p className="py-10 text-center text-sm text-mute">No templates match “{q}”.</p> : null}
    </div>
  );
}
