"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { trackServerEvent } from "@/lib/meta-pixel";

type Mode = "choose" | "signup" | "signin" | "forgot";

const ERRORS: Record<string, string> = {
  "google-off": "Google sign-in is not set up on this site yet. Please continue with email.",
  "google-failed": "Google sign-in did not finish. Please try again, or continue with email.",
};

async function post(url: string, data: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const out = await res.json().catch(() => ({}));
  return { ok: res.ok, ...out } as { ok: boolean; error?: string; code?: string; sent?: boolean; unavailable?: boolean; devLink?: string | null; metaEventId?: string | null };
}

/** `saving`: a guest who has customized a draft and now needs an account to keep it and pay. */
export function AuthScreen({ next, template, error, saving = false, startMode = "choose" }: { next: string; template: { slug: string; name: string } | null; error?: string; saving?: boolean; startMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(startMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(error ? ERRORS[error] ?? "" : "");
  const [done, setDone] = useState<null | { devLink?: string | null; unavailable?: boolean }>(null);

  const go = (m: Mode) => { setMode(m); setMsg(""); setDone(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      if (mode === "forgot") {
        const out = await post("/api/auth/forgot", { email });
        if (!out.ok) setMsg(out.error || "Something went wrong. Please try again.");
        else setDone({ devLink: out.devLink, unavailable: out.unavailable });
        return;
      }
      const out = await post(mode === "signup" ? "/api/auth/signup" : "/api/auth/signin", { name, email, password });
      if (!out.ok) {
        setMsg(out.error || "Something went wrong. Please try again.");
        if (out.code === "exists") setMode("signin");
        return;
      }
      if (mode === "signup" && out.metaEventId) {
        /* the server already reported the new account; the Pixel reports it with the same id, given a moment to send */
        trackServerEvent("CompleteRegistration", out.metaEventId);
        await new Promise((r) => setTimeout(r, 300));
      }
      window.location.assign(next);
    } catch {
      setMsg("You seem to be offline. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === "signin" ? "Welcome back." : mode === "forgot" ? "Reset your password." : saving ? "Save your invitation." : "Make it yours.";
  const sub =
    saving && mode !== "forgot" ? `${mode === "signin" ? "Sign in" : "Create an account"} to keep everything you have made and continue to payment.`
    : mode === "signin" ? "Sign in to continue with your invitation."
    : mode === "forgot" ? "Enter your email and we will send you a link to choose a new password."
    : "Create an account to save and customize your invitation.";

  return (
    <div className="auth">
      <header className="auth-top">
        <Link href="/" className="logo"><Logo /></Link>
        <a className="auth-x" href={template ? `/templates/${template.slug}` : "/"} aria-label="Close and go back">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </a>
      </header>

      <main className="auth-card">
        {template && (
          <div className="auth-tpl">
            <span className="auth-thumb"><Image src={`/thumbs/${template.slug}.webp`} alt="" width={780} height={1688} sizes="64px" /></span>
            <span>You picked<b>{template.name}</b></span>
          </div>
        )}
        <h1>{heading}</h1>
        <p className="auth-sub">{sub}</p>

        {mode === "choose" && (
          <div className="auth-options">
            <a className="btn btn-quiet btn-block" href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.300H12v4.400h6.200a5.3 5.3 0 0 1-2.3 3.500v2.900h3.700c2.2-2 3.4-5 3.4-8.500Z" /><path fill="#34A853" d="M12 23.500c3.1 0 5.7-1 7.6-2.800l-3.7-2.900c-1 .7-2.3 1.1-3.9 1.100a6.9 6.9 0 0 1-6.5-4.700H1.700v3A11.5 11.5 0 0 0 12 23.500Z" /><path fill="#FBBC05" d="M5.5 14.200a6.9 6.9 0 0 1 0-4.400v-3H1.700a11.5 11.5 0 0 0 0 10.400l3.8-3Z" /><path fill="#EA4335" d="M12 5.100c1.7 0 3.2.6 4.4 1.700l3.3-3.300A11.5 11.5 0 0 0 1.7 6.800l3.8 3A6.9 6.9 0 0 1 12 5.100Z" /></svg>
              Continue with Google
            </a>
            <button type="button" className="btn btn-solid btn-block" onClick={() => go("signup")}>Continue with Email</button>
            {msg && <p className="form-error" role="alert">{msg}</p>}
            <p className="auth-alt">Already have an account? <button type="button" className="text-link" onClick={() => go("signin")}>Sign in</button></p>
          </div>
        )}

        {mode !== "choose" && !done && (
          <form className="form" onSubmit={submit}>
            {mode === "signup" && (
              <label className="field">
                <span>Your name</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required />
              </label>
            )}
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
            </label>
            {mode !== "forgot" && (
              <label className="field">
                <span>Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required />
                {mode === "signup" && <small>At least 8 characters.</small>}
              </label>
            )}
            {msg && <p className="form-error" role="alert">{msg}</p>}
            <button type="submit" className="btn btn-solid btn-block" disabled={busy}>
              {busy ? "One moment…" : mode === "signup" ? "Create account" : mode === "signin" ? "Sign in" : "Send reset link"}
            </button>
            {mode === "signin" && <p className="auth-alt"><button type="button" className="text-link" onClick={() => go("forgot")}>Forgot password?</button></p>}
            <p className="auth-alt">
              {mode === "signup" ? <>Already have an account? <button type="button" className="text-link" onClick={() => go("signin")}>Sign in</button></> : <>New here? <button type="button" className="text-link" onClick={() => go("signup")}>Create an account</button></>}
            </p>
            <p className="auth-alt"><button type="button" className="text-link" onClick={() => go("choose")}>Other ways to continue</button></p>
          </form>
        )}

        {done && (
          <div className="auth-done" role="status">
            {done.unavailable ? (
              <p>Password reset by email is not available on this site yet. Please contact us and we will help you get back in.</p>
            ) : done.devLink !== undefined ? (
              <>
                <p>Email sending is not set up on this site, so no message was sent.</p>
                {done.devLink ? <p>Because this is a development build, here is the link the email would contain: <a href={done.devLink}>choose a new password</a>.</p> : <p>There is no account with that email.</p>}
              </>
            ) : (
              <p>If there is an account for {email}, a reset link is on its way. It works for one hour.</p>
            )}
            <button type="button" className="btn btn-quiet btn-block" onClick={() => go("signin")}>Back to sign in</button>
          </div>
        )}
      </main>
    </div>
  );
}

export function ResetScreen({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const out = await post("/api/auth/reset", { token, password }).catch(() => ({ ok: false, error: "You seem to be offline. Please try again." }));
    if (!out.ok) {
      setMsg(out.error || "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    window.location.assign("/dashboard");
  };
  return (
    <div className="auth">
      <header className="auth-top"><Link href="/" className="logo"><Logo /></Link></header>
      <main className="auth-card">
        <h1>Choose a new password.</h1>
        <p className="auth-sub">You will be signed in straight after.</p>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>New password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            <small>At least 8 characters.</small>
          </label>
          {msg && <p className="form-error" role="alert">{msg}</p>}
          <button type="submit" className="btn btn-solid btn-block" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
          <p className="auth-alt"><a className="text-link" href="/signin">Back to sign in</a></p>
        </form>
      </main>
    </div>
  );
}
