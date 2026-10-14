import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { RelatedPages } from "@/components/seo/RelatedPages";
import { RichText } from "@/components/seo/RichText";
import { SeoFaq } from "@/components/seo/SeoFaq";
import { articleLd } from "@/seo/jsonld";
import { pageMetadata } from "@/seo/page-metadata";
import { ALL_PAGES, getPageByPath } from "@/seo/select";
import "@/components/seo/seo.css";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_PAGES.filter((p) => p.type === "guide").map((p) => ({ slug: p.path.split("/").pop()! }));
}

export async function generateMetadata({ params }: Props) {
  const page = getPageByPath(`/guides/${(await params).slug}`);
  return page ? pageMetadata(page) : {};
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function Page({ params }: Props) {
  const page = getPageByPath(`/guides/${(await params).slug}`);
  if (!page || page.type !== "guide") notFound();
  return (
    <article className="seo-article">
      <JsonLd data={articleLd(page)} />
      <section className="seo-hero">
        <div className="wrap seo-narrow">
          <Breadcrumbs trail={page.crumbs} />
          <h1>{page.h1}</h1>
          <p className="seo-meta">Updated {dateLabel(page.updated)}</p>
          <p className="seo-lead">{page.intro}</p>
        </div>
      </section>
      {page.sections.map((s, i) => (
        <section key={s.heading} className={`band seo-section${i % 2 ? " band-cream" : ""}`} aria-labelledby={`g-${i}`}>
          <div className="wrap seo-narrow">
            <h2 id={`g-${i}`}>{s.heading}</h2>
            {s.body.map((b) => <p key={b}><RichText text={b} /></p>)}
            {s.bullets && <ul className="seo-bullets">{s.bullets.map((b) => <li key={b}><RichText text={b} /></li>)}</ul>}
          </div>
        </section>
      ))}
      <SeoFaq items={page.faq} />
      <RelatedPages paths={page.related} heading="Related" />
    </article>
  );
}
