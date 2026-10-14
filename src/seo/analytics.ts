/**
 * Marketing-safe analytics events. Nothing here ever carries guest names, replies, phone numbers,
 * venues or any invitation content: only the event name, a design slug and the landing/UTM data.
 *
 * Events go to window.dataLayer (read by Google Tag Manager or GA4). If neither is installed they do nothing.
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID to load GA4 directly (see src/components/seo/Analytics.tsx).
 */
export type SeoEvent =
  | "template_view"
  | "template_preview"
  | "template_customize"
  | "signup_start"
  | "signup_complete"
  | "payment_start"
  | "payment_complete"
  | "invitation_publish";

export type Attribution = { landing_page?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string };

const KEY = "yi_attr";
const UTM = ["utm_source", "utm_medium", "utm_campaign"] as const;

/** Reads the first landing page and UTM tags of a visit and keeps them for the rest of the visit. */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as Attribution;
    const q = new URLSearchParams(window.location.search);
    const a: Attribution = { landing_page: window.location.pathname };
    for (const k of UTM) {
      const v = q.get(k);
      if (v) a[k] = v.slice(0, 80);
    }
    sessionStorage.setItem(KEY, JSON.stringify(a));
    return a;
  } catch {
    return {};
  }
}

type Props = Record<string, string | number | boolean | undefined>;

export function track(event: SeoEvent, props: Props = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  const w2 = (w.dataLayer = w.dataLayer || []);
  w2.push({ event, ...captureAttribution(), ...props });
}
