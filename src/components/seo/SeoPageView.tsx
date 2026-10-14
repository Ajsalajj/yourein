import Link from "next/link";
import type { ReactNode } from "react";
import { TemplateCard } from "@/components/site/TemplateCard";
import { collectionLd } from "@/seo/jsonld";
import { pageTemplates } from "@/seo/select";
import type { SeoPage } from "@/seo/types";
import { Breadcrumbs } from "./Breadcrumbs";
import { JsonLd } from "./JsonLd";
import { RelatedPages } from "./RelatedPages";
import { RichText } from "./RichText";
import { SeoFaq } from "./SeoFaq";
import "./seo.css";

/**
 * The shared layout for every approved landing page. Order is chosen for phones:
 * heading, then the real designs, then benefits, then the explanation, then questions and related pages.
 * Everything here is rendered on the server.
 */
export function SeoPageView({ page, children, collectionHeading }: { page: SeoPage; children?: ReactNode; collectionHeading?: string }) {
  const templates = pageTemplates(page);
  return (
    <>
      <JsonLd data={collectionLd(page, templates.map((t) => t.slug))} />
      <section className="seo-hero">
        <div className="wrap seo-narrow">
          <Breadcrumbs trail={page.crumbs} />
          <h1>{page.h1}</h1>
          <p className="seo-lead">{page.intro}</p>
          <div className="pair seo-cta">
            {templates.length > 0 ? <a className="btn btn-solid" href="#designs">See the designs</a> : <Link className="btn btn-solid" href="/create">Browse all designs</Link>}
            <Link className="btn btn-quiet" href="/create">Create an invitation</Link>
          </div>
        </div>
      </section>

      {templates.length > 0 && (
        <section className="band band-cream" id="designs" aria-labelledby="designs-h">
          <div className="wrap">
            <div className="sec-head">
              <h2 id="designs-h">{collectionHeading ?? `${templates.length} ${templates.length === 1 ? "design" : "designs"} to preview`}</h2>
              <p>Tap Preview to open any design with sample names. Customizing is free; every design is the same price.</p>
            </div>
            <div className="grid">
              {templates.map((t, i) => <TemplateCard key={t.slug} t={t} priority={i < 2} />)}
            </div>
          </div>
        </section>
      )}

      {children}

      {page.benefits && page.benefits.length > 0 && (
        <section className="band seo-benefits" aria-label="Benefits">
          <div className="wrap">
            <ul className="seo-benefit-list">
              {page.benefits.map((b) => (
                <li key={b.title}>
                  <h3>{b.title}</h3>
                  <p>{b.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {page.sections.map((s, i) => (
        <section key={s.heading} className={`band seo-section${i % 2 ? " band-cream" : ""}`} aria-labelledby={`sec-${i}`}>
          <div className="wrap seo-narrow">
            <h2 id={`sec-${i}`}>{s.heading}</h2>
            {s.body.map((b) => <p key={b}><RichText text={b} /></p>)}
            {s.bullets && <ul className="seo-bullets">{s.bullets.map((b) => <li key={b}><RichText text={b} /></li>)}</ul>}
          </div>
        </section>
      ))}

      <SeoFaq items={page.faq} />
      <RelatedPages paths={page.related} />
    </>
  );
}
