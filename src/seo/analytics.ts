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

export type Attribution = {
  landing_page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** Meta's click id, kept for this visit only so a checkout can be matched to the ad (sent only with ads consent). */
  fbclid?: string;
  captured_at?: number;
};

const KEY = "yi_attr";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/**
 * Reads the first landing page, UTM tags and fbclid of a visit and keeps them for the rest of the visit (sessionStorage:
 * this tab only, gone when it closes). Internal links and canonical URLs never carry them.
 */
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
    const fbclid = q.get("fbclid");
    if (fbclid && /^[\w-]{10,500}$/.test(fbclid)) a.fbclid = fbclid;
    a.captured_at = Date.now();
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
  /* the click id stays out of analytics; it is only for matching an ad to a checkout */
  const { fbclid: _click, captured_at: _at, ...attr } = captureAttribution();
  w2.push({ event, ...attr, ...props });
}
