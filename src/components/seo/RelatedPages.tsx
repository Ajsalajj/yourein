import Link from "next/link";
import { getPageByPath } from "@/seo/select";

/** Descriptive anchors: the link text is the page's own subject, never "click here". */
export function anchorFor(path: string): string | undefined {
  const p = getPageByPath(path);
  if (!p) return undefined;
  if (p.type === "guide") return p.h1;
  return p.h1;
}

export function RelatedPages({ paths, heading = "Keep exploring" }: { paths: string[]; heading?: string }) {
  const items = paths.map((p) => ({ path: p, page: getPageByPath(p) })).filter((x): x is { path: string; page: NonNullable<ReturnType<typeof getPageByPath>> } => !!x.page);
  if (!items.length) return null;
  return (
    <section className="band band-cream seo-related" aria-labelledby="seo-related-h">
      <div className="wrap">
        <h2 id="seo-related-h">{heading}</h2>
        <ul className="seo-related-list">
          {items.map(({ path, page }) => (
            <li key={path}>
              <Link href={path}>{page.h1}</Link>
              <p>{page.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
