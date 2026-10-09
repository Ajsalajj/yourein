import type { MetadataRoute } from "next";
import { TEMPLATES } from "@/data/templates";
import { SITE_URL } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...TEMPLATES.map((t) => ({ url: `${SITE_URL}/templates/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
