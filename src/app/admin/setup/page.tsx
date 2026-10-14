import { AdminShell } from "@/components/admin/AdminShell";
import { CheckRazorpay } from "@/components/admin/CheckRazorpay";
import { adminDatabaseKind, requireAdminPage } from "@/server/admin";
import { PRICE } from "@/config/site";
import { setupChecks, WEBHOOK_EVENTS } from "@/server/payments/status";
import { siteOrigin } from "@/server/origin";

export const dynamic = "force-dynamic";

const ICON = { ok: "✓", warn: "!", bad: "✕" } as const;

export default async function SetupPage() {
  await requireAdminPage();
  const [origin, dbKind] = await Promise.all([siteOrigin(), adminDatabaseKind()]);
  const checks = setupChecks(process.env, { price: PRICE, databaseKind: dbKind, origin, production: process.env.NODE_ENV === "production" });
  return (
    <AdminShell>
    <main>
      <div className="adm-head"><h1>Setup</h1></div>
      <p className="adm-sub">Everything that has to be right before real customers pay. Secrets are never shown.</p>

      <ul className="adm-checks">
        {checks.map((c) => (
          <li key={c.id} className={`is-${c.state}`}>
            <span className="adm-icon" aria-hidden="true">{ICON[c.state]}</span>
            <div><b>{c.label}</b><p>{c.detail}</p></div>
          </li>
        ))}
      </ul>

      <section className="adm-panel">
        <h2>Check the Razorpay keys</h2>
        <p className="adm-sub">Asks Razorpay to accept the keys saved on this site. It creates nothing and moves no money.</p>
        <CheckRazorpay />
      </section>

      <section className="adm-panel">
        <h2>Webhook</h2>
        <p className="adm-sub">In the Razorpay dashboard, go to Account &amp; Settings → Webhooks → Add new webhook.</p>
        <dl className="adm-dl">
          <div><dt>Webhook URL</dt><dd className="adm-mono">{origin}/api/pay/webhook</dd></div>
          <div><dt>Secret</dt><dd>Any long random string. Put the same string in <span className="adm-mono">RAZORPAY_WEBHOOK_SECRET</span>.</dd></div>
          <div><dt>Events to tick</dt><dd className="adm-mono">{WEBHOOK_EVENTS.join(", ")}</dd></div>
        </dl>
        <p className="adm-note">With the webhook, an invitation is published even if the customer closes the tab right after paying, and failed payments and refunds appear in the Payments list.</p>
      </section>

      <section className="adm-panel">
        <h2>Settings this site reads</h2>
        <dl className="adm-dl">
          <div><dt>RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET</dt><dd>Your Razorpay keys. Use <span className="adm-mono">rzp_test_</span> keys while testing and <span className="adm-mono">rzp_live_</span> keys when you sell.</dd></div>
          <div><dt>RAZORPAY_WEBHOOK_SECRET</dt><dd>The webhook secret above.</dd></div>
          <div><dt>NEXT_PUBLIC_PRICE_INR</dt><dd>Price per invitation in whole rupees. Currently ₹{PRICE}. Change it and redeploy.</dd></div>
          <div><dt>DATABASE_URL</dt><dd>A PostgreSQL database, so payments and invitations survive restarts.</dd></div>
          <div><dt>AUTH_SECRET, NEXT_PUBLIC_SITE_URL</dt><dd>A long random string, and your public address.</dd></div>
          <div><dt>ADMIN_EMAILS, ADMIN_ACCESS_CODE</dt><dd>Who may open this admin area, and the code they type to unlock it.</dd></div>
        </dl>
      </section>
    </main>
    </AdminShell>
  );
}
