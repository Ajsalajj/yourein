import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTemplate } from "@/data/templates";
import { AuthScreen } from "@/components/app/AuthScreen";
import { getUser } from "@/server/auth";
import { safeNext } from "@/server/http";
import "../app.css";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; mode?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUser()) redirect(next);
  const slug = next.match(/^\/start\/([a-z0-9-]+)/)?.[1];
  const t = slug ? getTemplate(slug) : undefined;
  return <AuthScreen next={next} template={t ? { slug: t.slug, name: t.name } : null} error={sp.error} startMode={sp.mode === "signin" ? "signin" : "choose"} />;
}
