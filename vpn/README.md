# Orvane VPN

A WireGuard VPN product for Android: a Flutter app with a native Kotlin tunnel engine, a Node/TypeScript API, a gateway agent for WireGuard servers, and an admin dashboard.

```
┌──────────────── Android phone ────────────────┐        ┌──────────── Orvane API (vpn/backend) ────────────┐
│ Flutter UI (vpn/app/lib)                       │ HTTPS  │ Fastify · Postgres · Supabase JWT                │
│   VpnController ── state only from the engine  │──────▶ │ devices · peers/IPAM · plans · Play verification │
│        │ MethodChannel / EventChannel          │        │ admin API · gateway monitor                      │
│ Kotlin engine (android/.../tunnel)             │        └───────────────┬──────────────────────────────────┘
│   KeyVault (Keystore) · TunnelManager          │                        │ HMAC-signed HTTPS
│   GoBackend VpnService (wireguard-go)          │                        ▼
└───────────────┬────────────────────────────────┘        ┌──────── WireGuard gateway (per location) ────────┐
                │ WireGuard / UDP 51820                    │ wg0 · nftables NAT · unbound (no logs)            │
                └────────────────────────────────────────▶ │ orvane-agent (vpn/gateway-agent)                  │
                                                           └───────────────────────────────────────────────────┘
          Admin dashboard (vpn/admin) ──── Supabase login + TOTP MFA ────▶ /admin/v1 on the API
```

| Directory | What it is |
|---|---|
| [`app/`](app) | Flutter app (Android target; web build is a UI preview only) and the Kotlin WireGuard engine |
| [`backend/`](backend) | API: accounts, devices, peer provisioning, subscriptions, monitoring, admin |
| [`gateway-agent/`](gateway-agent) | Agent for each WireGuard server, plus `deploy/` configs (wg, nftables, unbound, systemd) |
| [`admin/`](admin) | Admin dashboard (static React SPA) |
| [`docs/`](docs) | [Setup](docs/setup.md) · [Release & signing](docs/release.md) · [Google Play compliance](docs/play-compliance.md) |

## Design principles the code enforces

* **No fake status.** The app shows *Protected* only after the engine reports a WireGuard handshake newer than the connection attempt. No handshake within 15 s → the tunnel is torn down and an error is shown. Stale handshakes while connected show *Reconnecting* and keep the tunnel up (traffic is held, not leaked). Covered by `app/test/vpn_controller_test.dart`.
* **No invented data.** There is no built-in server list. Locations come only from the API; latency is measured on the device (TCP connect to the gateway's probe port) and shows "—" when it can't be measured; load is shown only if the gateway reported it in the last 5 minutes. Prices come only from Google Play.
* **Keys stay on the phone.** The Curve25519 private key is generated on the device, stored AES-GCM-encrypted under an Android Keystore key, and never crosses the platform channel. The API only ever sees public keys.
* **No activity logs.** The database has no tables for connections, traffic, DNS or client IPs. Gateways report aggregate counters only. API logs carry method/route/status, never bodies, IPs or tokens.

## Status

Honest state of every part as of this commit. "Verified" means it ran here; "compiled" means it builds but has not been executed in its real environment.

| Area | State | Verified how |
|---|---|---|
| Design system, 3D sphere shader, parallax, all 12 screens | **Done** | `flutter analyze` clean; rendered in a web build and reviewed in screenshots |
| Connection state machine (handshake-gated) | **Done** | 12 unit tests incl. timeout, revocation, stale handshake, cancellation |
| Routing policy (LAN exclusion, IPv6 leak blocking) | **Done** | 5 unit tests |
| Honest failure on platforms without the engine | **Done** | widget test |
| Kotlin engine: Keystore key vault, GoBackend tunnel, consent flow, always-on restart, watchdog reconnect, network monitor | **Compiled, not run** | Compiled against Android 15 framework jar + WireGuard `tunnel:1.0.20260102` + Flutter embedding. **Needs a device/emulator test** (no Android SDK was available here) |
| Android APK/AAB build | **Not built** | `dl.google.com` (Android SDK) was blocked in this environment; build config is in place |
| API (auth, provisioning, IPAM, billing, RTDN, deletion, admin, monitor) | **Done** | 37 tests on embedded Postgres (PGlite), incl. concurrency and a contract test against the real agent |
| Gateway agent | **Done** | 4 tests with a stand-in `wg` binary (signing, replay, validation, sync) |
| Admin dashboard | **Done** | Typechecked, built, exercised against a local API |
| End-to-end on a real WireGuard server (Phase 6) | **Pending** | Needs a VPS, a Supabase project and a device — see [setup](docs/setup.md) |
| Google Play Billing purchase flow | **Implemented, untested** | Needs a Play Console app, subscription product and licence testers |
| Play submission (Phase 9) | **Prepared, not submitted** | Checklists in [play-compliance](docs/play-compliance.md); nothing here claims approval or legal compliance |

## Quick start (local)

```bash
# API with embedded Postgres (dev only)
cd backend && npm ci
SUPABASE_URL=https://<project>.supabase.co SECRETS_KEY=$(head -c32 /dev/urandom | base64) npm run dev
npm test

# Gateway agent tests
cd ../gateway-agent && npm ci && npm test

# App
cd ../app && flutter pub get && flutter analyze && flutter test
flutter run --dart-define-from-file=config/dev.json         # on an Android device
flutter build web --no-web-resources-cdn                    # UI preview only; cannot create a VPN

# Admin dashboard
cd ../admin && npm ci && cp .env.example .env.local && npm run dev
```

What you need to provide is listed in [docs/setup.md](docs/setup.md#what-you-need-to-provide).
