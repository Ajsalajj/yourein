import type { ReactNode } from "react";

/**
 * "Customize" for a design. A plain link on purpose: it leads to /start/<design>,
 * which asks the visitor to sign in if needed and then opens the editor.
 */
export function CustomizeLink({ slug, className = "btn btn-solid", children = "Customize" }: { slug: string; className?: string; children?: ReactNode }) {
  return (
    <a className={className} href={`/start/${slug}`} rel="nofollow" data-customize={slug}>
      {children}
    </a>
  );
}

export function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
