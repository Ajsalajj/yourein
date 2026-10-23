"use client";

import React from "react";
import { AnimatePresence } from "motion/react";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { PRICE_LABEL } from "@/config/site";
import { CustomizeLink } from "@/components/site/Actions";
import { InvitationViewer } from "./InvitationViewer";

/**
 * Catalog preview: try the real design, then one clear next step.
 * `landing` is the standalone page ads link to (/try): phones get a "Next design" button and the call to action reads "Make it yours".
 */
export default function PreviewOverlay({ slug, onClose, onPick, landing = false }: { slug: string | null; onClose: () => void; onPick: (slug: string) => void; landing?: boolean }) {
  const t = slug ? getTemplate(slug) : undefined;
  const idx = t ? TEMPLATES.findIndex((x) => x.slug === t.slug) : 0;
  const prev = TEMPLATES[(idx - 1 + TEMPLATES.length) % TEMPLATES.length];
  const next = TEMPLATES[(idx + 1) % TEMPLATES.length];

  return (
    <AnimatePresence>
      {t && (
        <InvitationViewer
          key="pv"
          t={t}
          title={t.name}
          note={landing ? undefined : "Sample names"}
          topAction={landing ? <button type="button" className="pv-top-next" onClick={() => onPick(next.slug)}>Next design <span aria-hidden="true">→</span></button> : undefined}
          closeLabel={landing ? "See all designs" : undefined}
          onClose={onClose}
          footer={
            <div className="inv-order">
              <p>{landing ? "Like it? Add your names, dates and photos in a few minutes. Free to try, pay only when you publish." : "Like this design? Add your own names, dates and photographs."}</p>
              <CustomizeLink slug={t.slug} className="btn btn-solid btn-block">{landing ? "Make it yours" : "Customize this design"}</CustomizeLink>
            </div>
          }
          side={(phase, replay) => (
            <>
              <p className="pv-no">Design {t.no} of {TEMPLATES.length}</p>
              <h2 className="pv-name">{t.name}</h2>
              <p className="pv-cat">{t.category}</p>
              <p className="pv-how">{t.opening}</p>
              <p className="pv-hint">
                {phase === "sealed" ? "Tap the phone to open it, then scroll." : phase === "opening" ? "Opening…" : "Scroll inside the phone to read the whole invitation."}
              </p>
              {phase === "open" && <button type="button" className="pv-text-btn" onClick={replay}>Replay the opening</button>}
            </>
          )}
          step={
            <nav className="pv-step" aria-label="Other designs">
              <button type="button" onClick={() => onPick(prev.slug)}>
                <span aria-hidden="true">←</span><span className="pv-step-label">Previous<b>{prev.name}</b></span>
              </button>
              <button type="button" onClick={() => onPick(next.slug)}>
                <span className="pv-step-label">Next<b>{next.name}</b></span><span aria-hidden="true">→</span>
              </button>
            </nav>
          }
          bar={
            <>
              <div className="pv-bar-info">
                <strong>{t.name}</strong>
                <span>{PRICE_LABEL}, paid when you publish</span>
              </div>
              <div className="pv-bar-price"><b>{PRICE_LABEL}</b><span>when you publish</span></div>
              <CustomizeLink slug={t.slug}>{landing ? "Make it yours" : "Customize"}</CustomizeLink>
            </>
          }
        />
      )}
    </AnimatePresence>
  );
}
