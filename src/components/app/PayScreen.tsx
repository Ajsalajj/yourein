"use client";

import Image from "next/image";
import { useState } from "react";
import { PRICE_LABEL } from "@/config/site";
import { api } from "./client";

type Checkout =
  | { mode: "razorpay"; keyId: string; orderId: string; amount: number; currency: string; name: string; description: string; prefill: { name: string; email: string } }
  | { mode: "test"; orderId: string }
  | { mode: "published"; slug: string };

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void };
  }
}

const INCLUDES = ["Interactive invitation", "RSVP", "Gallery", "Google Maps", "Countdown", "Music", "Guest tracking", "Shareable link"];

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("The payment window could not load. Check your connection and try again."));
    document.head.appendChild(s);
  });
}

export function PayScreen({ id, templateSlug, templateName, names, eventLine, mode }: { id: string; templateSlug: string; templateName: string; names: string; eventLine: string; mode: "razorpay" | "test" | "off" }) {
  const [state, setState] = useState<"idle" | "starting" | "test" | "verifying">("idle");
  const [error, setError] = useState("");
  const [testOrder, setTestOrder] = useState("");

  const verify = async (orderId: string, paymentId: string, signature: string) => {
    setState("verifying");
    try {
      await api("POST", "/api/pay/verify", { orderId, paymentId, signature });
      window.location.assign(`/success/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  };

  const pay = async () => {
    setError("");
    setState("starting");
    try {
      const co = await api<Checkout>("POST", "/api/pay/order", { invitationId: id });
      if (co.mode === "published") {
        window.location.assign(`/success/${id}`);
        return;
      }
      if (co.mode === "test") {
        setTestOrder(co.orderId);
        setState("test");
        return;
      }
      await loadRazorpay();
      const rzp = new window.Razorpay!({
        key: co.keyId,
        order_id: co.orderId,
        amount: co.amount,
        currency: co.currency,
        name: co.name,
        description: co.description,
        prefill: co.prefill,
        theme: { color: "#26231F" },
        handler: (r: RazorpayResponse) => void verify(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature),
        modal: { ondismiss: () => setState("idle") },
      });
      rzp.on("payment.failed", (r) => {
        setError(r.error?.description || "The payment did not go through. No money was taken. Please try again.");
        setState("idle");
      });
      rzp.open();
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "incomplete") {
        window.location.assign(`/edit/${id}?step=review`);
        return;
      }
      setError(err.message);
      setState("idle");
    }
  };

  const completeTest = async () => {
    setError("");
    try {
      const out = await api<{ orderId: string; paymentId: string; signature: string }>("POST", "/api/pay/test", { orderId: testOrder });
      await verify(out.orderId, out.paymentId, out.signature);
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  };

  const busy = state === "starting" || state === "verifying";

  return (
    <div className="pay">
      <header className="ed-top">
        <div className="ed-top-row">
          <a className="ed-back" href={`/edit/${id}?step=review`} aria-label="Back to editing">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <div className="ed-title"><b>Payment</b><span>Step 8 of 8</span></div>
        </div>
        <div className="ed-progress" aria-hidden="true"><i style={{ width: "100%" }} /></div>
      </header>

      <main className="pay-main">
        <h1 className="ed-h" style={{ marginTop: 22 }}>Publish your invitation.</h1>
        <p className="ed-lead" style={{ marginBottom: 0 }}>One payment. Your link is ready the moment it goes through.</p>

        <div className="pay-card">
          <div className="pay-item">
            <span className="invite-thumb"><Image src={`/thumbs/${templateSlug}.webp`} alt="" width={780} height={1688} sizes="56px" /></span>
            <div>
              <small>{templateName}</small>
              <b>{names}</b>
              <small>{eventLine}</small>
            </div>
          </div>
          <div className="pay-total">
            <span>One-time payment</span>
            <b>{PRICE_LABEL}</b>
          </div>
          <ul className="pay-inc">{INCLUDES.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>

        {mode === "off" ? (
          <p className="notice" style={{ marginTop: 18 }} role="status">Online payment is not set up on this site yet. Your invitation is saved and you can publish as soon as payments are switched on.</p>
        ) : (
          <div className="pay-cta">
            {state !== "test" && (
              <button type="button" className="btn btn-solid btn-block" onClick={pay} disabled={busy}>
                {state === "starting" ? "Opening payment…" : state === "verifying" ? "Confirming payment…" : `Pay ${PRICE_LABEL} & Publish`}
              </button>
            )}
            {state === "test" && (
              <div className="test-panel" role="group" aria-label="Test payment">
                <p><b>Test mode.</b> No payment service is connected, so no money is taken. This stands in for the payment window.</p>
                <button type="button" className="btn btn-solid btn-block" onClick={completeTest}>Complete test payment</button>
                <button type="button" className="btn btn-quiet btn-block" onClick={() => setState("idle")}>Cancel</button>
              </div>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="pay-fine">
              {mode === "test" ? "Test mode: payments are simulated on this site." : "Secure payment by Razorpay. UPI, cards, net banking and wallets."}
            </p>
            <p className="pay-fine">You can keep editing after you publish.</p>
          </div>
        )}
      </main>
    </div>
  );
}
