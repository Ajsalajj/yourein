import { nonEmptySitemaps, renderIndex, xmlResponse } from "@/seo/sitemap";

export const dynamic = "force-static";

/** Sitemap index. Submit this one URL in Search Console and Bing Webmaster Tools. */
export function GET() {
  return xmlResponse(renderIndex(nonEmptySitemaps()));
}
