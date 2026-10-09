import { headers } from "next/headers";
import { SITE_URL } from "@/config/site";

/** The public address of this site, for building invitation links inside pages. */
export async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return SITE_URL;
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
