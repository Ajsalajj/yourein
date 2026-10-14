/**
 * SEO logic tests.  npm run test:seo
 * Pure logic only: no server, browser or network needed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import robots from "../../src/app/robots";
import { linksIn } from "../../src/components/seo/RichText";
import { TEMPLATES } from "../../src/data/templates";
import { isPageIndexable, isTemplateIndexable, pageVerdict, templateVerdict, type FileCheck } from "../../src/seo/indexable";
import { articleLd, breadcrumbLd, collectionLd, productLd, serializeLd } from "../../src/seo/jsonld";
import { buildMetadata, templateDescription, templateTitle } from "../../src/seo/metadata";
import { pageMetadata } from "../../src/seo/page-metadata";
import { PROFILES } from "../../src/seo/template-profiles";
import { ALL_PAGES, getPageByPath, pageTemplates, relatedTemplates, resolveTemplates, templatesWithStyle } from "../../src/seo/select";
import { entriesFor, renderIndex, renderUrlset, SITEMAP_NAMES, pageIsListed } from "../../src/seo/sitemap";
import { absoluteUrl, canonicalPath, canonicalUrl, SEO_ORIGIN } from "../../src/seo/url";

const hasImages: FileCheck = () => true;
const noImages: FileCheck = () => false;

/* ------------------------------------------------------------ canonical URLs */
test("canonicalPath drops filters, sorting, tracking, preview params, hashes and trailing slashes", () => {
  assert.equal(canonicalPath("/wedding-invitations?category=wedding"), "/wedding-invitations");
  assert.equal(canonicalPath("/wedding-invitations?sort=popular"), "/wedding-invitations");
  assert.equal(canonicalPath("/wedding-invitations/?utm_source=instagram&utm_medium=social"), "/wedding-invitations");
  assert.equal(canonicalPath("/templates/rose-garden?preview=1#top"), "/templates/rose-garden");
  assert.equal(canonicalPath("//features///rsvp/"), "/features/rsvp");
  assert.equal(canonicalPath("/?category=Wedding"), "/");
  assert.equal(canonicalPath("https://www.yourein.in/guides/?page=2"), "/guides");
  assert.equal(canonicalPath("nikah-invitations"), "/nikah-invitations");
});

test("canonicalUrl is absolute, on the canonical origin, and identical for every parameter variant", () => {
  const variants = ["/wedding-invitations", "/wedding-invitations/", "/wedding-invitations?x=1", "/wedding-invitations?utm_campaign=a#b"];
  const urls = new Set(variants.map((v) => canonicalUrl(v)));
  assert.equal(urls.size, 1);
  assert.equal([...urls][0], `${SEO_ORIGIN}/wedding-invitations`);
  assert.equal(canonicalUrl("/"), `${SEO_ORIGIN}/`);
  assert.equal(absoluteUrl("/og.jpg"), `${SEO_ORIGIN}/og.jpg`);
  assert.equal(canonicalUrl("/x", "https://www.yourein.in"), "https://www.yourein.in/x");
});

/* ------------------------------------------------------------ metadata */
test("buildMetadata sets absolute title, canonical, robots, Open Graph and Twitter together", () => {
  const m = buildMetadata({ title: "Floral Wedding Invitation Templates | YoureIn", description: "d", path: "/wedding-invitations/floral?sort=new", image: { url: "/og/page/style-floral", width: 1200, height: 630, alt: "x" } });
  assert.deepEqual(m.title, { absolute: "Floral Wedding Invitation Templates | YoureIn" });
  assert.equal(m.alternates?.canonical, `${SEO_ORIGIN}/wedding-invitations/floral`);
  assert.equal((m.robots as { index: boolean }).index, true);
  assert.equal(m.openGraph?.url, `${SEO_ORIGIN}/wedding-invitations/floral`);
  assert.equal((m.twitter as { card: string }).card, "summary_large_image");
  const og = m.openGraph as { images: { url: string }[] };
  assert.ok(og.images[0].url.startsWith("https://") || og.images[0].url.startsWith("http://"));
});

test("noindex pages say 'noindex, follow'", () => {
  const m = buildMetadata({ title: "t", description: "d", path: "/create", noindex: true });
  assert.deepEqual(m.robots, { index: false, follow: true });
});

