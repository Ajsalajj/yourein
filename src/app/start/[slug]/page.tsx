import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTemplate } from "@/data/templates";
import { getUser } from "@/server/auth";
import { StartClient } from "./StartClient";
import "../../app.css";

export const metadata: Metadata = { title: "Starting your invitation", robots: { index: false } };

/**
 * Where every "Customize" button leads. Everyone gets a draft and the editor straight away;
 * signed-out visitors start as a guest and are asked to sign in only when they go to pay.
 */
export default async function StartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) notFound();
  return <StartClient slug={t.slug} name={t.name} signedOut={!(await getUser())} />;
}
