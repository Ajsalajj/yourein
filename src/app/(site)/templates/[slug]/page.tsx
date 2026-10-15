import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { PRICE_LABEL } from "@/config/site";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { RelatedPages } from "@/components/seo/RelatedPages";
import { TemplateViewEvent } from "@/components/seo/TemplateViewEvent";
import { templateVerdict } from "@/seo/indexable";
import { productLd } from "@/seo/jsonld";
import { buildMetadata, templateDescription, templateImage, templateTitle } from "@/seo/metadata";
import { PROFILES } from "@/seo/template-profiles";
import { occasionPageFor, relatedTemplates, stylePagesFor } from "@/seo/select";
import { pageVerdict } from "@/seo/indexable";
import "@/components/seo/seo.css";
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
  const img = templateImage(t.slug);
  return buildMetadata({
    title: templateTitle(t.slug),
    description: templateDescription(t.slug),
    path: `/templates/${t.slug}`,
    image: { url: `/og/template/${t.slug}`, width: 1200, height: 630, alt: img.alt },
    noindex: !templateVerdict(t).indexable,
  });
}

const INSIDE = ["Opening animation", "Names and date", "Invitation message", "Your story and photograph", "Every event, with time and place", "Live countdown", "Venue with directions", "Photo gallery", "RSVP with guest counts", "Music, calendar and share buttons"];

export default async function TemplatePage({ params }: Props) {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) notFound();
  const i = TEMPLATES.findIndex((x) => x.slug === t.slug);
  void i;
  const profile = PROFILES[t.slug];
  const more = relatedTemplates(t.slug, 3);
  const occasion = occasionPageFor(t.slug);
  const styles = stylePagesFor(t.slug).filter((p) => pageVerdict(p).indexable);
  const trail = [
    ...(occasion ? [{ href: occasion.path, label: occasion.crumbs[0].label }] : []),
    ...(styles[0] ? [{ href: styles[0].path, label: styles[0].crumbs[1].label }] : []),
    { href: `/templates/${t.slug}`, label: t.name },
  ];
  const product = productLd(t.slug);
  const related = [...styles.map((p) => p.path), ...(occasion ? [occasion.path] : []), "/features/rsvp", "/features/music"].filter((x, k, all) => all.indexOf(x) === k);
  return (
    <>
      {product && <JsonLd data={product} />}
      <TemplateViewEvent slug={t.slug} name={t.name} category={t.category} />
      <section className="tpl">
        <div className="wrap tpl-in">
          <PreviewButton slug={t.slug} className="feat-art tpl-art" label={`Preview ${t.name}`}>
            <span className="feat-plinth" style={{ background: t.theme.plinth }} aria-hidden="true" />
            <InvitationPhoneMockup t={t} variant="alt" className="feat-phone-b" sizes="(max-width: 720px) 34vw, 240px" />
            <InvitationPhoneMockup t={t} priority className="feat-phone-a" shadow="deep" sizes="(max-width: 720px) 38vw, 270px" />
          </PreviewButton>
          <div className="tpl-copy">
            <Breadcrumbs trail={trail} />
            <p className="feat-cat">{t.category}</p>
            <h1>{t.name} {profile?.occasion ?? "Wedding"} Invitation</h1>
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
      {profile && (
        <section className="band tpl-seo" aria-labelledby="tpl-about-h">
          <div className="wrap seo-narrow">
            <h2 id="tpl-about-h">About the {t.name} design</h2>
            <p>{profile.summary}</p>
            <h2>Best suited for</h2>
            <p>{profile.bestFor}</p>
            <h2>What sets it apart</h2>
            <ul>{profile.characteristics.map((c) => <li key={c}>{c}</li>)}</ul>
            <h2>Included, like every design</h2>
            <p>
              <Link href="/features/rsvp">RSVP with guest counts</Link>, <Link href="/features/music">background music</Link>, a <Link href="/features/photo-gallery">photo gallery</Link>,
              a <Link href="/features/countdown">live countdown</Link>, <Link href="/features/multiple-events">multiple events</Link>, venue directions, and sharing by{" "}
              <Link href="/features/personal-links">personal links</Link>, WhatsApp or <Link href="/features/qr-code">QR code</Link>.
            </p>
            <h2>What you can customize</h2>
            <p>Names, hosts and message, the date and every event with its venue, your story and photographs, the gallery, music and volume, and the RSVP questions. You can switch to another design at any time without losing what you have written.</p>
          </div>
        </section>
      )}
      <section className="band band-cream">
        <div className="wrap">
          <div className="sec-head">
            <h2>Similar designs</h2>
            <p>Chosen for a similar style or occasion. Every design is {PRICE_LABEL}.</p>
          </div>
          <div className="grid">
            {more.map((m) => <TemplateCard key={m.slug} t={m} />)}
          </div>
        </div>
      </section>
      <RelatedPages paths={related} heading="Explore more" />
      <div className="tpl-pad" />
      <div className="tpl-bar">
        <PreviewButton slug={t.slug} className="btn btn-quiet">Preview</PreviewButton>
        <CustomizeLink slug={t.slug} />
      </div>
    </>
  );
}
