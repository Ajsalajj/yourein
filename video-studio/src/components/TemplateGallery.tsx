"use client";
import { useEffect, useMemo, useState } from "react";
import { Heart, Search } from "lucide-react";
import type { StyleProps } from "@/lib/project";
import { usePrefs } from "@/store/prefs";
import { CORE_30_TEMPLATES } from "@/remotion/templates/core30";
import { CATEGORIES, searchTemplates, type Category, type CaptionTemplate } from "@/remotion/templates/registry";
import { TemplatePreview } from "./TemplatePreview";
import { cn } from "@/lib/cn";

type View = "all" | "core" | "favorites" | "recent";

export function TemplateGallery({ activeId, onPick, columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5", actionLabel, previewOverrides }: { activeId?: string; onPick: (t: CaptionTemplate) => void; columns?: string; actionLabel?: string; previewOverrides?: Partial<StyleProps> }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const [view, setView] = useState<View>("all");
  const { favorites, recents, hydrate, toggleFavorite, pushRecent } = usePrefs();
  useEffect(() => hydrate(), [hydrate]);
  const list = useMemo(() => {
    const base = searchTemplates(q, cat);
    if (view === "core") return CORE_30_TEMPLATES.filter((t) => base.includes(t));
    if (view === "favorites") return favorites.map((id) => base.find((t) => t.id === id)).filter(Boolean) as CaptionTemplate[];
    if (view === "recent") return recents.map((id) => base.find((t) => t.id === id)).filter(Boolean) as CaptionTemplate[];
    return base;
  }, [q, cat, view, favorites, recents]);
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
        <input className="field !pl-8" placeholder="Search templates (e.g. glow, karaoke, malayalam)…" aria-label="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Template collections">
        {([["all", "All"], ["core", "Core 30"], ["favorites", `Favorites (${favorites.length})`], ["recent", `Recent (${recents.length})`]] as [View, string][]).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("rounded-md border px-3 py-1 text-[12px] font-medium", view === v ? "border-accent-2 bg-accent-2/15 text-accent-2" : "border-line text-mute hover:text-text")}>{label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Template categories">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1 text-[12px] transition-colors", cat === c ? "border-accent bg-accent/15 text-accent" : "border-line text-mute hover:text-text")}>{c}</button>
        ))}
      </div>
      <p className="text-[12px] text-mute" aria-live="polite">{list.length} template{list.length === 1 ? "" : "s"}</p>
      <div className={cn("grid gap-3", columns)}>
        {list.map((t) => (
          <div key={t.id} className="relative">
          <button onClick={() => { pushRecent(t.id); onPick(t); }} aria-pressed={activeId === t.id} className={cn("group overflow-hidden rounded-xl border bg-panel text-left transition-all hover:-translate-y-0.5 hover:border-accent/60", activeId === t.id ? "border-accent ring-2 ring-accent/40" : "border-line")}>
            <TemplatePreview template={t} overrides={previewOverrides} />
            <div className="space-y-0.5 p-2.5">
              <div className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-medium">{t.name}</span><span className="shrink-0 text-[10px] text-mute">{t.category}</span></div>
              <p className="line-clamp-2 text-[11px] leading-snug text-mute">{t.description}</p>
              {actionLabel ? <span className="mt-1 inline-block text-[11px] font-medium text-accent">{actionLabel}</span> : null}
            </div>
          </button>
          <button onClick={() => toggleFavorite(t.id)} aria-pressed={favorites.includes(t.id)} aria-label={`${favorites.includes(t.id) ? "Remove" : "Add"} ${t.name} ${favorites.includes(t.id) ? "from" : "to"} favorites`} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 hover:bg-black/75"><Heart size={14} className={favorites.includes(t.id) ? "fill-danger text-danger" : "text-white"} /></button>
          </div>
        ))}
      </div>
      {list.length === 0 ? <p className="py-10 text-center text-sm text-mute">{view === "favorites" ? "No favorites yet - tap the heart on a template." : view === "recent" ? "Templates you apply show up here." : `No templates match “${q}”.`}</p> : null}
    </div>
  );
}
