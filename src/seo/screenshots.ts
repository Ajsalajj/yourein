import type { FeatureId } from "./types";

export type Screenshot = { src: string; alt: string; caption: string; width: number; height: number };

const shot = (file: string, width: number, height: number, alt: string, caption: string): Screenshot => ({ src: `/features/${file}.webp`, width, height, alt, caption });

const REPLY = shot("rsvp-reply-form", 560, 1212, "YoureIn invitation reply form asking how many guests are coming to each of three functions: Mehendi, Wedding ceremony and Reception dinner", "What a guest sees: a count for each function.");
const REPLIES = shot("rsvp-host-dashboard", 560, 1212, "YoureIn host dashboard showing total people attending, responses, confirmed, maybe and declined counts, with search and Export CSV", "What the host sees: totals, and an export for planners.");
const GUESTS = shot("guest-list-tracking", 560, 1212, "YoureIn guest list with a general link, a personal link for each family, reply status and WhatsApp, Copy link and QR code buttons", "The guest list: a personal link, reply status and a QR code for each family.");

/**
 * Real screenshots of the product (demo data only), captured by scripts/seo/capture-screens.mjs and stored in public/features/.
 * Photo gallery has none yet, so its page shows none rather than a stand-in.
 */
export const FEATURE_SCREENSHOTS: Partial<Record<FeatureId, Screenshot[]>> = {
  rsvp: [REPLY, REPLIES],
  "guest-tracking": [GUESTS, REPLIES],
  "personal-links": [GUESTS],
  "qr-code": [shot("share-invitation-qr-code", 560, 1212, "YoureIn share screen with the invitation link and WhatsApp, Messages, Email and QR code buttons", "Share by WhatsApp, message, email or QR code.")],
  music: [shot("music-picker", 560, 1100, "YoureIn editor music picker with a library of tracks grouped by mood, recommended tracks first, and an option to upload your own", "The music picker: recommended tracks first, or upload your own.")],
  countdown: [shot("invitation-countdown", 560, 1212, "A YoureIn invitation showing a live countdown in days, hours, minutes and seconds to the wedding date", "The live countdown on an invitation.")],
  "multiple-events": [shot("invitation-events", 560, 1212, "A YoureIn invitation listing three celebrations with their dates, times, venues and dress codes", "Each function with its own time, place and dress code.")],
};
