# Google Play readiness checklist

This is a preparation checklist, not a statement of compliance. Google's policies change; check each item against the current Play Console Help and policy pages when you submit, and get legal advice for the privacy policy and terms. Nothing in this repository has been reviewed or approved by Google.

## 1. VpnService policy

Play restricts `VpnService` to apps whose core functionality is a VPN. Orvane's is. When you submit, Play Console asks for a **VpnService declaration**. Facts you can state, all true of this code:

| Question area | Orvane |
|---|---|
| Core functionality | Encrypted device-level VPN tunnel to Orvane-operated WireGuard servers |
| Uses `VpnService` to | Create a WireGuard tunnel (official `com.wireguard.android:tunnel` library) |
| Encryption | WireGuard: Curve25519, ChaCha20-Poly1305, BLAKE2s |
| Collects/sells personal or sensitive data via the VPN | No. No traffic, DNS or site data is inspected, logged or monetised |
| Redirects or manipulates traffic (ads, affiliate, etc.) | No |
| User consent | Android's system VPN consent dialog before the first connection (`VpnService.prepare`) |

Prominent disclosure: the onboarding explains what the VPN does; Android's own consent dialog appears before any tunnel starts.

## 2. Foreground service

The tunnel runs in WireGuard's `GoBackend$VpnService`, which the system binds while the VPN is active; that keeps the process alive, as in the official WireGuard app. **No foreground service is declared**, so no foreground-service-type declaration is needed. If you later add an ongoing notification or long-running work outside the VPN service, you will need a declared FGS type and the matching Play declaration.

Permissions requested: `INTERNET`, `ACCESS_NETWORK_STATE`, plus Billing's (merged by the library). No location, contacts, storage, notification or query-all-packages permissions.

## 3. Data safety form

Answer from what the code actually does. Re-check if you add analytics, crash reporting or ads (none are included).

| Data type | Collected? | Shared? | Purpose | Notes |
|---|---|---|---|---|
| Email address | Yes | No (processed by Supabase as your processor) | Account management | Required for an account |
| User IDs | Yes | No | Account management | Supabase user id |
| Purchase history | Yes | No | App functionality (entitlement) | Play purchase token, product, state, expiry |
| Device or other IDs | Yes | No | App functionality | Device's WireGuard **public** key and the device model name the user can see in Account |
| Approximate/precise location | No | — | — | Latency is measured on the device and not uploaded |
| Web browsing history | **No** | — | — | Not logged anywhere |
| App activity, in-app search | No | — | — | |
| Crash logs, diagnostics | No | — | — | "Copy diagnostics" only copies to the clipboard for the user to send |

Security section: data is encrypted in transit (HTTPS; WireGuard for tunnel traffic). Users can request deletion: **yes, in-app** (Account → Delete account) — you must also provide a **web URL** for deletion requests (see §6).

Note on the gateway: while connected, the gateway necessarily holds the user's current public IP in memory (WireGuard needs it to send packets back). It is not written to disk or logs by Orvane's configuration (`SaveConfig=false`, no query logging in unbound, agent logs counts only). Say this plainly in the privacy policy.

## 4. Privacy policy must cover

* Who operates the service and how to contact them (also in the Play listing)
* Exactly the data in the table above, why, retention (e.g. account data until deletion; subscription records as required for tax/accounting), processors (Supabase, your hosting providers, Google Play)
* The no-activity-logs commitment and its limits (in-memory IP on the gateway while connected; aggregate gateway counters)
* Countries where gateways run
* Account deletion: in-app path and the web URL; what is deleted and what must be retained by law
* Children: not directed at children under 13 (or as your target audience settings declare)

Set `PRIVACY_POLICY_URL` in the app config and the same URL in Play Console.

## 5. Subscriptions policy

Implemented in the Premium screen:

* Price and billing period come from Google Play and are shown before purchase
* Free trial (if you configure one in Play) is labelled, and the recurring price is shown next to it
* Auto-renewal and how to cancel are stated on the purchase screen
* "Manage in Google Play" deep link for active subscribers; "Restore purchases"
* Entitlement is verified server-side with the Play Developer API; purchases are acknowledged only after verification (Play auto-refunds unacknowledged purchases after 3 days)
* Cancelled subscriptions keep Premium until the paid period ends; expiry/on-hold remove premium access

You still need to: create the products/base plans and prices in Play Console, and make sure your store listing describes Free vs Premium accurately (Free: free locations, `freeDeviceLimit` devices; Premium: all locations, `premiumDeviceLimit` devices — both set in Admin → Plans).

## 6. Account deletion

* **In-app:** Account → Delete account. Revokes all peers on all gateways, deletes the Supabase identity, then all rows (`DELETE /v1/me`). Requires `SUPABASE_SERVICE_ROLE_KEY` on the API.
* **Web (required by Play, You):** publish a page at a URL you enter in Play Console explaining how to delete the account and offering a way to request it without the app (e.g. a support email or a signed-in web form). Not built in this repo.
* Deleting the account does not cancel a Play subscription; the app says so before deletion.

## 7. Security and compliance testing before submission

* [ ] Phase 6 device checklist passes ([setup.md §5](setup.md#5-phase-6-acceptance-test-on-a-real-phone)), including DNS and IPv6 leak tests
* [ ] `flutter analyze`, `flutter test`, backend `npm test`, agent `npm test` green
* [ ] Dependency audit: `npm audit` in backend/agent/admin; `flutter pub outdated` reviewed
* [ ] Release AAB inspected: no debug flags, `android:debuggable` false, minified, no test endpoints in config
* [ ] Logcat during connect/disconnect contains no keys, tokens, endpoints or configs
* [ ] API: rate limits active behind your proxy (`TRUST_PROXY_HOPS` correct), admin endpoints reject non-MFA sessions, CORS limited to the admin origin
* [ ] Gateway: only UDP 51820 and TCP 8443 (plus restricted SSH) reachable; unbound not reachable from the internet; agent TLS valid
* [ ] Secrets only in secret stores; `SECRETS_KEY` backed up
* [ ] Play pre-launch report reviewed (accessibility, crashes, security warnings)
* [ ] Internal testing track with licence testers covers purchase, restore, cancel, expiry
* [ ] Consider an independent security review / no-logs audit before marketing claims about logging
