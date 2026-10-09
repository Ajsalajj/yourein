import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTemplate } from "@/data/templates";
import { PublicInvitation } from "@/components/app/PublicInvitation";
import { eventTitleOf, formatDate, mediaUrl, namesOf, resolveTemplate } from "@/lib/invite";
import { guestBySlug } from "@/server/guests";
import { attendingCount, getPublished } from "@/server/invitations";
import { siteOrigin } from "@/server/origin";
import "./public.css";

const SLUG = /^[a-z0-9-]{1,80}$/;

export async function invitationMetadata(slug: string): Promise<Metadata> {
  const inv = SLUG.test(slug) ? await getPublished(slug) : null;
  if (!inv || inv.status !== "published") return { title: "Invitation", robots: { index: false, follow: false } };
  const names = namesOf(inv.data);
  const title = `${names}: ${eventTitleOf(inv.data)} invitation`;
  const description = [formatDate(inv.data.date), inv.data.venueName].filter(Boolean).join(" at ");
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, images: [{ url: `/thumbs/${inv.templateSlug}.webp`, width: 780, height: 1688 }] },
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
        <p className="logo">YoureIn</p>
        <h1>This invitation is no longer available.</h1>
        <p>The hosts have taken it down. If you think this is a mistake, please get in touch with them directly.</p>
      </main>
    );
  }
  const base = getTemplate(inv.templateSlug);
  if (!base) notFound();

  const guest = guestSlug && SLUG.test(guestSlug) ? await guestBySlug(inv.id, guestSlug) : null;
  if (guestSlug && !guest) redirect(`/i/${slug}`);

  const origin = await siteOrigin();
  const t = resolveTemplate(base, inv.data, {
    mode: "public",
    mediaUrl,
    invitation: slug,
    shareUrl: `${origin}/i/${slug}`,
    attending: await attendingCount(inv.id),
    guest: guest ? { slug: guest.slug, name: guest.name, max: guest.max, note: guest.note, replied: guest.reply ?? undefined } : undefined,
  });
  return <PublicInvitation t={t} />;
}
