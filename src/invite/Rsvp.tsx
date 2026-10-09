"use client";

import React, { useEffect, useState } from "react";
import type { Template } from "@/data/templates";
import { formatDate } from "@/lib/invite";

type Status = "yes" | "maybe" | "no";
type Saved = { status: Status; count: number; name: string; token?: string };

const LABEL: Record<Status, string> = { yes: "Yes, I’ll be there", maybe: "Maybe", no: "Sorry, can’t make it" };

function summary(s: Saved) {
  if (s.status === "no") return "You let us know you cannot make it.";
  const who = s.count === 1 ? "1 guest" : `${s.count} guests`;
  return s.status === "yes" ? `You are coming, with ${who} in total.` : `You replied maybe, for ${who}.`;
}

/**
 * The reply section.
 * - On a design preview (no customer content) it is an example that sends nothing.
 * - In the host's own preview it behaves like the real thing but does not store replies.
 * - On a published invitation it stores the guest's reply for the host.
 */
export function RsvpForm({ t }: { t: Template }) {
  const live = t.live;
  const settings = live?.rsvp ?? null;
  const guest = live?.guest;
  const max = guest?.max ?? settings?.maxPerInvite ?? 4;
  const storeKey = live?.invitation ? `yi-rsvp:${live.invitation}${guest ? `:${guest.slug}` : ""}` : null;

  const [status, setStatus] = useState<Status | null>(null);
  const [name, setName] = useState(guest?.name ?? "");
  const [count, setCount] = useState(Math.min(2, max));
  const [phone, setPhone] = useState("");
  const [meal, setMeal] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<Saved | null>(guest?.replied ? { status: guest.replied.status, count: guest.replied.count, name: guest.name } : null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  /* a guest on the general link sees their earlier reply on the same device */
  useEffect(() => {
    if (!storeKey || guest?.replied) return;
    try {
      const raw = window.localStorage.getItem(storeKey);
      if (raw) {
        const s = JSON.parse(raw) as Saved;
        setSaved(s);
        if (!guest) setName(s.name);
      }
    } catch {
      /* private browsing: nothing stored */
    }
  }, [storeKey, guest]);

  if (live && !settings) return null;

  const allowMaybe = settings?.allowMaybe ?? true;
  const options: Status[] = allowMaybe ? ["yes", "maybe", "no"] : ["yes", "no"];
  const full = !!settings?.full && saved?.status !== "yes";
  const closed = !!settings?.closed;
  const deadline = settings?.deadline ? formatDate(settings.deadline, { day: "numeric", month: "long" }) : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!status) return;
    setError("");
    if (!guest && !name.trim()) {
      setError("Please add your name.");
      return;
    }
    if (!live || live.mode === "preview" || !live.invitation) {
      setNote(live ? "This is your preview, so nothing was saved. Replies from guests appear in your dashboard." : "This is a preview, so nothing was sent. In your invitation, replies come straight to your dashboard.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation: live.invitation, guest: guest?.slug, status, name, count, phone, meal, message, token: saved?.token }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Your reply could not be sent. Please try again.");
        return;
      }
      const next: Saved = { status, count: status === "no" ? 0 : count, name: guest?.name ?? name.trim(), token: out.token ?? saved?.token };
      setSaved(next);
      setEditing(false);
      try {
        if (storeKey) window.localStorage.setItem(storeKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    } catch {
      setError("You seem to be offline. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    if (saved) {
      setStatus(saved.status);
      if (saved.count > 0) setCount(Math.min(saved.count, max));
    }
    setEditing(true);
  };

  const showForm = !saved || editing;

  return (
    <section className="sec sec-rsvp" id="rsvp">
      <h2 className="sec-title" data-rv="wipe">Will you be joining us?</h2>
      {closed ? (
        <p className="sec-body" data-rv="up">Replies closed on {deadline}. Please contact the hosts directly.</p>
      ) : !showForm && saved ? (
        <div className="rsvp rsvp-done" data-rv="up" role="status">
          <p className="rsvp-thanks">Thank you{saved.name ? `, ${saved.name.split(" ")[0]}` : ""}.</p>
          <p className="rsvp-summary">{summary(saved)}</p>
          <button type="button" className="inv-btn" onClick={startEdit}>Change my reply</button>
        </div>
      ) : (
        <>
          {deadline && <p className="sec-body" data-rv="up">Kindly reply by {deadline}.</p>}
          <form className="rsvp" data-rv="up" onSubmit={submit} noValidate>
            <div className="rsvp-choice" role="radiogroup" aria-label="Your reply">
              {options.map((o) => (
                <button key={o} type="button" role="radio" aria-checked={status === o} disabled={o === "yes" && full} onClick={() => { setStatus(o); setNote(""); setError(""); }}>
                  {LABEL[o]}
                </button>
              ))}
            </div>
            {full && <p className="rsvp-hint">This event has reached its capacity, so new “yes” replies are closed.</p>}

            {status && (
              <div className="rsvp-fields">
                {!guest && (
                  <label className="rsvp-field">
                    <span>Your name</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required />
                  </label>
                )}
                {status !== "no" && (
                  <div className="rsvp-guests">
                    <span>Guests attending{max > 1 ? ` (up to ${max})` : ""}</span>
                    <div className="inv-stepper">
                      <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1} aria-label="One fewer guest">−</button>
                      <output aria-live="polite">{count}</output>
                      <button type="button" onClick={() => setCount((c) => Math.min(max, c + 1))} disabled={count >= max} aria-label="One more guest">+</button>
                    </div>
                  </div>
                )}
                {(settings?.askPhone ?? false) && (
                  <label className="rsvp-field">
                    <span>Phone (optional)</span>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={24} inputMode="tel" />
                  </label>
                )}
                {settings?.askMeal && status !== "no" && settings.mealOptions.length > 0 && (
                  <div className="rsvp-field">
                    <span id="meal-label">Meal preference</span>
                    <div className="rsvp-chips" role="radiogroup" aria-labelledby="meal-label">
                      {settings.mealOptions.map((m) => (
                        <button key={m} type="button" role="radio" aria-checked={meal === m} onClick={() => setMeal(meal === m ? "" : m)}>{m}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(settings?.askMessage ?? true) && (
                  <label className="rsvp-field">
                    <span>Message to {t.couple[1] ? "the couple" : "the host"} (optional)</span>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={400} />
                  </label>
                )}
              </div>
            )}

            <button type="submit" className="inv-btn inv-btn-solid" disabled={!status || busy}>{busy ? "Sending…" : saved ? "Update reply" : "Submit RSVP"}</button>
            <p className="rsvp-status" role="status" aria-live="polite">{error ? <span className="rsvp-error">{error}</span> : note || " "}</p>
          </form>
        </>
      )}
    </section>
  );
}
