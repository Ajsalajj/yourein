import { notFound } from "next/navigation";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { ogCard } from "@/seo/og-card";
import { PROFILES } from "@/seo/template-profiles";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

/** Social card for one design: its name, the occasion and its own artwork. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) notFound();
  const occasion = PROFILES[slug]?.occasion ?? "Wedding";
  return ogCard({ kicker: `${occasion} invitation`, title: t.name, note: "Animated digital invitation · RSVP included", art: `/renders/${slug}.webp`, artBg: t.theme.plinth });
}
