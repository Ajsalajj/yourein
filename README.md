# YoureIn

**Invitations worth opening.** A self-service site for animated digital invitations: pick a design, make it yours, pay once, share the link and see who is coming.

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
4. **Razorpay.** Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Start with test keys (`rzp_test_…`) and pay with Razorpay's test cards or test UPI, then switch to live keys (`rzp_live_…`). The pay screen says "Razorpay test mode" while test keys are in use. Open `/admin/setup` and press **Test the Razorpay connection** to confirm the keys are accepted.
5. **Webhook (recommended).** In Razorpay → Account & Settings → Webhooks, add `https://<site>/api/pay/webhook`, tick `payment.captured`, `order.paid`, `payment.failed` and `refund.processed`, and set the same secret as `RAZORPAY_WEBHOOK_SECRET`. This publishes the invitation even if the customer closes the tab straight after paying, and records failed payments and refunds for the admin area.
6. **Google sign-in (optional).** Create an OAuth client (Web application) with redirect URI `https://<site>/api/auth/google/callback`; set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Without them the Google button explains that it is not set up and email sign-in still works.
7. **Admin area (recommended).** Set `ADMIN_EMAILS` and `ADMIN_ACCESS_CODE` (see below).
8. **Email (optional).** Set `RESEND_API_KEY` and `EMAIL_FROM` so "Forgot password" can send its link. Without them the site says reset by email is unavailable.

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
- **Price lives in one place:** `NEXT_PUBLIC_PRICE_INR` (whole rupees, default **1** while testing), read once in `src/config/site.ts` and used by every page, the order amount and the payment screen. Set it to `999` (or any whole number from 1 to 100000) and redeploy to change it. Orders already created keep the price they were made with.

## Admin area (`/admin`)

A private, read-only dashboard for payments and customers. It never changes an order, a payment or an invitation: refunds are made in the Razorpay dashboard and arrive here through the webhook.

**Turning it on.** Set two environment variables and redeploy:

- `ADMIN_EMAILS`: comma-separated emails of the people who may be admins. They must have an account on the site.
- `ADMIN_ACCESS_CODE`: a long secret of at least 12 characters.

Sign in as an admin, open `/admin`, and type the access code once. It stays unlocked on that browser for 12 hours (the **Lock** button ends it sooner). Anyone else, signed in or not, gets the ordinary "not found" page. The code is needed on top of the email list because signing up does not prove that someone owns an email address; without the code, whoever registered an admin's address first could walk in. Wrong codes are rate limited.

| Page | What it shows |
| --- | --- |
| Overview | Net revenue (taken minus refunded), last 24 hours / 7 / 30 days, paid / failed / not completed / refunded counts, a 30-day chart, customers, invitations by status, the latest orders, and a banner for anything wrong with the setup |
| Payments | Every order with customer, invitation, amount, status and Razorpay ids. Filter by status and date, search by email, name, invitation, order id or payment id, and download a CSV |
| Customers | Everyone with an account: invitations, published, total paid, last payment |
| Invitations | Every invitation with owner, status, views, reply count and amount paid. Counts only: guest names and replies are never shown |
| Setup | A checklist of what must be right before real payments (keys, test or live mode, webhook, database, secrets, site address, price), the webhook URL to add in Razorpay, and a button that tests the Razorpay keys |

Simulated test payments (no Razorpay keys) are hidden from the figures unless you tick "Include simulated test payments". A payment's status is **Paid**, **Failed** (the attempt was declined), **Not completed** (checkout started, never paid), **Partly refunded** or **Refunded**. An order whose first attempt failed but was then paid shows as Paid.

**There are no subscriptions.** Each invitation is a one-time purchase, so the area tracks purchases, not recurring plans. Adding subscriptions would need a plan model, Razorpay Subscriptions and new database tables.

## Where things are

