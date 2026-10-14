import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { RelatedPages } from "@/components/seo/RelatedPages";
import { collectionLd } from "@/seo/jsonld";
import { pageMetadata } from "@/seo/page-metadata";
import { ALL_PAGES, getPageById } from "@/seo/select";
import "@/components/seo/seo.css";

const page = getPageById("guides");
export const metadata = pageMetadata(page);

export default function Page() {
  const guides = ALL_PAGES.filter((p) => p.type === "guide");
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
      <section className="band band-cream" aria-label="Guides">
        <div className="wrap seo-narrow">
          <ul className="seo-guide-list">
            {guides.map((g) => (
              <li key={g.id}>
                <Link href={g.path}>{g.h1}</Link>
                <p>{g.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <RelatedPages paths={page.related} heading="Ready to start?" />
    </>
  );
}
