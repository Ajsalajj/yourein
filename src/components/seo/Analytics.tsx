"use client";

import Script from "next/script";
import { useEffect } from "react";
import { captureAttribution, track } from "@/seo/analytics";

/**
 * Remembers where a visit started (landing page and UTM tags) and, only if NEXT_PUBLIC_GA_MEASUREMENT_ID is set,
 * loads GA4 after the page is interactive. With no id, no third-party script is added at all.
 * Guest replies and invitation content are never sent: see src/seo/analytics.ts.
 */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  useEffect(() => {
    captureAttribution();
    /* "Customize" is a plain link, so one delegated listener sees every click on it. Only the design's slug is sent. */
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-customize]");
      if (el) track("template_customize", { template: el.getAttribute("data-customize") ?? "" });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  if (!id) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`}</Script>
    </>
  );
}
