import Link from "next/link";
import { breadcrumbLd } from "@/seo/jsonld";
import type { Link as Crumb } from "@/seo/types";
import { JsonLd } from "./JsonLd";

/** Visible trail plus BreadcrumbList data. The last item is the current page and is not a link. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  if (!trail.length) return null;
  return (
    <>
      <JsonLd data={breadcrumbLd(trail)} />
      <nav className="crumbs seo-crumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          {trail.map((c, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={c.href}>
                <span aria-hidden="true">/</span>
                {last ? <span aria-current="page">{c.label}</span> : <Link href={c.href}>{c.label}</Link>}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
