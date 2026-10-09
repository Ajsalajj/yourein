import { PreviewProvider } from "@/components/preview/PreviewProvider";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Sections";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <PreviewProvider>
      <a className="skip-link" href="#main">Skip to content</a>
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </PreviewProvider>
  );
}
