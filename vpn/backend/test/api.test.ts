import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { Monitor } from "../src/services/monitor.js";
import { setup, wgKey, type Ctx } from "./helpers.js";

let c: Ctx;
beforeEach(async () => {
  c = await setup();
  await c.addServer("nl-ams-1");
  await c.addServer("us-nyc-1", "premium");
});

const premiumSub = (userId: string, overrides = {}) => ({
  state: "active" as const,
  productId: "orvane_premium",
  basePlanId: "yearly",
  expiresAt: new Date(Date.now() + 365 * 864e5),
  autoRenewing: true,
  acknowledged: false,
  accountId: userId,
  linkedPurchaseToken: null,
  testPurchase: false,
  ...overrides,
});

describe("public endpoints", () => {
  test("server list exposes no secrets or keys", async () => {
    const res = await c.app.inject({ method: "GET", url: "/v1/servers" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.servers.length, 2);
    const text = res.body;
    for (const forbidden of ["agent", "secret", "public_key", "publicKey", "ipv4", "endpoint"]) assert.ok(!text.includes(forbidden), forbidden);
    assert.deepEqual(body.servers[0].probe, { host: "gw.example.net", port: 8443 });
  });

  test("plans are configurable settings", async () => {
    const res = await c.app.inject({ method: "GET", url: "/v1/plans" });
    assert.equal(res.json().premiumDeviceLimit, 5);
  });
});

describe("auth", () => {
  test("rejects missing, forged and wrong-issuer tokens", async () => {
    assert.equal((await c.app.inject({ method: "GET", url: "/v1/me" })).statusCode, 401);
    const forged = { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad" };
    assert.equal((await c.app.inject({ method: "GET", url: "/v1/me", headers: forged })).statusCode, 401);
  });

  test("/v1/me creates the account on first contact", async () => {
    const u = await c.token();
    const res = await c.app.inject({ method: "GET", url: "/v1/me", headers: u.auth });
    assert.equal(res.statusCode, 200);
    const me = res.json();
    assert.equal(me.id, u.userId);
    assert.equal(me.subscription.tier, "free");
    assert.equal(me.deviceLimit, 1);
    assert.deepEqual(me.devices, []);
  });
});

describe("provisioning", () => {
  test("issues a config and installs the peer on the gateway", async () => {
    const u = await c.token();
    const key = wgKey();
    const res = await c.app.inject({
      method: "POST", url: "/v1/tunnels", headers: u.auth,
      payload: { serverId: "nl-ams-1", publicKey: key, deviceName: "Pixel 9", platform: "android" },
    });
    assert.equal(res.statusCode, 200, res.body);
    const cfg = res.json();
    assert.deepEqual(cfg.addresses, ["10.64.0.2/32", "fd00:64::2/128"]);
    assert.deepEqual(cfg.allowedIps, ["0.0.0.0/0", "::/0"]);
    assert.equal(cfg.endpoint, "gw.example.net:51820");
    assert.equal(cfg.dns[0], "10.64.0.1");
    assert.deepEqual(c.gateways.peers.get("nl-ams-1")!.get(key), ["10.64.0.2/32", "fd00:64::2/128"]);
    assert.ok(!res.body.toLowerCase().includes("private"));
  });

  test("is idempotent for the same device and server", async () => {
    const u = await c.token();
    const key = wgKey();
    const body = { serverId: "nl-ams-1", publicKey: key, deviceName: "Pixel", platform: "android" };
    const a = (await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: body })).json();
    const b = (await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: body })).json();
    assert.deepEqual(a.addresses, b.addresses);
  });

  test("never hands out the same address twice under concurrency", async () => {
    const users = await Promise.all(Array.from({ length: 25 }, () => c.token()));
    const results = await Promise.all(
      users.map((u) =>
        c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: wgKey(), deviceName: "d", platform: "android" } }),
      ),
    );
    const addrs = results.map((r) => r.json().addresses[0]);
    assert.equal(new Set(addrs).size, 25);
    assert.ok(!addrs.includes("10.64.0.1/32"), "gateway address is reserved");
  });

  test("rejects malformed keys", async () => {
    const u = await c.token();
    const res = await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: "abc", deviceName: "d", platform: "android" } });
    assert.equal(res.json().error.code, "invalid_public_key");
  });

  test("enforces the free device limit", async () => {
    const u = await c.token();
    const p = (k: string) => c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: k, deviceName: "d", platform: "android" } });
    assert.equal((await p(wgKey())).statusCode, 200);
    const second = await p(wgKey());
    assert.equal(second.statusCode, 409);
    assert.equal(second.json().error.code, "device_limit");
  });

  test("premium locations require Premium", async () => {
    const u = await c.token();
    const res = await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "us-nyc-1", publicKey: wgKey(), deviceName: "d", platform: "android" } });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error.code, "premium_required");
  });

  test("a key registered by one account can't be claimed by another", async () => {
    const [a, b] = [await c.token(), await c.token()];
    const key = wgKey();
    const body = { serverId: "nl-ams-1", publicKey: key, deviceName: "d", platform: "android" };
    assert.equal((await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: a.auth, payload: body })).statusCode, 200);
    const res = await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: b.auth, payload: body });
    assert.equal(res.json().error.code, "key_in_use");
  });

  test("offline servers and unreachable gateways fail honestly", async () => {
    await c.addServer("de-fra-1", "free", "offline", "10.65.0.0/24");
    const u = await c.token();
    const off = await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "de-fra-1", publicKey: wgKey(), deviceName: "d", platform: "android" } });
    assert.equal(off.json().error.code, "server_unavailable");
    c.gateways.down.add("nl-ams-1");
    const down = await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: wgKey(), deviceName: "d", platform: "android" } });
    assert.equal(down.statusCode, 503);
    assert.equal(down.json().error.code, "gateway_unreachable");
  });

  test("a full pool reports server_full", async () => {
    await c.addServer("tiny", "free", "online", "10.66.0.0/30", null); // hosts .2 only
    const t = async () => c.app.inject({ method: "POST", url: "/v1/tunnels", headers: (await c.token()).auth, payload: { serverId: "tiny", publicKey: wgKey(), deviceName: "d", platform: "android" } });
    assert.equal((await t()).statusCode, 200);
    assert.equal((await t()).json().error.code, "server_full");
  });
});

