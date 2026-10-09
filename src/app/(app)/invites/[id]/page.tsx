import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getTemplate } from "@/data/templates";
import { PRICE_LABEL } from "@/config/site";
import { StatusPill } from "@/components/app/InviteCard";
import { InviteSubnav, VisibilityControls } from "@/components/app/ManageParts";
import { LinkBox, ShareButtons } from "@/components/app/ShareTools";
import { formatDate, namesOf } from "@/lib/invite";
import { requireUserPage } from "@/server/auth";
import { statsFor } from "@/server/guests";
import { ApiError } from "@/server/http";
import { getOwned } from "@/server/invitations";
import { siteOrigin } from "@/server/origin";

export const metadata: Metadata = { title: "Manage invitation" };

export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/invites/${id}`);
  const inv = await getOwned(id, user.id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  const t = getTemplate(inv.templateSlug);
  const live = inv.status === "published" || inv.status === "archived";
  const stats = await statsFor(inv.id);
  const names = namesOf(inv.data) || "Untitled invitation";
  const dateLabel = formatDate(inv.data.date);
  const url = inv.slug ? `${await siteOrigin()}/i/${inv.slug}` : "";
  const qr = url ? await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#26231f", light: "#0000" } }) : "";
  const qrPng = url ? await QRCode.toDataURL(url, { width: 720, margin: 2 }) : "";
  const capacity = inv.data.rsvp.capacity;

  return (
    <main className="app-main">
      <a className="back-link" href="/invites">← All invitations</a>
      <div className="page-head">
        <div>
          <h1 className="page-h">{names}</h1>
          <p className="page-sub">{[inv.eventType, dateLabel, t?.name].filter(Boolean).join(" • ")}</p>
          <p style={{ marginTop: 10 }}><StatusPill status={inv.status} /></p>
        </div>
      </div>
      <InviteSubnav id={inv.id} current="overview" />

      {!live && (
        <div className="sheet">
          <p><b>{inv.status === "ready" ? "Ready to publish." : "This invitation is a draft."}</b></p>
          <p className="hint" style={{ margin: "4px 0 14px" }}>{inv.status === "ready" ? `Pay ${PRICE_LABEL} once and your link is live straight away.` : "Finish your details, then pay to publish. Guests cannot see it yet."}</p>
          <div className="chips">
            <a className="btn btn-solid" href={inv.status === "ready" ? `/pay/${inv.id}` : `/edit/${inv.id}`}>{inv.status === "ready" ? `Pay ${PRICE_LABEL} & Publish` : "Continue editing"}</a>
            {inv.status === "ready" && <a className="btn btn-quiet" href={`/edit/${inv.id}`}>Edit</a>}
          </div>
        </div>
      )}

      {live && (
        <>
          <section className="sheet" id="share" aria-labelledby="share-h">
            <h2 className="section-h" id="share-h" style={{ marginTop: 0 }}>Share your invitation</h2>
            {inv.status === "archived" && <p className="notice" style={{ marginBottom: 12 }}>This invitation is hidden, so the link shows a “no longer available” note.</p>}
            <LinkBox url={url} />
            <ShareButtons url={url} names={names} dateLabel={dateLabel} primary />
            <p className="hint" style={{ marginTop: 12 }}>Want each family to see their own name and guest limit? <a className="text-link" href={`/invites/${inv.id}/guests`}>Add them to your guest list</a> for personal links.</p>
          </section>

          <h2 className="section-h">At a glance</h2>
          <div className="tiles">
            <div className="tile tile-main">
              <b>{stats.attending}</b>
              <span>Total attending</span>
              {capacity ? (
                <>
                  <div className="meter" role="img" aria-label={`${stats.attending} of ${capacity} places taken`}><i style={{ width: `${Math.min(100, (stats.attending / capacity) * 100)}%` }} /></div>
                  <span>{stats.attending} / {capacity} confirmed attendees</span>
                </>
              ) : null}
            </div>
            <div className="tile"><b>{stats.confirmed}</b><span>Confirmed replies</span></div>
            <div className="tile"><b>{stats.maybe}</b><span>Maybe</span></div>
            <div className="tile"><b>{stats.declined}</b><span>Declined</span></div>
            <div className="tile"><b>{stats.views}</b><span>Views</span></div>
          </div>
          <div className="chips" style={{ marginTop: 14 }}>
            <a className="btn btn-solid" href={`/invites/${inv.id}/rsvps`}>View RSVPs</a>
            <a className="btn btn-quiet" href={`/invites/${inv.id}/guests`}>Manage guests</a>
            <a className="btn btn-quiet" href={`/edit/${inv.id}`}>Edit</a>
            <a className="btn btn-quiet" href={url} target="_blank" rel="noopener">Preview</a>
          </div>

          <h2 className="section-h" id="qr">QR code</h2>
          <div className="sheet qr">
            <div dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="hint" style={{ textAlign: "center" }}>Print it on a card or show it on a screen. It opens your invitation.</p>
            <a className="btn btn-quiet btn-sm" href={qrPng} download={`${inv.slug}-qr.png`}>Download PNG</a>
          </div>
        </>
      )}

      <h2 className="section-h">{live ? "Visibility" : "Remove"}</h2>
      <VisibilityControls id={inv.id} status={inv.status} />
    </main>
  );
}
