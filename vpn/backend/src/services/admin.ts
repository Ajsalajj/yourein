import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Principal } from "../auth.js";
import { isWireGuardKey } from "../crypto.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { grantsPremium } from "../google.js";
import { parseCidr } from "../ipam.js";
import type { PlanSettings, ServerRow } from "../types.js";
import { getPlans } from "./accounts.js";
import type { Deps } from "./context.js";
import { desiredPeers, revokeDevicePeers } from "./peers.js";

export async function audit(deps: Deps, actor: Principal, action: string, target: string | null, details?: object) {
  await deps.db.query("insert into audit_log (actor_id, actor_email, action, target, details) values ($1, $2, $3, $4, $5)", [
    actor.userId,
    actor.email,
    action,
    target,
    details ? JSON.stringify(details) : null,
  ]);
}

// ---------- Users ----------

export async function listUsers(deps: Deps, query: string, limit = 50, offset = 0) {
  const { rows } = await deps.db.query<{
    id: string; email: string; created_at: Date; suspended_at: Date | null; devices: number; premium_until: Date | null; state: string | null;
  }>(
    `select u.id, u.email, u.created_at, u.suspended_at,
            (select count(*)::int from devices d where d.user_id = u.id) as devices,
            s.expires_at as premium_until, s.state
       from users u
       left join lateral (select state, expires_at from subscriptions where user_id = u.id and replaced_by is null
                          order by expires_at desc nulls last limit 1) s on true
      where $1 = '' or u.email ilike '%' || $1 || '%' or u.id::text = $1
      order by u.created_at desc limit $2 offset $3`,
    [query.trim(), Math.min(limit, 200), offset],
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    createdAt: r.created_at,
    suspended: r.suspended_at !== null,
    devices: r.devices,
    premium: r.state ? grantsPremium({ state: r.state as never, expiresAt: r.premium_until }) : false,
    subscriptionState: r.state,
  }));
}

export async function userDetail(deps: Deps, userId: string) {
  const { rows } = await deps.db.query<{ id: string; email: string; created_at: Date; suspended_at: Date | null; suspended_reason: string | null }>(
    "select id, email, created_at, suspended_at, suspended_reason from users where id = $1",
    [userId],
  );
  const u = rows[0];
  if (!u) throw notFound("user_not_found");
  const { rows: devices } = await deps.db.query(
    `select d.id, d.name, d.platform, d.created_at, d.last_seen_at,
            coalesce(array_agg(p.server_id) filter (where p.server_id is not null), '{}') as servers
       from devices d left join peers p on p.device_id = d.id
      where d.user_id = $1 group by d.id order by d.created_at`,
    [userId],
  );
  const { rows: subs } = await deps.db.query(
    `select product_id, base_plan_id, state, expires_at, auto_renewing, replaced_by is not null as replaced, created_at
       from subscriptions where user_id = $1 order by created_at desc`,
    [userId],
  );
  return {
    id: u.id,
    email: u.email,
    createdAt: u.created_at,
    suspendedAt: u.suspended_at,
    suspendedReason: u.suspended_reason,
    devices,
    subscriptions: subs,
  };
}

/** Suspension blocks provisioning and revokes every peer immediately. */
export async function suspendUser(deps: Deps, actor: Principal, userId: string, reason: string) {
  const { rows } = await deps.db.query("update users set suspended_at = now(), suspended_reason = $2 where id = $1 returning id", [userId, reason]);
  if (!rows[0]) throw notFound("user_not_found");
  const { rows: devices } = await deps.db.query<{ id: string }>("select id from devices where user_id = $1", [userId]);
  for (const d of devices) await revokeDevicePeers(deps, d.id);
  await audit(deps, actor, "user.suspend", userId, { reason });
}

export async function unsuspendUser(deps: Deps, actor: Principal, userId: string) {
  const { rows } = await deps.db.query("update users set suspended_at = null, suspended_reason = null where id = $1 returning id", [userId]);
  if (!rows[0]) throw notFound("user_not_found");
  await audit(deps, actor, "user.unsuspend", userId);
}

export async function revokeDevice(deps: Deps, actor: Principal, deviceId: string) {
  const { rows } = await deps.db.query<{ user_id: string }>("select user_id from devices where id = $1", [deviceId]);
  if (!rows[0]) throw notFound("device_not_found");
  await revokeDevicePeers(deps, deviceId);
  await deps.db.query("delete from devices where id = $1", [deviceId]);
  await audit(deps, actor, "device.revoke", deviceId, { userId: rows[0].user_id });
}

// ---------- Servers ----------