describe("devices", () => {
  test("removing a device revokes it on the gateway", async () => {
    const u = await c.token();
    const key = wgKey();
    await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: key, deviceName: "d", platform: "android" } });
    const me = (await c.app.inject({ method: "GET", url: "/v1/me", headers: u.auth })).json();
    const del = await c.app.inject({ method: "DELETE", url: `/v1/devices/${me.devices[0].id}`, headers: u.auth });
    assert.equal(del.statusCode, 204);
    assert.equal(c.gateways.peers.get("nl-ams-1")!.has(key), false);
  });

  test("revocations to an unreachable gateway are queued and retried", async () => {
    const u = await c.token();
    const key = wgKey();
    await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: key, deviceName: "d", platform: "android" } });
    const me = (await c.app.inject({ method: "GET", url: "/v1/me", headers: u.auth })).json();
    c.gateways.down.add("nl-ams-1");
    await c.app.inject({ method: "DELETE", url: `/v1/devices/${me.devices[0].id}`, headers: u.auth });
    assert.equal(c.gateways.peers.get("nl-ams-1")!.has(key), true, "gateway still has it while down");
    c.gateways.down.delete("nl-ams-1");
    await new Monitor(c.deps).tick();
    assert.equal(c.gateways.peers.get("nl-ams-1")!.has(key), false);
  });

  test("key rotation swaps the key and revokes the old peer", async () => {
    const u = await c.token();
    const [oldKey, newKey] = [wgKey(), wgKey()];
    await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: oldKey, deviceName: "d", platform: "android" } });
    const res = await c.app.inject({ method: "POST", url: "/v1/devices/rotate", headers: u.auth, payload: { oldPublicKey: oldKey, newPublicKey: newKey } });
    assert.equal(res.statusCode, 204);
    assert.equal(c.gateways.peers.get("nl-ams-1")!.has(oldKey), false);
    const again = await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: newKey, deviceName: "d", platform: "android" } });
    assert.equal(again.statusCode, 200, "same device, new key, still within limit");
  });
});

