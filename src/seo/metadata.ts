import type { Metadata } from "next";
import { SITE_NAME, TAGLINE } from "@/config/site";
import { getTemplate } from "@/data/templates";
import { PROFILES } from "./template-profiles";
import { absoluteUrl, canonicalUrl } from "./url";

export const BRAND = SITE_NAME;
export const DEFAULT_OG = { url: "/og.jpg", width: 1200, height: 630, alt: "Three YoureIn animated invitations shown on phones" };

/** Titles are written whole, brand included, so none of them is cut off or doubled by a template. */
export const withBrand = (title: string) => `${title} | ${BRAND}`;

export function templateTitle(slug: string): string {
  const t = getTemplate(slug);
  const p = PROFILES[slug];
  if (!t || !p) return "";
  return withBrand(`${t.name} ${p.occasion} Invitation Template`);
}

/** Built from the design's own text, so no two designs share a description. */
export function templateDescription(slug: string): string {
  const t = getTemplate(slug);
  const p = PROFILES[slug];
  if (!t || !p) return "";
  return `${t.name}: an animated ${p.occasion.toLowerCase()} invitation. ${p.bestFor} RSVP and music included.`;
}

export function templateImage(slug: string) {
  const t = getTemplate(slug);
  const p = PROFILES[slug];
  return { src: `/thumbs/${slug}.webp`, width: 780, height: 1688, alt: p?.alt ?? `${t?.name ?? slug} animated digital invitation template` };
}

export type MetaInput = {
  /** Full <title>. */
  title: string;
  description: string;
  /** Path of this page. Any query string or hash is dropped for the canonical URL. */
  path: string;
  image?: { url: string; width?: number; height?: number; alt?: string };
  type?: "website" | "article";
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
};

/**
 * One place that builds the title, description, canonical URL, robots, Open Graph and Twitter tags.
 * Every page calls this, so the canonical rules and robots directives cannot drift apart.
 */
export function buildMetadata(m: MetaInput): Metadata {
  const url = canonicalUrl(m.path);
  const img = m.image ?? DEFAULT_OG;
  const images = [{ url: absoluteUrl(img.url), width: img.width, height: img.height, alt: img.alt }];
  return {
    title: { absolute: m.title },
    description: m.description,
    alternates: { canonical: url },
    robots: m.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    openGraph: {
      type: m.type ?? "website",
      siteName: BRAND,
      locale: "en_IN",
      title: m.title.replace(` | ${BRAND}`, ""),
      description: m.description,
      url,
      images,
      ...(m.type === "article" ? { publishedTime: m.publishedTime, modifiedTime: m.modifiedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: m.title.replace(` | ${BRAND}`, ""), description: m.description, images: images.map((i) => i.url) },
  };
}

/** Pages that exist for users but should never be in search results: filters, funnels, utility pages. */
export function noindexMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: true } };
}

export const HOME_TITLE = `${BRAND} | Premium Animated Digital Invitations`;
export const HOME_TAGLINE = TAGLINE;
