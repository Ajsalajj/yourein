import { createHash, randomBytes, randomUUID } from "node:crypto";
import { slugify, todayIn } from "@/lib/invite";
import { sql } from "./db";
import { ApiError } from "./http";
import { attendingCount, type Invitation } from "./invitations";

export type Guest = {
  id: string; slug: string; name: string; phone: string; email: string; group: string; invited: number; max: number | null; note: string;
  sentAt: Date | null; createdAt: Date;
  reply: { status: "yes" | "maybe" | "no"; count: number } | null;
};

type GuestRow = {
  id: string; slug: string; name: string; phone: string; email: string; group_name: string; invited_count: number; max_attendees: number | null; note: string;
  sent_at: Date | null; created_at: Date; response_status: "yes" | "maybe" | "no" | null; attendee_count: number | null;
};

const toGuest = (r: GuestRow): Guest => ({
  id: r.id, slug: r.slug, name: r.name, phone: r.phone, email: r.email, group: r.group_name, invited: r.invited_count, max: r.max_attendees, note: r.note,
  sentAt: r.sent_at, createdAt: r.created_at, reply: r.response_status ? { status: r.response_status, count: r.attendee_count ?? 0 } : null,
});

export async function listGuests(invitationId: string): Promise<Guest[]> {
  const rows = await sql<GuestRow>`
    select g.*, r.response_status, r.attendee_count from guests g left join rsvps r on r.guest_id = g.id
    where g.invitation_id = ${invitationId} order by g.created_at desc`;
  return rows.map(toGuest);
}

export type GuestInput = { name?: unknown; phone?: unknown; email?: unknown; group?: unknown; invited?: unknown; max?: unknown; note?: unknown; sent?: unknown };

function clean(input: GuestInput) {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) throw new ApiError(400, "Add the guest's name.");
  const invited = Math.min(50, Math.max(1, Math.round(Number(input.invited) || 1)));
  const maxRaw = input.max === null || input.max === "" || input.max === undefined ? null : Math.round(Number(input.max));
  const max = maxRaw === null || Number.isNaN(maxRaw) ? null : Math.min(50, Math.max(1, maxRaw));
  const email = String(input.email ?? "").trim().slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ApiError(400, "That email address does not look right.");
  return {
    name,
    phone: String(input.phone ?? "").replace(/[^\d+\s-]/g, "").trim().slice(0, 24),
    email,
    group: String(input.group ?? "").trim().slice(0, 60),
    invited,
    max,
    note: String(input.note ?? "").trim().slice(0, 200),
  };
}

export async function addGuest(invitationId: string, input: GuestInput): Promise<Guest> {
  const g = clean(input);
  const count = await sql<{ n: number }>`select count(*)::int as n from guests where invitation_id = ${invitationId}`;
  if ((count[0]?.n ?? 0) >= 2000) throw new ApiError(400, "This invitation has reached its guest list limit.");
  const base = slugify(g.name, "guest");
  let slug = base;
  for (let n = 2; n < 1000; n++) {
    const taken = await sql<{ id: string }>`select id from guests where invitation_id = ${invitationId} and slug = ${slug}`;
    if (!taken[0]) break;
    slug = `${base}-${n}`;
  }
  const id = randomUUID();
  await sql`insert into guests (id, invitation_id, slug, name, phone, email, group_name, invited_count, max_attendees, note)
    values (${id}, ${invitationId}, ${slug}, ${g.name}, ${g.phone}, ${g.email}, ${g.group}, ${g.invited}, ${g.max}, ${g.note})`;
  return (await listGuests(invitationId)).find((x) => x.id === id)!;
}

