/**
 * Stripe: reserved for international payments later.
 *
 * The rest of the app only needs two things from a payment provider:
 *   1. createOrder   -> something the browser can pay (a Checkout Session URL or PaymentIntent client secret)
 *   2. verification  -> a server-side proof that the payment succeeded (Stripe: the signed
 *                       `checkout.session.completed` webhook), after which `publishInvitation` is called
 *
 * To add it: create a Checkout Session in `createOrder` when the customer's currency is not INR,
 * store its id in `orders.provider_order_id` with provider = 'stripe', and call the same `settle`
 * step from a /api/pay/stripe-webhook route after verifying the `Stripe-Signature` header.
 * The orders and payments tables already hold everything Stripe needs (amount, currency, ids, status).
 */
export const STRIPE_READY = false;
