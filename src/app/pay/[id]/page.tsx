import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTemplate } from "@/data/templates";
import { PayScreen } from "@/components/app/PayScreen";
import { eventTitleOf, formatDate, missingFields, namesOf } from "@/lib/invite";
import { requireUserPage } from "@/server/auth";
import { ApiError } from "@/server/http";
import { getOwned } from "@/server/invitations";
import { paymentMode } from "@/server/payments";
import "../../app.css";

export const metadata: Metadata = { title: "Pay and publish", robots: { index: false } };

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/pay/${id}`);
  const inv = await getOwned(id, user.id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  if (inv.status === "published" || inv.status === "archived") redirect(`/invites/${id}`);
  if (missingFields(inv.data).length) redirect(`/edit/${id}?step=review`);
  const t = getTemplate(inv.templateSlug)!;
  return (
    <PayScreen
      id={inv.id}
      templateSlug={t.slug}
      templateName={t.name}
      names={namesOf(inv.data)}
      eventLine={`${eventTitleOf(inv.data)}, ${formatDate(inv.data.date)}`}
      mode={paymentMode()}
    />
  );
}
