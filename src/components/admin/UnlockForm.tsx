"use client";

import { useState } from "react";
import { api } from "@/components/app/client";

export function UnlockForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("POST", "/api/admin/unlock", { code });
      window.location.assign("/admin");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="adm-unlock">
      <label htmlFor="code">Access code</label>
      <input id="code" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} autoFocus required />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-solid btn-block" disabled={busy || !code}>{busy ? "Checking…" : "Open admin"}</button>
    </form>
  );
}
