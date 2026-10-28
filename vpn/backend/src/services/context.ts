import type { Config } from "../config.js";
import type { Sealer } from "../crypto.js";
import type { Db } from "../db.js";
import type { GatewayClient } from "../gateway.js";
import type { PlayApi } from "../google.js";

/** Everything services need, injected so tests can swap the outside world. */
export interface Deps {
  db: Db;
  config: Config;
  sealer: Sealer;
  gateways: GatewayClient;
  play: PlayApi | null;
  /** Deletes the Supabase auth user; null when no service role key is set. */
  deleteAuthUser: ((userId: string) => Promise<void>) | null;
  log: { info(o: object, msg?: string): void; warn(o: object, msg?: string): void; error(o: object, msg?: string): void };
}

export function supabaseUserDeleter(supabaseUrl: string, serviceRoleKey: string) {
  return async (userId: string) => {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    // 404: already gone, which is the outcome we want.
    if (!res.ok && res.status !== 404) throw new Error(`supabase delete user failed: ${res.status}`);
  };
}
