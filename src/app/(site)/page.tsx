import { TEMPLATES } from "@/data/templates";
import { PRICE, SITE_NAME, SITE_URL } from "@/config/site";
import { Catalog } from "@/components/site/Catalog";
import { LiveShowcase } from "@/components/showcase/LiveShowcase";
import { Featured, FinalCta, Hero, HowItWorks, Pricing, RsvpDemo, WhatYouGet, Why } from "@/components/site/Sections";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: SITE_NAME, url: SITE_URL, slogan: "Invitations worth opening." },
      {
        "@type": "ItemList",
        name: "Digital invitation templates",
        itemListElement: TEMPLATES.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: `${t.name} digital invitation`,
            description: t.blurb,
            category: t.category,
            image: `${SITE_URL}/thumbs/${t.slug}.webp`,
            url: `${SITE_URL}/templates/${t.slug}`,
            brand: { "@id": `${SITE_URL}/#org` },
            offers: { "@type": "Offer", price: PRICE, priceCurrency: "INR", availability: "https://schema.org/InStock", url: `${SITE_URL}/templates/${t.slug}` },
          },
        })),
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero />
      <Featured />
      <Catalog />
      <LiveShowcase />
      <HowItWorks />
      <RsvpDemo />
      <WhatYouGet />
      <Why />
      <Pricing />
      <FinalCta />
    </>
  );
}
