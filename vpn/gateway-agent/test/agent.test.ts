import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { createHandler } from "../src/agent.js";
import { Wg } from "../src/wg.js";

// A stand-in `wg` that keeps peers in a file and logs every argv.
const dir = mkdtempSync(join(tmpdir(), "fakewg-"));
const state = join(dir, "peers.tsv");
const log = join(dir, "calls.log");
const bin = join(dir, "wg");
writeFileSync(
  bin,
  `#!/usr/bin/env bash
echo "$*" >> "${log}"
touch "${state}"
if [ "$1" = show ]; then
  printf 'PRIV\\tPUB\\t51820\\toff\\n'; cat "${state}"; exit 0
fi
if [ "$1" = set ]; then
  key="$4"; grep -v "^$key	" "${state}" > "${state}.tmp" || true; mv "${state}.tmp" "${state}"
  if [ "$5" = allowed-ips ]; then printf '%s\\t(none)\\t1.2.3.4:5\\t%s\\t%s\\t100\\t50\\t25\\n' "$key" "$6" "$(date +%s)" >> "${state}"; fi
fi
`,
);
chmodSync(bin, 0o755);

const secret = randomBytes(32).toString("base64url");
let server: Server;
let base: string;
before(async () => {
  server = createServer(createHandler({ secret, wg: new Wg("wg0", bin) }));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());
beforeEach(() => {
  writeFileSync(state, "");
  writeFileSync(log, "");
});

const key = () => randomBytes(32).toString("base64");

async function call(method: string, path: string, body?: unknown, opts: { secret?: string; ts?: number; replay?: Record<string, string> } = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(payload).digest("hex");
  const sig = createHmac("sha256", opts.secret ?? secret).update(`${ts}\n${nonce}\n${method}\n${path}\n${hash}`).digest("hex");
  const headers = opts.replay ?? { "x-orvane-ts": ts, "x-orvane-nonce": nonce, "x-orvane-signature": sig };
  const res = await fetch(base + path, { method, headers: { ...headers, "content-type": "application/json" }, body: payload || undefined });
  return { status: res.status, json: res.status === 200 ? await res.json() : null, headers };
}

test("adds, lists and removes peers", async () => {
  const k = key();
  assert.equal((await call("PUT", `/v1/peers/${encodeURIComponent(k)}`, { allowedIps: ["10.64.0.2/32", "fd00:64::2/128"] })).status, 204);
  const h = await call("GET", "/v1/health");
  assert.deepEqual(h.json, { peers: 1, activePeers: 1, rxBytes: 100, txBytes: 50 });
  assert.equal((await call("DELETE", `/v1/peers/${encodeURIComponent(k)}`)).status, 204);
  assert.equal((await call("GET", "/v1/health")).json.peers, 0);
});

test("full sync converges to the desired set", async () => {
  const [a, b, c] = [key(), key(), key()];
  await call("PUT", `/v1/peers/${encodeURIComponent(a)}`, { allowedIps: ["10.64.0.2/32"] });
  await call("PUT", `/v1/peers/${encodeURIComponent(b)}`, { allowedIps: ["10.64.0.3/32"] });
  const r = await call("PUT", "/v1/peers", { peers: [{ publicKey: b, allowedIps: ["10.64.0.3/32"] }, { publicKey: c, allowedIps: ["10.64.0.4/32"] }] });
  assert.deepEqual(r.json, { added: 1, removed: 1, total: 2 });
  const keys = readFileSync(state, "utf8").trim().split("\n").map((l) => l.split("\t")[0]);
  assert.deepEqual(keys.sort(), [b, c].sort());
});

test("rejects bad signatures, stale timestamps and replays", async () => {
  assert.equal((await call("GET", "/v1/health", undefined, { secret: "wrong-secret-wrong-secret-wrong!" })).status, 401);
  assert.equal((await call("GET", "/v1/health", undefined, { ts: Math.floor(Date.now() / 1000) - 600 })).status, 401);
  const first = await call("GET", "/v1/health");
  assert.equal(first.status, 200);
  assert.equal((await call("GET", "/v1/health", undefined, { replay: first.headers })).status, 401);
});

test("validates keys and CIDRs before touching wg (no injection)", async () => {
  const k = key();
  assert.equal((await call("PUT", `/v1/peers/${encodeURIComponent("x; rm -rf /")}`, { allowedIps: ["10.0.0.2/32"] })).status, 400);
  assert.equal((await call("PUT", `/v1/peers/${encodeURIComponent(k)}`, { allowedIps: ["10.0.0.2/32 --evil"] })).status, 400);
  assert.equal((await call("PUT", `/v1/peers/${encodeURIComponent(k)}`, { allowedIps: [] })).status, 400);
  assert.equal(readFileSync(log, "utf8"), "", "wg never invoked");
});