test("template titles follow '{Name} {Occasion} Invitation Template | YoureIn' and stay short", () => {
  assert.equal(templateTitle("rose-garden"), "Rose Garden Wedding Invitation Template | YoureIn");
  assert.equal(templateTitle("jasmine-moon"), "Jasmine Moon Nikah Invitation Template | YoureIn");
  assert.equal(templateTitle("silk-ribbon"), "Silk Ribbon Engagement Invitation Template | YoureIn");
  assert.equal(templateTitle("not-a-design"), "");
  for (const t of TEMPLATES) assert.ok(templateTitle(t.slug).length <= 62, `${t.slug} title too long`);
});

test("every title carries the brand, and no page repeats a title, description or H1", () => {
  for (const p of ALL_PAGES) {
    assert.ok(p.title.includes("YoureIn"), `${p.path} title lacks the brand`);
    assert.ok(p.title.split("YoureIn").length - 1 <= 2, `${p.path} repeats the brand`);
    assert.ok(p.title.length <= 70, `${p.path} title is ${p.title.length} characters`);
    assert.ok(p.description.length >= 70 && p.description.length <= 165, `${p.path} description is ${p.description.length} characters`);
  }
  for (const key of ["title", "description", "h1"] as const) {
    const values = ALL_PAGES.map((p) => p[key].toLowerCase());
    assert.equal(new Set(values).size, values.length, `duplicate ${key}`);
  }
  const d = TEMPLATES.map((t) => templateDescription(t.slug));
  assert.equal(new Set(d).size, d.length, "template descriptions repeat");
  for (const x of d) assert.ok(x.length <= 165, `template description too long: ${x}`);
});

test("pageMetadata marks a page that fails its quality gate as noindex", () => {
  const wedding = getPageByPath("/wedding-invitations")!;
  assert.equal((pageMetadata(wedding).robots as { index: boolean }).index, true);
  const thin = { ...wedding, minTemplates: 99 };
  assert.deepEqual(pageMetadata(thin).robots, { index: false, follow: true });
});

/* ------------------------------------------------------------ robots */
test("robots.txt closes private routes and the API, and leaves public pages and assets open", () => {
  const r = robots();
  const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules) as { allow: string; disallow: string[] };
  assert.equal(rule.allow, "/");
  for (const p of ["/api/", "/dashboard", "/invites", "/guests", "/account", "/edit/", "/pay/", "/success/", "/start/", "/signin"]) assert.ok(rule.disallow.includes(p), `${p} should be disallowed`);
  for (const p of ["/_next", "/wedding-invitations", "/templates", "/features", "/guides", "/og", "/thumbs", "/renders", "/features/rsvp", "/i/"]) {
    assert.ok(!rule.disallow.some((d) => p.startsWith(d.replace(/\/$/, "")) && d !== "/"), `${p} must not be blocked`);
  }
  assert.equal(r.sitemap, `${SEO_ORIGIN}/sitemap.xml`);
});

/* ------------------------------------------------------------ template indexability */
const sample = TEMPLATES[0];
test("isTemplateIndexable: a published design with copy, a picture and a slug is indexed", () => {
  assert.equal(isTemplateIndexable(sample, hasImages), true);
  for (const t of TEMPLATES) assert.equal(templateVerdict(t, hasImages).indexable, true, `${t.slug}: ${templateVerdict(t, hasImages).reasons.join(", ")}`);
});

test("isTemplateIndexable: unpublished, no picture, no profile, odd slug and duplicate copy are all noindex", () => {
  assert.equal(isTemplateIndexable({ ...sample, status: "draft" }, hasImages), false);
  assert.ok(templateVerdict({ ...sample, status: "draft" }, hasImages).reasons.includes("not published"));
  assert.ok(templateVerdict(sample, noImages).reasons.includes("no preview image"));
  assert.ok(templateVerdict({ slug: "brand-new", blurb: "A new one." }, hasImages).reasons.includes("no SEO profile"));
  assert.ok(templateVerdict({ slug: "Bad Slug!", blurb: "x" }, hasImages).reasons.includes("no stable slug"));
  const twin = { ...sample, slug: "rose-garden-twin", blurb: sample.blurb };
  assert.ok(templateVerdict(sample, hasImages, [...TEMPLATES, twin]).reasons.includes("duplicate description"));
});

