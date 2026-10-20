import { libraryProvider } from "./library";
import { httpGenerator } from "./generate";
import { pexels, pixabay } from "./stock";
import type { Fetch, GenerationProvider, StockProvider } from "./types";

const realFetch: Fetch = (url, init) => fetch(url, init);

/** Providers are independent: each is enabled by its own configuration and the editor shows which ones are usable. */
export function stockProviders(origin = "", fetchFn: Fetch = realFetch, env: Record<string, string | undefined> = process.env): StockProvider[] {
  return [libraryProvider(origin), pexels(fetchFn, env), pixabay(fetchFn, env)];
}
export function generationProviders(fetchFn: Fetch = realFetch, env: Record<string, string | undefined> = process.env): GenerationProvider[] {
  return [httpGenerator(fetchFn, env)];
}

/** Only https downloads from a host the provider declared are allowed (no SSRF through a crafted result URL). */
export function isAllowedDownload(url: string, allowedHosts: string[]): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && allowedHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch { return false; }
}
