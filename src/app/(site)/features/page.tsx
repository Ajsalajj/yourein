import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { RelatedPages } from "@/components/seo/RelatedPages";
import { collectionLd } from "@/seo/jsonld";
import { pageMetadata } from "@/seo/page-metadata";
import { ALL_PAGES, getPageById } from "@/seo/select";
import "@/components/seo/seo.css";

const page = getPageById("features");
export const metadata = pageMetadata(page);

export default function Page() {
  const features = ALL_PAGES.filter((p) => p.type === "feature");
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
      <section className="band band-cream" aria-label="Features">
        <div className="wrap">
          <ul className="seo-feature-grid">
            {features.map((f) => (
              <li key={f.id}>
                <Link href={f.path}>{f.h1}</Link>
                <p>{f.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <RelatedPages paths={["/wedding-invitations", "/nikah-invitations", "/engagement-invitations"]} heading="Browse designs" />
    </>
  );
}
