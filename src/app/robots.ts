import type { MetadataRoute } from "next";
import { SEO_ORIGIN } from "@/seo/url";

/**
 * Public marketing and design pages are open. Account, editing, payment and API routes are closed.
 *
 * /i/ (guest invitations) is deliberately NOT blocked here. Those pages carry "noindex, follow" in their metadata and
 * headers, and a crawler can only obey a noindex if it is allowed to fetch the page. Blocking /i/ would hide the noindex
 * and let bare URLs be listed without content.
 *
 * CSS, JavaScript and images under /_next/ are not blocked, so pages render fully for crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/dashboard", "/invites", "/guests", "/account", "/edit/", "/pay/", "/success/", "/start/", "/signin", "/reset", "/shot/"] }],
    sitemap: `${SEO_ORIGIN}/sitemap.xml`,
  };
}
