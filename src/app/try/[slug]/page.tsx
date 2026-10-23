import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTemplate } from "@/data/templates";
import { TryClient } from "./TryClient";

type Props = { params: Promise<{ slug: string }> };

/** Kept out of search results: it repeats the design page, which is the one search engines should list. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTemplate((await params).slug);
  if (!t) return { robots: { index: false } };
  return {
    title: `Try ${t.name}: tap to open the invitation`,
    description: `Open the ${t.name} invitation on your phone, see how it opens and scrolls, then make it yours. Pay only when you publish.`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/templates/${t.slug}` },
  };
}

/**
 * The page ads link to: the real invitation fills the screen straight away so people can try it in their hand,
 * with one button to make their own. /try/<design>, or /try for the default design.
 */
export default async function TryPage({ params }: Props) {
  const t = getTemplate((await params).slug);
  if (!t) notFound();
  return <TryClient slug={t.slug} />;
}
