import type { Metadata } from "next";
import { buildMetadata } from "./metadata";
import { pageVerdict } from "./indexable";
import { pageTemplates } from "./select";
import type { SeoPage } from "./types";

/** Metadata for an approved SEO page. A page that fails its quality gate is noindexed, not hidden. */
export function pageMetadata(page: SeoPage): Metadata {
  const templates = pageTemplates(page);
  const verdict = pageVerdict(page, templates.length);
  /* Branded 1200x630 card generated at /og/page/<id>; the home page keeps its hand-made /og.jpg. */
  const image = page.id === "home" ? undefined : { url: page.image ?? `/og/page/${page.id}`, width: 1200, height: 630, alt: page.h1 };
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    image,
    type: page.type === "guide" ? "article" : "website",
    noindex: !verdict.indexable,
    modifiedTime: page.updated,
    publishedTime: page.type === "guide" ? page.updated : undefined,
  });
}