```
src/
  config/site.ts            price, currency, site name and address
  data/templates.ts         the designs (15, plus the Signature designs Moonlit Mahal and Velvet Opera): names, categories, palettes, sample content
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

`users` · `sessions` · `password_resets` · `templates` · `invitations` (status `draft` → `ready` → `published` ↔ `archived`, content as JSON) · `events` · `photos` (portrait, gallery, music; stored in the database) · `guests` · `rsvps` (`invitation_id`, optional `guest_id`, `guest_name`, `response_status`, `attendee_count`, `phone`, `meal_preference`, `message`, `events` (people per function), `answers` (host questions), `created_at`) · `wishes` (guestbook: `name`, `message`, `hidden`, optional `guest_id`) · `orders` · `payments` (provider payment id, order id, amount, status, signature, `paid_at`) · `analytics`.

"Total attending" is the sum of `attendee_count` over "yes" replies, which is a different number from how many replies came in.

### Accounts

Email + password (scrypt) and Google. Sessions are random tokens stored hashed, in an HttpOnly, SameSite=Lax cookie. Every route that changes something checks the request's origin. Sign-in, sign-up, reset and RSVP are rate limited per address (in memory, so per server instance).

## Search (SEO)

The SEO system lives in `src/seo/` and `src/components/seo/`. It is deliberately small: a hand-approved set of landing pages, each with its own search intent, real designs on it and copy of its own. Nothing is generated as a combination of keywords.

### How it is organised

```
src/seo/
  url.ts                 canonical origin (www.yourein.in) and canonical URL rules
  pages.ts               every landing page: occasion hubs, style collections, features, Kerala, trust pages (one typed list)
  guides.ts              the guide articles
  template-profiles.ts   unique copy and style tags for each design (used by template pages and collections)
  select.ts              which designs a page shows; related designs and pages
  indexable.ts           the quality gates: isTemplateIndexable, isPageIndexable
  metadata.ts            buildMetadata(): title, description, canonical, robots, Open Graph, Twitter, in one place
  page-metadata.ts       metadata for a landing page, noindexed automatically if it fails its gate
  jsonld.ts              Organization, WebSite, BreadcrumbList, CollectionPage, Product, Article
  sitemap.ts             what each sitemap lists (only canonical, indexable pages)
  analytics.ts           marketing-safe events and UTM capture
  og-card.tsx            1200 x 630 social cards (/og/template/<slug>, /og/page/<id>)
  screenshots.ts         real product screenshots used on the feature pages
