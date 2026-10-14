import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";
import { JsonLd } from "./JsonLd";
import { RelatedPages } from "./RelatedPages";
import { RichText } from "./RichText";
import { collectionLd } from "@/seo/jsonld";
import type { SeoPage } from "@/seo/types";
import "./seo.css";

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** About, Contact, Privacy and Terms: plain pages with real text, linked from the footer. */
export function TrustPage({ page, children }: { page: SeoPage; children?: ReactNode }) {
  return (
    <>
      <JsonLd data={collectionLd(page, [])} />
      <section className="seo-hero">
        <div className="wrap seo-narrow">
          <Breadcrumbs trail={page.crumbs} />
          <h1>{page.h1}</h1>
          <p className="seo-lead">{page.intro}</p>
        </div>
      </section>
      {children && <section className="band"><div className="wrap seo-narrow">{children}</div></section>}
      {page.sections.map((s, i) => (
        <section key={s.heading} className={`band seo-section${i % 2 ? " band-cream" : ""}`} aria-labelledby={`t-${i}`}>
          <div className="wrap seo-narrow">
            <h2 id={`t-${i}`}>{s.heading}</h2>
            {s.body.map((b) => <p key={b}><RichText text={b} /></p>)}
            {s.bullets && <ul className="seo-bullets">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
          </div>
        </section>
      ))}
      {page.id !== "contact" && <div className="wrap seo-narrow"><p className="seo-updated">Last updated {dateLabel(page.updated)}</p></div>}
      <RelatedPages paths={page.related} heading="More about YoureIn" />
    </>
  );
}
