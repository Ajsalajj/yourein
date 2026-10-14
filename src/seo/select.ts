import { TEMPLATES, templatesIn, type Template } from "@/data/templates";
import { GUIDES, guideToPage } from "./guides";
import { SEO_PAGES } from "./pages";
import { PROFILES } from "./template-profiles";
import type { SeoPage, StyleId, TemplateSelector } from "./types";
import { canonicalPath } from "./url";

/** Every approved page, guide articles included. */
export const ALL_PAGES: SeoPage[] = [...SEO_PAGES, ...GUIDES.map(guideToPage)];

export function getPageByPath(path: string): SeoPage | undefined {
  const p = canonicalPath(path);
  return ALL_PAGES.find((x) => x.path === p);
}

export function getPageById(id: string): SeoPage {
  const page = ALL_PAGES.find((x) => x.id === id);
  if (!page) throw new Error(`Unknown SEO page: ${id}`);
  return page;
}

export function templatesWithStyle(style: StyleId): Template[] {
  return TEMPLATES.filter((t) => PROFILES[t.slug]?.styles.includes(style));
}

/** Featured designs first, otherwise the order of the catalog. */
const featuredFirst = (list: Template[]) => [...list.filter((t) => t.featured), ...list.filter((t) => !t.featured)];

export function resolveTemplates(sel: TemplateSelector): Template[] {
  switch (sel.by) {
    case "category":
      return featuredFirst(templatesIn(sel.category));
    case "style":
      return featuredFirst(templatesWithStyle(sel.style));
    case "slugs":
      return sel.slugs.map((s) => TEMPLATES.find((t) => t.slug === s)).filter((t): t is Template => !!t);
    default:
      return [];
  }
}

export const pageTemplates = (page: SeoPage) => resolveTemplates(page.templates);

/** The collection pages a design belongs to, used for related links and breadcrumbs. */
export function stylePagesFor(slug: string): SeoPage[] {
  const styles = PROFILES[slug]?.styles ?? [];
  return styles.map((s) => ALL_PAGES.find((p) => p.type === "style" && p.style === s)).filter((p): p is SeoPage => !!p);
}

export function occasionPageFor(slug: string): SeoPage | undefined {
  const occ = PROFILES[slug]?.occasion;
  return ALL_PAGES.find((p) => p.type === "occasion" && p.occasion === occ?.toLowerCase());
}

/** Related designs: same collection first (style, then occasion), then anything else, never the design itself. */
export function relatedTemplates(slug: string, count = 3): Template[] {
  const profile = PROFILES[slug];
  const score = (t: Template) => {
    const p = PROFILES[t.slug];
    if (!p || !profile) return 0;
    return p.styles.filter((s) => profile.styles.includes(s)).length * 2 + (p.occasion === profile.occasion ? 1 : 0);
  };
  return TEMPLATES.filter((t) => t.slug !== slug)
    .map((t, i) => ({ t, s: score(t), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, count)
    .map((x) => x.t);
}
