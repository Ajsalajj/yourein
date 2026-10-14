import { existsSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES, type Template } from "@/data/templates";
import { PROFILES } from "./template-profiles";
import { templateTitle } from "./metadata";
import type { SeoPage } from "./types";
import { pageTemplates } from "./select";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Words of copy a page must have of its own before it is allowed in the index. */
export const MIN_PAGE_WORDS = 90;
export const MIN_TEMPLATE_COPY_WORDS = 45;

type TemplateLike = Pick<Template, "slug" | "blurb"> & { status?: "published" | "draft" };

/** Does the preview picture exist on disk? Injected in tests. */
export type FileCheck = (publicPath: string) => boolean;
export const fileExistsInPublic: FileCheck = (p) => existsSync(join(process.cwd(), "public", p.replace(/^\//, "")));

export type Verdict = { indexable: boolean; reasons: string[] };

/**
 * A template page is indexed only when it is published, has a stable URL and a preview picture,
 * has real copy of its own, and is not a duplicate of another design's copy.
 * Anything else gets "noindex, follow" and stays out of the sitemap.
 */
export function templateVerdict(t: TemplateLike, fileCheck: FileCheck = fileExistsInPublic, all: TemplateLike[] = TEMPLATES): Verdict {
  const reasons: string[] = [];
  if ((t.status ?? "published") !== "published") reasons.push("not published");
  if (!t.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug)) reasons.push("no stable slug");
  const profile = PROFILES[t.slug];
  if (!profile) reasons.push("no SEO profile");
  if (!templateTitle(t.slug)) reasons.push("no SEO title");
  if (!fileCheck(`/thumbs/${t.slug}.webp`)) reasons.push("no preview image");
  if (profile) {
    if (words(profile.summary) + words(profile.bestFor) + profile.characteristics.join(" ").split(/\s+/).length < MIN_TEMPLATE_COPY_WORDS) reasons.push("not enough unique copy");
    if (profile.characteristics.length < 3) reasons.push("fewer than three characteristics");
    const dup = all.some((o) => o.slug !== t.slug && PROFILES[o.slug]?.summary === profile.summary);
    if (dup) reasons.push("duplicate copy");
  }
  if (all.some((o) => o.slug !== t.slug && o.blurb === t.blurb)) reasons.push("duplicate description");
  return { indexable: reasons.length === 0, reasons };
}

export const isTemplateIndexable = (t: TemplateLike, fileCheck?: FileCheck, all?: TemplateLike[]) => templateVerdict(t, fileCheck, all).indexable;

const pageCopyWords = (page: SeoPage) =>
  words(page.intro) + page.sections.reduce((n, s) => n + words(s.heading) + s.body.reduce((m, b) => m + words(b), 0) + (s.bullets ?? []).reduce((m, b) => m + words(b), 0), 0) + (page.benefits ?? []).reduce((n, b) => n + words(b.text), 0);

/**
 * A landing page is indexed only when it shows enough real designs, has enough copy of its own,
 * and has not been switched off. Pages that fail are not rendered as noindex by accident:
 * they return noindex, follow and stay out of the sitemap.
 */
export function pageVerdict(page: SeoPage, templateCount: number = pageTemplates(page).length): Verdict {
  const reasons: string[] = [];
  if (page.noindex) reasons.push("marked noindex");
  if (templateCount < page.minTemplates) reasons.push(`only ${templateCount} matching designs, needs ${page.minTemplates}`);
  /* Hubs, the home page (the catalog itself) and the trust pages are judged on their purpose, not on word count. */
  const exempt = page.type === "feature-index" || page.type === "guide-index" || page.type === "home" || page.type === "trust";
  const minWords = exempt ? 0 : MIN_PAGE_WORDS;
  if (pageCopyWords(page) < minWords) reasons.push("not enough copy of its own");
  if (!page.title || !page.description || !page.h1) reasons.push("missing title, description or H1");
  return { indexable: reasons.length === 0, reasons };
}

export const isPageIndexable = (page: SeoPage, templateCount?: number) => pageVerdict(page, templateCount).indexable;
