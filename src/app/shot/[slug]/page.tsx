import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TEMPLATES, getTemplate } from "@/data/templates";
import Shot from "./Shot";

/** Renders one design's first screen at phone size. Used by `npm run thumbs` to make catalog images. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) notFound();
  return <Shot slug={slug} />;
}