export async function updateGuest(invitationId: string, guestId: string, input: GuestInput): Promise<Guest> {
  const existing = await sql<{ id: string }>`select id from guests where id = ${guestId} and invitation_id = ${invitationId}`;
  if (!existing[0]) throw new ApiError(404, "That guest is no longer on the list.");
  if (input.sent !== undefined && input.name === undefined) {
    await sql`update guests set sent_at = ${input.sent ? new Date() : null} where id = ${guestId}`;
  } else {
    const g = clean(input);
    await sql`update guests set name = ${g.name}, phone = ${g.phone}, email = ${g.email}, group_name = ${g.group}, invited_count = ${g.invited}, max_attendees = ${g.max}, note = ${g.note} where id = ${guestId}`;
  }
  return (await listGuests(invitationId)).find((x) => x.id === guestId)!;
}

export async function removeGuest(invitationId: string, guestId: string) {
  await sql`delete from guests where id = ${guestId} and invitation_id = ${invitationId}`;
}

export async function guestBySlug(invitationId: string, slug: string) {
  const rows = await sql<GuestRow>`
    select g.*, r.response_status, r.attendee_count from guests g left join rsvps r on r.guest_id = g.id
    where g.invitation_id = ${invitationId} and g.slug = ${slug}`;
  return rows[0] ? toGuest(rows[0]) : null;
}

/* ------------------------------------------------------------------ rsvps */

