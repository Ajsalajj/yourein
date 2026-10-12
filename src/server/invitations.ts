import { randomUUID } from "node:crypto";
import { getTemplate } from "@/data/templates";
import { InviteDataSchema, defaultData, eventTitleOf, missingFields, namesOf, slugify, type InviteData } from "@/lib/invite";
import { sql, transaction, type Sql } from "./db";
import { ApiError } from "./http";

export type Status = "draft" | "ready" | "published" | "archived";

export type Invitation = {
  id: string;
  userId: string;
  templateSlug: string;
  slug: string | null;
  status: Status;
  title: string;
  eventType: string;
  eventDate: string;
  data: InviteData;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

type Raw = {
  id: string; user_id: string; template_slug: string; slug: string | null; status: Status; title: string; event_type: string; event_date: string;
  data: unknown; views: number; created_at: Date; updated_at: Date; published_at: Date | null;
};

const fromRow = (r: Raw): Invitation => ({
  id: r.id,
  userId: r.user_id,
  templateSlug: r.template_slug,
  slug: r.slug,
  status: r.status,
  title: r.title,
  eventType: r.event_type,
  eventDate: r.event_date,
  data: InviteDataSchema.parse(typeof r.data === "string" ? JSON.parse(r.data) : r.data ?? {}),
  views: r.views,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  publishedAt: r.published_at,
});

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function createInvitation(userId: string, templateSlug: string, tz?: string): Promise<Invitation> {
  const t = getTemplate(templateSlug);
  if (!t) throw new ApiError(404, "That design does not exist.");
  const data = defaultData(t, tz);
  const id = randomUUID();
  await sql`insert into invitations (id, user_id, template_slug, event_type, data) values (${id}, ${userId}, ${t.slug}, ${eventTitleOf(data)}, ${JSON.stringify(data)}::jsonb)`;
  return getOwned(id, userId);
}

export async function getOwned(id: string, userId: string): Promise<Invitation> {
  if (!isUuid(id)) throw new ApiError(404, "We could not find that invitation.");
  const rows = await sql<Raw>`select * from invitations where id = ${id} and user_id = ${userId}`;
  if (!rows[0]) throw new ApiError(404, "We could not find that invitation.");
  return fromRow(rows[0]);
}

export type InvitationSummary = Invitation & { responses: number; confirmed: number; maybe: number; declined: number; attending: number; guests: number };

export async function listForUser(userId: string): Promise<InvitationSummary[]> {
  const rows = await sql<Raw & { responses: number; confirmed: number; maybe: number; declined: number; attending: number; guests: number }>`
    select i.*,
      (select count(*)::int from rsvps r where r.invitation_id = i.id) as responses,
      (select count(*)::int from rsvps r where r.invitation_id = i.id and r.response_status = 'yes') as confirmed,
      (select count(*)::int from rsvps r where r.invitation_id = i.id and r.response_status = 'maybe') as maybe,
      (select count(*)::int from rsvps r where r.invitation_id = i.id and r.response_status = 'no') as declined,
      (select coalesce(sum(r.attendee_count), 0)::int from rsvps r where r.invitation_id = i.id and r.response_status = 'yes') as attending,
      (select count(*)::int from guests g where g.invitation_id = i.id) as guests
    from invitations i where i.user_id = ${userId} order by i.updated_at desc`;
  return rows.map((r) => ({ ...fromRow(r), responses: r.responses, confirmed: r.confirmed, maybe: r.maybe, declined: r.declined, attending: r.attending, guests: r.guests }));
}

export type Patch = { data?: unknown; templateSlug?: string; markReady?: boolean; archived?: boolean };

export async function updateInvitation(id: string, userId: string, patch: Patch): Promise<Invitation> {
  const inv = await getOwned(id, userId);
  let { data, templateSlug, status } = inv;

  if (patch.templateSlug && patch.templateSlug !== templateSlug) {
    if (!getTemplate(patch.templateSlug)) throw new ApiError(404, "That design does not exist.");
    templateSlug = patch.templateSlug;
  }

  if (patch.data !== undefined) {
    const parsed = InviteDataSchema.safeParse(patch.data);
    if (!parsed.success) throw new ApiError(400, "Some details could not be saved. Please check them and try again.");
    data = parsed.data;
    /* only keep media that really belongs to this invitation */
    const owned = new Set((await sql<{ id: string }>`select id from photos where invitation_id = ${id} and kind <> 'guest'`).map((r) => r.id));
    data.portrait = data.portrait && owned.has(data.portrait) ? data.portrait : null;
    data.music = data.music && owned.has(data.music) ? data.music : null;
    data.gallery = data.gallery.filter((g) => owned.has(g));
  }

  const complete = missingFields(data).length === 0;
  if (status === "draft" && patch.markReady) {
    if (!complete) throw new ApiError(400, `Still needed: ${missingFields(data).join(", ").toLowerCase()}.`, "incomplete");
    status = "ready";
  }
  if (status === "ready" && !complete) status = "draft";
  if (patch.archived !== undefined && (status === "published" || status === "archived")) status = patch.archived ? "archived" : "published";

  await transaction(async (q) => {
    await q`update invitations set template_slug = ${templateSlug}, status = ${status}, title = ${namesOf(data)}, event_type = ${eventTitleOf(data)},
      event_date = ${data.date}, data = ${JSON.stringify(data)}::jsonb, updated_at = now() where id = ${id}`;
    if (patch.data !== undefined) {
      await q`delete from events where invitation_id = ${id}`;
      for (const [i, e] of data.events.entries()) {
        if (!e.title) continue;
        await q`insert into events (id, invitation_id, position, title, event_date, event_time, place, note)
          values (${randomUUID()}, ${id}, ${i}, ${e.title}, ${e.date}, ${e.time}, ${e.place}, ${e.note})`;
      }
      /* drop uploads that are no longer used; recent ones are left alone in case a save is still on its way */
      const used = [data.portrait, data.music, ...data.gallery].filter(Boolean) as string[];
      const stale = await q<{ id: string }>`select id from photos where invitation_id = ${id} and kind in ('portrait', 'gallery', 'music') and created_at < now() - interval '1 hour'`;
      for (const s of stale) if (!used.includes(s.id)) await q`delete from photos where id = ${s.id}`;
    }
  });
  return getOwned(id, userId);
}

export async function deleteInvitation(id: string, userId: string) {
  const inv = await getOwned(id, userId);
  if (inv.status === "published" || inv.status === "archived") throw new ApiError(400, "A published invitation cannot be deleted. Hide it instead.");
  await sql`delete from invitations where id = ${id}`;
}

/* ------------------------------------------------------------------ media */

const LIMITS = { portrait: 3_500_000, gallery: 3_500_000, music: 4_000_000 } as const;
export type MediaKind = keyof typeof LIMITS;

export function sniff(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "audio/mp4";
  return null;
}

export async function addMedia(id: string, userId: string, kind: MediaKind, bytes: Uint8Array): Promise<{ id: string; data: InviteData }> {
  const inv = await getOwned(id, userId);
  if (!(kind in LIMITS)) throw new ApiError(400, "Unknown upload type.");
  if (bytes.byteLength > LIMITS[kind]) throw new ApiError(413, kind === "music" ? "That audio file is too large. Use an MP3 under 4 MB." : "That photo is too large.");
  const mime = sniff(bytes);
  const wantAudio = kind === "music";
  if (!mime || mime.startsWith("audio/") !== wantAudio) throw new ApiError(400, wantAudio ? "Please choose an MP3 or M4A audio file." : "Please choose a JPG, PNG or WebP photo.");
  const data = inv.data;
  if (kind === "gallery" && data.gallery.length >= 8) throw new ApiError(400, "The gallery holds up to 8 photos. Remove one to add another.");

  const mediaId = randomUUID();
  await sql`insert into photos (id, invitation_id, user_id, kind, mime, bytes, size) values (${mediaId}, ${id}, ${userId}, ${kind}, ${mime}, ${Buffer.from(bytes)}, ${bytes.byteLength})`;
  if (kind === "portrait") data.portrait = mediaId;
  else if (kind === "music") data.music = mediaId;
  else data.gallery = [...data.gallery, mediaId];
  await sql`update invitations set data = ${JSON.stringify(data)}::jsonb, updated_at = now() where id = ${id}`;
  return { id: mediaId, data };
}

export async function getMedia(mediaId: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!isUuid(mediaId)) return null;
  const rows = await sql<{ mime: string; bytes: Uint8Array }>`select mime, bytes from photos where id = ${mediaId}`;
  return rows[0] ? { mime: rows[0].mime, bytes: Buffer.from(rows[0].bytes) } : null;
}

