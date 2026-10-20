"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { Studio } from "@/remotion/Studio";
import { newProject, type Project, type StyleProps } from "@/lib/project";
import { distributeWords } from "@/lib/captions/ops";
import { groupWords } from "@/lib/captions/grouping";
import type { CaptionTemplate } from "@/remotion/templates/registry";

const SAMPLE_EN = "Every word lands right on the beat";
const SAMPLE_ML = "ഇത് ഒരു നല്ല വീഡിയോ ആണ്";

export function previewProject(t: CaptionTemplate, text?: string, overrides: Partial<StyleProps> = {}): { project: Project; frames: number } {
  const sample = text ?? (t.category === "Malayalam Reels" ? SAMPLE_ML : SAMPLE_EN);
  const toks = sample.split(/\s+/);
  const per = t.id === "impact-caption" ? 520 : 400;
  const words = distributeWords(toks, 250, 250 + toks.length * per, 0.95);
  const p = newProject({ id: `preview${t.id.replace(/\W/g, "")}`.slice(0, 40).padEnd(8, "0"), name: t.name, aspect: "9:16" });
  p.captionStyle = { templateId: t.id, overrides: { ...overrides, maxWordsPerLine: Math.min(t.style.maxWordsPerLine, 3), wordsPerGroup: 8 }, position: { x: 0.5, y: 0.5 } };
  p.captions = groupWords(words, { wordsPerGroup: 8, gapMs: 5000, maxDurationMs: 20000 });
  const end = words[words.length - 1].endMs + 700;
  p.captions[0].endMs = end;
  return { project: p, frames: Math.ceil((end * 30) / 1000) + 12 };
}

/** Live Remotion preview of a template. Mounted only while on screen to keep galleries cheap. */
export function TemplatePreview({ template, text, overrides, className = "" }: { template: CaptionTemplate; text?: string; overrides?: Partial<StyleProps>; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  const key = JSON.stringify(overrides ?? {});
  const { project, frames } = useMemo(() => previewProject(template, text, overrides), [template, text, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const inputProps = useMemo(() => ({ project, mediaUrls: {} }), [project]);
  return (
    <div ref={ref} className={`relative aspect-[9/16] overflow-hidden bg-gradient-to-br from-[#2a2f55] via-[#3b2a55] to-[#10131c] ${className}`}>
      {visible ? (
        <Player component={Studio} inputProps={inputProps} durationInFrames={frames} compositionWidth={540} compositionHeight={960} fps={30} loop autoPlay controls={false} clickToPlay={false} style={{ width: "100%", height: "100%" }} acknowledgeRemotionLicense />
      ) : null}
    </div>
  );
}