export const ServerInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,40}$/),
  name: z.string().min(1).max(80),
  countryCode: z.string().regex(/^[A-Za-z]{2}$/).transform((s) => s.toUpperCase()),
  city: z.string().min(1).max(80),
  tier: z.enum(["free", "premium"]),
  endpointHost: z.string().min(1).max(253),
  endpointPort: z.number().int().min(1).max(65535).default(51820),
  publicKey: z.string().refine(isWireGuardKey, "invalid WireGuard public key"),
  ipv4Cidr: z.string().refine((c) => {
    try {
      const p = parseCidr(c);
      return !p.v6 && p.bits >= 2 && p.bits <= 20;
    } catch {
      return false;
    }
  }, "IPv4 CIDR between /12 and /30"),
  ipv6Cidr: z
    .string()
    .nullable()
    .default(null)
    .refine((c) => {
      if (c === null) return true;
      try {
        return parseCidr(c).v6;
      } catch {
        return false;
      }
    }, "IPv6 CIDR"),
  dns: z.array(z.string().min(2)).min(1).max(4),
  mtu: z.number().int().min(1280).max(1500).nullable().default(null),
  agentUrl: z.string().url().refine((u) => u.startsWith("https://"), "agent must use https"),
  probeHost: z.string().min(1),
  probePort: z.number().int().min(1).max(65535),
  capacity: z.number().int().min(1).default(1000),
});

export const ServerPatch = ServerInput.omit({ id: true, ipv4Cidr: true, ipv6Cidr: true })
  .partial()
  .extend({ enabled: z.boolean().optional(), maintenance: z.boolean().optional(), rotateAgentSecret: z.boolean().optional() });

function publicServer(s: ServerRow) {
  return {
    id: s.id,
    name: s.name,
    countryCode: s.country_code,
    city: s.city,
    tier: s.tier,
    enabled: s.enabled,
    status: s.status,
    endpoint: `${s.endpoint_host}:${s.endpoint_port}`,
    publicKey: s.public_key,
    ipv4Cidr: s.ipv4_cidr,
    ipv6Cidr: s.ipv6_cidr,
    dns: s.dns,
    mtu: s.mtu,
    agentUrl: s.agent_url,
    probe: { host: s.probe_host, port: s.probe_port },
    capacity: s.capacity,
    loadPercent: s.load_percent,
    activePeers: s.active_peers,
    rxBytes: s.rx_bytes === null ? null : Number(s.rx_bytes),
    txBytes: s.tx_bytes === null ? null : Number(s.tx_bytes),
    lastSeenAt: s.last_seen_at,
    failures: s.failures,
  };
}

export async function listServersAdmin(deps: Deps) {
  const { rows } = await deps.db.query<ServerRow & { peers: number }>(
    "select s.*, (select count(*)::int from peers p where p.server_id = s.id) as peers from servers s order by country_code, city",
  );
  return rows.map((s) => ({ ...publicServer(s), allocatedPeers: s.peers }));
}

/**
 * Creates a gateway record. The agent secret is generated here, returned
 * exactly once for installing on the gateway, and stored only sealed.
 */
export async function createServer(deps: Deps, actor: Principal, input: z.infer<typeof ServerInput>) {
  const secret = randomBytes(32).toString("base64url");
  try {
    await deps.db.query(
      `insert into servers (id, name, country_code, city, tier, endpoint_host, endpoint_port, public_key, ipv4_cidr, ipv6_cidr,
                            dns, mtu, agent_url, agent_secret_sealed, probe_host, probe_port, capacity, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'offline')`,
      [input.id, input.name, input.countryCode, input.city, input.tier, input.endpointHost, input.endpointPort, input.publicKey,
        input.ipv4Cidr, input.ipv6Cidr, input.dns, input.mtu, input.agentUrl, deps.sealer.seal(secret), input.probeHost,
        input.probePort, input.capacity],
    );
  } catch (e) {
    if (/duplicate key/i.test((e as Error).message)) throw conflict("server_exists");
    throw e;
  }
  await audit(deps, actor, "server.create", input.id);
  return { id: input.id, agentSecret: secret };
}

export async function updateServer(deps: Deps, actor: Principal, id: string, patch: z.infer<typeof ServerPatch>) {
  const { rows } = await deps.db.query<ServerRow>("select * from servers where id = $1", [id]);
  const s = rows[0];
  if (!s) throw notFound("server_not_found");
  const map: Record<string, unknown> = {
    name: patch.name, country_code: patch.countryCode, city: patch.city, tier: patch.tier, endpoint_host: patch.endpointHost,
    endpoint_port: patch.endpointPort, public_key: patch.publicKey, dns: patch.dns, mtu: patch.mtu, agent_url: patch.agentUrl,
    probe_host: patch.probeHost, probe_port: patch.probePort, capacity: patch.capacity, enabled: patch.enabled,
  };
  if (patch.maintenance !== undefined) map.status = patch.maintenance ? "maintenance" : "offline";
  let secret: string | undefined;
  if (patch.rotateAgentSecret) {
    secret = randomBytes(32).toString("base64url");
    map.agent_secret_sealed = deps.sealer.seal(secret);
  }
  const entries = Object.entries(map).filter(([, v]) => v !== undefined);
  if (entries.length) {
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
    await deps.db.query(`update servers set ${sets} where id = $1`, [id, ...entries.map(([, v]) => v)]);
  }
  await audit(deps, actor, "server.update", id, { fields: entries.map(([k]) => k).filter((k) => k !== "agent_secret_sealed"), rotatedSecret: !!secret });
  return secret ? { agentSecret: secret } : {};
}