```

| Pages | URLs |
| --- | --- |
| Occasions | `/wedding-invitations`, `/nikah-invitations`, `/engagement-invitations` |
| Styles | `/wedding-invitations/floral`, `/royal`, `/minimal`, `/indian` |
| Location | `/india/kerala` |
| Features | `/features`, `/features/rsvp`, `music`, `guest-tracking`, `personal-links`, `qr-code`, `photo-gallery`, `countdown`, `multiple-events` |
| Guides | `/guides` and five articles |
| Trust | `/about`, `/contact`, `/privacy`, `/terms` |
| Designs | `/templates/<slug>` |

`docs/seo-keyword-map.md` lists each page's primary and secondary keywords, intent, title, H1, related pages and designs. Regenerate it with `npm run seo:audit -- --map --write`.

### Rules the code enforces

- **One canonical per page.** Every public page sets its own canonical through `buildMetadata`. Filters, sorting, `utm_*`, preview and other query strings never change it, so `/?category=Wedding` and `/wedding-invitations?utm_source=x` are not separate pages. There is no site-wide default canonical.
- **Quality gate.** A landing page is indexed only if it shows at least its minimum number of real designs, has copy of its own and is not switched off. Otherwise it returns `noindex, follow` and is left out of every sitemap. A design page is indexed only if `isTemplateIndexable` passes: published, a stable slug, a preview picture, unique copy and not a duplicate.
- **Guest invitations are never indexed.** `/i/...` pages send `noindex, follow` in their metadata and in an `X-Robots-Tag` header. They are deliberately not blocked in `robots.txt`: a crawler can only obey a noindex it is allowed to read. Letting a host opt in to indexing would need a new setting in the database, so it has not been built.
- **Private routes** (`/dashboard`, `/invites`, `/guests`, `/account`, `/edit`, `/pay`, `/success`, `/start`, `/signin`, `/reset`, `/api`) are disallowed in `robots.txt` and send `X-Robots-Tag: noindex`. `/create` repeats the catalog and is `noindex, follow`.
- **No invented data.** No ratings, reviews, stock, discounts, customer numbers, offices or social profiles. Product markup carries only the real name, picture and price. FAQ sections are plain visible text, with no FAQ rich-result markup.
- **Unknown URLs are real 404s.** `/wedding-invitations/<anything else>`, `/features/<anything else>` and `/guides/<anything else>` return 404. `/templates` redirects (301) to the catalog at `/create`.

### Sitemaps

`/sitemap.xml` is an index of `/sitemap-pages.xml`, `/sitemap-collections.xml`, `/sitemap-templates.xml` and `/sitemap-blog.xml`. Empty ones are left out. Design entries carry an image with descriptive text. `lastmod` is the page's real update date from `pages.ts`, and is omitted where no meaningful date exists. There is no `priority` or `changefreq`.

### Adding or changing a page

1. Add it to `src/seo/pages.ts` (or `guides.ts`), with its own primary keyword, a unique title, description and H1, and links to related pages.
2. If it shows designs, check they genuinely match. Style tags are in `template-profiles.ts`.
3. Add its route under `src/app/(site)/` (copy a neighbour). Use `dynamicParams = false` for dynamic routes.
4. Run `npm run test:seo` and `npm run seo:audit`. Both must pass.

To add a design, also add its profile in `template-profiles.ts`: a design without one is `noindex` and is not listed in the sitemap.

### Checks

```bash
npm run test:seo                                   # logic tests: canonicals, titles, robots, sitemaps, indexability, schema
npm run seo:audit                                  # static audit of titles, descriptions, links, duplicates, sitemap eligibility
npm run seo:audit -- --live http://localhost:3000  # also fetches every sitemap URL and checks the real HTML
npm run seo:screens                                # re-captures the feature-page screenshots (needs npm run dev)
```

### Before you go live

Set these in the environment (see `.env.example`):

- `NEXT_PUBLIC_SITE_URL=https://www.yourein.in` so canonicals, sitemaps and invitation links use the live domain.
- `NEXT_PUBLIC_SUPPORT_EMAIL` (or `SUPPORT_WHATSAPP` in `src/config/site.ts`). Until a contact method exists, `/contact` is `noindex` and says support is being set up.
- Optional: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

Have the privacy policy and terms read by someone qualified, and add a refund and cancellation policy: they describe what the product does today but are not legal advice, and no refund terms have been invented.

### Google Search Console

1. Add a **Domain property** for `yourein.in` (this covers `www` and `https`).
2. Verify with the DNS TXT record Google gives you. If you prefer the HTML tag, set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
3. Under **Sitemaps**, submit `https://www.yourein.in/sitemap.xml`.
4. Watch **Pages** (indexing) for "Crawled, currently not indexed", "Duplicate" and "Excluded by noindex". The only noindex pages should be `/create`, `/contact` (until configured), guest invitations and private routes.
5. Watch **Core Web Vitals** for mobile and desktop.
6. Use **Performance** to see which queries bring people to which pages, and compare with the keyword map.
7. Check **Enhancements** for breadcrumb and product errors.
8. Use **URL Inspection** on the home page, one occasion page, one style page, one feature page, one design and one guide, and select **Request indexing**.

### Bing Webmaster Tools

Add the site (or import it from Search Console), verify with DNS or `NEXT_PUBLIC_BING_SITE_VERIFICATION`, and submit the same `sitemap.xml`. Bing also reads the `Sitemap:` line in `robots.txt`.

