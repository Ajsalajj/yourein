import type { Queryable } from "../db.js";
import { hostOf } from "../ipam.js";
import type { ServerRow } from "../types.js";
import type { Deps } from "./context.js";

/**
 * Removes a device's peers from every gateway and from the database.
 * If a gateway is unreachable the removal is queued and retried by the
 * monitor, so a revoked key never stays usable once the gateway is back.
 */
export async function revokeDevicePeers(deps: Deps, deviceId: string, onlyServerId?: string): Promise<void> {
  const { rows } = await deps.db.query<ServerRow & { device_key: string }>(
    `select s.*, d.public_key as device_key
       from peers p join servers s on s.id = p.server_id join devices d on d.id = p.device_id
      where p.device_id = $1 ${onlyServerId ? "and p.server_id = $2" : ""}`,
    onlyServerId ? [deviceId, onlyServerId] : [deviceId],
  );
  for (const server of rows) {
    await removeOrQueue(deps, server, server.device_key);
  }
  await deps.db.query(
    `delete from peers where device_id = $1 ${onlyServerId ? "and server_id = $2" : ""}`,
    onlyServerId ? [deviceId, onlyServerId] : [deviceId],
  );
}

export async function removeOrQueue(deps: Deps, server: ServerRow, publicKey: string): Promise<void> {
  try {
    await deps.gateways.removePeer(server, publicKey);
  } catch (e) {
    deps.log.warn({ server: server.id, err: (e as Error).message }, "peer removal queued");
    await deps.db.query(
      "insert into pending_revocations (server_id, public_key) values ($1, $2) on conflict do nothing",
      [server.id, publicKey],
    );
  }
}

/** Desired peer set for a gateway, for full reconciliation. */
export async function desiredPeers(q: Queryable, serverId: string) {
  const { rows } = await q.query<{ public_key: string; ipv4: string; ipv6: string | null }>(
    `select d.public_key, host(p.ipv4) as ipv4, host(p.ipv6) as ipv6
       from peers p join devices d on d.id = p.device_id join users u on u.id = d.user_id
      where p.server_id = $1 and u.suspended_at is null`,
    [serverId],
  );
  return rows.map((r) => ({
    publicKey: r.public_key,
    allowedIps: [`${hostOf(r.ipv4)}/32`, ...(r.ipv6 ? [`${hostOf(r.ipv6)}/128`] : [])],
  }));
}
