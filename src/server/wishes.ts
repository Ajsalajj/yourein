import { randomUUID } from "node:crypto";
import type { Wish } from "@/data/templates";
import { sql } from "./db";
import { activeGuestBySlug } from "./guests";
import { ApiError } from "./http";
import { sniff, type Invitation } from "./invitations";

/** A wish as the host sees it, including ones they have hidden. */
export type HostWish = Wish & { hidden: boolean; guestId: string | null };

type WishRow = { id: string; guest_id: string | null; name: string; message: string; hidden: boolean; photo_id: string | null; created_at: Date };

const photoUrl = (r: WishRow) => (r.photo_id ? { photo: `/api/media/${r.photo_id}` } : {});
const toHostWish = (r: WishRow): HostWish => ({ id: r.id, guestId: r.guest_id, name: r.name, message: r.message, hidden: r.hidden, createdAt: r.created_at.toISOString(), ...photoUrl(r) });

const PHOTO_MAX = 3_500_000;
const PHOTOS_PER_INVITATION = 300;

/** What guests see: visible wishes only, newest first, without anything that identifies a guest record. */
export async function listPublicWishes(invitationId: string): Promise<Wish[]> {
  const rows = await sql<WishRow>`select * from wishes where invitation_id = ${invitationId} and not hidden order by created_at desc limit 200`;
  return rows.map((r) => ({ id: r.id, name: r.name, message: r.message, createdAt: r.created_at.toISOString(), ...photoUrl(r) }));
}

export async function listWishes(invitationId: string): Promise<HostWish[]> {
  return (await sql<WishRow>`select * from wishes where invitation_id = ${invitationId} order by created_at desc`).map(toHostWish);
}

export type WishInput = { name?: unknown; message?: unknown };

/** Stores a guest's wish, with an optional photo. On a personal link the guest's name comes from the host's list. */
export async function addWish(inv: Invitation, guestSlug: string | null, input: WishInput, photo?: Uint8Array): Promise<Wish> {
  if (inv.status !== "published") throw new ApiError(410, "This invitation is no longer taking wishes.");
  if (!inv.data.guestbook) throw new ApiError(400, "The guestbook is not open for this invitation.");

  const guest = guestSlug ? await activeGuestBySlug(inv.id, guestSlug) : null;
  if (guestSlug && !guest) throw new ApiError(404, "This personal link is no longer valid. Ask the hosts for a new one.");

  const name = (guest?.name || String(input.name ?? "")).trim().slice(0, 60);
  if (!name) throw new ApiError(400, "Please add your name.");
  const message = String(input.message ?? "").trim().replace(/\n{3,}/g, "\n\n").slice(0, 500);
  if (!message) throw new ApiError(400, "Please write a wish.");

  const count = await sql<{ n: number }>`select count(*)::int as n from wishes where invitation_id = ${inv.id}`;
  if ((count[0]?.n ?? 0) >= 2000) throw new ApiError(400, "This guestbook is full.");

  let photoId: string | null = null;
  if (photo && photo.byteLength) {
    if (!inv.data.guestPhotos) throw new ApiError(400, "Photos are not being collected for this invitation.");
    if (photo.byteLength > PHOTO_MAX) throw new ApiError(413, "That photo is too large.");
    const mime = sniff(photo);
    if (!mime || !mime.startsWith("image/")) throw new ApiError(400, "Please choose a JPG, PNG or WebP photo.");
    const n = await sql<{ n: number }>`select count(*)::int as n from photos where invitation_id = ${inv.id} and kind = 'guest'`;
    if ((n[0]?.n ?? 0) >= PHOTOS_PER_INVITATION) throw new ApiError(400, "This guestbook has all the photos it can hold. Your wish can still be sent without one.");
    photoId = randomUUID();
    await sql`insert into photos (id, invitation_id, user_id, kind, mime, bytes, size) values (${photoId}, ${inv.id}, ${inv.userId}, 'guest', ${mime}, ${Buffer.from(photo)}, ${photo.byteLength})`;
  }

  const id = randomUUID();
  const rows = await sql<WishRow>`insert into wishes (id, invitation_id, guest_id, name, message, photo_id) values (${id}, ${inv.id}, ${guest?.id ?? null}, ${name}, ${message}, ${photoId}) returning *`;
  const r = rows[0];
  return { id: r.id, name: r.name, message: r.message, createdAt: r.created_at.toISOString(), ...photoUrl(r) };
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function setWishHidden(invitationId: string, wishId: string, hidden: boolean): Promise<HostWish> {
  if (!isUuid(wishId)) throw new ApiError(404, "That wish is no longer here.");
  const rows = await sql<WishRow>`update wishes set hidden = ${hidden} where id = ${wishId} and invitation_id = ${invitationId} returning *`;
  if (!rows[0]) throw new ApiError(404, "That wish is no longer here.");
  return toHostWish(rows[0]);
}

export async function removeWish(invitationId: string, wishId: string) {
  if (!isUuid(wishId)) return;
  const rows = await sql<{ photo_id: string | null }>`delete from wishes where id = ${wishId} and invitation_id = ${invitationId} returning photo_id`;
  if (rows[0]?.photo_id) await sql`delete from photos where id = ${rows[0].photo_id} and invitation_id = ${invitationId} and kind = 'guest'`;
}