export type Rsvp = {
  id: string; guestId: string | null; name: string; status: "yes" | "maybe" | "no"; count: number; phone: string; meal: string; message: string;
  createdAt: Date; updatedAt: Date;
};
type RsvpRow = {
  id: string; guest_id: string | null; guest_name: string; response_status: "yes" | "maybe" | "no"; attendee_count: number; phone: string; meal_preference: string;
  message: string; created_at: Date; updated_at: Date;
};
const toRsvp = (r: RsvpRow): Rsvp => ({
  id: r.id, guestId: r.guest_id, name: r.guest_name, status: r.response_status, count: r.attendee_count, phone: r.phone, meal: r.meal_preference, message: r.message,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function listRsvps(invitationId: string): Promise<Rsvp[]> {
  return (await sql<RsvpRow>`select * from rsvps where invitation_id = ${invitationId} order by updated_at desc`).map(toRsvp);
}

export async function removeRsvp(invitationId: string, rsvpId: string) {
  await sql`delete from rsvps where id = ${rsvpId} and invitation_id = ${invitationId}`;
}

export type Stats = {
  /** Entries on the guest list, and how many of them have been sent their link. */
  listed: number; sent: number;
  /** People invited across the guest list. */
  invited: number;
  responses: number; confirmed: number; maybe: number; declined: number;
  /** People coming: the sum of guest counts on "yes" replies. */
  attending: number;
  views: number;
};

export async function statsFor(invitationId: string): Promise<Stats> {
  const rows = await sql<Stats>`
    select
      (select count(*)::int from guests where invitation_id = ${invitationId}) as listed,
      (select count(*)::int from guests where invitation_id = ${invitationId} and sent_at is not null) as sent,
      (select coalesce(sum(invited_count), 0)::int from guests where invitation_id = ${invitationId}) as invited,
      (select count(*)::int from rsvps where invitation_id = ${invitationId}) as responses,
      (select count(*)::int from rsvps where invitation_id = ${invitationId} and response_status = 'yes') as confirmed,
      (select count(*)::int from rsvps where invitation_id = ${invitationId} and response_status = 'maybe') as maybe,
      (select count(*)::int from rsvps where invitation_id = ${invitationId} and response_status = 'no') as declined,
      (select coalesce(sum(attendee_count), 0)::int from rsvps where invitation_id = ${invitationId} and response_status = 'yes') as attending,
      (select views from invitations where id = ${invitationId}) as views`;
  return rows[0];
}

export type RsvpInput = { status?: unknown; name?: unknown; count?: unknown; phone?: unknown; meal?: unknown; message?: unknown; token?: unknown };

/**
 * Stores a guest's reply. A personalised link keeps one reply per guest; a
 * general link returns a private token so the same person can change their reply later.
 */
export async function submitRsvp(inv: Invitation, guestSlug: string | null, input: RsvpInput): Promise<{ token?: string; status: string; count: number }> {
  const settings = inv.data.rsvp;
  if (inv.status !== "published") throw new ApiError(410, "This invitation is no longer taking replies.");
  if (!settings.enabled) throw new ApiError(400, "Replies are not being collected for this invitation.");
  if (settings.deadline && todayIn(inv.data.tz) > settings.deadline) throw new ApiError(400, "The reply date has passed. Please contact the hosts directly.");

  const status = String(input.status ?? "");
  if (status !== "yes" && status !== "no" && !(status === "maybe" && settings.allowMaybe)) throw new ApiError(400, "Choose whether you are coming.");

  const guest = guestSlug ? await guestBySlug(inv.id, guestSlug) : null;
  if (guestSlug && !guest) throw new ApiError(404, "This personal link is no longer valid. Ask the hosts for a new one.");

  const name = (guest?.name || String(input.name ?? "")).trim().slice(0, 80);
  if (!name) throw new ApiError(400, "Please add your name.");

  const max = guest?.max ?? settings.maxPerInvite;
  let count = status === "no" ? 0 : Math.round(Number(input.count) || 1);
  if (status !== "no" && (count < 1 || count > max)) throw new ApiError(400, max === 1 ? "This invitation is for one guest." : `This invitation is for up to ${max} guests.`);
  if (status === "no") count = 0;

  const phone = settings.askPhone ? String(input.phone ?? "").replace(/[^\d+\s-]/g, "").trim().slice(0, 24) : "";
  const mealRaw = String(input.meal ?? "").trim().slice(0, 30);
  const meal = settings.askMeal && status !== "no" && settings.mealOptions.includes(mealRaw) ? mealRaw : "";
  const message = settings.askMessage ? String(input.message ?? "").trim().slice(0, 400) : "";

  /* find the reply this person already made, if any */
  let existing: string | undefined;
  const token = typeof input.token === "string" && input.token.length > 20 ? input.token : null;
  if (guest) existing = (await sql<{ id: string }>`select id from rsvps where guest_id = ${guest.id}`)[0]?.id;
  else if (token) existing = (await sql<{ id: string }>`select id from rsvps where invitation_id = ${inv.id} and edit_token_hash = ${hash(token)}`)[0]?.id;

  if (status === "yes" && settings.capacity && settings.hardCapacity) {
    const taken = await attendingCount(inv.id, existing);
    if (taken + count > settings.capacity) {
      const left = Math.max(0, settings.capacity - taken);
      throw new ApiError(409, left > 0 ? `Only ${left} ${left === 1 ? "place is" : "places are"} left. Please reduce your number of guests.` : "We are sorry, this event is now full.", "full");
    }
  }

  if (existing) {
    /* an empty phone on an update keeps the number they gave before */
    await sql`update rsvps set guest_name = ${name}, response_status = ${status}, attendee_count = ${count}, phone = case when ${phone} = '' then phone else ${phone} end,
      meal_preference = ${meal}, message = ${message}, updated_at = now() where id = ${existing}`;
    return { status, count };
  }
  const fresh = guest ? null : randomBytes(24).toString("base64url");
  await sql`insert into rsvps (id, invitation_id, guest_id, guest_name, response_status, attendee_count, phone, meal_preference, message, edit_token_hash)
    values (${randomUUID()}, ${inv.id}, ${guest?.id ?? null}, ${name}, ${status}, ${count}, ${phone}, ${meal}, ${message}, ${fresh ? hash(fresh) : null})`;
  return { token: fresh ?? undefined, status, count };
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/** CSV for spreadsheets. Cells that could be read as formulas are neutralised. */
export function rsvpsToCsv(rows: Rsvp[]): string {
  const cell = (v: string | number) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const label = { yes: "Confirmed", maybe: "Maybe", no: "Declined" } as const;
  const lines = [["Guest name", "Status", "Guest count", "Phone", "Meal", "Message", "Response date"].join(",")];
  for (const r of rows) lines.push([r.name, label[r.status], r.count, r.phone, r.meal, r.message, r.updatedAt.toISOString().slice(0, 16).replace("T", " ")].map(cell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
