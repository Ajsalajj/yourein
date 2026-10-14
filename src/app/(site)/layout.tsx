import { PreviewProvider } from "@/components/preview/PreviewProvider";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Sections";
import { Analytics } from "@/components/seo/Analytics";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationLd, websiteLd } from "@/seo/jsonld";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <PreviewProvider>
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <Analytics />
      <a className="skip-link" href="#main">Skip to content</a>
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </PreviewProvider>
  );
}
