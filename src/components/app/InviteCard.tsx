import Image from "next/image";
import { getTemplate } from "@/data/templates";
import { PRICE_LABEL } from "@/config/site";
import { formatDate } from "@/lib/invite";
import type { InvitationSummary } from "@/server/invitations";

export const STATUS_LABEL = { draft: "Draft", ready: "Ready to pay", published: "Published", archived: "Archived" } as const;

export function StatusPill({ status }: { status: keyof typeof STATUS_LABEL }) {
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function InviteCard({ inv }: { inv: InvitationSummary }) {
  const t = getTemplate(inv.templateSlug);
  const live = inv.status === "published" || inv.status === "archived";
  const meta = [inv.eventType, inv.eventDate ? formatDate(inv.eventDate, { day: "numeric", month: "short", year: "numeric" }) : "No date yet"].filter(Boolean).join(" • ");
  return (
    <article className="invite-card">
      <span className="invite-thumb"><Image src={`/thumbs/${inv.templateSlug}.webp`} alt="" width={780} height={1688} sizes="62px" /></span>
      <div className="invite-body">
        <h2 className="invite-title">{inv.title || "Untitled invitation"}</h2>
        <p className="invite-meta">{meta}</p>
        <p><StatusPill status={inv.status} /></p>
        {live ? (
          <p className="invite-nums">
            <span><b>{inv.responses}</b> {inv.responses === 1 ? "RSVP" : "RSVPs"}</span>
            <span><b>{inv.attending}</b> attending</span>
            <span><b>{inv.views}</b> {inv.views === 1 ? "view" : "views"}</span>
          </p>
        ) : (
          <p className="invite-meta">{t?.name}</p>
        )}
      </div>
      <div className="invite-actions">
        {live ? (
          <>
            <a className="btn btn-solid btn-sm invite-main" href={`/invites/${inv.id}`}>Manage</a>
            <a className="btn btn-quiet btn-sm" href={`/edit/${inv.id}`}>Edit</a>
            <a className="btn btn-quiet btn-sm" href={`/edit/${inv.id}?step=review&preview=1`}>Preview</a>
            <a className="btn btn-quiet btn-sm" href={`/invites/${inv.id}#share`}>Share</a>
            <a className="btn btn-quiet btn-sm" href={`/invites/${inv.id}/rsvps`}>RSVPs</a>
          </>
        ) : (
          <>
            <a className="btn btn-solid btn-sm" href={inv.status === "ready" ? `/pay/${inv.id}` : `/edit/${inv.id}`}>{inv.status === "ready" ? `Pay ${PRICE_LABEL} & Publish` : "Continue editing"}</a>
            {inv.status === "ready" && <a className="btn btn-quiet btn-sm" href={`/edit/${inv.id}`}>Edit</a>}
            <a className="btn btn-quiet btn-sm" href={`/edit/${inv.id}?step=review&preview=1`}>Preview</a>
          </>
        )}
      </div>
    </article>
  );
}
