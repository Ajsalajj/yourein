import type { Metadata, Viewport } from "next";
import "@fontsource/gfs-didot/latin-400.css";
import "@fontsource-variable/jost/wght.css";
import "./globals.css";
import { SITE_NAME, TAGLINE } from "@/config/site";
import { HOME_TITLE } from "@/seo/metadata";
import { SEO_ORIGIN } from "@/seo/url";

const description =
  "Create an animated digital invitation that opens like the real thing. Personalize it, share one link and track RSVPs. Wedding, Nikah and engagement designs.";

/** Search engine site-verification tags. Set in the environment, never in code. */
const verification = {
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : {}),
  ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } } : {}),
};

/**
 * Site-wide defaults only. There is deliberately no canonical here: a default canonical would be inherited by
 * every page that forgets its own and point it at the home page. Each public page sets its own through buildMetadata.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SEO_ORIGIN),
  title: { default: HOME_TITLE, template: `%s | ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${TAGLINE}`,
    description,
    locale: "en_IN",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Three YoureIn invitations shown on phones" }],
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} | ${TAGLINE}`, description, images: ["/og.jpg"] },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
  ...(Object.keys(verification).length ? { verification } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF8F1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
