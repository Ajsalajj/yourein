import { randomBytes, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { buildApp } from "../src/app.js";
import { supabaseVerifier } from "../src/auth.js";
import { loadConfig } from "../src/config.js";
import { Sealer } from "../src/crypto.js";
import { pgliteDb } from "../src/db.js";
import type { GatewayClient, GatewayHealth, PeerSpec } from "../src/gateway.js";
import { PlayApiError, type PlayApi, type PlaySubscription } from "../src/google.js";
import { migrate } from "../src/migrate.js";
import type { Deps } from "../src/services/context.js";
import type { ServerRow } from "../src/types.js";

export const SUPABASE_URL = "https://test-project.supabase.co";
export const JWT_SECRET = "test-jwt-secret-that-is-long-enough-for-hs256";

/** Records calls; can be told to fail, like an unreachable gateway. */
export class FakeGateways implements GatewayClient {
  peers = new Map<string, Map<string, string[]>>(); // server -> key -> allowedIps
  down = new Set<string>();
  health_: GatewayHealth = { peers: 0, activePeers: 0, rxBytes: 0, txBytes: 0 };
  calls: string[] = [];

  private on(server: ServerRow) {
    if (this.down.has(server.id)) throw new Error("unreachable");
    if (!this.peers.has(server.id)) this.peers.set(server.id, new Map());
    return this.peers.get(server.id)!;
  }
  async addPeer(server: ServerRow, peer: PeerSpec) {
    this.calls.push(`add:${server.id}`);
    this.on(server).set(peer.publicKey, peer.allowedIps);
  }
  async removePeer(server: ServerRow, key: string) {
    this.calls.push(`remove:${server.id}`);
    this.on(server).delete(key);
  }
  async syncPeers(server: ServerRow, peers: PeerSpec[]) {
    this.calls.push(`sync:${server.id}`);
    const m = this.on(server);
    m.clear();
    for (const p of peers) m.set(p.publicKey, p.allowedIps);
  }
  async health(server: ServerRow) {
    this.on(server);
    return this.health_;
  }
}

export class FakePlay implements PlayApi {
  subs = new Map<string, PlaySubscription>();
  acknowledged: string[] = [];
  async getSubscription(token: string) {
    const s = this.subs.get(token);
    if (!s) throw new PlayApiError(404, "unknown token");
    return s;
  }
  async acknowledge(_productId: string, token: string) {
    this.acknowledged.push(token);
  }
}

export const wgKey = () => randomBytes(32).toString("base64");

export async function setup() {
  const config = loadConfig({
    NODE_ENV: "test",
    SUPABASE_URL,
    SUPABASE_JWT_SECRET: JWT_SECRET,
    SECRETS_KEY: randomBytes(32).toString("base64"),
    ADMIN_REQUIRE_MFA: "true",
  });
  const db = await pgliteDb();
  await migrate(db);
  const gateways = new FakeGateways();
  const play = new FakePlay();
  const deleted: string[] = [];
  const quiet = { info() {}, warn() {}, error() {} };
  const deps: Deps = {
    db,
    config,
    sealer: new Sealer(config.SECRETS_KEY),
    gateways,
    play,
    deleteAuthUser: async (id) => {
      deleted.push(id);
    },
    log: quiet,
  };
  const app = await buildApp({ deps, verify: supabaseVerifier(config), verifyPubsub: async (t) => t === "pubsub-ok" });

  async function token(opts: { userId?: string; email?: string; admin?: boolean; aal?: string } = {}) {
    const userId = opts.userId ?? randomUUID();
    const jwt = await new SignJWT({
      email: opts.email ?? `${userId.slice(0, 8)}@example.com`,
      role: "authenticated",
      aal: opts.aal ?? "aal1",
      app_metadata: opts.admin ? { orvane_role: "admin" } : {},
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(`${SUPABASE_URL}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(JWT_SECRET));
    return { userId, auth: { authorization: `Bearer ${jwt}` } };
  }

  async function addServer(id: string, tier: "free" | "premium" = "free", status = "online", v4 = "10.64.0.0/24", v6: string | null = "fd00:64::/112") {
    await db.query(
      `insert into servers (id, name, country_code, city, tier, status, endpoint_host, endpoint_port, public_key, ipv4_cidr, ipv6_cidr,
                            dns, agent_url, agent_secret_sealed, probe_host, probe_port, capacity, last_seen_at)
       values ($1, $1, 'NL', 'Amsterdam', $2, $3, 'gw.example.net', 51820, $4, $5, $6, '{10.64.0.1}', 'https://gw.example.net:8443',
               $7, 'gw.example.net', 8443, 100, now())`,
      [id, tier, status, wgKey(), v4, v6, deps.sealer.seal("agent-secret")],
    );
  }

  return { app, db, deps, gateways, play, deleted, token, addServer };
}

export type Ctx = Awaited<ReturnType<typeof setup>>;
