/**
 * Tests for the price setting, admin access, setup checks and CSV safety.  npm run test:admin
 * Pure logic only: no server, database or network needed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePrice, priceLabel, DEFAULT_PRICE } from "../../src/config/price";
import { ADMIN_SESSION_MS, adminConfigured, adminEmails, codeMatches, isAdminEmail, makeAdminToken, verifyAdminToken } from "../../src/server/admin-access";
import { csvCell, rupees } from "../../src/server/admin";
import { maskKeyId, setupChecks } from "../../src/server/payments/status";

/* ------------------------------------------------------------ price */
test("the price defaults to ₹1 and only accepts whole rupees from 1 to 100000", () => {
  assert.equal(DEFAULT_PRICE, 1);
  assert.equal(parsePrice(undefined), 1);
  assert.equal(parsePrice(""), 1);
  assert.equal(parsePrice("999"), 999);
  assert.equal(parsePrice(" 1499 "), 1499);
  for (const bad of ["0", "-5", "1.5", "abc", "99.99", "1e3", "100001", "9999999", "₹999"]) assert.equal(parsePrice(bad), 1, bad);
  assert.equal(parsePrice("nope", 999), 999);
});

test("the price label uses Indian digit grouping", () => {
  assert.equal(priceLabel(1), "₹1");
  assert.equal(priceLabel(999), "₹999");
  assert.equal(priceLabel(1499), "₹1,499");
  assert.equal(priceLabel(100000), "₹1,00,000");
});

test("rupees() formats paise and drops empty decimals", () => {
  assert.equal(rupees(100), "₹1");
  assert.equal(rupees(99900), "₹999");
  assert.equal(rupees(150), "₹1.50");
  assert.equal(rupees(0), "₹0");
});

/* ------------------------------------------------------------ admin access */
const env = { ADMIN_EMAILS: "Owner@Example.com, partner@example.com", ADMIN_ACCESS_CODE: "a-long-secret-code" };

test("admin is off unless both an email and a long enough code are set", () => {
  assert.equal(adminConfigured(env), true);
  assert.equal(adminConfigured({ ADMIN_EMAILS: env.ADMIN_EMAILS }), false);
  assert.equal(adminConfigured({ ADMIN_ACCESS_CODE: env.ADMIN_ACCESS_CODE }), false);
  assert.equal(adminConfigured({ ADMIN_EMAILS: env.ADMIN_EMAILS, ADMIN_ACCESS_CODE: "short" }), false);
  assert.equal(adminConfigured({}), false);
  assert.equal(isAdminEmail("owner@example.com", {}), false, "no config means nobody is an admin");
});

test("the email allowlist ignores case and spacing, and rejects everyone else", () => {
  assert.deepEqual(adminEmails(env), ["owner@example.com", "partner@example.com"]);
  assert.equal(isAdminEmail("OWNER@example.com", env), true);
  assert.equal(isAdminEmail("  partner@example.com ", env), true);
  assert.equal(isAdminEmail("stranger@example.com", env), false);
  assert.equal(isAdminEmail("", env), false);
  assert.equal(isAdminEmail(null, env), false);
  assert.equal(isAdminEmail("owner@example.com.evil.com", env), false);
});

test("the access code must match exactly", () => {
  assert.equal(codeMatches("a-long-secret-code", env), true);
  assert.equal(codeMatches("a-long-secret-cod", env), false);
  assert.equal(codeMatches("A-LONG-SECRET-CODE", env), false);
  assert.equal(codeMatches("", env), false);
  assert.equal(codeMatches(undefined, env), false);
  assert.equal(codeMatches(123, env), false);
  assert.equal(codeMatches("anything", { ADMIN_ACCESS_CODE: "" }), false, "an empty code never matches");
});

test("an admin cookie is bound to one user, expires, and cannot be forged", () => {
  const secret = "app-secret-for-tests";
  const now = 1_800_000_000_000;
  const token = makeAdminToken(secret, "user-1", now);
  assert.equal(verifyAdminToken(secret, token, "user-1", now + 1000), true);
  assert.equal(verifyAdminToken(secret, token, "user-2", now + 1000), false, "another user cannot reuse it");
  assert.equal(verifyAdminToken("other-secret", token, "user-1", now + 1000), false, "signed with a different secret");
  assert.equal(verifyAdminToken(secret, token, "user-1", now + ADMIN_SESSION_MS + 1), false, "expired");
  assert.equal(verifyAdminToken(secret, undefined, "user-1", now), false);
  assert.equal(verifyAdminToken(secret, "", "user-1", now), false);
  assert.equal(verifyAdminToken(secret, "garbage", "user-1", now), false);
  const [exp, mac] = token.split(".");
  assert.equal(verifyAdminToken(secret, `${Number(exp) + 3_600_000}.${mac}`, "user-1", now), false, "the expiry cannot be extended");
  assert.equal(verifyAdminToken(secret, `${exp}.${mac.slice(0, -1)}0`, "user-1", now), false, "a changed signature is rejected");
  assert.equal(verifyAdminToken(secret, `${now + 10 * ADMIN_SESSION_MS}.${mac}`, "user-1", now), false, "an expiry far in the future is rejected");
});

