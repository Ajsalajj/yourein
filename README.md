# YoureIn

**Invitations worth opening.** A self-service site for animated digital invitations: pick a design, make it yours, pay ₹999 once, share the link and see who is coming.

```
BROWSE → PREVIEW → CUSTOMIZE → EDIT → RSVP SETUP → SIGN IN → PAY → PUBLISH → SHARE → TRACK GUESTS
```

Next.js 16 (App Router), React 19, TypeScript, PostgreSQL, GSAP + Motion. No UI kit, no ORM, no auth library.

## Try it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

That is all. With no settings, the site uses an embedded PostgreSQL that keeps its files in `./.data`, and payments are simulated (the payment screen says so). Sign up with any email, build an invitation, "pay", and you get a working public link, guest list and RSVP dashboard.

Password reset in this mode shows the reset link on screen instead of emailing it.

## Going live

1. **Database.** Create a PostgreSQL database (Neon, Supabase, Vercel Postgres, RDS) and set `DATABASE_URL`. Tables are created on first start. *Without it a deployed site stores data in a temporary folder and loses it on restart.*
2. **Secret.** Set `AUTH_SECRET` to a long random string.
3. **Address.** Set `NEXT_PUBLIC_SITE_URL` (for example `https://yourein.com`). Invitation links and QR codes use it.
4. **Razorpay.** Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Start with test keys (`rzp_test_…`) and pay with Razorpay's test cards, then switch to live keys.
5. **Webhook (recommended).** In Razorpay → Webhooks, add `https://<site>/api/pay/webhook` for `payment.captured` and `order.paid`, and set `RAZORPAY_WEBHOOK_SECRET`. This publishes the invitation even if the customer closes the tab straight after paying.
6. **Google sign-in (optional).** Create an OAuth client (Web application) with redirect URI `https://<site>/api/auth/google/callback`; set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Without them the Google button explains that it is not set up and email sign-in still works.
7. **Email (optional).** Set `RESEND_API_KEY` and `EMAIL_FROM` so "Forgot password" can send its link. Without them the site says reset by email is unavailable.

Every variable is described in [`.env.example`](.env.example).

Deploy on Vercel: import the repository, add the variables, deploy. Any Node 20.9+ host works too: `npm run build && npm run start`.

### What has and has not been run end to end

| Area | Status |
| --- | --- |
| Whole journey on a phone-sized screen (browse → … → host dashboard) | Automated, passing (`npm run test:flow`) |
| Returning users, password reset, design switch, long names, hide/show, closed RSVPs, cross-account access | Automated, passing (`npm run test:paths`) |
| Razorpay on the server: order, signature check, publish, webhook | Automated against a local stand-in for Razorpay's API, passing (`npm run test:pay`) |
| Razorpay's own checkout window | **Not run.** Needs real test keys and a browser. The integration follows Razorpay's standard web checkout. |
| Google sign-in round trip | **Not run.** The redirect to Google and the failure paths are checked; the token exchange needs real credentials. |
| Sending email through Resend | **Not run.** Needs an API key. |

Do one real test-mode payment and one Google sign-in on your deployment before announcing the site.

## Rules the code enforces

- **Nothing is published before payment is verified on the server.** The browser's "payment succeeded" callback is never trusted on its own: `/api/pay/verify` recomputes Razorpay's HMAC-SHA256 signature over `order_id|payment_id` with the key secret and only then marks the order paid and publishes, in one transaction. The webhook does the same with the webhook secret. A wrong signature leaves the invitation unpublished.
- **Preview and customizing need no account.** A signed-out visitor who taps Customize gets a temporary guest account that can only edit its own drafts. Sign-in is asked for when they go to pay; their draft and uploads then move to the account they sign in to, and the guest is removed. Guests cannot pay, publish or open the dashboard. Guest drafts nobody comes back to are deleted after 30 days.
- **Guests need no account, and see only the invitation.** The public page and `/api/rsvp` never return other guests, totals or replies. Every host route checks the session and that the invitation belongs to that user; another account gets a 404.
- **Wishes are the one thing guests share with each other.** When the host switches the guestbook on, the public page shows the name and message of each wish that is not hidden, and nothing else about the guest. It is off for invitations made before it existed; the host can hide or delete any wish under Wishes.
- **WhatsApp is for sharing a published invitation only.** There is no "order on WhatsApp" anywhere.
- **Price lives in one place:** `src/config/site.ts` (`PRICE = 999`, `CURRENCY = "INR"`).

## Where things are

