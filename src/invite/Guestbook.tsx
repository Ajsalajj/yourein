"use client";

import React, { useState } from "react";
import type { Template, Wish } from "@/data/templates";
import { shrinkImage } from "@/components/app/client";

const SAMPLE: Wish[] = [
  { id: "s1", name: "Anjali", message: "Wishing you both a lifetime of love and laughter. We cannot wait to dance at your wedding!", createdAt: "" },
  { id: "s2", name: "Rahul & family", message: "So happy for you two. May every day be as beautiful as this one.", createdAt: "" },
];

const SHOWN = 6;

const when = (iso: string) => (iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso)) : "");

/**
 * The guestbook: wishes guests leave for the hosts, shown to everyone with the link.
 * - On a design preview it shows example wishes and sends nothing.
 * - In the host's own preview it behaves like the real thing but does not store wishes.
 * - On a published invitation it stores the wish and shows it straight away.
 */
export function Guestbook({ t }: { t: Template }) {
  const live = t.live;
  const guest = live?.guest;
  const [wishes, setWishes] = useState<Wish[]>(live?.guestbook?.wishes ?? SAMPLE);
  const [all, setAll] = useState(false);
  const [name, setName] = useState(guest?.name ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const photosOn = !!live?.guestbook?.photos;
  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  };

  if (live && !live.guestbook) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNote("");
    if (!guest && !name.trim()) return setError("Please add your name.");
    if (!message.trim()) return setError("Please write a wish.");
    if (!live || live.mode === "preview" || !live.invitation) {
      setNote(live ? "This is your preview, so nothing was saved. Wishes from guests appear here and in your dashboard." : "This is a preview, so nothing was sent. In your invitation, wishes appear here for everyone to read.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("invitation", live.invitation);
      if (guest?.slug) form.set("guest", guest.slug);
      form.set("name", name);
      form.set("message", message);
      /* phone photos are shrunk before they are sent */
      if (photo && photosOn) form.set("photo", await shrinkImage(photo, 1600, 0.82), "photo.jpg");
      const res = await fetch("/api/wishes", { method: "POST", body: form });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(out.error || "Your wish could not be sent. Please try again.");
        return;
      }
      setWishes((w) => [out.wish as Wish, ...w]);
      setMessage("");
      pick(null);
      setNote("Thank you. Your wish has been added.");
    } catch {
      setError("You seem to be offline. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const shown = all ? wishes : wishes.slice(0, SHOWN);
  const to = t.couple[1] ? "the couple" : "the host";

  return (
    <section className="sec sec-wishes" id="wishes">
      <h2 className="sec-title" data-rv="wipe">Wishes</h2>
      <p className="sec-body" data-rv="up">Leave a few words for {to}. Everyone with the invitation can read them.</p>

      <form className="wish-form" data-rv="up" onSubmit={submit} noValidate>
        {!guest && (
          <label className="rsvp-field">
            <span>Your name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} required />
          </label>
        )}
        <label className="rsvp-field">
          <span>Your wish</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} required />
        </label>
        {photosOn && (
          <div className="rsvp-field">
            <span>A photo (optional)</span>
            {preview ? (
              <div className="wish-pick">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Your photo" />
                <button type="button" className="inv-btn" onClick={() => pick(null)}>Remove photo</button>
              </div>
            ) : (
              <label className="inv-btn wish-file">
                Add a photo
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              </label>
            )}
          </div>
        )}
        <button type="submit" className="inv-btn inv-btn-solid" disabled={busy}>{busy ? "Sending…" : "Leave a wish"}</button>
        <p className="rsvp-status" role="status" aria-live="polite">{error ? <span className="rsvp-error">{error}</span> : note || " "}</p>
      </form>

      {wishes.length > 0 && (
        <ul className="wishes" data-rv="up" aria-label="Wishes from guests">
          {shown.map((w) => (
            <li key={w.id} className="wish">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {w.photo && <img className="wish-photo" src={w.photo} alt={`Photo from ${w.name}`} loading="lazy" />}
              <p className="wish-msg">{w.message}</p>
              <p className="wish-by">{w.name}{w.createdAt && <span>{when(w.createdAt)}</span>}</p>
            </li>
          ))}
        </ul>
      )}
      {!all && wishes.length > SHOWN && (
        <button type="button" className="inv-btn" onClick={() => setAll(true)}>Read all {wishes.length} wishes</button>
      )}
    </section>
  );
}