test("template profiles are complete and their copy is not shared between designs", () => {
  const summaries = new Set<string>();
  for (const t of TEMPLATES) {
    const p = PROFILES[t.slug];
    assert.ok(p, `${t.slug} has no profile`);
    assert.ok(p.summary.split(/\s+/).length >= 40, `${t.slug} summary is thin`);
    assert.ok(p.characteristics.length >= 3, `${t.slug} needs three characteristics`);
    assert.ok(p.alt.length > 20, `${t.slug} alt text is too short`);
    assert.ok(!summaries.has(p.summary), `${t.slug} repeats another summary`);
    summaries.add(p.summary);
  }
});

/* ------------------------------------------------------------ route generation and quality gate */
test("only approved pages exist: a small, hand-listed set, never a keyword grid", () => {
  assert.ok(ALL_PAGES.length >= 20 && ALL_PAGES.length <= 40, `${ALL_PAGES.length} pages`);
  const paths = ALL_PAGES.map((p) => p.path);
  assert.equal(new Set(paths).size, paths.length, "duplicate paths");
  assert.ok(!paths.some((p) => /birthday|baby-shower|housewarming|anniversary/.test(p)), "no pages for occasions without designs");
  assert.ok(!paths.some((p) => p.split("/").length > 4), "no deep combination pages");
});

test("every collection shows enough real designs, and each design belongs where it is listed", () => {
  for (const p of ALL_PAGES) {
    const n = pageTemplates(p).length;
    assert.ok(n >= p.minTemplates, `${p.path} has ${n} designs, needs ${p.minTemplates}`);
    if (p.type === "style") assert.ok(n >= 3, `${p.path} needs at least three designs`);
  }
  for (const t of templatesWithStyle("floral")) assert.ok(PROFILES[t.slug].styles.includes("floral"));
  assert.ok(resolveTemplates({ by: "slugs", slugs: ["rose-garden", "nope"] }).length === 1);
  assert.equal(templatesWithStyle("minimal").length, 4);
});

test("every page passes its own quality gate, and a thin page does not", () => {
  for (const p of ALL_PAGES) {
    if (p.id === "contact") continue;
    assert.equal(isPageIndexable(p), true, `${p.path}: ${pageVerdict(p).reasons.join(", ")}`);
  }
  const wedding = getPageByPath("/wedding-invitations")!;
  assert.equal(isPageIndexable({ ...wedding, sections: [], intro: "Short.", benefits: [] }), false);
  assert.equal(isPageIndexable({ ...wedding, noindex: true }), false);
  assert.equal(isPageIndexable(wedding, 1), false);
});

test("internal links in copy and related pages all point at real pages", () => {
  const known = new Set(["/", "/create", ...ALL_PAGES.map((p) => p.path), ...TEMPLATES.map((t) => `/templates/${t.slug}`)]);
  for (const p of ALL_PAGES) {
    for (const r of p.related) assert.ok(known.has(r), `${p.path} relates to missing ${r}`);
    for (const s of p.sections) for (const text of [...s.body, ...(s.bullets ?? [])]) for (const href of linksIn(text)) assert.ok(known.has(canonicalPath(href)), `${p.path} links to missing ${href}`);
    for (const c of p.crumbs) assert.ok(known.has(c.href), `${p.path} breadcrumb points to missing ${c.href}`);
  }
});

test("no two pages target the same primary keyword", () => {
  const k = ALL_PAGES.map((p) => p.primaryKeyword.toLowerCase());
  assert.equal(new Set(k).size, k.length);
});

test("related designs never include the design itself, and prefer the same style", () => {
  const r = relatedTemplates("rose-garden", 3);
  assert.equal(r.length, 3);
  assert.ok(!r.some((t) => t.slug === "rose-garden"));
  assert.ok(PROFILES[r[0].slug].styles.includes("floral"));
});

