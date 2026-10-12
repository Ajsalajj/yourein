/**
 * The content a customer enters for their invitation, and how it is laid
 * over a design. Shared by the editor, the server and the public page.
 */
import { z } from "zod";
import type { InviteEvent, Live, RsvpSettings, Template, Wish } from "@/data/templates";

export const EVENT_TYPES = ["Wedding", "Engagement", "Nikah", "Reception", "Anniversary", "Birthday", "Baby Shower", "Housewarming", "Other"] as const;

export const TIME_ZONES: [string, string][] = [
  ["Asia/Kolkata", "India (IST)"],
  ["Asia/Dubai", "UAE (Gulf)"],
  ["Asia/Riyadh", "Saudi Arabia, Qatar, Kuwait"],
  ["Asia/Singapore", "Singapore, Malaysia"],
  ["Europe/London", "United Kingdom"],
  ["America/New_York", "US and Canada, Eastern"],
  ["America/Chicago", "US and Canada, Central"],
  ["America/Los_Angeles", "US and Canada, Pacific"],
  ["Australia/Sydney", "Australia, Sydney"],
];

/** Free text: trimmed and cut to length rather than rejected. */
const text = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.replace(/\s+$/g, "").replace(/^\s+/g, "").slice(0, max) : ""), z.string()).default("");
const dateStr = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).catch("").default("");
const timeStr = z.string().regex(/^(\d{2}:\d{2})?$/).catch("").default("");
const flag = (d: boolean) => z.boolean().catch(d).default(d);
const mediaId = z.string().uuid();

const EventSchema = z.object({
  id: z.string().max(40),
  title: text(60),
  date: dateStr,
  time: timeStr,
  place: text(120),
  note: text(160),
  dressCode: text(80),
  /** Shown only to guests the host picks in the guest list. */
  private: flag(false),
});

const QuestionSchema = z.object({
  id: z.string().max(40),
  label: text(80),
  kind: z.enum(["text", "yesno", "choice"]).catch("text"),
  options: z.array(z.string().trim().min(1).max(40)).max(6).catch([]).default([]),
});

const RsvpSchema = z.object({
  enabled: flag(true),
  deadline: dateStr,
  allowMaybe: flag(true),
  askPhone: flag(true),
  askMeal: flag(false),
  mealOptions: z.array(z.string().trim().min(1).max(30)).max(6).catch(["Vegetarian", "Non-vegetarian"]).default(["Vegetarian", "Non-vegetarian"]),
  askMessage: flag(true),
  maxPerInvite: z.number().int().min(1).max(20).catch(4).default(4),
  capacity: z.number().int().min(1).max(100000).nullable().catch(null).default(null),
  hardCapacity: flag(false),
  perEvent: flag(false),
  questions: z.array(QuestionSchema).max(6).catch([]).default([]),
});

export const InviteDataSchema = z.object({
  eventType: z.enum(EVENT_TYPES).catch("Wedding").default("Wedding"),
  /** Used when the event type is "Other". */
  eventTitle: text(40),
  name1: text(40),
  name2: text(40),
  hosts: text(200),
  date: dateStr,
  time: timeStr,
  tz: z.string().max(60).catch("Asia/Kolkata").default("Asia/Kolkata"),
  venueName: text(100),
  venueAddress: text(200),
  mapsUrl: z.string().trim().max(600).regex(/^(https?:\/\/\S+)?$/i).catch("").default(""),
  welcome: text(160),
  inviteText: text(200),
  story: text(600),
  closing: text(200),
  portrait: mediaId.nullable().catch(null).default(null),
  gallery: z.array(mediaId).max(8).catch([]).default([]),
  music: mediaId.nullable().catch(null).default(null),
  events: z.array(EventSchema).max(8).catch([]).default([]),
  countdown: flag(true),
  contacts: z.array(z.object({ name: text(60), phone: text(24) })).max(2).catch([]).default([]),
  rsvp: RsvpSchema.default(RsvpSchema.parse({})),
  allowShare: flag(true),
  /** Guests can leave wishes on the invitation. Off unless set, so invitations made before it existed do not change. */
  guestbook: flag(false),
});

export type InviteData = z.infer<typeof InviteDataSchema>;
export type InviteEventInput = InviteData["events"][number];

export const MAX_GALLERY = 8;

const REQUEST_LINE: Record<string, string> = {
  Wedding: "request the pleasure of your company at the wedding of",
  Engagement: "joyfully invite you to the engagement of",
  Nikah: "request the honour of your presence at the Nikah of",
  Reception: "invite you to the wedding reception of",
  Anniversary: "invite you to celebrate the anniversary of",
  Birthday: "invite you to celebrate the birthday of",
  "Baby Shower": "invite you to a baby shower for",
  Housewarming: "invite you to the housewarming of",
  Other: "invite you to celebrate with",
};
export const requestLineFor = (eventType: string) => REQUEST_LINE[eventType] || REQUEST_LINE.Other;

/** A fresh invitation, with wording that suits the design it starts from. */
export function defaultData(t: Template, tz = "Asia/Kolkata"): InviteData {
  const eventType = t.filters.includes("Wedding") ? "Wedding" : t.filters.includes("Nikah") ? "Nikah" : "Engagement";
  return InviteDataSchema.parse({
    eventType,
    hosts: "Together with their families",
    tz,
    welcome: t.invocation || "",
    inviteText: requestLineFor(eventType),
    closing: "We cannot wait to celebrate with you.",
    guestbook: true,
  });
}

