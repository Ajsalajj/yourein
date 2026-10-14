import { AdminShell } from "@/components/admin/AdminShell";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { UnlockForm } from "@/components/admin/UnlockForm";
import { appSecret } from "@/server/auth";
import { ADMIN_COOKIE, verifyAdminToken } from "@/server/admin-access";
import { requireAdminPage } from "@/server/admin";

export const dynamic = "force-dynamic";

export default async function UnlockPage() {
  const user = await requireAdminPage({ allowLocked: true });
  if (verifyAdminToken(appSecret(), (await cookies()).get(ADMIN_COOKIE)?.value, user.id)) redirect("/admin");
  return (
    <AdminShell>
    <main className="adm-narrow">
      <h1>Admin</h1>
      <p className="adm-sub">Signed in as {user.email}. Enter the admin access code to continue. It stays unlocked on this browser for 12 hours.</p>
      <UnlockForm />
    </main>
    </AdminShell>
  );
}
