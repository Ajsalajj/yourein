import { TEMPLATES } from "@/data/templates";
import { fileExistsInPublic, pageVerdict, templateVerdict, type FileCheck } from "./indexable";
import { templateImage } from "./metadata";
import { ALL_PAGES, pageTemplates } from "./select";
import { absoluteUrl, SEO_ORIGIN, canonicalUrl } from "./url";
import type { SeoPage } from "./types";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/config/site";

export type SitemapEntry = { loc: string; lastmod?: string; images?: { loc: string; title?: string }[] };
export type SitemapName = "pages" | "collections" | "templates" | "blog";
export const SITEMAP_NAMES: SitemapName[] = ["pages", "collections", "templates", "blog"];

const group = (p: SeoPage): SitemapName =>
  p.type === "guide" || p.type === "guide-index" ? "blog" : p.type === "occasion" || p.type === "style" || p.type === "feature" || p.type === "location" ? "collections" : "pages";

/**
 * A page is listed only if it is canonical (its own URL), indexable, and genuinely exists.
 * Pages that fail their quality gate, or are noindex, never appear. There is no priority or changefreq:
 * search engines ignore them, so only accurate URLs and real modification dates are given.
 */
export function pageIsListed(p: SeoPage): boolean {
  if (p.id === "contact" && !SUPPORT_EMAIL && !SUPPORT_WHATSAPP) return false;
  return pageVerdict(p, pageTemplates(p).length).indexable;
}

export function entriesFor(name: SitemapName, fileCheck: FileCheck = fileExistsInPublic): SitemapEntry[] {
  if (name === "templates") {
    return TEMPLATES.filter((t) => templateVerdict(t, fileCheck).indexable).map((t) => ({
      loc: canonicalUrl(`/templates/${t.slug}`),
      images: [{ loc: absoluteUrl(`/renders/${t.slug}.webp`), title: templateImage(t.slug).alt }],
    }));
  }
  return ALL_PAGES.filter((p) => group(p) === name && pageIsListed(p)).map((p) => ({
    loc: canonicalUrl(p.path),
    lastmod: p.updated,
  }));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderUrlset(entries: SitemapEntry[]): string {
  const hasImages = entries.some((e) => e.images?.length);
  const body = entries
    .map((e) => {
      const imgs = (e.images ?? []).map((i) => `<image:image><image:loc>${esc(i.loc)}</image:loc>${i.title ? `<image:title>${esc(i.title)}</image:title>` : ""}</image:image>`).join("");
      return `<url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}${imgs}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ""}>${body}</urlset>\n`;
}

export function renderIndex(names: SitemapName[], origin: string = SEO_ORIGIN): string {
  const body = names.map((n) => `<sitemap><loc>${esc(`${origin}/sitemap-${n}.xml`)}</loc></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>\n`;
}

/** Sitemaps that have at least one URL. Empty ones are left out of the index. */
export const nonEmptySitemaps = (): SitemapName[] => SITEMAP_NAMES.filter((n) => entriesFor(n).length > 0);

export function xmlResponse(xml: string): Response {
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" } });
}
