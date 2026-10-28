import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { isWireGuardKey, safeEqualHex, Sealer, signRequest } from "../src/crypto.js";
import { grantsPremium, parseSubscriptionV2 } from "../src/google.js";
import { addressAt, bigToIpv6, indexOf, ipv6ToBig, nextFreeIndex } from "../src/ipam.js";
import { formatEndpoint } from "../src/services/tunnels.js";

test("ipam allocates lowest free host, skipping network and gateway", () => {
  assert.equal(nextFreeIndex("10.64.0.0/24", []), 2);
  assert.equal(nextFreeIndex("10.64.0.0/24", ["10.64.0.2", "10.64.0.4/32"]), 3);
  assert.equal(nextFreeIndex("10.64.0.0/30", ["10.64.0.2"]), null);
  assert.equal(addressAt("10.64.0.0/16", 258), "10.64.1.2");
  assert.equal(addressAt("fd00:64::/112", 258), "fd00:64::102");
  assert.equal(indexOf("10.64.0.0/16", "10.64.1.2/32"), 258);
});

test("ipv6 round-trips and compresses", () => {
  for (const ip of ["fd00::1", "2001:db8::8a2e:370:7334", "::1", "fe80::", "1:2:3:4:5:6:7:8"]) assert.equal(bigToIpv6(ipv6ToBig(ip)), ip);
});

test("wireguard key validation", () => {
  assert.ok(isWireGuardKey(randomBytes(32).toString("base64")));
  assert.ok(!isWireGuardKey(randomBytes(31).toString("base64")));
  assert.ok(!isWireGuardKey("A".repeat(42) + "B="), "non-canonical last character");
  assert.ok(!isWireGuardKey(42));
});

test("sealer round-trips and detects tampering", () => {
  const s = new Sealer(randomBytes(32).toString("base64"));
  const sealed = s.seal("top secret");
  assert.equal(s.open(sealed), "top secret");
  const parts = sealed.split(".");
  parts[2] = Buffer.from("tampered!!").toString("base64");
  assert.throws(() => s.open(parts.join(".")));
});

test("request signatures bind method, path and body", () => {
  const sig = signRequest("k", "1700000000", "n1", "PUT", "/v1/peers/x", "{}");
  assert.ok(safeEqualHex(sig, signRequest("k", "1700000000", "n1", "put", "/v1/peers/x", "{}")));
  assert.ok(!safeEqualHex(sig, signRequest("k", "1700000000", "n2", "PUT", "/v1/peers/x", "{}")));
  assert.ok(!safeEqualHex(sig, signRequest("k", "1700000000", "n1", "PUT", "/v1/peers/y", "{}")));
  assert.ok(!safeEqualHex(sig, signRequest("k", "1700000000", "n1", "PUT", "/v1/peers/x", "{ }")));
});

test("play subscriptionsv2 parsing and entitlement", () => {
  const s = parseSubscriptionV2({
    subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    externalAccountIdentifiers: { obfuscatedExternalAccountId: "u1" },
    lineItems: [{ productId: "orvane_premium", expiryTime: "2030-01-01T00:00:00Z", autoRenewingPlan: { autoRenewEnabled: true }, offerDetails: { basePlanId: "monthly" } }],
  });
  assert.equal(s.state, "grace");
  assert.equal(s.basePlanId, "monthly");
  assert.equal(s.accountId, "u1");
  assert.ok(grantsPremium(s));
  assert.ok(!grantsPremium({ state: "on_hold", expiresAt: new Date(Date.now() + 1e9) }));
  assert.ok(!grantsPremium({ state: "canceled", expiresAt: new Date(Date.now() - 1) }));
});

test("ipv6 endpoints are bracketed", () => {
  assert.equal(formatEndpoint("2001:db8::1", 51820), "[2001:db8::1]:51820");
  assert.equal(formatEndpoint("gw.example.net", 51820), "gw.example.net:51820");
});
