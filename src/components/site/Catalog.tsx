"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, TEMPLATES, templatesIn, type Category } from "@/data/templates";
import { TemplateCard } from "./TemplateCard";

type Pick = Category | "All";
const TABS: Pick[] = ["All", ...CATEGORIES];

export function Catalog({ heading = "All templates", intro }: { heading?: string; intro?: string }) {
  const [cat, setCat] = useState<Pick>("All");
  const tabs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("category");
    if (fromUrl && (TABS as string[]).includes(fromUrl)) setCat(fromUrl as Pick);
    const on = (e: Event) => setCat((e as CustomEvent<Pick>).detail);
    window.addEventListener("yourein:category", on);
    return () => window.removeEventListener("yourein:category", on);
  }, []);

  /* keep the chosen chip in view on phones */
  useEffect(() => {
    const row = tabs.current;
    const el = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && el) row.scrollTo({ left: el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [cat]);

  const choose = (c: Pick) => {
    setCat(c);
    const url = new URL(window.location.href);
    if (c === "All") url.searchParams.delete("category");
    else url.searchParams.set("category", c);
    window.history.replaceState(window.history.state, "", url);
  };

  const list = useMemo(() => templatesIn(cat), [cat]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((c) => [c, templatesIn(c).length])) as Record<Pick, number>, []);

  return (
    <section id="templates" className="band catalog" aria-labelledby="catalog-h">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="catalog-h">{heading}</h2>
          <p>{intro ?? `${TEMPLATES.length} designs. Tap one to try it, then make it yours.`}</p>
        </div>
        <div className="tabs" ref={tabs} role="group" aria-label="Filter by occasion">
          {TABS.map((c) => (
            <button key={c} type="button" className="tab" aria-pressed={cat === c} onClick={() => choose(c)}>
              {c}
              {counts[c] > 0 && <span className="tab-n">{counts[c]}</span>}
            </button>
          ))}
        </div>
        {list.length > 0 ? (
          <div className="grid" key={cat}>
            {list.map((t, i) => <TemplateCard key={t.slug} t={t} priority={i < 2} />)}
          </div>
        ) : (
          <div className="empty">
            <h3>Any design works for {cat === "Other" ? "your occasion" : `a ${cat.toLowerCase()}`}.</h3>
            <p>There is no design made only for this yet, but every design lets you choose the occasion and rewrite the wording when you customize it.</p>
            <button type="button" className="btn btn-solid" onClick={() => choose("All")}>See all designs</button>
          </div>
        )}
      </div>
    </section>
  );
}
