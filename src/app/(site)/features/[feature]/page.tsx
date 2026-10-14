import Image from "next/image";
import { notFound } from "next/navigation";
import { SeoPageView } from "@/components/seo/SeoPageView";
import { FEATURE_SCREENSHOTS } from "@/seo/screenshots";
import { pageMetadata } from "@/seo/page-metadata";
import { ALL_PAGES, getPageByPath } from "@/seo/select";

type Props = { params: Promise<{ feature: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_PAGES.filter((p) => p.type === "feature").map((p) => ({ feature: p.feature! }));
}

export async function generateMetadata({ params }: Props) {
  const page = getPageByPath(`/features/${(await params).feature}`);
  return page ? pageMetadata(page) : {};
}

export default async function Page({ params }: Props) {
  const page = getPageByPath(`/features/${(await params).feature}`);
  if (!page || page.type !== "feature") notFound();
  const shots = FEATURE_SCREENSHOTS[page.feature!] ?? [];
  return (
    <SeoPageView page={page} collectionHeading="Designs that show it well">
      {shots.length > 0 && (
        <section className="band seo-section" aria-label="How it looks in the product">
          <div className="wrap seo-narrow">
            <h2>How it looks</h2>
            <div className="seo-shots">
              {shots.map((s) => (
                <figure className="seo-figure" key={s.src}>
                  <Image src={s.src} alt={s.alt} width={s.width} height={s.height} sizes="(max-width: 720px) 80vw, 340px" />
                  <figcaption>{s.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}
    </SeoPageView>
  );
}
