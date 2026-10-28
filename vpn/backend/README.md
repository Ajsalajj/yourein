# Orvane API

Fastify + Postgres. Accounts come from Supabase Auth (JWT); everything else lives here.

| Area | Endpoints |
|---|---|
| Public | `GET /health`, `GET /v1/servers`, `GET /v1/plans` |
| User (Bearer token) | `GET/DELETE /v1/me`, `POST /v1/tunnels`, `DELETE /v1/devices/:id`, `POST /v1/devices/rotate`, `POST /v1/billing/google/verify` |
| Google Play RTDN | `POST /v1/billing/google/rtdn` (Pub/Sub push, OIDC-verified) |
| Admin (role + MFA) | `/admin/v1/analytics`, `users`, `devices`, `servers`, `plans`, `audit` |

Errors are `{ "error": { "code": "...", "message": "..." } }` with stable codes the app maps to copy (`device_limit`, `premium_required`, `server_unavailable`, `gateway_unreachable`, `key_in_use`, `purchase_account_mismatch`, …).

```bash
npm ci
npm test            # 37 tests on embedded Postgres (PGlite)
npm run typecheck
npm run dev         # needs SUPABASE_URL and SECRETS_KEY; uses ./.data/pglite without DATABASE_URL
```

Configuration reference: `src/config.ts`. Deployment: [`../docs/setup.md`](../docs/setup.md).
