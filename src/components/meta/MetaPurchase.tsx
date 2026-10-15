"use client";

import { useEffect } from "react";
import { trackServerEvent } from "@/lib/meta-pixel";

/**
 * The browser half of a verified Purchase. The success page renders this only once per order (the server claims it
 * atomically), with the event_id and amount the server queued for the Conversions API, so Meta counts one purchase.
 */
export function MetaPurchase({ eventId, value, currency, contentIds, contentName }: { eventId: string; value: number; currency: string; contentIds: string[]; contentName?: string }) {
  useEffect(() => {
    trackServerEvent("Purchase", eventId, { value, currency, content_ids: contentIds, content_type: "product", num_items: 1, ...(contentName ? { content_name: contentName } : {}) });
  }, [eventId, value, currency, contentIds, contentName]);
  return null;
}