export async function deleteServer(deps: Deps, actor: Principal, id: string) {
  const { rows } = await deps.db.query("delete from servers where id = $1 returning id", [id]);
  if (!rows[0]) throw notFound("server_not_found");
  await audit(deps, actor, "server.delete", id);
}

export async function reconcileServer(deps: Deps, actor: Principal, id: string) {
  const { rows } = await deps.db.query<ServerRow>("select * from servers where id = $1", [id]);
  if (!rows[0]) throw notFound("server_not_found");
  const peers = await desiredPeers(deps.db, id);
  await deps.gateways.syncPeers(rows[0], peers);
  await audit(deps, actor, "server.reconcile", id, { peers: peers.length });
  return { peers: peers.length };
}

// ---------- Plans & analytics ----------

export const PlanPatch = z.object({
  productId: z.string().min(1).optional(),
  monthlyBasePlan: z.string().min(1).optional(),
  yearlyBasePlan: z.string().min(1).optional(),
  freeDeviceLimit: z.number().int().min(1).max(20).optional(),
  premiumDeviceLimit: z.number().int().min(1).max(50).optional(),
  estimatedMonthlyPriceUsd: z.number().min(0).nullable().optional(),
  estimatedYearlyPriceUsd: z.number().min(0).nullable().optional(),
});

export async function updatePlans(deps: Deps, actor: Principal, patch: z.infer<typeof PlanPatch>): Promise<PlanSettings> {
  const next = { ...(await getPlans(deps.db)), ...patch };
  if (next.premiumDeviceLimit < next.freeDeviceLimit) throw badRequest("invalid_limits");
  await deps.db.query("update settings set value = $1, updated_at = now() where key = 'plans'", [JSON.stringify(next)]);
  await audit(deps, actor, "plans.update", null, patch);
  return next;
}

export async function analytics(deps: Deps) {
  const q = deps.db;
  const one = async <T extends object>(sql: string) => (await q.query<T>(sql)).rows[0]!;
  const users = await one<{ total: number; d7: number; d30: number; suspended: number }>(
    `select count(*)::int total,
            count(*) filter (where created_at > now() - interval '7 days')::int d7,
            count(*) filter (where created_at > now() - interval '30 days')::int d30,
            count(*) filter (where suspended_at is not null)::int suspended from users`,
  );
  const devices = await one<{ total: number; active24h: number }>(
    `select count(*)::int total, count(*) filter (where last_seen_at > now() - interval '24 hours')::int active24h from devices`,
  );
  const { rows: subs } = await q.query<{ state: string; base_plan_id: string | null; expires_at: Date | null; n: number }>(
    `select state, base_plan_id, expires_at, 1 as n from subscriptions where replaced_by is null`,
  );
  const now = new Date();
  const live = subs.filter((s) => grantsPremium({ state: s.state as never, expiresAt: s.expires_at }, now));
  const plans = await getPlans(q);
  const monthly = live.filter((s) => s.base_plan_id === plans.monthlyBasePlan).length;
  const yearly = live.filter((s) => s.base_plan_id === plans.yearlyBasePlan).length;
  const byState: Record<string, number> = {};
  for (const s of subs) byState[s.state] = (byState[s.state] ?? 0) + 1;
  const estimatedMrrUsd =
    plans.estimatedMonthlyPriceUsd === null || plans.estimatedYearlyPriceUsd === null
      ? null
      : Math.round((monthly * plans.estimatedMonthlyPriceUsd + (yearly * plans.estimatedYearlyPriceUsd) / 12) * 100) / 100;
  const servers = await listServersAdmin(deps);
  return {
    users,
    devices,
    subscriptions: { premiumActive: live.length, monthly, yearly, byState },
    revenue: {
      estimatedMrrUsd,
      note: "Estimate from admin-entered list prices x active subscriptions. Actual revenue (taxes, regional pricing, refunds, Google's fee) is in Play Console financial reports.",
    },
    servers: {
      total: servers.length,
      online: servers.filter((s) => s.status === "online").length,
      activePeers: servers.reduce((a, s) => a + (s.activePeers ?? 0), 0),
      rxBytes: servers.reduce((a, s) => a + (s.rxBytes ?? 0), 0),
      txBytes: servers.reduce((a, s) => a + (s.txBytes ?? 0), 0),
    },
  };
}

export async function auditLog(deps: Deps, limit = 100) {
  const { rows } = await deps.db.query("select id, actor_email, action, target, details, at from audit_log order by at desc limit $1", [
    Math.min(limit, 500),
  ]);
  return rows;
}