### Analytics

`src/seo/analytics.ts` records `template_view`, `template_preview` and `template_customize`, plus the first landing page and `utm_source`, `utm_medium`, `utm_campaign` of each visit. Events go to `window.dataLayer` (Google Tag Manager or GA4). With `NEXT_PUBLIC_GA_MEASUREMENT_ID` set, GA4 is loaded after the page is interactive; with it unset, no analytics script is loaded. Events carry only a design slug: never guest names, replies, phone numbers, venues or any invitation content.

`signup_start`, `signup_complete`, `payment_start`, `payment_complete` and `invitation_publish` are defined but not yet fired, because they live inside the sign-in and payment code. Add `track("payment_complete")` calls there when you are ready to change those screens.

## Meta ads tracking

Meta Pixel plus the Conversions API, with a consent banner, browser/server deduplication and a Purchase outbox, so a
verified payment is reported exactly once. Off until `NEXT_PUBLIC_META_PIXEL_ID` is set; nothing is sent for a visitor
until they allow advertising cookies. Setup, testing and troubleshooting: [docs/meta-ads-tracking-setup.md](docs/meta-ads-tracking-setup.md).
Tests: `npm run test:meta` and `npm run test:meta:browser`.

## Changing things

- **Add or edit a design:** add an entry in `src/data/templates.ts`, a scene in `src/invite/art/scenes/`, register it in `src/invite/art/index.ts`, then regenerate catalog images (below).
- **Catalog images:** `public/thumbs/*.webp` and `public/og.jpg` are screenshots of the real invitations. After changing artwork or sample names: run the site, then `npm run thumbs`. Then run `npm run renders`: it draws each design's two screens onto the real iPhone 16 model (`public/models/iphone-16.glb`) and writes the card and featured pictures to `public/renders/<slug>.webp`.
- **Editor steps and fields:** `src/components/app/Editor.tsx`; the fields themselves are defined in `src/lib/invite.ts`.
- **Stripe:** `src/server/payments/stripe.ts` describes the two functions to fill in. Orders and payments tables already carry currency and provider.
- **Hero phones:** the home page hero draws a real iPhone 16 model (`public/models/iphone-16.glb`, compressed with meshopt) with three.js in `src/components/site/HeroPhones3D.tsx`. Each phone's screen shows that design's catalog image; poses and sway are in `POSES`. Without WebGL the flat mockups stay. Model: "iPhone 16 - Free" by Wes (sketchfab.com/wimell), Sketchfab Standard licence.
- **Functions and replies:** each event can have a dress code and be private (`events[].private`); private events reach only guests whose `guests.private_events` lists them, and are filtered on the server in `resolveTemplate`. With `rsvp.perEvent`, guests give a number for each function they can see; `attendee_count` is the largest of those. Host questions live in `rsvp.questions` (text, yes/no or one choice, up to 6) and are checked in `cleanAnswers`.
- **Event guide:** `notice` shows an "Update from the hosts" band at the top of the invitation; `stays` (up to 4) adds "Where to stay". In the guest list each family has a QR code for their personal link and can have the link turned off (`guests.disabled`): the page then says so, and replies, wishes and tracking from it are refused (`activeGuestBySlug`).
- **Memories:** with `guestPhotos` on, a wish can carry one photo (stored in `photos` as kind `guest`, owned by the host; up to 300 per invitation; hidden with its wish and deleted with it). The editor's clean-up of unused uploads only touches portrait, gallery and music. `thanksOn` turns the invitation into a thank-you page: the RSVP form and countdown hide, replies are refused, the guestbook stays open. The manage page draws a phone-sized invitation picture with a QR code in the browser (`src/components/app/InviteImage.tsx`).
- **Look and feel (design tokens):** colours, type sizes, corner radius, shadows and motion are CSS variables at the top of `src/app/globals.css` (`--bg`, `--surface`, `--accent`, `--r-lg`, `--shadow-card`, `--dur-sheet`…). Headings and numbers use GFS Didot, everything else Jost; invitations keep their own typefaces. Change a token there and every screen follows.
- **Background music:** the editor offers a built-in library or the host's own file (MP3, M4A, AAC or WAV up to 4 MB, the request limit on Vercel; larger files would need object storage). Track details live only in `src/data/music.ts` (title, mood, style, filters, duration, `active`, order, and `RECOMMENDED` per design). The ten active tracks in `public/audio/builtin/` (Her, Pesamale, Sahiba, Taaj, Lover Remix, Ordinary, Hoor, Inaam, and violin versions of Golden Hour and Love Story) are 90-second clips with a fade in and out, cut from licensed songs. The ten earlier placeholder pieces from `npm run music` (`scripts/make-music.mjs`) are retired (`active: false`) but their files stay, so invitations that already use them keep playing. To add a track, encode a clip to `public/audio/builtin/<id>.m4a`, add it to `TRACKS` and update `duration`. Invitations store `musicSource` (`builtin` / `upload` / `none`; older invitations read as their upload), `musicTrack`, `musicVolume` (default 35) and `musicStart`. Music never plays before the guest's tap; it fades in over 1.8 s through a gain node (so it works on iPhone), loops, and the guest can mute it.
- **Signature designs:** Moonlit Mahal and Velvet Opera set `theme.skin` and `theme.display`. The skin restyles the shared sections in `src/invite/skins.css` (arches for Moonlit Mahal; a programme in acts with a theatre-ticket RSVP for Velvet Opera) and can label sections (`src/invite/skins.ts`); `display` letters names and titles in Bodoni Moda or Playfair Display instead of a script. Their scenes and openings are in `src/invite/art/scenes/`.
- **Support link:** set `SUPPORT_WHATSAPP` in `src/config/site.ts` to show a "Help on WhatsApp" link in the footer. Leave empty to hide it.