/* ------------------------------------------------------------ setup checks */
const ctx = (over = {}) => ({ price: 999, databaseKind: "postgres" as const, origin: "https://www.yourein.in", production: true, ...over });
const byId = (checks: ReturnType<typeof setupChecks>, id: string) => checks.find((c) => c.id === id)!;
const goodEnv = { RAZORPAY_KEY_ID: "rzp_live_abcdef123456", RAZORPAY_KEY_SECRET: "secret", RAZORPAY_WEBHOOK_SECRET: "hook", AUTH_SECRET: "x", NEXT_PUBLIC_SITE_URL: "https://www.yourein.in" };

test("setup checks pass for a complete live configuration", () => {
  const c = setupChecks(goodEnv, ctx());
  assert.ok(c.every((x) => x.state === "ok"), JSON.stringify(c.filter((x) => x.state !== "ok")));
});

test("setup checks tell test keys from live keys", () => {
  assert.equal(byId(setupChecks({ ...goodEnv, RAZORPAY_KEY_ID: "rzp_test_abcdef123456" }, ctx()), "mode").state, "warn");
  assert.equal(byId(setupChecks(goodEnv, ctx()), "mode").state, "ok");
});

test("setup checks catch missing and half-set Razorpay keys, and never print a secret", () => {
  assert.equal(byId(setupChecks({ ...goodEnv, RAZORPAY_KEY_SECRET: undefined }, ctx()), "keys").state, "bad");
  assert.equal(byId(setupChecks({ ...goodEnv, RAZORPAY_KEY_ID: undefined }, ctx()), "keys").state, "bad");
  assert.equal(byId(setupChecks({}, ctx()), "keys").state, "bad");
  assert.equal(byId(setupChecks({}, ctx({ production: false })), "keys").state, "warn");
  const text = JSON.stringify(setupChecks({ ...goodEnv, RAZORPAY_KEY_SECRET: "s3cr3t-value-xyz", RAZORPAY_WEBHOOK_SECRET: "hook-value-xyz", AUTH_SECRET: "auth-value-xyz" }, ctx()));
  for (const hidden of ["s3cr3t-value-xyz", "hook-value-xyz", "auth-value-xyz"]) assert.ok(!text.includes(hidden), `${hidden} must never appear in the setup report`);
  assert.ok(!text.includes("rzp_live_abcdef123456"), "the full key id must not appear");
  assert.ok(text.includes("rzp_live_••••3456"));
});

test("setup checks flag a database that would lose payments, and simulated payments left on", () => {
  assert.equal(byId(setupChecks(goodEnv, ctx({ databaseKind: "embedded" })), "database").state, "bad");
  assert.equal(byId(setupChecks(goodEnv, ctx({ databaseKind: "embedded", production: false })), "database").state, "warn");
  const free = setupChecks({ AUTH_SECRET: "x", YOUREIN_TEST_PAYMENTS: "1" }, ctx());
  assert.equal(byId(free, "free").state, "bad", "anyone could publish without paying");
  assert.equal(setupChecks(goodEnv, ctx()).some((c) => c.id === "free"), false);
});

test("setup checks warn about a missing webhook secret and about the test price", () => {
  assert.equal(byId(setupChecks({ ...goodEnv, RAZORPAY_WEBHOOK_SECRET: undefined }, ctx()), "webhook").state, "warn");
  assert.equal(byId(setupChecks(goodEnv, ctx({ price: 1 })), "price").state, "warn");
  assert.equal(byId(setupChecks(goodEnv, ctx({ price: 999 })), "price").state, "ok");
});

test("maskKeyId keeps only the start and the last four characters", () => {
  assert.equal(maskKeyId("rzp_test_Ab12Cd34Ef56"), "rzp_test_••••Ef56");
  assert.equal(maskKeyId("rzp_live_Ab12Cd34Ef56"), "rzp_live_••••Ef56");
  assert.equal(maskKeyId("short"), "••••");
});

/* ------------------------------------------------------------ CSV */
test("CSV cells are quoted when needed and cannot run as spreadsheet formulas", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(42), "42");
  for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)"]) assert.ok(csvCell(evil).replace(/^"/, "").startsWith("'"), evil);
});