export const eventTitleOf = (d: Pick<InviteData, "eventType" | "eventTitle">) => (d.eventType === "Other" ? d.eventTitle || "Celebration" : d.eventType);

/** "Aarav & Meera", or one name when there is one host. */
export const namesOf = (d: Pick<InviteData, "name1" | "name2">) => [d.name1, d.name2].filter(Boolean).join(" & ");

/** What still has to be filled in before an invitation can be paid for and published. */
export function missingFields(d: InviteData): string[] {
  const m: string[] = [];
  if (!d.name1) m.push("A name");
  if (!d.date) m.push("The date");
  if (!d.time) m.push("The time");
  if (!d.venueName) m.push("The venue");
  return m;
}

/* ------------------------------------------------------------------ dates */

function wallClock(ms: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

/** The instant a wall-clock date and time happens in a time zone, as an ISO string. */
export function zonedIso(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess;
  try {
    utc = guess - (wallClock(guess, tz) - guess);
    utc = guess - (wallClock(utc, tz) - utc);
  } catch {
    /* unknown zone: treat the time as UTC */
  }
  return new Date(utc).toISOString();
}

const utcDate = (date: string) => new Date(`${date}T12:00:00Z`);
export const formatDate = (date: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) =>
  date ? new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(utcDate(date)) : "";
export function formatTime(time: string) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
export function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/* -------------------------------------------------------------- rendering */

export type ResolveOptions = {
  mode: Live["mode"];
  mediaUrl: (id: string) => string;
  invitation?: string;
  shareUrl?: string;
  guest?: Live["guest"];
  /** Total people already confirmed, for the capacity limit. */
  attending?: number;
  /** Wishes guests have left, newest first. Hidden ones are never passed in. */
  wishes?: Wish[];
  /** Private events this viewer may see. Public pages show only public events plus these; the host's preview shows all. */
  privateEvents?: string[];
};

/** The events a viewer may see: every public one, and private ones they have been given. `null` means all (the host). */
export function visibleEvents(d: Pick<InviteData, "events">, privateEvents: string[] | null) {
  return d.events.filter((e) => e.title && (!e.private || privateEvents === null || privateEvents.includes(e.id)));
}

/** Whether replies are taken per function for this viewer. */
export const repliesPerEvent = (d: InviteData, privateEvents: string[] | null) => d.rsvp.perEvent && visibleEvents(d, privateEvents).length > 1;

/**
 * Lays a customer's content over a design, producing exactly what the
 * invitation engine renders. In the editor, empty fields fall back to the
 * design's sample content so the preview never looks broken.
 */
export function resolveTemplate(base: Template, d: InviteData, o: ResolveOptions): Template {
  const preview = o.mode === "preview";
  const hasNames = !!d.name1;
  const couple: [string, string] = hasNames ? [d.name1, d.name2] : base.couple;
  const date = d.date || (preview ? base.date.slice(0, 10) : "");
  const time = d.time || (preview && !d.date ? "18:30" : "");
  const title = eventTitleOf(d);
  const venueName = d.venueName || (preview ? base.venue.name : "");

  const allowed = o.mode === "preview" ? null : o.privateEvents ?? [];
  let events: InviteEvent[] = visibleEvents(d, allowed)
    .map((e) => ({
      id: e.id,
      title: e.title,
      day: formatDate(e.date || date, { weekday: "long", day: "numeric", month: "long" }),
      time: formatTime(e.time),
      place: e.place || venueName,
      note: e.note || undefined,
      dressCode: e.dressCode || undefined,
    }));
  if (!events.length) {
    events = [{ title, day: formatDate(date, { weekday: "long", day: "numeric", month: "long" }), time: formatTime(time), place: venueName }];
  }

  const rsvp: RsvpSettings | null = d.rsvp.enabled ? d.rsvp : null;
  const closed = !!rsvp?.deadline && todayIn(d.tz) > rsvp.deadline;
  const full = !!rsvp?.capacity && rsvp.hardCapacity && (o.attending ?? 0) >= rsvp.capacity;

  return {
    ...base,
    couple,
    date: date ? zonedIso(date, time, d.tz) : base.date,
    dateLabel: formatDate(date),
    tz: d.tz,
    invocation: d.welcome || undefined,
    hosts: d.hosts,
    request: d.inviteText,
    story: d.story,
    closing: d.closing,
    events,
    venue: { name: venueName, address: d.venueAddress || (preview && !d.venueName ? base.venue.address : ""), city: preview && !d.venueName ? base.venue.city : "" },
    live: {
      mode: o.mode,
      eventTitle: title,
      portrait: d.portrait ? o.mediaUrl(d.portrait) : undefined,
      gallery: d.gallery.map(o.mediaUrl),
      music: d.music ? o.mediaUrl(d.music) : undefined,
      mapsUrl: d.mapsUrl || undefined,
      countdown: d.countdown,
      contacts: d.contacts.filter((c) => c.name || c.phone),
      allowShare: d.allowShare,
      rsvp: rsvp ? { ...rsvp, perEvent: repliesPerEvent(d, allowed), closed, full } : null,
      guestbook: d.guestbook ? { wishes: o.wishes ?? [] } : null,
      invitation: o.invitation,
      shareUrl: o.shareUrl,
      guest: o.guest,
    },
  };
}

export const mediaUrl = (id: string) => `/api/media/${id}`;

export function slugify(s: string, fallback = "invitation"): string {
  const out = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return out || fallback;
}
