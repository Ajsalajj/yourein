# Meta ads tracking (Pixel + Conversions API)

How YoureIn measures Facebook and Instagram ads, how to switch it on, how to test it and how to switch it off.
Nothing here contains real credentials; never paste a token into code, docs or chat.

## What is tracked, and where

| Event | Type | Fires when | Browser (Pixel) | Server (CAPI) | Dedup `event_id` |
|---|---|---|---|---|---|
| `PageView` | standard | a page is shown; once per path, including client-side navigation | yes | no | – |
| `ViewContent` | standard | a design page `/templates/<slug>` opens | yes | yes, relayed | random, shared |
| `TemplatePreview` | custom | a design preview opens | yes | yes, relayed | random, shared |
| `CustomizeInvitation` | custom | a **Customize** button is clicked | yes | yes, relayed | random, shared |
| `CompleteRegistration` | standard | a new account is really created (email sign-up or first Google sign-in) | email sign-up only | yes | `signup_<user id>` |
| `InitiateCheckout` | standard | **Pay & Publish** creates a payment order (`/api/pay/order`) | yes | yes | `checkout_<order id>` |
| `Purchase` | standard | the server has verified the payment (Razorpay signature or signed webhook) | yes, once, on the success page | yes, from the outbox | `purchase_<order id>` |

Not implemented, on purpose:

- **AddPaymentInfo.** Razorpay Checkout runs in Razorpay's own window and does not tell the site when payment details are entered, so there is no honest moment to fire it.
- **Login.** Meta has no standard login event and it is not a useful ad signal.
- **Failed payments.** These are recorded for the admin dashboard but not sent to Meta. An abandoned checkout shows in Meta as `InitiateCheckout` without a `Purchase`, which you can use for retargeting audiences.

Parameters sent are public design details only: `content_ids` (the design slug), `content_name`, `content_category` and `content_type: product`. Checkout and purchase events add `value` (rupees, from the order row), `currency: INR`, `num_items: 1` and the Razorpay `order_id`.

**Never sent:** invitation content, names, dates, venues, photos, guest lists, RSVP replies, wishes, passwords or payment details.
`custom_data` is filtered against an allowlist (`src/server/meta/capi.ts`), so a field outside that list cannot leak in by accident.

### How a purchase is counted once

1. `settle()` in `src/server/payments/index.ts` is the single place a payment becomes `paid`. It is reached from `/api/pay/verify` (signature-checked) and `/api/pay/webhook` (signature-checked).
2. The first time an order becomes paid, inside the same database transaction, one row is inserted into `meta_events` with `event_id = purchase_<order id>` (primary key, `on conflict do nothing`). Duplicate webhooks, a webhook racing the browser, retries and refreshes therefore cannot create a second purchase. A savepoint makes sure a tracking error can never undo the payment or the publishing.
3. After the response is sent, the server delivers queued rows to the Conversions API. A failed delivery stays `pending` and is retried by the next delivery or by the daily cron (`/api/meta/flush`). Rows are given up after 6 attempts, or after 7 days, which is Meta's limit for website events.
4. The success page claims the row once (an atomic `browser_claimed_at` update) and fires the browser `Purchase` with the same `event_id`, value and currency. A refresh finds nothing to claim. Opening `/success/<id>` without a verified payment shows nothing.
5. No public endpoint can create a purchase. `/api/meta/event` only accepts `ViewContent`, `TemplatePreview` and `CustomizeInvitation` for real design slugs.
6. Purchases made before this tracking was installed are **not** backfilled.

**Test payments never pollute live data.** Purchases made with the simulated test mode or Razorpay `rzp_test_…` keys are reported only while `META_CAPI_TEST_EVENT_CODE` is set, so they appear in Test Events only. The same rule applies to `InitiateCheckout`.

## Consent and privacy

- There was no consent mechanism before this change, so a small banner now asks first-time visitors: *Allow* or *No thanks*. The choice is stored in the first-party cookie `yi_ads_consent` (`granted` or `denied`) for 180 days. It can be changed at any time with **Cookie settings** in the footer's account links.
- Until a visitor chooses *Allow*:
  - the Pixel script is not loaded;
  - no `_fbp`/`_fbc` cookies are set;
  - no server events are sent.

  Events that happen before the choice wait in memory and are sent only if the visitor allows.
- Withdrawing consent calls `fbq('consent', 'revoke')` and deletes `_fbp`/`_fbc`.
- **Signing in is not consent.** Server events check the consent cookie on the request. Purchase uses the consent recorded when checkout started.
- The Pixel never loads on guests' invitation pages (`/i/…`), the admin area or internal render routes, even with consent. Guests are not our customers, and their visits and replies stay private.
- The Pixel runs with `autoConfig` off (no automatic button or metadata scraping) and with automatic SPA history tracking off (`fbq.disablePushState = true`). Only the events above are sent.

User data sent to the server, only with consent:

