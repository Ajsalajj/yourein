import { PRICE } from "@/config/site";

/** The one price. The rupee sign is set in the interface face so it sits well beside display numerals. */
export function Price() {
  return (
    <span className="price-tag" aria-label={`${PRICE} rupees`}>
      <span className="rs" aria-hidden="true">₹</span>
      <span aria-hidden="true">{PRICE}</span>
    </span>
  );
}