```
src/
  config/site.ts            price, currency, site name and address
  data/templates.ts         the 15 designs: names, categories, palettes, sample content
  lib/invite.ts             the shape of an invitation's content (zod) and how it is laid over a design
  lib/share.ts              share text, WhatsApp and email links, calendar files

  invite/                   the invitation itself (shared by catalog preview, editor preview and public page)
    art/kit.tsx             drawing kit: flowers, arches, palaces, lamps, couple …
    art/scenes/*.tsx        one file per design: layered scene, sealed cover, opening animation
    Invitation.tsx          sealed → opening → open; music; scroll setup
    Sections.tsx, Rsvp.tsx  message, events, countdown, venue, gallery, RSVP form, closing

  components/site/          marketing pages: nav, hero, catalog, cards, <InvitationPhoneMockup />
  components/preview/       fullscreen preview
  components/app/           signed-in screens: editor, payment, success, dashboard, guests, RSVPs
  server/                   database, auth, invitations, guests + RSVPs, payments, email
  app/
    (site)/                 /, /create, /templates/[slug]
    start/[slug]            Customize: sign in if needed, create a draft, open the editor
    edit/[id]  pay/[id]  success/[id]
    (app)/                  /dashboard, /invites, /invites/[id](/guests|/rsvps), /guests, /account
    i/[slug]                public invitation;  i/[slug]/[guest] personal link
    api/                    JSON routes
```

### Data

Plain PostgreSQL tables, created by `src/server/schema.ts`:

`users` · `sessions` · `password_resets` · `templates` · `invitations` (status `draft` → `ready` → `published` ↔ `archived`, content as JSON) · `events` · `photos` (portrait, gallery, music; stored in the database) · `guests` · `rsvps` (`invitation_id`, optional `guest_id`, `guest_name`, `response_status`, `attendee_count`, `phone`, `meal_preference`, `message`, `created_at`) · `wishes` (guestbook: `name`, `message`, `hidden`, optional `guest_id`) · `orders` · `payments` (provider payment id, order id, amount, status, signature, `paid_at`) · `analytics`.

"Total attending" is the sum of `attendee_count` over "yes" replies, which is a different number from how many replies came in.

### Accounts

Email + password (scrypt) and Google. Sessions are random tokens stored hashed, in an HttpOnly, SameSite=Lax cookie. Every route that changes something checks the request's origin. Sign-in, sign-up, reset and RSVP are rate limited per address (in memory, so per server instance).

## Changing things

- **Add or edit a design:** add an entry in `src/data/templates.ts`, a scene in `src/invite/art/scenes/`, register it in `src/invite/art/index.ts`, then regenerate catalog images (below).
- **Catalog images:** `public/thumbs/*.webp` and `public/og.jpg` are screenshots of the real invitations. After changing artwork or sample names: run the site, then `npm run thumbs`.
- **Editor steps and fields:** `src/components/app/Editor.tsx`; the fields themselves are defined in `src/lib/invite.ts`.
- **Stripe:** `src/server/payments/stripe.ts` describes the two functions to fill in. Orders and payments tables already carry currency and provider.
- **Hero phones:** the home page hero draws a real iPhone 16 model (`public/models/iphone-16.glb`, compressed with meshopt) with three.js in `src/components/site/HeroPhones3D.tsx`. Each phone's screen shows that design's catalog image; poses and sway are in `POSES`. Without WebGL the flat mockups stay. Model: "iPhone 16 - Free" by Wes (sketchfab.com/wimell), Sketchfab Standard licence.
- **Support link:** set `SUPPORT_WHATSAPP` in `src/config/site.ts` to show a "Help on WhatsApp" link in the footer. Leave empty to hide it.

## Tests

The site has to be running. Tests use simulated payments, so run them against `npm run dev`, or a build started with `YOUREIN_TEST_PAYMENTS=1` and no Razorpay keys.

```bash
npm run test:flow  [screenshot-folder]    # the full journey at 390 px wide
npm run test:paths [screenshot-folder]    # everything around it, at 360 px wide
npm run test:pay                          # see the header of scripts/dev/pay-live-path.mjs for how to start the site
```

`scripts/dev/seed-and-shoot.mjs <folder> [width] [height]` creates a published invitation with guests and replies and screenshots every signed-in screen at that size.

## Known limits

- **Artwork is drawn in code** (layered vector illustration), not painted or photographed. It is original, light and sharp at any size; swapping in commissioned illustration later means replacing files in `src/invite/art/scenes/`.
- **Photos and music live in the database.** Photos are shrunk in the browser before upload. Music is limited to 4 MB, which is also Vercel's request limit. For heavy use, move `photos.bytes` to object storage (S3, R2, Vercel Blob); only `addMedia` and `getMedia` in `src/server/invitations.ts` need to change.
- **Colour presets are not offered.** Each design is drawn for its own palette. The editor's Design step lets the host switch to any other design and keeps everything they typed.
- **Catalog cards are taller than a 0.75 ratio on phones.** Two per row with a full phone mockup at 80% of the card width fixes the height; the choice was to show the whole invitation screen instead of cropping it.
- **Rate limits are per server instance.** Fine for launch; put a shared limiter (Upstash, Vercel KV) in `src/server/http.ts` if abuse appears.