| Field | Form |
|---|---|
| `em` | Email, trimmed, lower-cased, SHA-256 |
| `external_id` | Our account id, SHA-256 |
| `client_ip_address` | Unhashed, as Meta requires |
| `client_user_agent` | Unhashed, as Meta requires |
| `fbp`, `fbc` | Meta cookies, unhashed |

`fbc` is built from the ad's `fbclid` when the cookie is missing.

Retention:

- The visit details stored on an order (`orders.ad_context`) are cleared as soon as the Purchase is queued, or after 30 days.
- Delivered or abandoned `meta_events` rows are deleted after 30 days.

The privacy policy (`/privacy`, the "Advertising measurement" section) describes this. **This is an engineering implementation, not legal advice.** Have the banner wording and the privacy policy reviewed against the Digital Personal Data Protection Act, 2023 and its rules before relying on them.

Campaign attribution:

- The first landing page, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` and `fbclid` are kept in `sessionStorage` for the visit only. They are not appended to links or canonical URLs.
- They are sent to the server only when checkout starts, and stored on the order only with consent.
- Attribution is never perfect: browser privacy features, ad blockers, consent choices and Meta's attribution settings all reduce what can be measured.

## Environment variables

| Variable | Secret? | Where | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | no (public) | Production. Preview and Development only if you want to test there. | The Pixel / dataset ID (digits only). Without it nothing loads and no banner shows. |
| `META_CAPI_ACCESS_TOKEN` | **yes** | Production (and Preview if testing there) | Server only. Never give it a `NEXT_PUBLIC_` prefix. Without it the Conversions API is off. |
| `META_CAPI_TEST_EVENT_CODE` | no | Temporarily, only while testing | Sends server events to Test Events. Remove it before live traffic; the server logs a warning while it is set in production. |
| `NEXT_PUBLIC_SITE_URL` | no | All | `https://www.yourein.in` |
| `CRON_SECRET` | **yes** | Production | Any long random string. Vercel Cron sends it to `/api/meta/flush` to retry deliveries. Without it the retry endpoint refuses all requests; retries still happen on the next purchase. |
| `META_GRAPH_API_VERSION` | no | optional | Defaults to `v26.0`, the current Graph API version per Meta's changelog (checked 2026-10-15). Change only when Meta deprecates it. |
| `META_GRAPH_API_URL` | no | tests only | Points server events at a local stub. Never set it in Vercel. |

Both the Pixel ID and the token are needed for server events. Both, plus visitor consent, are needed for anything at all.

## Setup

### 1. Get the Pixel ID

1. Open Meta Events Manager (business.facebook.com → Events Manager).
2. Choose **Connect data sources → Web**, name the dataset (for example "YoureIn website") and create it.
3. Copy the **Dataset ID / Pixel ID**: a long number, shown under the dataset name and in Settings.

### 2. Get the Conversions API access token

1. In Events Manager, select the dataset → **Settings**.
2. Under **Conversions API → Set up direct integration**, choose **Generate access token**.
3. Copy it once and store it only in Vercel (step 3). Do not paste it anywhere else. If it leaks, generate a new one; the old one stops working.

### 3. Add the variables in Vercel

1. Vercel → project **yourein** → Settings → Environment Variables.
2. Add `NEXT_PUBLIC_META_PIXEL_ID` (Production), `META_CAPI_ACCESS_TOKEN` (Production, type Sensitive) and `CRON_SECRET` (Production, Sensitive).
3. Leave `META_CAPI_TEST_EVENT_CODE` unset for now.

### 4. Redeploy

`NEXT_PUBLIC_*` values are built into the page, so a **redeploy** is required after adding or changing them. Use Deployments → the newest Production deployment → ⋯ → Redeploy. Redeploy the newest one: redeploying an older deployment rolls the site back.

The database tables (`meta_events`, `orders.ad_context`) are created automatically on the first request after deploy. The schema in `src/server/schema.ts` is idempotent, so there is no separate migration step.

### 5. Verify your domain (recommended)

Business Settings → Brand Safety → **Domains** → add `yourein.in` and verify it with the DNS TXT record Meta gives you (add it at your domain registrar). Domain verification lets you configure web events for the domain.

### 6. Aggregated Event Measurement

Depending on your account, Events Manager may ask you to configure web events for the verified domain. If it does, rank **Purchase** first, then **InitiateCheckout**, **CompleteRegistration** and **ViewContent**.

## Testing with Meta Test Events

Do this on Production with **Razorpay test keys**, or on a Preview deployment, so no real customer is charged.

