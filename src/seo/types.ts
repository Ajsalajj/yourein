import type { Category } from "@/data/templates";

export type StyleId = "floral" | "royal" | "minimal" | "indian";
export type FeatureId = "rsvp" | "music" | "guest-tracking" | "personal-links" | "qr-code" | "photo-gallery" | "countdown" | "multiple-events";
export type OccasionId = "wedding" | "nikah" | "engagement";

export type PageType = "home" | "occasion" | "style" | "feature" | "feature-index" | "location" | "guide-index" | "guide" | "trust";

export type Faq = { q: string; a: string };
export type Section = { heading: string; body: string[]; bullets?: string[] };
export type Link = { href: string; label: string };

/** How a page picks the real templates it shows. A page with too few matches is not indexed. */
export type TemplateSelector =
  | { by: "category"; category: Category }
  | { by: "style"; style: StyleId }
  | { by: "slugs"; slugs: string[] }
  | { by: "none" };

/** One approved SEO page. Pages are listed by hand: nothing here is generated as a combination of keywords. */
export type SeoPage = {
  id: string;
  type: PageType;
  /** Canonical path, no trailing slash. */
  path: string;
  /** Full <title>, brand included. */
  title: string;
  h1: string;
  description: string;
  /** Short lead paragraph under the H1. */
  intro: string;
  searchIntent: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  templates: TemplateSelector;
  /** Smallest number of matching templates this page needs before it may be indexed. */
  minTemplates: number;
  benefits?: { title: string; text: string }[];
  sections: Section[];
  /** Paths of related pages, shown as descriptive links. */
  related: string[];
  faq?: Faq[];
  /** Social/Open Graph image, path or absolute URL. Defaults to the first matching template's picture. */
  image?: string;
  schemaType: "CollectionPage" | "WebPage" | "AboutPage" | "ContactPage" | "Article";
  /** Force a page out of the index (it is then also left out of the sitemaps). */
  noindex?: boolean;
  occasion?: OccasionId;
  style?: StyleId;
  feature?: FeatureId;
  location?: string;
  /** Breadcrumb trail after "Home", ending with this page. */
  crumbs: Link[];
  /** ISO date the content last meaningfully changed, used for lastmod. */
  updated: string;
};
