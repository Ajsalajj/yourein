"use client";

import { useState } from "react";
import { api } from "./client";

export function AccountForm({ name: initialName, email, hasPassword, google }: { name: string; email: string; hasPassword: boolean; google: boolean }) {
  const [name, setName] = useState(initialName);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("PATCH", "/api/account", { name });
      setMsg({ text: "Saved." });
    } catch (err) {
      setMsg({ text: (err as Error).message, bad: true });
    } finally {
      setBusy(false);
    }
  };
  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("PATCH", "/api/account", { currentPassword: current, newPassword: next });
      setPwMsg({ text: "Password updated." });
      setCurrent("");
      setNext("");
    } catch (err) {
      setPwMsg({ text: (err as Error).message, bad: true });
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    await api("POST", "/api/auth/signout").catch(() => {});
    window.location.assign("/");
  };

  return (
    <>
      <form className="sheet form" onSubmit={saveName}>
        <label className="field"><span>Your name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" /></label>
        <label className="field"><span>Email</span><input type="email" value={email} readOnly /><small>{google ? "Signed in with Google." : "This is the email you sign in with."}</small></label>
        {msg && <p className={msg.bad ? "form-error" : "hint"} role="status">{msg.text}</p>}
        <button type="submit" className="btn btn-solid" disabled={busy}>Save</button>
      </form>

      <h2 className="section-h">{hasPassword ? "Change password" : "Set a password"}</h2>
      <form className="sheet form" onSubmit={savePassword}>
        {hasPassword && <label className="field"><span>Current password</span><input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required /></label>}
        <label className="field"><span>New password</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required /><small>At least 8 characters.</small></label>
        {pwMsg && <p className={pwMsg.bad ? "form-error" : "hint"} role="status">{pwMsg.text}</p>}
        <button type="submit" className="btn btn-quiet" disabled={busy}>{hasPassword ? "Update password" : "Set password"}</button>
      </form>

      <h2 className="section-h">Sign out</h2>
      <div className="sheet"><button type="button" className="btn btn-quiet" onClick={signOut}>Sign out of YoureIn</button></div>
    </>
  );
}