1. Events Manager → select the YoureIn dataset → **Test events**.
2. Copy the test code shown (for example `TEST12345`).
3. In Vercel, set `META_CAPI_TEST_EVENT_CODE` to that code for the environment you are testing, and redeploy.
4. In the **Test browser events** box, enter `https://www.yourein.in` and open the site from that button, or open the site normally in a fresh browser.
5. Choose **Allow** on the cookie banner. A `PageView` should arrive.
6. Open a design page (`ViewContent`), open a preview (`TemplatePreview`) and press **Customize** (`CustomizeInvitation`).
7. Create a new account with an email you control (`CompleteRegistration`).
8. Fill in the invitation and press **Pay & Publish** (`InitiateCheckout`).
9. Pay with a Razorpay **test** card or test UPI (needs `rzp_test_…` keys). No real money moves.
10. On the success page, check that `Purchase` arrives with value 999 and currency INR.
11. **Deduplication:** each of `ViewContent`, `CompleteRegistration`, `InitiateCheckout` and `Purchase` should show as received from **Browser and Server** with the same Event ID, and be counted as deduplicated. Refresh the success page: no new Purchase should appear.
12. **Before running ads:** delete `META_CAPI_TEST_EVENT_CODE` in Vercel and redeploy. While it is set, purchases made with live keys still go to Test Events instead of live reporting.

Automated checks, none of which contact Meta or charge anyone:

- `npm run test:meta`: the logic and the real payment code against a throwaway database. It covers:
  - hashing, the payload allowlist and timeouts;
  - failed, unverified and underpaid payments;
  - duplicate webhooks, refreshes and retries;
  - consent and test-key rules.
- `npm run test:meta:browser`: the Pixel in a real browser, with Meta replaced by local stubs. See the top of `scripts/dev/e2e-meta.mjs` for how to start the site for it. It covers:
  - consent gating and a single init;
  - one PageView per route;
  - relay deduplication;
  - the whole sign-up → checkout → verified purchase path.

  Run it with `EXPECT=off` against a site without a Pixel ID to check that nothing loads.

## Diagnostics in Meta

- **Pixel installation:** Meta Pixel Helper (Chrome extension) on www.yourein.in, after choosing Allow. Expect one Pixel ID and one PageView per page.
- **Event activity:** Events Manager → dataset → Overview. Events appear within minutes; the totals update more slowly.
- **Test Events:** see above.
- **Diagnostics:** dataset → Diagnostics, for problems Meta detects (missing parameters, duplicate events, domain issues).
- **Event Match Quality:** dataset → Overview → click an event. The score depends on what each visitor's browser allows; no particular score is promised.
- **Deduplication:** Overview → an event → the event details show Browser and Server counts and the deduplication rate.
- **Purchase value and currency:** Overview → Purchase → check that value and INR show.
- **Event source URLs:** event details. URLs are sent without query strings or ids, for example `https://www.yourein.in/pay`.
- **Attribution windows** are an Ads Manager setting per ad set (for example 7-day click, 1-day view), not something the site controls.
- **Ads Manager reporting:** Columns → Customize → add Purchases, Purchase conversion value, Cost per purchase, Checkouts initiated and Registrations completed.

## Troubleshooting

| Symptom | Check |
|---|---|
| No banner and no events at all | `NEXT_PUBLIC_META_PIXEL_ID` is set for Production, digits only, and you redeployed after setting it. |
| Banner shows but no events after Allow | An ad blocker or browser tracking protection can block `connect.facebook.net`. Server events (ViewContent, registration, checkout, purchase) still arrive if the token is set. |
| Browser events arrive but server events do not | `META_CAPI_ACCESS_TOKEN` is set (Production), not expired, and generated for this dataset. Vercel → Logs: search for `Meta Conversions API` to see Meta's error message (tokens are never logged). |
| Purchases missing | Was the cookie choice *Allow* before checkout? Were live keys used, or was a test code set? Check the `meta_events` table: `status`, `attempts`, `last_error`. |
| Purchases counted twice | Both sides must show the same Event ID. If the browser and server IDs differ, report it; they are built from the same order id by design. |
| Events land in Test Events instead of live | `META_CAPI_TEST_EVENT_CODE` is still set; delete it and redeploy. |

## Turning tracking off safely

- **Everything:** delete `NEXT_PUBLIC_META_PIXEL_ID` and redeploy. The Pixel, the banner and all server events stop. Payments and publishing are unaffected.
- **Server events only:** delete `META_CAPI_ACCESS_TOKEN` and redeploy. Queued purchases stay unsent and are deleted after 30 days.

## Files

| File | Purpose |
|---|---|
| `src/config/meta.ts` | Shared settings: Pixel ID, consent cookie, pages without tracking |
| `src/lib/meta-pixel.ts` | The only browser code that talks to `fbq`: consent, single load, PageView dedupe, event ids |
| `src/components/meta/MetaTracking.tsx` | Root-layout component: banner, PageView per route, Customize clicks, footer Cookie settings link |
| `src/components/meta/MetaPurchase.tsx` | Browser half of a verified Purchase (success page) |
| `src/server/meta/capi.ts` | Conversions API client: config, hashing, payload allowlist, timeouts and retries |
| `src/server/meta/events.ts` | Journey events, the Purchase outbox, delivery and retention |
| `src/app/api/meta/event/route.ts` | Relays the three browsing events with the Pixel's event_id |
| `src/app/api/meta/flush/route.ts` + `vercel.json` | Daily retry of undelivered purchases (needs `CRON_SECRET`) |
