import type { Faq } from "@/seo/types";

/** Questions only where they help. Rendered as plain, visible text; no FAQ rich-result markup is relied on. */
export function SeoFaq({ items, heading = "Questions" }: { items?: Faq[]; heading?: string }) {
  if (!items?.length) return null;
  return (
    <section className="band seo-faq" aria-labelledby="seo-faq-h">
      <div className="wrap seo-narrow">
        <h2 id="seo-faq-h">{heading}</h2>
        <dl>
          {items.map((f) => (
            <div key={f.q}>
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
