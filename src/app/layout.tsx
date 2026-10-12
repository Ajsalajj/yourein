import type { Metadata, Viewport } from "next";
import "@fontsource/gfs-didot/latin-400.css";
import "@fontsource-variable/jost/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "./globals.css";
import { SITE_NAME, SITE_URL, TAGLINE } from "@/config/site";

const description =
  "Create an animated digital invitation that opens like the real thing. Personalize every detail, share one link and track RSVPs. Wedding, Nikah and engagement designs, ₹999 each.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} | Animated Digital Wedding Invitations, ₹999`, template: `%s | ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  keywords: [
    "digital wedding invitations",
    "animated wedding invitations",
    "Nikah invitations",
    "Indian digital invitations",
    "online wedding invitation",
    "wedding invitation website",
    "engagement invitation",
    "wedding invitation with RSVP",
    "e-invite",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${TAGLINE}`,
    description,
    url: "/",
    locale: "en_IN",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Three YoureIn invitations shown on phones" }],
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} | ${TAGLINE}`, description, images: ["/og.jpg"] },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
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
