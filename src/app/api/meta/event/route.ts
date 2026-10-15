import { BROWSER_RELAYED_EVENTS, isEventId } from "@/config/meta";
import { getTemplate } from "@/data/templates";
import { body, clientIp, ok, rateLimit, route } from "@/server/http";
import { currentVisit, relayEvent } from "@/server/meta/events";

const ALLOWED: ReadonlySet<string> = new Set(BROWSER_RELAYED_EVENTS);

/**
 * Forwards a browsing event the Pixel just fired to the Conversions API with the same event_id, so Meta can
 * deduplicate the pair. Only design-browsing events are accepted, only for real designs, and only with ads consent:
 * this route can never report a registration, a checkout or a purchase.
 */
export const POST = route(async (req) => {
  rateLimit(`meta:${clientIp(req)}`, 60, 10 * 60_000);
  const b = await body(req);
  const name = String(b.event ?? "");
  const template = getTemplate(String(b.template ?? ""));
  if (!ALLOWED.has(name) || !isEventId(b.eventId) || !template) return ok({ sent: false });
  const sent = relayEvent(name, b.eventId, template.slug, typeof b.url === "string" ? b.url : null, await currentVisit());
  return ok({ sent });
});
