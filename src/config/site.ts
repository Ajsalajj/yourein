/**
 * Global site settings. Change values here once; every page picks them up.
 */

/** One price for every template, in rupees. */
export const PRICE = 999;
export const CURRENCY = "INR";
export const PRICE_LABEL = "₹999";

export const SITE_NAME = "YoureIn";
export const TAGLINE = "Invitations worth opening.";

/**
 * Optional support number for a "Chat with us" link in the footer.
 * International format, digits only (e.g. "919876543210"). Leave empty to hide the link.
 * WhatsApp is not part of buying: customers customize, pay and publish on the site.
 */
export const SUPPORT_WHATSAPP: string = "";

/**
 * Public URL of the deployed site, used for SEO tags and invitation links.
 * On Vercel this is picked up automatically; set NEXT_PUBLIC_SITE_URL to use your own domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");
