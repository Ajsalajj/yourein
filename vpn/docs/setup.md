# Setting up Orvane end to end

This is the path from this repository to a phone connecting through your own WireGuard server (Phase 6). Every step that needs your accounts, money or credentials is marked **You**.

## What you need to provide

| Item | Used for | Where it goes |
|---|---|---|
| **Supabase project** (free tier is fine to start) | Sign-up/sign-in, password reset, MFA for admins | API: `SUPABASE_URL`, optionally `SUPABASE_JWT_SECRET`; app & admin: URL + anon key |
| **Supabase service role key** | Deleting the auth user on account deletion | API only: `SUPABASE_SERVICE_ROLE_KEY` (secret) |
| **PostgreSQL 14+** (Supabase's own DB works) | API data | API: `DATABASE_URL` (secret) |
| **A host for the API** with HTTPS (Fly.io, Render, a VPS behind Caddy…) | Serving the API | — |
| **One or more VPS** with a public IPv4 (IPv6 recommended), Ubuntu 24.04 or Debian 12 | WireGuard gateways | One per location |
| **TLS certificates** for each gateway agent (Let's Encrypt is fine) | Agent HTTPS | Gateway: `TLS_CERT`, `TLS_KEY` |
| **Google Play Console** developer account | Distribution and subscriptions | — |
| **Google Cloud service account** with Play Android Developer API access | Verifying purchases | API: `PLAY_SERVICE_ACCOUNT_JSON` (base64, secret) |
| **Pub/Sub topic + push subscription** | Real-time subscription notifications | API: `PLAY_RTDN_AUDIENCE`, `PLAY_RTDN_SERVICE_ACCOUNT` |
| **Domain + privacy policy, terms and support address** | Play listing, in-app links | App: `PRIVACY_POLICY_URL`, `TERMS_URL`, `SUPPORT_EMAIL` |
| **Upload keystore** | Signing the app bundle | `android/key.properties` (never committed) |

## 1. Supabase (You)

1. Create a project. Under **Authentication → Providers**, keep Email enabled. Decide whether to require email confirmation (the app handles both).
2. Under **Authentication → URL configuration**, set the site URL to your website (used in confirmation and reset emails).
3. Under **Authentication → Multi-factor**, enable **TOTP** (admins must use it; the API rejects admin calls without `aal2`).
4. Note the project URL and the **anon** key (public) and **service_role** key (secret).
5. JWT verification: new projects use asymmetric signing keys and the API verifies against the project's JWKS automatically. If your project still uses the legacy shared secret, set `SUPABASE_JWT_SECRET`.
6. Make yourself an admin (SQL editor, as the service role):
   ```sql
   update auth.users
      set raw_app_meta_data = raw_app_meta_data || '{"orvane_role":"admin"}'
    where email = 'you@example.com';
   ```
   `app_metadata` can't be edited by users themselves, which is why the role lives there.

## 2. API (vpn/backend)

Environment (see `src/config.ts` for every option):

```bash
NODE_ENV=production
DATABASE_URL=postgres://...                 # secret
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...                # secret
SECRETS_KEY=$(head -c32 /dev/urandom | base64)   # secret; seals gateway agent secrets. Back it up: losing it means re-issuing agent secrets.
ADMIN_ORIGINS=https://admin.orvane.example
PLAY_PACKAGE_NAME=app.orvane.vpn
PLAY_SERVICE_ACCOUNT_JSON=$(base64 -w0 service-account.json)   # secret
PLAY_RTDN_AUDIENCE=https://api.orvane.example/v1/billing/google/rtdn
PLAY_RTDN_SERVICE_ACCOUNT=pubsub-push@<gcp-project>.iam.gserviceaccount.com
TRUST_PROXY_HOPS=1                           # number of reverse proxies in front
```

```bash
npm ci && npm run build && npm run migrate && npm start
```

Store secrets in your host's secret manager, not in files in the repo. The schema migration is idempotent and also runs at start-up.

## 3. A WireGuard gateway (You: a VPS)

On the server (as root):

```bash
apt install wireguard nftables unbound nodejs   # Node 22+
umask 077; wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
cp deploy/wg0.conf.example /etc/wireguard/wg0.conf          # adjust pools if this gateway uses different ones
cp deploy/nftables.conf.example /etc/nftables.conf         # set your public NIC name; restrict SSH
cp deploy/unbound.conf.example /etc/unbound/unbound.conf.d/orvane.conf
printf 'net.ipv4.ip_forward=1\nnet.ipv6.conf.all.forwarding=1\n' > /etc/sysctl.d/99-orvane.conf && sysctl --system
systemctl enable --now nftables wg-quick@wg0 unbound
```

Then in the **admin dashboard → Gateways → Add gateway**, enter:

* endpoint host/port (the VPS public address, UDP 51820), the contents of `public.key`
* client pools: `10.64.0.0/16` and `fd00:64::/112` (each gateway can reuse the same private ranges)
* DNS inside tunnel: `10.64.0.1` (the unbound instance above)
* agent URL `https://<gateway-host>:8443`, probe host/port the same host and `8443`

The dashboard shows an **agent secret once**. Install the agent:

```bash
useradd --system --no-create-home orvane
mkdir -p /opt/orvane-agent /etc/orvane/tls
# copy the built agent (npm ci && npm run build in vpn/gateway-agent) to /opt/orvane-agent
# put your TLS certificate in /etc/orvane/tls
cat > /etc/orvane/agent.env <<EOF
AGENT_SECRET=<from the dashboard>
WG_INTERFACE=wg0
PORT=8443
TLS_CERT=/etc/orvane/tls/fullchain.pem
TLS_KEY=/etc/orvane/tls/privkey.pem
EOF
chmod 600 /etc/orvane/agent.env
cp deploy/orvane-agent.service /etc/systemd/system/ && systemctl enable --now orvane-agent
```

Within a minute the API's monitor marks the gateway **online** and pushes its peer list. Until then the app lists it as offline and won't connect to it.

## 4. The app

```bash
cd vpn/app
cp config/example.json config/prod.json   # API URL, Supabase URL + anon key, policy URLs, support email
flutter run --release --dart-define-from-file=config/prod.json
```

Debug builds may talk to an API on your dev machine over plain HTTP (`10.0.2.2` on the emulator); release builds are HTTPS-only.

## 5. Phase 6 acceptance test (on a real phone)

Do this before trusting anything the UI says:

1. Sign up, choose a free location, tap the sphere. Approve Android's VPN dialog.
2. The status must pass *Connecting* → *Protected* only after a handshake. Check on the gateway: `wg show wg0 latest-handshakes` lists your key.
3. Visit an IP-check site: it must show the gateway's address. Run a DNS leak test: only the gateway's resolver may appear.
4. IPv6: with **Block IPv6 outside the tunnel** on and a gateway without IPv6, IPv6 test sites must fail rather than show your ISP's address.
5. Switch Wi‑Fi ↔ mobile data while connected: traffic resumes without user action.
6. Stop `wg-quick@wg0` on the gateway: within ~3 minutes the app shows *Reconnecting* (not *Protected*); restart it and the app returns to *Protected*.
7. Start another VPN app: Orvane must show *VPN turned off*.
8. Enable Always-on VPN + Block connections without VPN for Orvane, reboot the phone: the tunnel comes back without opening the app.
9. Remove the device in **Account**: the key disappears from `wg show` and the phone can no longer pass traffic.
10. Delete the account: confirm the Supabase user and all rows are gone.

## 6. Google Play Billing (You)

1. In Play Console create a **subscription** with product ID `orvane_premium` and base plans `monthly` and `yearly` (or change the IDs in **Admin → Plans**). Set prices per country there; the app shows Play's localised prices.
2. Link a Google Cloud project, create a service account, grant it **View financial data** and **Manage orders and subscriptions** in Play Console → Users and permissions, download its JSON key → `PLAY_SERVICE_ACCOUNT_JSON`.
3. Real-time developer notifications: create a Pub/Sub topic, grant `google-play-developer-notifications@system.gserviceaccount.com` publish rights, add a **push** subscription to `https://<api>/v1/billing/google/rtdn` with authentication enabled (service account = `PLAY_RTDN_SERVICE_ACCOUNT`, audience = `PLAY_RTDN_AUDIENCE`). Set the topic in Play Console → Monetization setup.
4. Add licence testers, upload a build to internal testing, and test: purchase, restore, cancel (Premium stays until expiry), expiry (premium-location peers are removed by the monitor), and a purchase from a second Orvane account on the same Google account (must be rejected).
