"use client";
import { Bot, Captions, Clapperboard, Film, LayoutGrid, Music, Shuffle, Sparkles, Volume2, Type, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { MediaPanel } from "./panels/MediaPanel";
import { CaptionsPanel } from "./panels/CaptionsPanel";
import { TemplatesPanel } from "./panels/TemplatesPanel";
import { TextPanel } from "./panels/TextPanel";
import { AudioPanel } from "./panels/AudioPanel";
import { BrollPanel } from "./panels/BrollPanel";
import { TransitionsPanel } from "./panels/TransitionsPanel";
import { EffectsPanel } from "./panels/EffectsPanel";
import { AiPanel } from "./panels/AiPanel";
import { SfxPanel } from "./panels/SfxPanel";
import { TypographyPanel } from "./panels/TypographyPanel";
import type { TabId } from "@/store/ui";

const TABS = [
  { id: "media", label: "Media", icon: Film, panel: MediaPanel },
  { id: "captions", label: "Captions", icon: Captions, panel: CaptionsPanel },
  { id: "templates", label: "Templates", icon: LayoutGrid, panel: TemplatesPanel },
  { id: "type", label: "Type FX", icon: Sparkles, panel: TypographyPanel },
  { id: "text", label: "Text", icon: Type, panel: TextPanel },
  { id: "audio", label: "Audio", icon: Music, panel: AudioPanel },
  { id: "sfx", label: "SFX", icon: Volume2, panel: SfxPanel },
  { id: "broll", label: "B-roll", icon: Clapperboard, panel: BrollPanel },
  { id: "effects", label: "Effects", icon: Wand2, panel: EffectsPanel },
  { id: "transitions", label: "Transitions", icon: Shuffle, panel: TransitionsPanel },
  { id: "ai", label: "AI tools", icon: Bot, panel: AiPanel },
] as const;

export type { TabId };

export function LeftPanel({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  const Active = TABS.find((t) => t.id === tab)!.panel;
  return (
    <div className="flex shrink-0 border-r border-line bg-panel">
      <div role="tablist" aria-orientation="vertical" aria-label="Editor tools" className="flex w-[68px] flex-col gap-0.5 border-r border-line py-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} aria-controls="left-panel" onClick={() => onTab(t.id)} className={cn("mx-1.5 flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] transition-colors", tab === t.id ? "bg-accent/15 text-accent" : "text-mute hover:bg-panel-2 hover:text-text")}>
            <t.icon size={18} aria-hidden /> {t.label}
          </button>
        ))}
      </div>
      <div id="left-panel" role="tabpanel" className="w-[318px] overflow-y-auto"><Active /></div>
    </div>
  );
}
