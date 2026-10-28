import type { Principal } from "../auth.js";
import { isWireGuardKey } from "../crypto.js";
import { badRequest, conflict, forbidden, HttpError, notFound, unavailable } from "../errors.js";
import { addressAt, hostOf, indexOf, nextFreeIndex } from "../ipam.js";
import type { ServerRow } from "../types.js";
import { deviceLimit, ensureUser, entitlement } from "./accounts.js";
import type { Deps } from "./context.js";
import { revokeDevicePeers } from "./peers.js";

export interface ProvisionRequest {
  serverId: string;
  publicKey: string;
  deviceName: string;
  platform: string;
}

/** What the app needs to build the local interface. No private key. */
export interface TunnelConfigResponse {
  serverId: string;
  addresses: string[];
  dns: string[];
  serverPublicKey: string;
  endpoint: string;
  allowedIps: string[];
  persistentKeepalive: number;
  mtu: number | null;
}

/**
 * Registers the device (by public key) and gives it a peer on the server.
 *
 * Address allocation runs in a transaction holding a per-server advisory
 * lock, so concurrent requests can't receive the same address. The peer is
 * installed on the gateway after commit; if that fails the database still
 * holds the allocation and the next reconciliation pushes it.
 */
export async function provision(deps: Deps, p: Principal, req: ProvisionRequest): Promise<TunnelConfigResponse> {
  if (!isWireGuardKey(req.publicKey)) throw badRequest("invalid_public_key");
  await ensureUser(deps.db, p);

  const { rows: servers } = await deps.db.query<ServerRow>("select * from servers where id = $1 and enabled", [req.serverId]);
  const server = servers[0];
  if (!server) throw notFound("server_not_found");
  if (server.status !== "online") throw unavailable("server_unavailable");

  const ent = await entitlement(deps.db, p.userId);
  const premium = ent.tier === "premium";
  if (server.tier === "premium" && !premium) throw forbidden("premium_required");
  const limit = await deviceLimit(deps.db, premium);

  const alloc = await deps.db.tx(async (q) => {
    const { rows: existing } = await q.query<{ id: string; user_id: string }>(
      "select id, user_id from devices where public_key = $1 for update",
      [req.publicKey],
    );
    let deviceId: string;
    if (existing[0]) {
      if (existing[0].user_id !== p.userId) throw conflict("key_in_use");
      deviceId = existing[0].id;
      // After a downgrade, only the oldest `limit` devices keep working.
      const { rows: rank } = await q.query<{ n: number }>(
        `select count(*)::int as n from devices
          where user_id = $1 and created_at <= (select created_at from devices where id = $2)`,
        [p.userId, deviceId],
      );
      if ((rank[0]?.n ?? 0) > limit) throw conflict("device_limit");
      await q.query("update devices set name = $2, last_seen_at = now() where id = $1", [deviceId, req.deviceName]);
    } else {
      const { rows: count } = await q.query<{ n: number }>("select count(*)::int as n from devices where user_id = $1", [p.userId]);
      if ((count[0]?.n ?? 0) >= limit) throw conflict("device_limit");
      const { rows: created } = await q.query<{ id: string }>(
        "insert into devices (user_id, name, platform, public_key, last_seen_at) values ($1, $2, $3, $4, now()) returning id",
        [p.userId, req.deviceName, req.platform, req.publicKey],
      );
      deviceId = created[0]!.id;
    }

    await q.query("select pg_advisory_xact_lock(hashtext($1))", [server.id]);
    const { rows: peer } = await q.query<{ ipv4: string; ipv6: string | null }>(
      "select host(ipv4) as ipv4, host(ipv6) as ipv6 from peers where device_id = $1 and server_id = $2",
      [deviceId, server.id],
    );
    if (peer[0]) return { deviceId, ipv4: hostOf(peer[0].ipv4), ipv6: peer[0].ipv6 ? hostOf(peer[0].ipv6) : null };

    const { rows: used } = await q.query<{ ipv4: string }>("select host(ipv4) as ipv4 from peers where server_id = $1", [server.id]);
    const index = nextFreeIndex(server.ipv4_cidr, used.map((u) => u.ipv4));
    if (index === null) throw unavailable("server_full");
    const ipv4 = addressAt(server.ipv4_cidr, index);
    const ipv6 = server.ipv6_cidr ? addressAt(server.ipv6_cidr, index) : null;
    await q.query("insert into peers (device_id, server_id, ipv4, ipv6) values ($1, $2, $3, $4)", [deviceId, server.id, ipv4, ipv6]);
    return { deviceId, ipv4, ipv6 };
  });

  const allowedOnGateway = [`${alloc.ipv4}/32`, ...(alloc.ipv6 ? [`${alloc.ipv6}/128`] : [])];
  try {
    await deps.gateways.addPeer(server, { publicKey: req.publicKey, allowedIps: allowedOnGateway });
  } catch (e) {
    deps.log.warn({ server: server.id, err: (e as Error).message }, "gateway add peer failed");
    throw unavailable("gateway_unreachable");
  }
  // A re-provisioned key must not be removed by an older queued revocation.
  await deps.db.query("delete from pending_revocations where server_id = $1 and public_key = $2", [server.id, req.publicKey]);

  return {
    serverId: server.id,
    addresses: [`${alloc.ipv4}/32`, ...(alloc.ipv6 ? [`${alloc.ipv6}/128`] : [])],
    dns: server.dns,
    serverPublicKey: server.public_key,
    endpoint: formatEndpoint(server.endpoint_host, server.endpoint_port),
    allowedIps: ["0.0.0.0/0", "::/0"],
    persistentKeepalive: 25,
    mtu: server.mtu,
  };
}

export function formatEndpoint(host: string, port: number): string {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]:${port}` : `${host}:${port}`;
}

export async function removeDevice(deps: Deps, p: Principal, deviceId: string): Promise<void> {
  const { rows } = await deps.db.query("select 1 from devices where id = $1 and user_id = $2", [deviceId, p.userId]);
  if (!rows[0]) throw notFound("device_not_found");
  await revokeDevicePeers(deps, deviceId);
  await deps.db.query("delete from devices where id = $1", [deviceId]);
}

/** Swaps a device's key and revokes every peer that used the old one. */
export async function rotateDeviceKey(deps: Deps, p: Principal, oldKey: string, newKey: string): Promise<void> {
  if (!isWireGuardKey(oldKey) || !isWireGuardKey(newKey) || oldKey === newKey) throw badRequest("invalid_public_key");
  const { rows } = await deps.db.query<{ id: string; user_id: string }>("select id, user_id from devices where public_key = $1", [oldKey]);
  const device = rows[0];
  if (!device) return; // never registered: nothing to revoke
  if (device.user_id !== p.userId) throw notFound("device_not_found");
  await revokeDevicePeers(deps, device.id);
  try {
    await deps.db.query("update devices set public_key = $2 where id = $1", [device.id, newKey]);
  } catch {
    throw new HttpError(409, "key_in_use");
  }
}

export { indexOf };
