import Link from "next/link";
import { ArrowRight, Captions, Scissors, Clapperboard, Languages, ShieldCheck, Cpu } from "lucide-react";
import { SiteNav } from "@/components/Logo";
import { TemplatePreview } from "@/components/TemplatePreview";
import { TEMPLATE_MAP } from "@/remotion/templates/registry";

const featured = ["word-pop", "karaoke", "neon-pulse", "cinematic-serif", "ml-reel-pop", "impact-caption"].map((id) => TEMPLATE_MAP[id]);

const features = [
  { icon: Languages, title: "Transcribe on your machine", body: "Whisper (faster-whisper) with word-level timestamps and automatic language detection - English, Malayalam, Hindi, Tamil and more. No API key, no upload to a third party." },
  { icon: Captions, title: "30 animation engines, 40+ templates", body: "Each preset has its own frame-deterministic motion: springs, masks, 3D flips, glitch, karaoke fill. Preview and export run the same Remotion composition." },
  { icon: Scissors, title: "Edit by transcript - safely", body: "Fixing a typo never deletes footage. Removing a spoken segment from the video is a separate, undoable action stored in an edit-decision list." },
  { icon: Clapperboard, title: "Real MP4 export", body: "H.264 + AAC at 1080×1920, 1920×1080 or 1080×1080. No watermark. The download button only exists once a verified file is on disk." },
  { icon: Cpu, title: "Honest about accuracy", body: "ASR is never perfect. Every word keeps its confidence and where its timing came from, and every word's timing is editable." },
  { icon: ShieldCheck, title: "Local-first", body: "Projects are versioned JSON next to your media. Uploads are validated and media paths are confined to the project folder." },
];

export default function Landing() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pt-24">
          <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-line px-3 py-1 text-[12px] text-mute">Open, local video captioning</p>
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">Captions that move<br /><span className="text-accent">exactly when you speak.</span></h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-mute">Upload a clip, transcribe it locally, pick an animated caption style, fix any word, trim the dead air and export a watermark-free MP4. Everything the preview shows is what the exporter renders.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/upload" className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-[#0b0c10] hover:bg-[#a094ff]">Upload a video <ArrowRight size={16} /></Link>
                <Link href="/templates" className="inline-flex h-11 items-center rounded-lg border border-line bg-panel-2 px-5 text-sm hover:bg-[#20242f]">Browse templates</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3" aria-label="Live caption template previews">
              {featured.map((t, i) => (
                <div key={t.id} className={i % 2 ? "translate-y-6" : ""}>
                  <div className="overflow-hidden rounded-xl border border-line"><TemplatePreview template={t} /></div>
                  <p className="mt-1.5 text-center text-[11px] text-mute">{t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="panel rounded-xl p-5">
                <f.icon size={20} className="mb-3 text-accent" aria-hidden />
                <h2 className="mb-1.5 text-[15px] font-semibold">{f.title}</h2>
                <p className="text-[13px] leading-relaxed text-mute">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