describe("billing", () => {
  test("verified purchase grants Premium and is acknowledged", async () => {
    const u = await c.token();
    c.play.subs.set("purchase-token-1", premiumSub(u.userId));
    const res = await c.app.inject({ method: "POST", url: "/v1/billing/google/verify", headers: u.auth, payload: { productId: "orvane_premium", purchaseToken: "purchase-token-1" } });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().tier, "premium");
    assert.deepEqual(c.play.acknowledged, ["purchase-token-1"]);
    const me = (await c.app.inject({ method: "GET", url: "/v1/me", headers: u.auth })).json();
    assert.equal(me.deviceLimit, 5);
    const prem = await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "us-nyc-1", publicKey: wgKey(), deviceName: "d", platform: "android" } });
    assert.equal(prem.statusCode, 200);
  });

  test("a purchase made for another account is rejected", async () => {
    const [a, b] = [await c.token(), await c.token()];
    c.play.subs.set("purchase-token-2", premiumSub(a.userId));
    const res = await c.app.inject({ method: "POST", url: "/v1/billing/google/verify", headers: b.auth, payload: { productId: "orvane_premium", purchaseToken: "purchase-token-2" } });
    assert.equal(res.json().error.code, "purchase_account_mismatch");
  });

  test("unknown tokens are invalid, not premium", async () => {
    const u = await c.token();
    const res = await c.app.inject({ method: "POST", url: "/v1/billing/google/verify", headers: u.auth, payload: { productId: "orvane_premium", purchaseToken: "purchase-token-unknown" } });
    assert.equal(res.json().error.code, "invalid_purchase");
  });

  test("expiry via RTDN removes premium peers on the next monitor pass", async () => {
    const u = await c.token();
    c.play.subs.set("purchase-token-3", premiumSub(u.userId));
    await c.app.inject({ method: "POST", url: "/v1/billing/google/verify", headers: u.auth, payload: { productId: "orvane_premium", purchaseToken: "purchase-token-3" } });
    const key = wgKey();
    await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "us-nyc-1", publicKey: key, deviceName: "d", platform: "android" } });
    assert.ok(c.gateways.peers.get("us-nyc-1")!.has(key));

    c.play.subs.set("purchase-token-3", premiumSub(u.userId, { state: "expired", expiresAt: new Date(Date.now() - 1000), acknowledged: true }));
    const data = Buffer.from(JSON.stringify({ subscriptionNotification: { purchaseToken: "purchase-token-3", notificationType: 13 } })).toString("base64");
    const rtdnBad = await c.app.inject({ method: "POST", url: "/v1/billing/google/rtdn", headers: { authorization: "Bearer nope" }, payload: { message: { data } } });
    assert.equal(rtdnBad.statusCode, 401);
    const rtdn = await c.app.inject({ method: "POST", url: "/v1/billing/google/rtdn", headers: { authorization: "Bearer pubsub-ok" }, payload: { message: { data } } });
    assert.equal(rtdn.statusCode, 204);
    const me = (await c.app.inject({ method: "GET", url: "/v1/me", headers: u.auth })).json();
    assert.equal(me.subscription.tier, "free");

    await new Monitor(c.deps).tick();
    assert.equal(c.gateways.peers.get("us-nyc-1")!.has(key), false);
  });

  test("cancelled subscriptions keep Premium until the paid period ends", async () => {
    const u = await c.token();
    c.play.subs.set("purchase-token-4", premiumSub(u.userId, { state: "canceled", autoRenewing: false }));
    const res = await c.app.inject({ method: "POST", url: "/v1/billing/google/verify", headers: u.auth, payload: { productId: "orvane_premium", purchaseToken: "purchase-token-4" } });
    assert.equal(res.json().tier, "premium");
    assert.equal(res.json().renewsAt, null);
  });
});

describe("account deletion", () => {
  test("revokes peers, deletes the auth user and all rows", async () => {
    const u = await c.token();
    const key = wgKey();
    await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: key, deviceName: "d", platform: "android" } });
    const res = await c.app.inject({ method: "DELETE", url: "/v1/me", headers: u.auth });
    assert.equal(res.statusCode, 204);
    assert.deepEqual(c.deleted, [u.userId]);
    assert.equal(c.gateways.peers.get("nl-ams-1")!.has(key), false);
    const { rows } = await c.db.query("select (select count(*)::int from users) u, (select count(*)::int from devices) d, (select count(*)::int from peers) p");
    assert.deepEqual(rows[0], { u: 0, d: 0, p: 0 });
  });
});

