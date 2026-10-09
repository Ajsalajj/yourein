import { requireUser } from "@/server/auth";
import { body, ok, route } from "@/server/http";
import { verifyAndPublish } from "@/server/payments";

/** The only place an invitation becomes published from the browser flow: after the signature checks out. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const b = await body(req);
  return ok(await verifyAndPublish(user, { orderId: b.orderId, paymentId: b.paymentId, signature: b.signature }));
});
