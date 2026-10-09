import type { Metadata } from "next";
import { AccountForm } from "@/components/app/AccountForm";
import { requireUserPage } from "@/server/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUserPage("/account");
  return (
    <main className="app-main">
      <div className="page-head"><h1 className="page-h">Account</h1></div>
      <AccountForm name={user.name} email={user.email} hasPassword={user.hasPassword} google={user.google} />
    </main>
  );
}
