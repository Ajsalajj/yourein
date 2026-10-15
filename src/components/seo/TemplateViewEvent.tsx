"use client";

import { useEffect } from "react";
import { track } from "@/seo/analytics";
import { trackDesignEvent } from "@/lib/meta-pixel";

/** Fires template_view (and Meta ViewContent) once when a design page is opened. Sends the design's public details only. */
export function TemplateViewEvent({ slug, name, category }: { slug: string; name?: string; category?: string }) {
  useEffect(() => {
    track("template_view", { template: slug });
    trackDesignEvent("ViewContent", { slug, name, category });
  }, [slug, name, category]);
  return null;
}
