# Orvane gateway agent

Runs on every WireGuard gateway. Applies peer additions/removals and full syncs from the Orvane API using `wg set` (argv only, no shell; keys and CIDRs validated first), and reports aggregate health (peer counts and interface byte totals — nothing per user).

Every request must carry `x-orvane-ts`, `x-orvane-nonce` and `x-orvane-signature` = HMAC-SHA256(secret, `ts\nnonce\nMETHOD\npath\nsha256(body)`). Requests older than 60 s or replayed are rejected. The secret is issued once by the admin dashboard and sealed in the API's database.

| Method | Path | |
|---|---|---|
| GET | `/v1/health` | `{ peers, activePeers, rxBytes, txBytes }` |
| PUT | `/v1/peers/:publicKey` | `{ allowedIps: [...] }` |
| DELETE | `/v1/peers/:publicKey` | |
| PUT | `/v1/peers` | `{ peers: [{ publicKey, allowedIps }] }` — converge to exactly this set |

```bash
npm ci && npm test && npm run build
```

Server configuration (WireGuard, nftables, unbound without logging, hardened systemd unit) is in [`deploy/`](deploy); walkthrough in [`../docs/setup.md`](../docs/setup.md#3-a-wireguard-gateway-you-a-vps).