/* ------------------------------------------------------------ sitemaps */
test("sitemaps list only canonical, indexable pages and every indexable design", () => {
  const all = SITEMAP_NAMES.flatMap((n) => entriesFor(n, hasImages));
  const locs = all.map((e) => e.loc);
  assert.equal(new Set(locs).size, locs.length, "a URL is listed twice");
  for (const e of all) {
    assert.equal(e.loc, canonicalUrl(canonicalPath(e.loc)), `${e.loc} is not canonical`);
    assert.ok(!/[?#]/.test(e.loc), `${e.loc} has a query string`);
    assert.ok(!/\/(dashboard|invites|guests|account|edit|pay|success|start|signin|reset|api|shot|i)(\/|$)/.test(canonicalPath(e.loc)), `${e.loc} is a private route`);
  }
  assert.equal(entriesFor("templates", hasImages).length, TEMPLATES.length);
  assert.equal(entriesFor("templates", noImages).length, 0, "designs without pictures must not be listed");
  assert.ok(locs.includes(canonicalUrl("/")));
  assert.ok(locs.includes(canonicalUrl("/wedding-invitations/floral")));
  assert.ok(!locs.some((l) => l.includes("/create")), "/create is noindex and must not be listed");
});

test("a noindex or thin page is left out of the sitemap", () => {
  const wedding = getPageByPath("/wedding-invitations")!;
  assert.equal(pageIsListed(wedding), true);
  assert.equal(pageIsListed({ ...wedding, noindex: true }), false);
  assert.equal(pageIsListed({ ...wedding, minTemplates: 99 }), false);
});

test("sitemap XML is well formed: escaped, with images and real dates, and no priority fields", () => {
  const xml = renderUrlset([{ loc: "https://x.test/a?b=1&c=2", lastmod: "2026-10-14", images: [{ loc: "https://x.test/i.webp", title: 'A "quoted" <title>' }] }]);
  assert.ok(xml.includes("&amp;c=2"));
  assert.ok(xml.includes("&lt;title&gt;"));
  assert.ok(xml.includes("xmlns:image"));
  assert.ok(xml.includes("<lastmod>2026-10-14</lastmod>"));
  assert.ok(!/priority|changefreq/.test(xml));
  const idx = renderIndex(["pages", "templates"], "https://www.yourein.in");
  assert.ok(idx.includes("https://www.yourein.in/sitemap-pages.xml") && idx.includes("https://www.yourein.in/sitemap-templates.xml"));
  assert.ok(!idx.includes("sitemap-blog"));
});

/* ------------------------------------------------------------ structured data */
test("structured data never claims ratings, reviews or stock, and prices are real", () => {
  for (const t of TEMPLATES) {
    const p = productLd(t.slug)!;
    const text = JSON.stringify(p);
    assert.ok(!/AggregateRating|ratingValue|reviewCount|"Review"|priceValidUntil/.test(text));
    assert.equal(p["@type"], "Product");
    const offer = p.offers as { price: number; priceCurrency: string };
    assert.equal(offer.priceCurrency, "INR");
    assert.ok(offer.price > 0);
  }
  assert.equal(productLd("not-a-design"), null);
});

test("breadcrumb data starts at Home and ends at the page, with absolute URLs", () => {
  const ld = breadcrumbLd([{ href: "/wedding-invitations", label: "Wedding Invitations" }, { href: "/wedding-invitations/floral", label: "Floral" }]) as { itemListElement: { position: number; name: string; item: string }[] };
  assert.equal(ld.itemListElement[0].name, "Home");
  assert.equal(ld.itemListElement.at(-1)!.item, `${SEO_ORIGIN}/wedding-invitations/floral`);
  assert.deepEqual(ld.itemListElement.map((i) => i.position), [1, 2, 3]);
});

test("collection and article data point at the page's own canonical URL", () => {
  const floral = getPageByPath("/wedding-invitations/floral")!;
  const c = collectionLd(floral, pageTemplates(floral).map((t) => t.slug)) as { url: string; mainEntity: { numberOfItems: number } };
  assert.equal(c.url, `${SEO_ORIGIN}/wedding-invitations/floral`);
  assert.equal(c.mainEntity.numberOfItems, pageTemplates(floral).length);
  const guide = ALL_PAGES.find((p) => p.type === "guide")!;
  assert.equal((articleLd(guide) as { mainEntityOfPage: string }).mainEntityOfPage, canonicalUrl(guide.path));
});

test("serializeLd cannot be broken out of its script tag", () => {
  const s = serializeLd({ name: "</script><script>alert(1)</script>" });
  assert.ok(!s.includes("</script>"));
  assert.equal(JSON.parse(s).name, "</script><script>alert(1)</script>");
});
