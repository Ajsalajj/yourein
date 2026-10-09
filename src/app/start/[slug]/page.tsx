import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTemplate } from "@/data/templates";
import { getUser } from "@/server/auth";
import { StartClient } from "./StartClient";
import "../../app.css";

export const metadata: Metadata = { title: "Starting your invitation", robots: { index: false } };

/**
 * Where every "Customize" button leads. Signed-out visitors are sent to sign
 * in and come straight back here; signed-in visitors get a draft and the editor.
 */
export default async function StartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) notFound();
  if (!(await getUser())) redirect(`/signin?next=${encodeURIComponent(`/start/${slug}`)}`);
  return <StartClient slug={t.slug} name={t.name} />;
}
