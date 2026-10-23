"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { captureAttribution, track } from "@/seo/analytics";
import { trackDesignEvent } from "@/lib/meta-pixel";

const PreviewOverlay = dynamic(() => import("@/components/preview/PreviewOverlay"), { ssr: false });

export function TryClient({ slug: initial }: { slug: string }) {
  const [slug, setSlug] = useState(initial);

  /* an ad visit usually starts here, so keep its campaign tags for checkout (the site layout does this elsewhere) */
  useEffect(() => { captureAttribution(); }, []);

  useEffect(() => {
    track("template_preview", { template: slug });
    trackDesignEvent("TemplatePreview", { slug });
  }, [slug]);

  /* switching designs updates the address (keeping the campaign tags) without a new page view */
  const pick = useCallback((next: string) => {
    setSlug(next);
    window.history.replaceState(null, "", `/try/${next}${window.location.search}`);
  }, []);

  return (
    <div className="pv-landing">
      {/* "Her" (JVKE) plays as soon as the invitation is opened */}
      <PreviewOverlay slug={slug} landing music="her" onPick={pick} onClose={() => window.location.assign("/create")} />
    </div>
  );
}
