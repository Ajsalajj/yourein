import type { Principal } from "../auth.js";
import { badRequest, conflict, forbidden, unavailable } from "../errors.js";
import { grantsPremium, PlayApiError, type PlaySubscription } from "../google.js";
import { ensureUser, entitlement, getPlans } from "./accounts.js";
import type { Deps } from "./context.js";

async function store(deps: Deps, userId: string, token: string, s: PlaySubscription) {
  await deps.db.query(
    `insert into subscriptions (purchase_token, user_id, product_id, base_plan_id, state, expires_at, auto_renewing, acknowledged)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (purchase_token) do update set
       state = excluded.state, expires_at = excluded.expires_at, auto_renewing = excluded.auto_renewing,
       acknowledged = excluded.acknowledged, base_plan_id = excluded.base_plan_id, updated_at = now()`,
    [token, userId, s.productId, s.basePlanId, s.state, s.expiresAt, s.autoRenewing, s.acknowledged],
  );
  if (s.linkedPurchaseToken) {
    await deps.db.query("update subscriptions set replaced_by = $1 where purchase_token = $2", [token, s.linkedPurchaseToken]);
  }
}

/**
 * Verifies a Google Play purchase token with Google and records the
 * entitlement. The purchase must carry this user's id as its obfuscated
 * account id, and a token can only ever belong to one Orvane account.
 */
export async function verifyGooglePurchase(deps: Deps, p: Principal, productId: string, token: string) {
  if (!deps.play) throw unavailable("billing_unavailable");
  await ensureUser(deps.db, p);
  const plans = await getPlans(deps.db);
  if (productId !== plans.productId) throw badRequest("unknown_product");

  let sub: PlaySubscription;
  try {
    sub = await deps.play.getSubscription(token);
  } catch (e) {
    if (e instanceof PlayApiError && (e.status === 400 || e.status === 404 || e.status === 410)) throw badRequest("invalid_purchase");
    throw unavailable("billing_unavailable");
  }
  if (sub.productId !== plans.productId) throw badRequest("unknown_product");
  if (sub.accountId !== p.userId) throw forbidden("purchase_account_mismatch");

  const { rows } = await deps.db.query<{ user_id: string }>("select user_id from subscriptions where purchase_token = $1", [token]);
  if (rows[0] && rows[0].user_id !== p.userId) throw conflict("purchase_account_mismatch");

  if (!sub.acknowledged && grantsPremium(sub)) {
    try {
      await deps.play.acknowledge(sub.productId, token);
      sub = { ...sub, acknowledged: true };
    } catch (e) {
      // The app acknowledges too; Play only refunds if neither does within 3 days.
      deps.log.warn({ err: (e as Error).message }, "acknowledge failed");
    }
  }
  await store(deps, p.userId, token, sub);
  return entitlement(deps.db, p.userId);
}

/**
 * Real-time developer notification (Pub/Sub push). Only updates purchases
 * we already know; a brand-new purchase is linked when the app verifies it.
 */
export async function handleRtdn(deps: Deps, body: unknown): Promise<void> {
  if (!deps.play) return;
  const data = (body as { message?: { data?: string } })?.message?.data;
  if (!data) return;
  let n: { subscriptionNotification?: { purchaseToken?: string }; testNotification?: unknown };
  try {
    n = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch {
    return;
  }
  const token = n.subscriptionNotification?.purchaseToken;
  if (!token) return;
  const { rows } = await deps.db.query<{ user_id: string }>("select user_id from subscriptions where purchase_token = $1", [token]);
  if (!rows[0]) return;
  const sub = await deps.play.getSubscription(token);
  await store(deps, rows[0].user_id, token, sub);
}
