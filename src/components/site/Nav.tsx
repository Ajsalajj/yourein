"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Category } from "@/data/templates";

const LINKS: Category[] = ["Wedding", "Engagement", "Nikah", "Birthday", "Baby Shower", "Other"];

/** Ask the catalog on the home page to show one category. */
export function pickCategory(c: Category | "All") {
  window.dispatchEvent(new CustomEvent("yourein:category", { detail: c }));
  document.getElementById("templates")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

/** True when the visitor has a session. Read from a non-secret hint cookie so public pages can stay static. */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(/(?:^|; )yi_in=1/.test(document.cookie)), []);
  return signedIn;
}

export function Nav() {
  const pathname = usePathname();
  const signedIn = useSignedIn();
  const [menu, setMenu] = useState(false);
  const [raised, setRaised] = useState(false);

  useEffect(() => {
    const on = () => setRaised(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setMenu(false), [pathname]);

  const onPick = (e: React.MouseEvent, c: Category) => {
    setMenu(false);
    if (pathname === "/") {
      e.preventDefault();
      pickCategory(c);
    }
  };

  return (
    <header className={`nav${raised ? " is-raised" : ""}`}>
      <div className="nav-in">
        <Link href="/" className="logo" aria-label="YoureIn, home">YoureIn</Link>
        <nav className="nav-links" aria-label="Invitation categories">
          {LINKS.map((c) => (
            <Link key={c} href={`/?category=${encodeURIComponent(c)}#templates`} onClick={(e) => onPick(e, c)}>{c}</Link>
          ))}
        </nav>
        <div className="nav-right">
          <a className="nav-account" href={signedIn ? "/dashboard" : "/signin"}>{signedIn ? "My invitations" : "Sign in"}</a>
          <button type="button" className="nav-menu" aria-expanded={menu} aria-controls="nav-sheet" onClick={() => setMenu((m) => !m)}>
            <span className="sr-only">{menu ? "Close categories" : "Browse categories"}</span>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {menu ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> : <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>
      {menu && (
        <nav id="nav-sheet" className="nav-sheet" aria-label="Invitation categories">
          {LINKS.map((c) => (
            <Link key={c} href={`/?category=${encodeURIComponent(c)}#templates`} onClick={(e) => onPick(e, c)}>{c}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
