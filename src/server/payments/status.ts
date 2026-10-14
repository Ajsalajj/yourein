import { priceLabel } from "@/config/price";

export type Env = Record<string, string | undefined>;
export type Check = { id: string; label: string; state: "ok" | "warn" | "bad"; detail: string };

/** The key id with all but the last four characters hidden. The secret is never shown anywhere. */
export const maskKeyId = (id: string) => (id.length <= 12 ? "••••" : `${id.slice(0, id.startsWith("rzp_") ? 9 : 4)}••••${id.slice(-4)}`);

/**
 * Is the site ready to take money? Each check says what is wrong and what to do about it.
 * Pure: it only reads the environment it is given, so it is easy to test.
 */
export function setupChecks(env: Env, ctx: { price: number; databaseKind: "postgres" | "embedded"; origin: string; production: boolean }): Check[] {
  const id = env.RAZORPAY_KEY_ID?.trim();
  const secret = env.RAZORPAY_KEY_SECRET?.trim();
  const out: Check[] = [];

  if (id && secret) {
    const live = id.startsWith("rzp_live_");
    out.push({ id: "keys", label: "Razorpay keys", state: "ok", detail: `Key ${maskKeyId(id)} and a secret are set.` });
    out.push(
      live
        ? { id: "mode", label: "Razorpay mode", state: "ok", detail: "LIVE keys. Customers are charged real money." }
        : { id: "mode", label: "Razorpay mode", state: "warn", detail: "TEST keys. Payments work but no real money moves. Switch to rzp_live_ keys when you are ready to sell." },
    );
  } else if (id || secret) {
    out.push({ id: "keys", label: "Razorpay keys", state: "bad", detail: `Only ${id ? "RAZORPAY_KEY_ID" : "RAZORPAY_KEY_SECRET"} is set. Both are needed, so online payment is switched off.` });
  } else if (env.YOUREIN_TEST_PAYMENTS === "1" || !ctx.production) {
    out.push({ id: "keys", label: "Razorpay keys", state: "warn", detail: "No Razorpay keys. Payments are simulated and no money is taken." });
  } else {
    out.push({ id: "keys", label: "Razorpay keys", state: "bad", detail: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set, so customers cannot pay yet." });
  }

  if (env.YOUREIN_TEST_PAYMENTS === "1" && ctx.production && !(id && secret)) {
    out.push({ id: "free", label: "Simulated payments", state: "bad", detail: "YOUREIN_TEST_PAYMENTS=1 is set with no Razorpay keys: anyone can publish without paying. Remove it on the live site." });
  }

  out.push(
    env.RAZORPAY_WEBHOOK_SECRET?.trim()
      ? { id: "webhook", label: "Webhook secret", state: "ok", detail: "Set. Make sure the webhook below is added in the Razorpay dashboard." }
      : { id: "webhook", label: "Webhook secret", state: "warn", detail: "RAZORPAY_WEBHOOK_SECRET is not set. A customer who pays and closes the tab straight away may not get their invitation published, and failed payments and refunds will not be recorded." },
  );

  out.push(
    ctx.databaseKind === "postgres"
      ? { id: "database", label: "Database", state: "ok", detail: "A PostgreSQL database is connected, so payments and invitations are kept safely." }
      : { id: "database", label: "Database", state: ctx.production ? "bad" : "warn", detail: ctx.production ? "No DATABASE_URL. Payments and invitations are stored in a temporary folder and will be lost when the server restarts. Set DATABASE_URL before taking real payments." : "Using the embedded development database." },
  );

  out.push(
    env.AUTH_SECRET?.trim()
      ? { id: "secret", label: "AUTH_SECRET", state: "ok", detail: "Set." }
      : { id: "secret", label: "AUTH_SECRET", state: ctx.production ? "bad" : "warn", detail: "Not set. Set a long random string so sign-in and payment checks are secure." },
  );

  out.push(
    env.NEXT_PUBLIC_SITE_URL?.trim()
      ? { id: "site", label: "Site address", state: "ok", detail: `${env.NEXT_PUBLIC_SITE_URL.trim()}. Sign-in and payment requests are only accepted from this address, so open the site on exactly this domain.` }
      : { id: "site", label: "Site address", state: "warn", detail: "NEXT_PUBLIC_SITE_URL is not set. Invitation links and canonical URLs use whatever address the host reports." },
  );

  out.push({ id: "price", label: "Price", state: ctx.price === 1 ? "warn" : "ok", detail: ctx.price === 1 ? `${priceLabel(ctx.price)} per invitation: the test price. Set NEXT_PUBLIC_PRICE_INR (for example 999) and redeploy to change it.` : `${priceLabel(ctx.price)} per invitation.` });
  return out;
}

/** The events to tick when adding the webhook in the Razorpay dashboard. */
export const WEBHOOK_EVENTS = ["payment.captured", "order.paid", "payment.failed", "refund.processed"];

/** Asks Razorpay to list one order. A 200 means the key id and secret are valid. Creates nothing and moves no money. */
export async function checkRazorpayConnection(env: Env = process.env): Promise<{ ok: boolean; message: string }> {
  const id = env.RAZORPAY_KEY_ID?.trim();
  const secret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!id || !secret) return { ok: false, message: "Razorpay keys are not set." };
  try {
    const res = await fetch(`${env.RAZORPAY_API_URL || "https://api.razorpay.com"}/v1/orders?count=1`, {
      headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) return { ok: true, message: `Connected to Razorpay with ${maskKeyId(id)} (${id.startsWith("rzp_live_") ? "live" : "test"} mode).` };
    if (res.status === 401) return { ok: false, message: "Razorpay rejected these keys. Check the key id and secret, and that they are from the same mode (test or live)." };
    return { ok: false, message: `Razorpay answered with status ${res.status}.` };
  } catch (e) {
    return { ok: false, message: `Could not reach Razorpay: ${(e as Error).message}` };
  }
}
