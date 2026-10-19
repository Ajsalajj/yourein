import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTemplate } from "@/data/templates";
import { PublicInvitation } from "@/components/app/PublicInvitation";
import { eventTitleOf, formatDate, mediaUrl, namesOf, resolveTemplate } from "@/lib/invite";
import { guestBySlug } from "@/server/guests";
import { attendingCount, getPublished } from "@/server/invitations";
import { siteOrigin } from "@/server/origin";
import { listPublicWishes } from "@/server/wishes";
import "./public.css";
import { Logo } from "@/components/Logo";

const SLUG = /^[a-z0-9-]{1,80}$/;

export async function invitationMetadata(slug: string): Promise<Metadata> {
  const inv = SLUG.test(slug) ? await getPublished(slug) : null;
  if (!inv || inv.status !== "published") return { title: "Invitation", robots: { index: false, follow: true } };
  const names = namesOf(inv.data);
  const title = `${names}: ${eventTitleOf(inv.data)} invitation`;
  const description = [formatDate(inv.data.date), inv.data.venueName].filter(Boolean).join(" at ");
  const shareImage = `/og/invite/${inv.slug}?v=${new Date(inv.updatedAt).getTime().toString(36)}`;
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: true },
    /* the couple's own card (names, occasion, date), not the design's sample picture; the version changes with every edit */
    openGraph: { type: "website", title, description, images: [{ url: shareImage, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [shareImage] },
  };
}

/** Guests need no account: the link is the invitation. Only this invitation's content is sent, never other guests' replies. */
export async function InvitationPage({ slug, guestSlug }: { slug: string; guestSlug?: string }) {
  if (!SLUG.test(slug)) notFound();
  const inv = await getPublished(slug);
  if (!inv) notFound();
  if (inv.status === "archived") {
    return (
      <main className="pub-gone">
        <p className="logo"><Logo /></p>
        <h1>This invitation is no longer available.</h1>
        <p>The hosts have taken it down. If you think this is a mistake, please get in touch with them directly.</p>
      </main>
    );
  }
  const base = getTemplate(inv.templateSlug);
  if (!base) notFound();

  const guest = guestSlug && SLUG.test(guestSlug) ? await guestBySlug(inv.id, guestSlug) : null;
  if (guestSlug && !guest) redirect(`/i/${slug}`);
  if (guest?.disabled) {
    return (
      <main className="pub-gone">
        <p className="logo"><Logo /></p>
        <h1>This personal link has been turned off.</h1>
        <p>The hosts have switched off this link. If you think this is a mistake, please get in touch with them directly.</p>
      </main>
    );
  }

  const origin = await siteOrigin();
  const t = resolveTemplate(base, inv.data, {
    mode: "public",
    mediaUrl,
    invitation: slug,
    shareUrl: `${origin}/i/${slug}`,
    attending: await attendingCount(inv.id),
    wishes: inv.data.guestbook ? await listPublicWishes(inv.id) : undefined,
    privateEvents: guest?.privateEvents ?? [],
    guest: guest ? { slug: guest.slug, name: guest.name, max: guest.max, note: guest.note, replied: guest.reply ?? undefined } : undefined,
  });
  return <PublicInvitation t={t} />;
}
