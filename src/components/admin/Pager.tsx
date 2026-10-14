import Link from "next/link";
import { PAGE_SIZE } from "@/server/admin";

/** Previous / next links that keep the current filters. */
export function Pager({ base, params, page, total }: { base: string; params: Record<string, string | undefined>; page: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav className="adm-pager" aria-label="Pages">
      {page > 1 ? <Link href={href(page - 1)}>← Newer</Link> : <span />}
      <span>{total === 0 ? "No results" : `Page ${page} of ${pages} · ${total} total`}</span>
      {page < pages ? <Link href={href(page + 1)}>Older →</Link> : <span />}
    </nav>
  );
}
