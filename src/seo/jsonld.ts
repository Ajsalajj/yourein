import { CURRENCY, PRICE, SITE_NAME } from "@/config/site";
import { getTemplate } from "@/data/templates";
import { templateDescription, templateImage } from "./metadata";
import { PROFILES } from "./template-profiles";
import type { Link, SeoPage } from "./types";
import { absoluteUrl, canonicalUrl, SEO_ORIGIN } from "./url";

/** Stable ids let one page's schema point at another's (publisher, isPartOf). */
export const ORG_ID = `${SEO_ORIGIN}/#organization`;
export const SITE_ID = `${SEO_ORIGIN}/#website`;

type Ld = Record<string, unknown>;

/**
 * Organization and WebSite only. `sameAs` is left out on purpose: it is for official social profiles,
 * and none are listed yet. Add them in src/config/site.ts when they exist.
 */
export function organizationLd(sameAs: string[] = []): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: `${SEO_ORIGIN}/`,
    logo: absoluteUrl("/logo.svg"),
    description: "YoureIn makes animated digital invitations for weddings, Nikah and engagements, with RSVP and guest tracking.",
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteLd(): Ld {
  return { "@context": "https://schema.org", "@type": "WebSite", "@id": SITE_ID, name: SITE_NAME, url: `${SEO_ORIGIN}/`, inLanguage: "en-IN", publisher: { "@id": ORG_ID } };
}

/** BreadcrumbList for a trail that starts at Home. */
export function breadcrumbLd(trail: Link[]): Ld {
  const items: Link[] = [{ href: "/", label: "Home" }, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: canonicalUrl(c.href) })),
  };
}

/** A collection page and the designs on it. Designs are listed by URL, not repeated as full products. */
export function collectionLd(page: SeoPage, templateSlugs: string[]): Ld {
  return {
    "@context": "https://schema.org",
    "@type": page.schemaType === "Article" ? "WebPage" : page.schemaType,
    "@id": `${canonicalUrl(page.path)}#page`,
    url: canonicalUrl(page.path),
    name: page.h1,
    description: page.description,
    inLanguage: "en-IN",
    isPartOf: { "@id": SITE_ID },
    dateModified: page.updated,
    ...(templateSlugs.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: templateSlugs.length,
            itemListElement: templateSlugs.map((s, i) => ({ "@type": "ListItem", position: i + 1, url: canonicalUrl(`/templates/${s}`), name: getTemplate(s)?.name })),
          },
        }
      : {}),
  };
}

/**
 * Product markup for a design. It carries only true data: the name, description, picture and the real price.
 * There is no rating, review count, stock level or discount, because none exist.
 */
export function productLd(slug: string): Ld | null {
  const t = getTemplate(slug);
  const p = PROFILES[slug];
  if (!t || !p) return null;
  const img = templateImage(slug);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl(`/templates/${slug}`)}#product`,
    name: `${t.name} animated digital invitation`,
    description: templateDescription(slug),
    category: `${p.occasion} invitation`,
    sku: slug,
    image: [absoluteUrl(`/renders/${slug}.webp`), absoluteUrl(img.src)],
    brand: { "@id": ORG_ID },
    url: canonicalUrl(`/templates/${slug}`),
    offers: { "@type": "Offer", price: PRICE, priceCurrency: CURRENCY, availability: "https://schema.org/InStock", url: canonicalUrl(`/templates/${slug}`) },
  };
}

export function articleLd(page: SeoPage): Ld {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.h1,
    description: page.description,
    url: canonicalUrl(page.path),
    mainEntityOfPage: canonicalUrl(page.path),
    datePublished: page.updated,
    dateModified: page.updated,
    inLanguage: "en-IN",
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    image: absoluteUrl("/og.jpg"),
  };
}

/** Safe to place inside a <script>: "<" is escaped so content can never close the tag. */
export const serializeLd = (data: Ld | Ld[]) => JSON.stringify(data).replace(/</g, "\\u003c");
