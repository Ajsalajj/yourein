import { grantsPremium } from "../google.js";
import type { ServerRow } from "../types.js";
import type { Deps } from "./context.js";
import { desiredPeers, removeOrQueue } from "./peers.js";

const OFFLINE_AFTER_FAILURES = 3;
const FULL_SYNC_EVERY = 10;

/**
 * Periodic gateway housekeeping:
 *  - health-check each gateway and record aggregate load and counters
 *    (never per-user traffic);
 *  - retry queued peer revocations;
 *  - fully re-sync a gateway's peers when it comes back and periodically,
 *    so the gateway always matches the database;
 *  - drop peers on premium gateways whose owners no longer have Premium,
 *    and peers of suspended users.
 */
export class Monitor {
  private round = 0;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly deps: Deps) {}

  start(intervalS: number) {
    if (intervalS <= 0) return;
    this.timer = setInterval(() => void this.tick(), intervalS * 1000);
    void this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.round++;
    try {
      const { rows: servers } = await this.deps.db.query<ServerRow>("select * from servers where enabled");
      for (const s of servers) await this.check(s);
      await this.enforceEntitlements();
    } catch (e) {
      this.deps.log.error({ err: (e as Error).message }, "monitor tick failed");
    } finally {
      this.running = false;
    }
  }

  private async check(server: ServerRow) {
    const { db, gateways, log } = this.deps;
    try {
      const h = await gateways.health(server);
      const load = Math.max(0, Math.min(100, Math.round((h.activePeers / Math.max(1, server.capacity)) * 100)));
      const recovered = server.failures >= OFFLINE_AFTER_FAILURES || server.last_seen_at === null;
      await db.query(
        `update servers set failures = 0, last_seen_at = now(), load_percent = $2, active_peers = $3, rx_bytes = $4, tx_bytes = $5,
                status = case when status = 'maintenance' then status else 'online' end
          where id = $1`,
        [server.id, load, h.activePeers, h.rxBytes, h.txBytes],
      );
      if (recovered || this.round % FULL_SYNC_EVERY === 0) {
        await gateways.syncPeers(server, await desiredPeers(db, server.id));
      }
      await this.retryRevocations(server);
    } catch (e) {
      log.warn({ server: server.id, err: (e as Error).message }, "gateway health check failed");
      await db.query(
        `update servers set failures = failures + 1,
                status = case when status = 'maintenance' then status
                              when failures + 1 >= $2 then 'offline' else status end
          where id = $1`,
        [server.id, OFFLINE_AFTER_FAILURES],
      );
    }
  }

  private async retryRevocations(server: ServerRow) {
    const { db, gateways } = this.deps;
    const { rows } = await db.query<{ public_key: string; still_wanted: boolean }>(
      `select r.public_key,
              exists (select 1 from peers p join devices d on d.id = p.device_id
                       where p.server_id = r.server_id and d.public_key = r.public_key) as still_wanted
         from pending_revocations r where r.server_id = $1`,
      [server.id],
    );
    for (const r of rows) {
      if (!r.still_wanted) await gateways.removePeer(server, r.public_key);
      await db.query("delete from pending_revocations where server_id = $1 and public_key = $2", [server.id, r.public_key]);
    }
  }

  private async enforceEntitlements() {
    const { db } = this.deps;
    const { rows } = await db.query<ServerRow & { device_id: string; device_key: string; user_id: string; suspended: boolean }>(
      `select s.*, p.device_id, d.public_key as device_key, d.user_id, (u.suspended_at is not null) as suspended
         from peers p join servers s on s.id = p.server_id join devices d on d.id = p.device_id join users u on u.id = d.user_id
        where s.tier = 'premium' or u.suspended_at is not null`,
    );
    const now = new Date();
    for (const r of rows) {
      let keep = !r.suspended;
      if (keep && r.tier === "premium") {
        const { rows: subs } = await db.query<{ state: string; expires_at: Date | null }>(
          "select state, expires_at from subscriptions where user_id = $1 and replaced_by is null",
          [r.user_id],
        );
        keep = subs.some((s) => grantsPremium({ state: s.state as never, expiresAt: s.expires_at }, now));
      }
      if (!keep) {
        await removeOrQueue(this.deps, r, r.device_key);
        await db.query("delete from peers where device_id = $1 and server_id = $2", [r.device_id, r.id]);
      }
    }
  }
}
