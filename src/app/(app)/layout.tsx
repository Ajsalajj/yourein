import type { Metadata } from "next";
import { AppChrome } from "@/components/app/AppChrome";
import { requireUserPage } from "@/server/auth";
import "../app.css";

export const metadata: Metadata = { robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage("/dashboard");
  return <AppChrome>{children}</AppChrome>;
}
