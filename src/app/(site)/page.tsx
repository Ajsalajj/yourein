import { Catalog } from "@/components/site/Catalog";
import { ExploreLinks } from "@/components/seo/ExploreLinks";
import { Featured, FinalCta, Hero, HowItWorks, Pricing, RsvpDemo, WhatYouGet, Why } from "@/components/site/Sections";
import { buildMetadata } from "@/seo/metadata";
import { HOME_PAGE } from "@/seo/pages";

const page = HOME_PAGE;
export const metadata = buildMetadata({ title: page.title, description: page.description, path: "/" });

export default function Home() {
  return (
    <>
      <Hero />
      <Featured />
      <Catalog />
      <ExploreLinks />
      <HowItWorks />
      <RsvpDemo />
      <WhatYouGet />
      <Why />
      <Pricing />
      <FinalCta />
    </>
  );
}
