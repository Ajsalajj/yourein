import type { Principal } from "../auth.js";
import type { Queryable } from "../db.js";
import { forbidden, HttpError, unavailable } from "../errors.js";
import { grantsPremium } from "../google.js";
import type { PlanSettings } from "../types.js";
import type { Deps } from "./context.js";
import { revokeDevicePeers } from "./peers.js";

export async function getPlans(q: Queryable): Promise<PlanSettings> {
  const { rows } = await q.query<{ value: PlanSettings }>("select value from settings where key = 'plans'");
  if (!rows[0]) throw new Error("plans setting missing");
  return rows[0].value;
}

/** Creates the local user row on first contact; rejects suspended users. */
export async function ensureUser(q: Queryable, p: Principal): Promise<void> {
  const { rows } = await q.query<{ suspended_at: Date | null }>(
    `insert into users (id, email) values ($1, $2)
     on conflict (id) do update set email = excluded.email
     returning suspended_at`,
    [p.userId, p.email],
  );
  if (rows[0]?.suspended_at) throw forbidden("account_suspended");
}

export interface Entitlement {
  tier: "free" | "premium";
  status: string;
  productId: string | null;
  renewsAt: string | null;
  expiresAt: string | null;
  store: "google_play" | null;
}

export async function entitlement(q: Queryable, userId: string, now = new Date()): Promise<Entitlement> {
  const { rows } = await q.query<{ state: string; product_id: string; expires_at: Date | null; auto_renewing: boolean }>(
    `select state, product_id, expires_at, auto_renewing from subscriptions
     where user_id = $1 and replaced_by is null
     order by expires_at desc nulls last limit 5`,
    [userId],
  );
  const live = rows.find((r) => grantsPremium({ state: r.state as never, expiresAt: r.expires_at }, now));
  const latest = live ?? rows[0];
  if (!latest) return { tier: "free", status: "none", productId: null, renewsAt: null, expiresAt: null, store: null };
  const exp = latest.expires_at?.toISOString() ?? null;
  return {
    tier: live ? "premium" : "free",
    status: latest.state,
    productId: latest.product_id,
    renewsAt: live && latest.auto_renewing ? exp : null,
    expiresAt: exp,
    store: "google_play",
  };
}

export async function deviceLimit(q: Queryable, premium: boolean): Promise<number> {
  const plans = await getPlans(q);
  return premium ? plans.premiumDeviceLimit : plans.freeDeviceLimit;
}

export async function me(deps: Deps, p: Principal) {
  await ensureUser(deps.db, p);
  const ent = await entitlement(deps.db, p.userId);
  const { rows: devices } = await deps.db.query<{ id: string; name: string; platform: string; created_at: Date; last_seen_at: Date | null }>(
    "select id, name, platform, created_at, last_seen_at from devices where user_id = $1 order by created_at",
    [p.userId],
  );
  return {
    id: p.userId,
    email: p.email,
    subscription: ent,
    deviceLimit: await deviceLimit(deps.db, ent.tier === "premium"),
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      createdAt: d.created_at.toISOString(),
      lastSeenAt: d.last_seen_at?.toISOString() ?? null,
    })),
  };
}

/**
 * Permanently deletes the account: revokes every peer on every gateway,
 * deletes the Supabase identity, then all local rows (cascade).
 * Google Play subscriptions are not cancelled here; the app tells the user.
 */
export async function deleteAccount(deps: Deps, p: Principal): Promise<void> {
  if (!deps.deleteAuthUser) throw unavailable("deletion_unavailable");
  const { rows: devices } = await deps.db.query<{ id: string }>("select id from devices where user_id = $1", [p.userId]);
  for (const d of devices) await revokeDevicePeers(deps, d.id);
  try {
    await deps.deleteAuthUser(p.userId);
  } catch (e) {
    deps.log.error({ err: (e as Error).message }, "auth user deletion failed");
    throw new HttpError(502, "deletion_failed");
  }
  await deps.db.query("delete from users where id = $1", [p.userId]);
}
