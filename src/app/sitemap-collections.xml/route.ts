import { entriesFor, renderUrlset, xmlResponse } from "@/seo/sitemap";

export const dynamic = "force-static";

export function GET() {
  return xmlResponse(renderUrlset(entriesFor("collections")));
}
