/**
 * The price of one invitation, in whole rupees.
 *
 * Set NEXT_PUBLIC_PRICE_INR in the environment to change it (for example 999 when testing is over).
 * Left unset, it is ₹1, which is the smallest amount Razorpay accepts and is used for test payments.
 * Anything that is not a whole number from 1 to 100000 is ignored and the default is used instead.
 */
export const DEFAULT_PRICE = 1;

export function parsePrice(raw: string | undefined | null, fallback: number = DEFAULT_PRICE): number {
  const text = (raw ?? "").trim();
  if (!/^\d{1,6}$/.test(text)) return fallback;
  const n = Number(text);
  return n >= 1 && n <= 100000 ? n : fallback;
}

/** "₹1", "₹999", "₹1,499": Indian digit grouping. */
export function priceLabel(rupees: number): string {
  return `₹${rupees.toLocaleString("en-IN")}`;
}
