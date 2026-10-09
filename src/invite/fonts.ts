/* Invitation typefaces. Imported only by the invitation chunk, so the catalog never pays for them. */
import "@fontsource/pinyon-script/latin-400.css";
import "@fontsource/allura/latin-400.css";
import "@fontsource/cinzel/latin-400.css";
import "@fontsource/cinzel/latin-500.css";
import "@fontsource-variable/cormorant-garamond/wght.css";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";

import type React from "react";
import type { Theme } from "@/data/templates";

const SCRIPT = { pinyon: "'Pinyon Script', 'Snell Roundhand', cursive", allura: "'Allura', 'Snell Roundhand', cursive" };
const CAPS = { cinzel: "'Cinzel', 'Cormorant Garamond Variable', serif", cormorant: "'Cormorant Garamond Variable', Georgia, serif" };

/** Theme colours and typefaces as CSS variables on the invitation root. */
export function themeVars(th: Theme): React.CSSProperties {
  return {
    "--bg": th.bg,
    "--bg-alt": th.bgAlt,
    "--ink": th.ink,
    "--soft": th.soft,
    "--accent": th.accent,
    "--tint": th.tint,
    "--hero-ink": th.heroInk,
    "--f-script": SCRIPT[th.script],
    "--f-caps": CAPS[th.caps],
    "--caps-track": th.caps === "cinzel" ? "0.2em" : "0.3em",
    "--caps-weight": th.caps === "cinzel" ? 400 : 500,
    "--script-scale": th.script === "pinyon" ? 0.92 : 1,
  } as React.CSSProperties;
}
