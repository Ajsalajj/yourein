"use client";

import { useState } from "react";
import { api } from "@/components/app/client";

/** Asks the server to test the Razorpay keys. Nothing is created and no money moves. */
export function CheckRazorpay() {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    setState(null);
    try {
      setState(await api<{ ok: boolean; message: string }>("POST", "/api/admin/check-razorpay", {}));
    } catch (e) {
      setState({ ok: false, message: (e as Error).message });
    }
    setBusy(false);
  };
  return (
    <div>
      <button type="button" className="btn btn-solid btn-sm" onClick={run} disabled={busy}>{busy ? "Checking…" : "Test the Razorpay connection"}</button>
      {state && <p className={state.ok ? "adm-ok" : "form-error"} role="status" style={{ marginTop: 10 }}>{state.message}</p>}
    </div>
  );
}