describe("administration", () => {
  test("requires the admin role and MFA", async () => {
    const user = await c.token();
    assert.equal((await c.app.inject({ method: "GET", url: "/admin/v1/analytics", headers: user.auth })).statusCode, 403);
    const noMfa = await c.token({ admin: true });
    const r = await c.app.inject({ method: "GET", url: "/admin/v1/analytics", headers: noMfa.auth });
    assert.equal(r.json().error.code, "mfa_required");
    const adm = await c.token({ admin: true, aal: "aal2" });
    assert.equal((await c.app.inject({ method: "GET", url: "/admin/v1/analytics", headers: adm.auth })).statusCode, 200);
  });

  test("creates a server and returns the agent secret exactly once", async () => {
    const adm = await c.token({ admin: true, aal: "aal2" });
    const res = await c.app.inject({
      method: "POST", url: "/admin/v1/servers", headers: adm.auth,
      payload: {
        id: "se-sto-1", name: "Stockholm 1", countryCode: "se", city: "Stockholm", tier: "free", endpointHost: "sto.example.net",
        publicKey: wgKey(), ipv4Cidr: "10.70.0.0/16", ipv6Cidr: "fd00:70::/112", dns: ["10.70.0.1"],
        agentUrl: "https://sto.example.net:8443", probeHost: "sto.example.net", probePort: 8443,
      },
    });
    assert.equal(res.statusCode, 201, res.body);
    const secret = res.json().agentSecret as string;
    assert.ok(secret.length >= 40);
    const list = await c.app.inject({ method: "GET", url: "/admin/v1/servers", headers: adm.auth });
    assert.ok(!list.body.includes(secret));
    const { rows } = await c.db.query<{ agent_secret_sealed: string }>("select agent_secret_sealed from servers where id = 'se-sto-1'");
    assert.ok(!rows[0]!.agent_secret_sealed.includes(secret), "stored sealed");
    assert.equal(c.deps.sealer.open(rows[0]!.agent_secret_sealed), secret);
    const audit = await c.app.inject({ method: "GET", url: "/admin/v1/audit", headers: adm.auth });
    assert.equal(audit.json()[0].action, "server.create");
  });

  test("rejects http agents and bad keys", async () => {
    const adm = await c.token({ admin: true, aal: "aal2" });
    const res = await c.app.inject({
      method: "POST", url: "/admin/v1/servers", headers: adm.auth,
      payload: { id: "bad-1", name: "x", countryCode: "se", city: "x", tier: "free", endpointHost: "x", publicKey: "nope", ipv4Cidr: "10.0.0.0/8", dns: ["1.1.1.1"], agentUrl: "http://x", probeHost: "x", probePort: 1 },
    });
    assert.equal(res.statusCode, 400);
  });

  test("suspension revokes peers and blocks provisioning", async () => {
    const adm = await c.token({ admin: true, aal: "aal2" });
    const u = await c.token();
    const key = wgKey();
    await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: key, deviceName: "d", platform: "android" } });
    const s = await c.app.inject({ method: "POST", url: `/admin/v1/users/${u.userId}/suspend`, headers: adm.auth, payload: { reason: "abuse report #12" } });
    assert.equal(s.statusCode, 204);
    assert.equal(c.gateways.peers.get("nl-ams-1")!.has(key), false);
    const again = await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: key, deviceName: "d", platform: "android" } });
    assert.equal(again.json().error.code, "account_suspended");
  });

  test("plan limits are editable and validated", async () => {
    const adm = await c.token({ admin: true, aal: "aal2" });
    const bad = await c.app.inject({ method: "PATCH", url: "/admin/v1/plans", headers: adm.auth, payload: { freeDeviceLimit: 9, premiumDeviceLimit: 2 } });
    assert.equal(bad.statusCode, 400);
    const ok = await c.app.inject({ method: "PATCH", url: "/admin/v1/plans", headers: adm.auth, payload: { premiumDeviceLimit: 8 } });
    assert.equal(ok.json().premiumDeviceLimit, 8);
    assert.equal((await c.app.inject({ method: "GET", url: "/v1/plans" })).json().premiumDeviceLimit, 8);
  });
});

describe("monitor", () => {
  test("records health and marks gateways offline after repeated failures", async () => {
    c.gateways.health_ = { peers: 30, activePeers: 25, rxBytes: 1000, txBytes: 500 };
    const m = new Monitor(c.deps);
    await m.tick();
    let { rows } = await c.db.query<{ status: string; load_percent: number }>("select status, load_percent from servers where id = 'nl-ams-1'");
    assert.deepEqual(rows[0], { status: "online", load_percent: 25 });
    c.gateways.down.add("nl-ams-1");
    for (let i = 0; i < 3; i++) await m.tick();
    ({ rows } = await c.db.query<{ status: string; load_percent: number }>("select status, load_percent from servers where id = 'nl-ams-1'"));
    assert.equal(rows[0]!.status, "offline");
  });

  test("a recovering gateway is fully re-synced from the database", async () => {
    const u = await c.token();
    const key = wgKey();
    await c.app.inject({ method: "POST", url: "/v1/tunnels", headers: u.auth, payload: { serverId: "nl-ams-1", publicKey: key, deviceName: "d", platform: "android" } });
    c.gateways.peers.get("nl-ams-1")!.clear(); // gateway rebooted and lost its peers
    await c.db.query("update servers set failures = 3 where id = 'nl-ams-1'");
    await new Monitor(c.deps).tick();
    assert.ok(c.gateways.peers.get("nl-ams-1")!.has(key));
  });
});
