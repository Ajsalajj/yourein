import { requireUser } from "@/server/auth";
import { body, ok, route } from "@/server/http";
import { testGatewayPay } from "@/server/payments";

/** Test mode only. Plays the part of the payment gateway; refuses when real payments are configured. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const b = await body(req);
  return ok(await testGatewayPay(user, String(b.orderId ?? "")));
});
