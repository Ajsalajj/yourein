import { notFound } from "next/navigation";
import { ogCard } from "@/seo/og-card";
import { ALL_PAGES, getPageById, pageTemplates } from "@/seo/select";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_PAGES.map((p) => ({ id: p.id }));
}

const KICKER: Record<string, string> = { occasion: "Invitations", style: "Wedding invitation style", feature: "Feature", location: "Invitations in India", guide: "Guide", "guide-index": "Guides", "feature-index": "Features", trust: "YoureIn", home: "Animated digital invitations" };

/** Branded social card for a collection, feature, location or guide page. Uses the first matching design's artwork when there is one. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ALL_PAGES.some((p) => p.id === id)) notFound();
  const page = getPageById(id);
  const first = pageTemplates(page)[0];
  return ogCard({ kicker: KICKER[page.type] ?? "YoureIn", title: page.h1, art: first ? `/renders/${first.slug}.webp` : undefined, artBg: first?.theme.plinth });
}
