import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Editor } from "@/components/app/Editor";
import { requireUserPage } from "@/server/auth";
import { ApiError } from "@/server/http";
import { getOwned } from "@/server/invitations";
import "../../app.css";

export const metadata: Metadata = { title: "Edit your invitation", robots: { index: false } };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/edit/${id}`, { allowGuest: true });
  const inv = await getOwned(id, user.id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  return <Editor id={inv.id} initial={inv.data} initialTemplate={inv.templateSlug} status={inv.status} guest={user.guest} />;
}
