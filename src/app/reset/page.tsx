import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetScreen } from "@/components/app/AuthScreen";
import "../app.css";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/signin");
  return <ResetScreen token={token} />;
}
