"use client";

import React, { useEffect, useState } from "react";
import type { Template } from "@/data/templates";
import { formatDate } from "@/lib/invite";

type Status = "yes" | "maybe" | "no";
type Saved = { status: Status; count: number; name: string; token?: string; events?: Record<string, number>; answers?: Record<string, string>; meal?: string };

const LABEL: Record<Status, string> = { yes: "Yes, I’ll be there", maybe: "Maybe", no: "Sorry, can’t make it" };

function summary(s: Saved, titles: Record<string, string>) {
  if (s.status === "no") return "You let us know you cannot make it.";
  const each = Object.entries(s.events ?? {}).filter(([id, n]) => n > 0 && titles[id]);
  if (each.length) return `You are coming to ${each.map(([id, n]) => `${titles[id]} (${n})`).join(", ")}.`;
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
  const [perEvent, setPerEvent] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Saved | null>(guest?.replied ? { status: guest.replied.status, count: guest.replied.count, name: guest.name, events: guest.replied.events, answers: guest.replied.answers, meal: guest.replied.meal } : null);
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
  /* replies per function: one counter per event this guest can see */
  const byEvent = !!settings?.perEvent && t.events.filter((e) => e.id).length > 1;
  const fnEvents = byEvent ? t.events.filter((e) => e.id) : [];
  const titles = Object.fromEntries(fnEvents.map((e) => [e.id!, e.title]));
  const fnStatus: Status = Object.values(perEvent).some((n) => n > 0) ? "yes" : "no";
  const questions = (settings?.questions ?? []).filter((q) => q.label);
  const options: Status[] = allowMaybe ? ["yes", "maybe", "no"] : ["yes", "no"];
  const full = !!settings?.full && saved?.status !== "yes";
  const closed = !!settings?.closed;
  const deadline = settings?.deadline ? formatDate(settings.deadline, { day: "numeric", month: "long" }) : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const status_ = byEvent ? fnStatus : status;
    if (!status_) return;
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
        body: JSON.stringify({ invitation: live.invitation, guest: guest?.slug, status: status_, name, count, phone, meal, message, token: saved?.token, events: byEvent ? perEvent : undefined, answers }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Your reply could not be sent. Please try again.");
        return;
      }
      const next: Saved = { status: status_, count: out.count ?? (status_ === "no" ? 0 : count), name: guest?.name ?? name.trim(), token: out.token ?? saved?.token, events: byEvent ? perEvent : undefined, answers, meal };
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
      if (saved.events) setPerEvent(saved.events);
      if (saved.answers) setAnswers(saved.answers);
      if (saved.meal) setMeal(saved.meal);
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
          <p className="rsvp-summary">{summary(saved, titles)}</p>
          <button type="button" className="inv-btn" onClick={startEdit}>Change my reply</button>
        </div>
      ) : (
        <>
          {deadline && <p className="sec-body" data-rv="up">Kindly reply by {deadline}.</p>}
          <form className="rsvp" data-rv="up" onSubmit={submit} noValidate>
            {byEvent ? (
              <div className="rsvp-fns" role="group" aria-label="Who is coming to each function">
                <p className="rsvp-hint">How many of you are coming to each? Leave it at 0 for any you cannot attend.</p>
                {fnEvents.map((ev) => {
                  const n = perEvent[ev.id!] ?? 0;
                  const setN = (v: number) => { setPerEvent((p) => ({ ...p, [ev.id!]: Math.max(0, Math.min(max, v)) })); setNote(""); setError(""); };
                  return (
                    <div key={ev.id} className="rsvp-fn">
                      <span className="rsvp-fn-name"><b>{ev.title}</b>{ev.day && <small>{ev.day}{ev.time && `, ${ev.time}`}</small>}</span>
                      <div className="inv-stepper">
                        <button type="button" onClick={() => setN(n - 1)} disabled={n <= 0} aria-label={`One fewer for ${ev.title}`}>−</button>
                        <output aria-live="polite">{n}</output>
                        <button type="button" onClick={() => setN(n + 1)} disabled={n >= max} aria-label={`One more for ${ev.title}`}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="rsvp-choice" role="radiogroup" aria-label="Your reply">
              {options.map((o) => (
                <button key={o} type="button" role="radio" aria-checked={status === o} disabled={o === "yes" && full} onClick={() => { setStatus(o); setNote(""); setError(""); }}>
                  {LABEL[o]}
                </button>
              ))}
            </div>
            )}
            {full && <p className="rsvp-hint">This event has reached its capacity, so new “yes” replies are closed.</p>}

            {(status || byEvent) && (
              <div className="rsvp-fields">
                {!guest && (
                  <label className="rsvp-field">
                    <span>Your name</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required />
                  </label>
                )}
                {!byEvent && status !== "no" && (
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
                {settings?.askMeal && (byEvent ? fnStatus : status) !== "no" && settings.mealOptions.length > 0 && (
                  <div className="rsvp-field">
                    <span id="meal-label">Meal preference</span>
                    <div className="rsvp-chips" role="radiogroup" aria-labelledby="meal-label">
                      {settings.mealOptions.map((m) => (
                        <button key={m} type="button" role="radio" aria-checked={meal === m} onClick={() => setMeal(meal === m ? "" : m)}>{m}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(byEvent ? fnStatus : status) !== "no" && questions.map((q) => (
                  q.kind === "text" ? (
                    <label key={q.id} className="rsvp-field">
                      <span>{q.label}</span>
                      <input type="text" value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} maxLength={200} />
                    </label>
                  ) : (
                    <div key={q.id} className="rsvp-field">
                      <span id={`q-${q.id}`}>{q.label}</span>
                      <div className="rsvp-chips" role="radiogroup" aria-labelledby={`q-${q.id}`}>
                        {(q.kind === "yesno" ? ["Yes", "No"] : q.options).map((o) => (
                          <button key={o} type="button" role="radio" aria-checked={answers[q.id] === o} onClick={() => setAnswers((a) => ({ ...a, [q.id]: a[q.id] === o ? "" : o }))}>{o}</button>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                {(settings?.askMessage ?? true) && (
                  <label className="rsvp-field">
                    <span>Message to {t.couple[1] ? "the couple" : "the host"} (optional)</span>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={400} />
                  </label>
                )}
              </div>
            )}

            <button type="submit" className="inv-btn inv-btn-solid" disabled={(!byEvent && !status) || busy}>{busy ? "Sending…" : saved ? "Update reply" : "Submit RSVP"}</button>
            <p className="rsvp-status" role="status" aria-live="polite">{error ? <span className="rsvp-error">{error}</span> : note || " "}</p>
          </form>
        </>
      )}
    </section>
  );
}
