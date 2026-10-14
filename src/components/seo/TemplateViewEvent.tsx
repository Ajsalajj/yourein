"use client";

import { useEffect } from "react";
import { track } from "@/seo/analytics";

/** Fires template_view once when a design page is opened. Sends the design's slug only. */
export function TemplateViewEvent({ slug }: { slug: string }) {
  useEffect(() => track("template_view", { template: slug }), [slug]);
  return null;
}
