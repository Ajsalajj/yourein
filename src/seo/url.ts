/**
 * Canonical origin and URL helpers. Pure functions, no framework imports, so they are easy to test.
 *
 * The canonical host is www.yourein.in. Set NEXT_PUBLIC_SITE_URL to override it (for example on a staging site).
 * On Vercel production without that variable the live domain is used, never the *.vercel.app address.
 */
export const LIVE_ORIGIN = "https://www.yourein.in";

function resolveOrigin(): string {
  const set = process.env.NEXT_PUBLIC_SITE_URL;
  if (set) return set.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production") return LIVE_ORIGIN;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return process.env.NODE_ENV === "production" ? LIVE_ORIGIN : "http://localhost:3000";
}

export const SEO_ORIGIN = resolveOrigin();

/**
 * The path part of a canonical URL: no query string (filters, sorting, utm_*, preview flags), no hash,
 * no trailing slash, no doubled slashes. "/wedding-invitations/?sort=new#x" becomes "/wedding-invitations".
 */
export function canonicalPath(input: string): string {
  let p = input.split("#")[0].split("?")[0].trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      p = "/";
    }
  }
  p = "/" + p.replace(/^\/+/, "");
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p;
}

export function absoluteUrl(path: string, origin: string = SEO_ORIGIN): string {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p === "/" ? "" : p}` || origin;
}

/** Canonical absolute URL for a path, with all parameters removed. */
export function canonicalUrl(path: string, origin: string = SEO_ORIGIN): string {
  const p = canonicalPath(path);
  return p === "/" ? `${origin}/` : `${origin}${p}`;
}