/* ----------------------------------------------------------------- public */

export async function getPublished(slug: string): Promise<Invitation | null> {
  const rows = await sql<Raw>`select * from invitations where slug = ${slug} and status in ('published', 'archived')`;
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function attendingCount(invitationId: string, exceptRsvp?: string): Promise<number> {
  const rows = await sql<{ n: number }>`
    select coalesce(sum(attendee_count), 0)::int as n from rsvps
    where invitation_id = ${invitationId} and response_status = 'yes' and (${exceptRsvp ?? null}::uuid is null or id <> ${exceptRsvp ?? null}::uuid)`;
  return rows[0]?.n ?? 0;
}

/** Marks an invitation as live and gives it its public address. Call only after payment is verified. */
export async function publishInvitation(q: Sql, invitationId: string): Promise<string> {
  const rows = await q<Raw>`select * from invitations where id = ${invitationId}`;
  if (!rows[0]) throw new ApiError(404, "We could not find that invitation.");
  const inv = fromRow(rows[0]);
  if (inv.slug && (inv.status === "published" || inv.status === "archived")) return inv.slug;
  const base = slugify(namesOf(inv.data));
  let slug = base;
  for (let n = 2; n < 500; n++) {
    const taken = await q<{ id: string }>`select id from invitations where slug = ${slug}`;
    if (!taken[0]) break;
    slug = `${base}-${n}`;
  }
  await q`update invitations set slug = ${slug}, status = 'published', published_at = now(), updated_at = now() where id = ${invitationId}`;
  return slug;
}

export async function recordView(invitationId: string, guestId: string | null, type: string) {
  await sql`insert into analytics (invitation_id, guest_id, type) values (${invitationId}, ${guestId}, ${type})`;
  if (type === "view") await sql`update invitations set views = views + 1 where id = ${invitationId}`;
}
