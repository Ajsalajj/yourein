import { randomBytes } from "node:crypto";
import { signRequest, type Sealer } from "./crypto.js";
import type { ServerRow } from "./types.js";

export interface PeerSpec {
  publicKey: string;
  allowedIps: string[];
}

export interface GatewayHealth {
  /** Peers configured on the interface. */
  peers: number;
  /** Peers with a handshake in the last 3 minutes. */
  activePeers: number;
  /** Interface byte counters (aggregate, all peers). */
  rxBytes: number;
  txBytes: number;
}

/** Control channel to the agent running on each WireGuard gateway. */
export interface GatewayClient {
  addPeer(server: ServerRow, peer: PeerSpec): Promise<void>;
  removePeer(server: ServerRow, publicKey: string): Promise<void>;
  syncPeers(server: ServerRow, peers: PeerSpec[]): Promise<void>;
  health(server: ServerRow): Promise<GatewayHealth>;
}

export class GatewayError extends Error {}

/**
 * HTTPS client for gateway agents. Every request carries a timestamp and
 * an HMAC over method, path and body with the gateway's own secret (sealed
 * at rest in the database), so a leaked secret affects one gateway only.
 */
export class HttpGatewayClient implements GatewayClient {
  constructor(
    private readonly sealer: Sealer,
    private readonly timeoutMs = 6000,
  ) {}

  private async call(server: ServerRow, method: string, path: string, body?: unknown): Promise<unknown> {
    const secret = this.sealer.open(server.agent_secret_sealed);
    const payload = body === undefined ? "" : JSON.stringify(body);
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString("hex");
    const res = await fetch(new URL(path, server.agent_url), {
      method,
      headers: {
        "content-type": "application/json",
        "x-orvane-ts": ts,
        "x-orvane-nonce": nonce,
        "x-orvane-signature": signRequest(secret, ts, nonce, method, path, payload),
      },
      body: payload || undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch((e: unknown) => {
      throw new GatewayError(`gateway ${server.id} unreachable: ${(e as Error).name}`);
    });
    if (!res.ok) throw new GatewayError(`gateway ${server.id} returned ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  async addPeer(server: ServerRow, peer: PeerSpec) {
    await this.call(server, "PUT", `/v1/peers/${encodeURIComponent(peer.publicKey)}`, { allowedIps: peer.allowedIps });
  }

  async removePeer(server: ServerRow, publicKey: string) {
    await this.call(server, "DELETE", `/v1/peers/${encodeURIComponent(publicKey)}`);
  }

  async syncPeers(server: ServerRow, peers: PeerSpec[]) {
    await this.call(server, "PUT", "/v1/peers", { peers });
  }

  async health(server: ServerRow): Promise<GatewayHealth> {
    const h = (await this.call(server, "GET", "/v1/health")) as Partial<GatewayHealth>;
    return {
      peers: Number(h.peers ?? 0),
      activePeers: Number(h.activePeers ?? 0),
      rxBytes: Number(h.rxBytes ?? 0),
      txBytes: Number(h.txBytes ?? 0),
    };
  }
}
