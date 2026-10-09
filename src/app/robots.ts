import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/shot/", "/api/", "/i/", "/dashboard", "/invites", "/guests", "/account", "/edit/", "/pay/", "/success/", "/start/", "/signin", "/reset"] }], sitemap: `${SITE_URL}/sitemap.xml` };
}
