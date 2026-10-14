import { requireAdminApi } from "@/server/admin";
import { ok, rateLimit, route } from "@/server/http";
import { checkRazorpayConnection } from "@/server/payments/status";

/** Asks Razorpay whether the configured keys are accepted. Creates nothing and moves no money. */
export const POST = route(async () => {
  const user = await requireAdminApi();
  rateLimit(`admin-rzp-check:${user.id}`, 10, 10 * 60_000);
  return ok(await checkRazorpayConnection());
});
