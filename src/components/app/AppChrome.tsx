"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

const ITEMS: { href: string; label: string; match: (p: string) => boolean; icon: React.ReactNode }[] = [
  { href: "/dashboard", label: "Home", match: (p) => p === "/dashboard", icon: <path d="M4 11l8-7 8 7v8.5a.5.5 0 0 1-.5.5H14v-6h-4v6H4.500a.5.5 0 0 1-.5-.5Z" /> },
  { href: "/invites", label: "Invites", match: (p) => p.startsWith("/invites") && !/\/(guests|rsvps)$/.test(p), icon: <><rect x="4" y="5" width="16" height="14" rx="1.5" /><path d="M4.5 6.500l7.5 6 7.5-6" /></> },
  { href: "/guests", label: "Guests", match: (p) => p === "/guests" || /\/(guests|rsvps)$/.test(p), icon: <><circle cx="9" cy="9" r="3.2" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 6.200a3 3 0 0 1 0 5.600M17.5 14.400c1.9.7 3.1 2.3 3.5 4.6" /></> },
  { href: "/account", label: "Account", match: (p) => p === "/account", icon: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.7-3.7 3.5-6 7-6s6.3 2.3 7 6" /></> },
];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app">
      <header className="app-top">
        <Link href="/dashboard" className="logo" aria-label="YoureIn, home"><Logo alt="" /></Link>
        <nav className="app-top-nav" aria-label="Sections">
          {ITEMS.map((it) => <Link key={it.href} href={it.href} aria-current={it.match(pathname) ? "page" : undefined}>{it.label}</Link>)}
        </nav>
      </header>
      {children}
      <nav className="tabbar" aria-label="Sections">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} aria-current={it.match(pathname) ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{it.icon}</svg>
            {it.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
