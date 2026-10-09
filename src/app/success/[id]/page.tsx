import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { SuccessScreen } from "@/components/app/SuccessScreen";
import { formatDate, namesOf } from "@/lib/invite";
import { requireUserPage } from "@/server/auth";
import { ApiError } from "@/server/http";
import { getOwned } from "@/server/invitations";
import { siteOrigin } from "@/server/origin";
import "../../app.css";

export const metadata: Metadata = { title: "Your invitation is live", robots: { index: false } };

export default async function SuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/success/${id}`);
  const inv = await getOwned(id, user.id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  if (!inv.slug || inv.status === "draft" || inv.status === "ready") redirect(`/pay/${id}`);
  const url = `${await siteOrigin()}/i/${inv.slug}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#26231f", light: "#0000" } });
  return <SuccessScreen id={inv.id} url={url} names={namesOf(inv.data)} dateLabel={formatDate(inv.data.date)} qrSvg={qrSvg} />;
}