## Tests

The site has to be running. Tests use simulated payments, so run them against `npm run dev`, or a build started with `YOUREIN_TEST_PAYMENTS=1` and no Razorpay keys.

```bash
npm run test:flow  [screenshot-folder]    # the full journey at 390 px wide
npm run test:paths [screenshot-folder]    # everything around it, at 360 px wide
npm run test:pay                          # Razorpay path with a stand-in Razorpay; see the header of scripts/dev/pay-live-path.mjs
node scripts/dev/admin-check.mjs          # the admin area over HTTP; run after test:pay, see its header
npm run test:seo                          # SEO logic tests, no site needed
npm run test:admin                        # price, admin access, setup checks and CSV tests, no site needed
```

`scripts/dev/seed-and-shoot.mjs <folder> [width] [height]` creates a published invitation with guests and replies and screenshots every signed-in screen at that size.

## Known limits

- **Artwork is drawn in code** (layered vector illustration), not painted or photographed. It is original, light and sharp at any size; swapping in commissioned illustration later means replacing files in `src/invite/art/scenes/`.
- **Photos and music live in the database.** Photos are shrunk in the browser before upload. Music is limited to 4 MB, which is also Vercel's request limit. For heavy use, move `photos.bytes` to object storage (S3, R2, Vercel Blob); only `addMedia` and `getMedia` in `src/server/invitations.ts` need to change.
- **Colour presets are not offered.** Each design is drawn for its own palette. The editor's Design step lets the host switch to any other design and keeps everything they typed.
- **Catalog cards are taller than a 0.75 ratio on phones.** Two per row with a full phone mockup at 80% of the card width fixes the height; the choice was to show the whole invitation screen instead of cropping it.
- **Rate limits are per server instance.** Fine for launch; put a shared limiter (Upstash, Vercel KV) in `src/server/http.ts` if abuse appears.
