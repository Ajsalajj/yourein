import { csvCell, listPayments, requireAdminApi, STATE_LABEL, type PaymentState } from "@/server/admin";
import { route } from "@/server/http";

const STATES = new Set(["paid", "partially_refunded", "refunded", "failed", "pending"]);

/** CSV of payments with the same filters as the Payments page (up to 5,000 rows). For accounting and reconciliation. */
export const GET = route(async (req) => {
  await requireAdminApi();
  const u = new URL(req.url).searchParams;
  const state = u.get("state") ?? "all";
  const { rows } = await listPayments(
    { state: STATES.has(state) ? (state as PaymentState) : "all", q: u.get("q") ?? undefined, from: u.get("from") ?? undefined, to: u.get("to") ?? undefined, includeSimulated: u.get("sim") === "1" },
    { all: true },
  );
  const head = ["Created (IST)", "Status", "Amount (INR)", "Refunded (INR)", "Customer", "Email", "Invitation", "Design", "Order id", "Payment id", "Provider", "Confirmed by", "Key mode"];
  const lines = rows.map((r) =>
    [
      new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), STATE_LABEL[r.state], (r.amount / 100).toFixed(2), (r.refunded / 100).toFixed(2),
      r.user_name, r.user_email ?? "", r.invitation_title, r.template_slug, r.provider_order_id, r.provider_payment_id ?? "", r.provider,
      (r.payment_raw?.source as string | undefined) ?? "", (r.payment_raw?.keyMode as string | undefined) ?? "",
    ].map(csvCell).join(","),
  );
  return new Response([head.join(","), ...lines].join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="yourein-payments-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
});
