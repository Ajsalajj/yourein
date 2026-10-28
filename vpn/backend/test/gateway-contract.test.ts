// Contract test: the API's gateway client against the real agent handler
// (with an in-memory `wg`), proving both sides agree on the signed protocol.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createHandler } from "../../gateway-agent/src/agent.js";
import type { Wg } from "../../gateway-agent/src/wg.js";
import { Sealer } from "../src/crypto.js";
import { HttpGatewayClient } from "../src/gateway.js";
import type { ServerRow } from "../src/types.js";

class MemoryWg {
  peers = new Map<string, string[]>();
  async setPeer(k: string, ips: string[]) { this.peers.set(k, ips); }
  async removePeer(k: string) { this.peers.delete(k); }
  async peers_() { return [...this.peers].map(([publicKey, allowedIps]) => ({ publicKey, allowedIps, latestHandshake: Math.floor(Date.now() / 1000), rx: 10, tx: 5 })); }
}

test("API client and gateway agent interoperate", async () => {
  const secret = randomBytes(32).toString("base64url");
  const mem = new MemoryWg();
  const wg = { setPeer: mem.setPeer.bind(mem), removePeer: mem.removePeer.bind(mem), peers: mem.peers_.bind(mem) } as unknown as Wg;
  const srv = createServer(createHandler({ secret, wg }));
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const sealer = new Sealer(randomBytes(32).toString("base64"));
    const server = {
      id: "t", agent_url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, agent_secret_sealed: sealer.seal(secret),
    } as ServerRow;
    const client = new HttpGatewayClient(sealer);
    const key = randomBytes(32).toString("base64");
    await client.addPeer(server, { publicKey: key, allowedIps: ["10.64.0.2/32"] });
    await client.addPeer(server, { publicKey: key, allowedIps: ["10.64.0.2/32"] }); // identical retry within the same second
    assert.deepEqual(mem.peers.get(key), ["10.64.0.2/32"]);
    assert.equal((await client.health(server)).activePeers, 1);
    await client.syncPeers(server, []);
    assert.equal(mem.peers.size, 0);

    const wrong = { ...server, agent_secret_sealed: sealer.seal("x".repeat(43)) };
    await assert.rejects(client.health(wrong), /401/);
  } finally {
    srv.close();
  }
});
