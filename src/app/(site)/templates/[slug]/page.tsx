import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { PRICE, PRICE_LABEL, SITE_URL } from "@/config/site";
import { PreviewButton } from "@/components/preview/PreviewProvider";
import { InvitationPhoneMockup } from "@/components/site/InvitationPhoneMockup";
import { CustomizeLink } from "@/components/site/Actions";
import { TemplateCard } from "@/components/site/TemplateCard";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) return {};
  const title = `${t.name}: animated ${t.category.toLowerCase()} invitation`;
  const description = `${t.blurb} An animated digital invitation with countdown, venue directions and RSVP. ${PRICE_LABEL}, customized online and published in minutes.`;
  return {
    title,
    description,
    alternates: { canonical: `/templates/${t.slug}` },
    openGraph: { title, description, url: `/templates/${t.slug}`, images: [{ url: `/thumbs/${t.slug}.webp`, width: 780, height: 1688, alt: `${t.name} invitation` }] },
  };
}

const INSIDE = ["Opening animation", "Names and date", "Invitation message", "Your story and photograph", "Every event, with time and place", "Live countdown", "Venue with directions", "Photo gallery", "RSVP with guest counts", "Music, calendar and share buttons"];

export default async function TemplatePage({ params }: Props) {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) notFound();
  const i = TEMPLATES.findIndex((x) => x.slug === t.slug);
  const more = [1, 2, 3].map((k) => TEMPLATES[(i + k) % TEMPLATES.length]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${t.name} digital invitation`,
    description: t.blurb,
    category: t.category,
    image: `${SITE_URL}/thumbs/${t.slug}.webp`,
    offers: { "@type": "Offer", price: PRICE, priceCurrency: "INR", availability: "https://schema.org/InStock", url: `${SITE_URL}/templates/${t.slug}` },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="tpl">
        <div className="wrap tpl-in">
          <PreviewButton slug={t.slug} className="feat-art tpl-art" label={`Preview ${t.name}`}>
            <span className="feat-plinth" style={{ background: t.theme.plinth }} aria-hidden="true" />
            <InvitationPhoneMockup t={t} variant="alt" className="feat-phone-b" sizes="(max-width: 720px) 34vw, 240px" />
            <InvitationPhoneMockup t={t} priority className="feat-phone-a" shadow="deep" sizes="(max-width: 720px) 38vw, 270px" />
          </PreviewButton>
          <div className="tpl-copy">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/#templates">All templates</Link>
              <span aria-hidden="true">/</span>
              <span>{t.name}</span>
            </nav>
            <p className="feat-cat">{t.category}</p>
            <h1>{t.name}</h1>
            <p className="tpl-price">{PRICE_LABEL} <span>One-time, paid when you publish</span></p>
            <p className="tpl-blurb">{t.blurb}</p>
            <p className="feat-open"><span>How it opens</span>{t.opening}</p>
            <div className="pair tpl-actions">
              <PreviewButton slug={t.slug} className="btn btn-quiet">Preview</PreviewButton>
              <CustomizeLink slug={t.slug} />
            </div>
            <h2 className="tpl-h">Inside this invitation</h2>
            <ol className="tpl-list">
              {INSIDE.map((x) => <li key={x}>{x}</li>)}
            </ol>
            <p className="tpl-fine">Shown with sample names. Tap Customize to add your own names, dates, venue and photographs. It is free until you publish.</p>
          </div>
        </div>
      </section>
      <section className="band band-cream">
        <div className="wrap">
          <div className="sec-head">
            <h2>More designs</h2>
            <p>Every design is {PRICE_LABEL}.</p>
          </div>
          <div className="grid">
            {more.map((m) => <TemplateCard key={m.slug} t={m} />)}
          </div>
        </div>
      </section>
      <div className="tpl-pad" />
      <div className="tpl-bar">
        <PreviewButton slug={t.slug} className="btn btn-quiet">Preview</PreviewButton>
        <CustomizeLink slug={t.slug} />
      </div>
    </>
  );
}
