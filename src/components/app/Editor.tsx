"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { PRICE_LABEL } from "@/config/site";
import { EVENT_TYPES, InviteDataSchema, MAX_GALLERY, TIME_ZONES, formatDate, formatTime, mediaUrl, missingFields, namesOf, requestLineFor, resolveTemplate, type InviteData, type InviteEventInput } from "@/lib/invite";
import { InvitationViewer } from "@/components/preview/InvitationViewer";
import { InvitationPhoneMockup } from "@/components/site/InvitationPhoneMockup";
import { api, shrinkImage } from "./client";
import { MusicPicker } from "./MusicPicker";

const Invitation = dynamic(() => import("@/invite/Invitation"), { ssr: false });

const STEPS = [
  { key: "names", label: "Names" },
  { key: "when", label: "Date & venue" },
  { key: "photos", label: "Photos" },
  { key: "events", label: "Events" },
  { key: "rsvp", label: "RSVP" },
  { key: "design", label: "Design" },
  { key: "review", label: "Preview" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];
const TOTAL = STEPS.length + 1; // payment is the final step

type Props = { id: string; initial: InviteData; initialTemplate: string; status: "draft" | "ready" | "published" | "archived"; guest?: boolean };
type Errors = Partial<Record<"name1" | "date" | "time" | "venueName", string>>;

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1040px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

/* ------------------------------------------------------------ small parts */

function Field({ label, hint, error, children, count }: { label: string; hint?: string; error?: string; children: React.ReactNode; count?: [number, number] }) {
  return (
    <label className="field" data-invalid={error ? "true" : undefined}>
      <span>{label}</span>
      {children}
      {count && count[0] > count[1] * 0.8 && <small className="count-chars">{count[0]} / {count[1]}</small>}
      {error ? <small className="field-error" role="alert">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <span className="switch-text"><b>{label}</b>{hint && <span>{hint}</span>}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Fewer">−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More">+</button>
    </span>
  );
}

/* ----------------------------------------------------------------- editor */

export function Editor({ id, initial, initialTemplate, status, guest = false }: Props) {
  const [data, setData] = useState<InviteData>(initial);
  const [templateSlug, setTemplateSlug] = useState(initialTemplate);
  const [step, setStep] = useState<StepKey>("names");
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [errors, setErrors] = useState<Errors>({});
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const wide = useWide();
  const published = status === "published" || status === "archived";

  const template = getTemplate(templateSlug)!;
  const set = useCallback(<K extends keyof InviteData>(key: K, value: InviteData[K]) => setData((d) => ({ ...d, [key]: value })), []);
  const setRsvp = <K extends keyof InviteData["rsvp"]>(key: K, value: InviteData["rsvp"][K]) => setData((d) => ({ ...d, rsvp: { ...d.rsvp, [key]: value } }));

  /* ---- keep the current step's chip in view on phones ---- */
  useEffect(() => {
    const row = document.querySelector<HTMLElement>(".ed-steps");
    const el = row?.querySelector<HTMLElement>('[aria-current="step"]');
    if (row && el) row.scrollTo({ left: el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [step]);

  /* ---- undo and redo: quick runs of changes (typing a word) count as one step ---- */
  type Snap = { data: InviteData; templateSlug: string };
  const hist = useRef<{ past: Snap[]; future: Snap[]; prev: Snap; last: number; skip: boolean }>({
    past: [], future: [], prev: { data: initial, templateSlug: initialTemplate }, last: 0, skip: false,
  });
  const [, setHistTick] = useState(0);
  useEffect(() => {
    const h = hist.current;
    const cur = { data, templateSlug };
    if (h.skip) {
      h.skip = false;
      h.prev = cur;
      return;
    }
    if (cur.data === h.prev.data && cur.templateSlug === h.prev.templateSlug) return;
    const now = Date.now();
    if (now - h.last > 700) {
      h.past.push(h.prev);
      if (h.past.length > 50) h.past.shift();
    }
    h.last = now;
    h.future = [];
    h.prev = cur;
    setHistTick((n) => n + 1);
  }, [data, templateSlug]);
  const travel = useCallback((dir: "undo" | "redo") => {
    const h = hist.current;
    const to = dir === "undo" ? h.past.pop() : h.future.pop();
    if (!to) return;
    (dir === "undo" ? h.future : h.past).push(h.prev);
    h.skip = true;
    h.last = 0;
    setData(to.data);
    setTemplateSlug(to.templateSlug);
    setHistTick((n) => n + 1);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const el = e.target as HTMLElement | null;
      /* inside a text box the browser's own undo applies */
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); travel("undo"); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); travel("redo"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [travel]);

  /* ---- step in the address bar, so refresh and Back behave ---- */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("step") as StepKey | null;
    if (s && STEPS.some((x) => x.key === s)) setStep(s);
    if (q.get("preview") === "1") setPreview(true);
  }, []);
  const go = useCallback((s: StepKey) => {
    setStep(s);
    const url = new URL(window.location.href);
    url.searchParams.set("step", s);
    window.history.replaceState(window.history.state, "", url);
    window.scrollTo({ top: 0 });
  }, []);

  /* ---- autosave: every change is saved shortly after it is made ---- */
  const latest = useRef({ data, templateSlug });
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  /* What the server is known to hold, and a copy of anything newer kept in this tab until the server confirms it. */
  const savedSnap = useRef(JSON.stringify({ data: initial, templateSlug: initialTemplate }));
  const draftKey = `yi-draft:${id}`;

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return chain.current;
    dirty.current = false;
    chain.current = chain.current.then(async () => {
      const sending = latest.current;
      const snap = JSON.stringify(sending);
      try {
        await api("PATCH", `/api/invitations/${id}`, sending);
        savedSnap.current = snap;
        try { if (sessionStorage.getItem(draftKey) === snap) sessionStorage.removeItem(draftKey); } catch {}
        setSave(dirty.current ? "saving" : "saved");
      } catch {
        dirty.current = true;
        setSave("error");
      }
    });
    return chain.current;
  }, [id, draftKey]);

  /* A refresh can outrun the last save. If this tab still holds changes the server never confirmed, pick them back up. */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      if (raw === savedSnap.current) { sessionStorage.removeItem(draftKey); return; }
      const kept = JSON.parse(raw) as { data?: unknown; templateSlug?: string };
      const parsed = InviteDataSchema.safeParse(kept.data);
      if (!parsed.success || !kept.templateSlug || !getTemplate(kept.templateSlug)) { sessionStorage.removeItem(draftKey); return; }
      setData(parsed.data);
      setTemplateSlug(kept.templateSlug);
    } catch {}
  }, [draftKey]);

  useEffect(() => {
    latest.current = { data, templateSlug };
    const snap = JSON.stringify(latest.current);
    if (snap === savedSnap.current && !dirty.current) return;
    try { sessionStorage.setItem(draftKey, snap); } catch {}
    dirty.current = true;
    setSave("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 800);
  }, [data, templateSlug, flush, draftKey]);

  useEffect(() => {
    const onHide = () => {
      if (!dirty.current) return;
      dirty.current = false;
      fetch(`/api/invitations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(latest.current), keepalive: true }).catch(() => {});
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [id]);

  /* ---- what the invitation looks like right now ---- */
  const resolved = useMemo(() => resolveTemplate(template, data, { mode: "preview", mediaUrl }), [template, data]);
  const sideT = useDebounced(resolved, 450);

  /* ---- moving between steps ---- */
  const index = STEPS.findIndex((s) => s.key === step);
  const validate = (s: StepKey): boolean => {
    const e: Errors = {};
    if (s === "names" && !data.name1.trim()) e.name1 = "Add at least one name.";
    if (s === "when") {
      if (!data.date) e.date = "Choose the date.";
      if (!data.time) e.time = "Choose the time.";
      if (!data.venueName.trim()) e.venueName = "Add the venue name.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const toPayment = async () => {
    const missing = missingFields(data);
    if (missing.length) {
      go(!data.name1 ? "names" : "when");
      validate(!data.name1 ? "names" : "when");
      return;
    }
    setLeaving(true);
    await flush();
    if (published) {
      window.location.assign(`/invites/${id}`);
      return;
    }
    try {
      await api("PATCH", `/api/invitations/${id}`, { markReady: true });
      window.location.assign(`/pay/${id}`);
    } catch {
      setLeaving(false);
      setSave("error");
    }
  };

  const next = () => {
    if (!validate(step)) return;
    if (step === "review") void toPayment();
    else go(STEPS[index + 1].key);
  };
  const back = async () => {
    if (index > 0) return go(STEPS[index - 1].key);
    await flush();
    /* a guest has no dashboard yet; their draft stays on this device's session */
    window.location.assign(published ? `/invites/${id}` : guest ? `/templates/${templateSlug}` : "/dashboard");
  };

  /* ---- uploads ---- */
  const upload = async (kind: "portrait" | "gallery" | "music", files: FileList | null) => {
    if (!files?.length) return;
    setUploadError("");
    const list = Array.from(files).slice(0, kind === "gallery" ? MAX_GALLERY - data.gallery.length : 1);
    for (const [i, file] of list.entries()) {
      setUploading(kind === "gallery" && list.length > 1 ? `Uploading ${i + 1} of ${list.length}…` : "Uploading…");
      try {
        if (kind === "music" && file.size > 4_000_000) throw new Error("That audio file is too large. Use an MP3, M4A or AAC under 4 MB.");
        const blob = kind === "music" ? file : await shrinkImage(file);
        const res = await fetch(`/api/invitations/${id}/media?kind=${kind}`, { method: "POST", body: blob });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "That file could not be uploaded.");
        setData((d) => ({ ...d, portrait: out.portrait, gallery: out.gallery, music: out.music, ...(kind === "music" ? { musicSource: "upload" as const, musicName: file.name.slice(0, 120) } : {}) }));
      } catch (e) {
        setUploadError((e as Error).message);
        break;
      }
    }
    setUploading(null);
  };

  /* ---- events ---- */
  const addEvent = () => set("events", [...data.events, { id: Math.random().toString(36).slice(2, 10), title: "", date: data.date, time: "", place: data.venueName, note: "", dressCode: "", private: false }]);
  const patchEvent = (eid: string, p: Partial<InviteEventInput>) => set("events", data.events.map((e) => (e.id === eid ? { ...e, ...p } : e)));

  const changeType = (type: InviteData["eventType"]) => {
    setData((d) => ({ ...d, eventType: type, inviteText: !d.inviteText || d.inviteText === requestLineFor(d.eventType) ? requestLineFor(type) : d.inviteText }));
  };

  const stepNo = index + 1;
  const nextLabel = step === "review" ? (published ? "Save and finish" : "Proceed to payment") : `Next: ${STEPS[index + 1].label}`;

  return (
    <div className="ed">
      <header className="ed-top">
        <div className="ed-top-row">
          <button type="button" className="ed-back" onClick={back} aria-label={index > 0 ? "Previous step" : "Leave the editor"}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="ed-title">
            <b>{template.name}</b>
            <span>Step {stepNo} of {TOTAL}</span>
          </div>
          <div className="ed-hist">
            <button type="button" className="ed-hist-btn" onClick={() => travel("undo")} disabled={!hist.current.past.length} aria-label="Undo" title="Undo (Ctrl or ⌘ + Z)">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 7L4.5 11.5 9 16M5 11.5h9.5a5 5 0 0 1 0 10H11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" className="ed-hist-btn" onClick={() => travel("redo")} disabled={!hist.current.future.length} aria-label="Redo" title="Redo (Ctrl or ⌘ + Shift + Z)">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 7l4.5 4.5L15 16M19 11.5H9.5a5 5 0 0 0 0 10H13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <span className="ed-save" data-state={save} role="status">{save === "saved" ? "Saved" : save === "saving" ? "Saving…" : "Not saved. Retrying"}</span>
        </div>
        <div className="ed-progress" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={stepNo} aria-label="Progress"><i style={{ width: `${(stepNo / TOTAL) * 100}%` }} /></div>
        <nav className="ed-steps" aria-label="Steps">
          {STEPS.map((s, i) => (
            <button key={s.key} type="button" className="ed-step" aria-current={s.key === step ? "step" : undefined} data-done={i < index} onClick={() => go(s.key)}>
              <i>{i + 1}</i>{s.label}
            </button>
          ))}
          <button type="button" className="ed-step" onClick={toPayment} disabled={published}><i>{TOTAL}</i>{published ? "Paid" : "Payment"}</button>
        </nav>
      </header>

      <div className="ed-layout">
        <main className="ed-main" key={step}>
          {step === "names" && (
            <>
              <h1 className="ed-h">Who is it for?</h1>
              <p className="ed-lead">Start with the occasion and the names on the invitation.</p>
              <div className="ed-group">
                <div className="field">
                  <span className="field-label" id="type-label">Occasion</span>
                  <div className="chips" role="radiogroup" aria-labelledby="type-label">
                    {EVENT_TYPES.map((t) => (
                      <button key={t} type="button" className="chip" role="radio" aria-checked={data.eventType === t} onClick={() => changeType(t)}>{t}</button>
                    ))}
                  </div>
                </div>
                {data.eventType === "Other" && (
                  <Field label="Event title" hint="For example: Graduation party, Sangeet, Farewell.">
                    <input type="text" value={data.eventTitle} onChange={(e) => set("eventTitle", e.target.value)} maxLength={40} />
                  </Field>
                )}
                <Field label={data.eventType === "Wedding" || data.eventType === "Nikah" || data.eventType === "Engagement" ? "First name (bride or groom)" : "Name"} error={errors.name1}>
                  <input type="text" value={data.name1} onChange={(e) => { set("name1", e.target.value); setErrors({}); }} maxLength={40} autoComplete="off" placeholder={template.couple[0]} />
                </Field>
                <Field label="Second name" hint="Leave empty for a single host, such as a birthday.">
                  <input type="text" value={data.name2} onChange={(e) => set("name2", e.target.value)} maxLength={40} autoComplete="off" placeholder={template.couple[1]} />
                </Field>
                <Field label="Hosted by" hint="The line above the invitation text. For example: Mr. & Mrs. Sharma and Mr. & Mrs. Kapoor." count={[data.hosts.length, 200]}>
                  <textarea value={data.hosts} onChange={(e) => set("hosts", e.target.value)} maxLength={200} rows={2} />
                </Field>
              </div>
            </>
          )}

          {step === "when" && (
            <>
              <h1 className="ed-h">When and where?</h1>
              <p className="ed-lead">This is the main date. You can add more events in a later step.</p>
              <div className="ed-group">
                <div className="row2">
                  <Field label="Date" error={errors.date}>
                    <input type="date" value={data.date} onChange={(e) => { set("date", e.target.value); setErrors((x) => ({ ...x, date: undefined })); }} />
                  </Field>
                  <Field label="Time" error={errors.time}>
                    <input type="time" value={data.time} onChange={(e) => { set("time", e.target.value); setErrors((x) => ({ ...x, time: undefined })); }} />
                  </Field>
                </div>
                <Field label="Time zone" hint="Used for the countdown, so it is right for guests abroad.">
                  <select value={data.tz} onChange={(e) => set("tz", e.target.value)}>
                    {!TIME_ZONES.some(([z]) => z === data.tz) && <option value={data.tz}>{data.tz}</option>}
                    {TIME_ZONES.map(([z, label]) => <option key={z} value={z}>{label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="ed-group">
                <Field label="Venue" error={errors.venueName}>
                  <input type="text" value={data.venueName} onChange={(e) => { set("venueName", e.target.value); setErrors((x) => ({ ...x, venueName: undefined })); }} maxLength={100} placeholder={template.venue.name} />
                </Field>
                <Field label="Address" count={[data.venueAddress.length, 200]}>
                  <textarea value={data.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} maxLength={200} rows={2} placeholder={`${template.venue.address}, ${template.venue.city}`} />
                </Field>
                <Field label="Google Maps link" hint="Open the venue in Google Maps, tap Share and paste the link here. Without it, guests get a map search for the venue name.">
                  <input type="url" value={data.mapsUrl} onChange={(e) => set("mapsUrl", e.target.value)} maxLength={600} inputMode="url" placeholder="https://maps.app.goo.gl/…" />
                </Field>
              </div>
            </>
          )}

          {step === "photos" && (
            <>
              <h1 className="ed-h">Add your photos.</h1>
              <p className="ed-lead">Optional. Without photos, the design’s own artwork is used and the gallery is left out.</p>
              <div className="ed-group">
                <p className="ed-group-h">Main photo</p>
                <div className="uploader">
                  <div className="portrait-slot">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {data.portrait ? <img src={mediaUrl(data.portrait)} alt="Your main photo" /> : "A portrait of you both works best"}
                  </div>
                  <div className="chips">
                    <label className="btn btn-quiet btn-sm file-btn">
                      {data.portrait ? "Replace photo" : "Choose photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { void upload("portrait", e.target.files); e.target.value = ""; }} />
                    </label>
                    {data.portrait && <button type="button" className="btn btn-sm btn-danger" onClick={() => set("portrait", null)}>Remove</button>}
                  </div>
                </div>
              </div>
              <div className="ed-group">
                <p className="ed-group-h">Gallery <span className="muted">({data.gallery.length} of {MAX_GALLERY})</span></p>
                <div className="thumbs">
                  {data.gallery.map((g, i) => (
                    <div key={g} className="thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrl(g)} alt={`Gallery photo ${i + 1}`} />
                      <button type="button" className="thumb-x" onClick={() => set("gallery", data.gallery.filter((x) => x !== g))} aria-label={`Remove photo ${i + 1}`}>
                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </button>
                    </div>
                  ))}
                  {data.gallery.length < MAX_GALLERY && (
                    <label className="thumb thumb-add file-btn" aria-label="Add gallery photos">
                      +
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { void upload("gallery", e.target.files); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
              </div>
              <p className="hint" role="status" style={{ marginTop: 14 }}>{uploading || " "}</p>
              {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
            </>
          )}

          {step === "events" && (
            <>
              <h1 className="ed-h">Add your events.</h1>
              <p className="ed-lead">Optional. List each function with its own time and place. With none added, the invitation shows the main event only.</p>
              <div className="ed-group">
                {data.events.map((e, i) => (
                  <div key={e.id} className="event-card">
                    <div className="event-card-head">
                      <span>Event {i + 1}</span>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => set("events", data.events.filter((x) => x.id !== e.id))}>Remove</button>
                    </div>
                    <Field label="Title"><input type="text" value={e.title} onChange={(ev) => patchEvent(e.id, { title: ev.target.value })} maxLength={60} placeholder="Mehendi, Sangeet, Reception…" /></Field>
                    <div className="row2">
                      <Field label="Date"><input type="date" value={e.date} onChange={(ev) => patchEvent(e.id, { date: ev.target.value })} /></Field>
                      <Field label="Time"><input type="time" value={e.time} onChange={(ev) => patchEvent(e.id, { time: ev.target.value })} /></Field>
                    </div>
                    <Field label="Place"><input type="text" value={e.place} onChange={(ev) => patchEvent(e.id, { place: ev.target.value })} maxLength={120} /></Field>
                    <Field label="Dress code" hint="Optional. Shown under this function."><input type="text" value={e.dressCode} onChange={(ev) => patchEvent(e.id, { dressCode: ev.target.value })} maxLength={80} placeholder="Traditional, pastel colours…" /></Field>
                    <Field label="Note" hint="Optional. Anything else guests should know."><input type="text" value={e.note} onChange={(ev) => patchEvent(e.id, { note: ev.target.value })} maxLength={160} /></Field>
                    <Switch label="Only for guests you choose" hint="Hidden from the general link. Tick it for each family in your guest list." checked={e.private} onChange={(v) => patchEvent(e.id, { private: v })} />
                  </div>
                ))}
                {data.events.length < 8 && <button type="button" className="btn btn-quiet btn-block" onClick={addEvent}>+ Add an event</button>}
              </div>
              <div className="ed-group">
                <p className="ed-group-h">Update for guests</p>
                <Field label="Message" hint="Optional. Shown in a band at the top of the invitation, for example a changed time or venue. Leave empty to hide it.">
                  <textarea value={data.notice} onChange={(e) => set("notice", e.target.value)} maxLength={200} rows={2} placeholder="The Sangeet now starts at 8 pm." />
                </Field>
              </div>
              <div className="ed-group">
                <p className="ed-group-h">Where to stay</p>
                <p className="hint">Optional. Suggest up to 4 hotels or homestays for guests travelling in.</p>
                {data.stays.map((st, i) => {
                  const patchStay = (p: Partial<typeof st>) => set("stays", data.stays.map((x, k) => (k === i ? { ...x, ...p } : x)));
                  return (
                    <div key={i} className="event-card">
                      <div className="event-card-head">
                        <span>Place {i + 1}</span>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => set("stays", data.stays.filter((_, k) => k !== i))}>Remove</button>
                      </div>
                      <Field label="Name"><input type="text" value={st.name} onChange={(e) => patchStay({ name: e.target.value })} maxLength={80} placeholder="Hotel Lake View" /></Field>
                      <Field label="Note" hint="Distance, price range, a booking code…"><input type="text" value={st.note} onChange={(e) => patchStay({ note: e.target.value })} maxLength={160} /></Field>
                      <div className="row2">
                        <Field label="Website or booking link"><input type="url" value={st.url} onChange={(e) => patchStay({ url: e.target.value })} maxLength={600} placeholder="https://" inputMode="url" /></Field>
                        <Field label="Phone"><input type="tel" value={st.phone} onChange={(e) => patchStay({ phone: e.target.value })} maxLength={24} inputMode="tel" /></Field>
                      </div>
                    </div>
                  );
                })}
                {data.stays.length < 4 && <button type="button" className="btn btn-quiet btn-block" onClick={() => set("stays", [...data.stays, { name: "", note: "", url: "", phone: "" }])}>+ Add a place to stay</button>}
              </div>
            </>
          )}

          {step === "rsvp" && (
            <>
              <h1 className="ed-h">Know who’s coming.</h1>
              <p className="ed-lead">Guests reply from the invitation. You see every reply and the total headcount in your dashboard.</p>
              <div className="ed-group">
                <Switch label="Collect RSVPs" hint="Adds “Will you be joining us?” to your invitation." checked={data.rsvp.enabled} onChange={(v) => setRsvp("enabled", v)} />
              </div>
              {data.rsvp.enabled && (
                <>
                  <div className="ed-group">
                    <Field label="Reply by" hint="Optional. After this date the reply form closes.">
                      <input type="date" value={data.rsvp.deadline} max={data.date || undefined} onChange={(e) => setRsvp("deadline", e.target.value)} />
                    </Field>
                    <div className="field">
                      <span className="field-label">Guests allowed per reply</span>
                      <Stepper value={data.rsvp.maxPerInvite} min={1} max={20} onChange={(v) => setRsvp("maxPerInvite", v)} label="Guests allowed per reply" />
                      <small>The most people one reply can bring. You can set a different limit for each family in your guest list.</small>
                    </div>
                  </div>
                  {data.events.filter((e) => e.title).length > 1 && (
                    <div className="ed-group">
                      <Switch label="Separate reply for each function" hint="Guests say how many are coming to each function. Your dashboard shows a head count for each." checked={data.rsvp.perEvent} onChange={(v) => setRsvp("perEvent", v)} />
                    </div>
                  )}
                  <div className="ed-group">
                    <p className="ed-group-h">What to ask</p>
                    <div>
                      <Switch label="Offer “Maybe”" hint="Guests can say they are not sure yet." checked={data.rsvp.allowMaybe} onChange={(v) => setRsvp("allowMaybe", v)} />
                      <Switch label="Phone number" hint="Optional for the guest." checked={data.rsvp.askPhone} onChange={(v) => setRsvp("askPhone", v)} />
                      <Switch label="Meal preference" checked={data.rsvp.askMeal} onChange={(v) => setRsvp("askMeal", v)} />
                      <Switch label="A message to you" checked={data.rsvp.askMessage} onChange={(v) => setRsvp("askMessage", v)} />
                    </div>
                    {data.rsvp.askMeal && (
                      <Field label="Meal choices" hint="Separate with commas. Up to 6.">
                        <input type="text" defaultValue={data.rsvp.mealOptions.join(", ")} onBlur={(e) => setRsvp("mealOptions", e.target.value.split(",").map((s) => s.trim().slice(0, 30)).filter(Boolean).slice(0, 6))} />
                      </Field>
                    )}
                  </div>
                  <div className="ed-group">
                    <p className="ed-group-h">Your own questions</p>
                    <p className="hint">Optional. Asked of everyone who is coming. Up to 6.</p>
                    {data.rsvp.questions.map((q) => {
                      const patchQ = (p: Partial<typeof q>) => setRsvp("questions", data.rsvp.questions.map((x) => (x.id === q.id ? { ...x, ...p } : x)));
                      return (
                        <div key={q.id} className="event-card">
                          <div className="event-card-head">
                            <span>Question</span>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => setRsvp("questions", data.rsvp.questions.filter((x) => x.id !== q.id))}>Remove</button>
                          </div>
                          <Field label="Question"><input type="text" value={q.label} onChange={(e) => patchQ({ label: e.target.value })} maxLength={80} /></Field>
                          <Field label="Answer type">
                            <select value={q.kind} onChange={(e) => patchQ({ kind: e.target.value as typeof q.kind })}>
                              <option value="text">Short answer</option>
                              <option value="yesno">Yes or no</option>
                              <option value="choice">Pick one option</option>
                            </select>
                          </Field>
                          {q.kind === "choice" && (
                            <Field label="Options" hint="Separate with commas. Up to 6.">
                              <input type="text" defaultValue={q.options.join(", ")} onBlur={(e) => patchQ({ options: e.target.value.split(",").map((o) => o.trim().slice(0, 40)).filter(Boolean).slice(0, 6) })} />
                            </Field>
                          )}
                        </div>
                      );
                    })}
                    {data.rsvp.questions.length < 6 && (
                      <div className="chips">
                        {([
                          ["Dietary needs", "Any dietary needs or allergies?", "text"],
                          ["Transport", "Do you need transport to the venue?", "yesno"],
                          ["Accommodation", "Do you need a place to stay?", "yesno"],
                          ["+ Custom question", "", "text"],
                        ] as const).filter(([, label]) => !label || !data.rsvp.questions.some((x) => x.label === label)).map(([chip, label, kind]) => (
                          <button key={chip} type="button" className="btn btn-quiet btn-sm" onClick={() => setRsvp("questions", [...data.rsvp.questions, { id: Math.random().toString(36).slice(2, 10), label, kind, options: [] }])}>{chip}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ed-group">
                    <Field label="Event capacity" hint="Optional. Your dashboard shows confirmed guests against this number.">
                      <input type="number" inputMode="numeric" min={1} max={100000} value={data.rsvp.capacity ?? ""} onChange={(e) => setRsvp("capacity", e.target.value ? Math.max(1, Math.min(100000, Math.round(Number(e.target.value)))) : null)} placeholder="No limit" />
                    </Field>
                    {data.rsvp.capacity !== null && (
                      <Switch label="Stop replies when full" hint="Off: you only see a progress bar. On: guests cannot say yes once capacity is reached." checked={data.rsvp.hardCapacity} onChange={(v) => setRsvp("hardCapacity", v)} />
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {step === "design" && (
            <>
              <h1 className="ed-h">Words, music and design.</h1>
              <p className="ed-lead">Everything here has a sensible default. Change only what you want to.</p>
              <div className="ed-group">
                <Field label="Welcome message" hint="A short line at the very top: a blessing, a verse or a greeting." count={[data.welcome.length, 160]}>
                  <input type="text" value={data.welcome} onChange={(e) => set("welcome", e.target.value)} maxLength={160} />
                </Field>
                <Field label="Invitation text" hint="Comes just before your names." count={[data.inviteText.length, 200]}>
                  <textarea value={data.inviteText} onChange={(e) => set("inviteText", e.target.value)} maxLength={200} rows={2} />
                </Field>
                <Field label="Your story" hint="Optional. A few lines beside your main photo." count={[data.story.length, 600]}>
                  <textarea value={data.story} onChange={(e) => set("story", e.target.value)} maxLength={600} rows={3} />
                </Field>
                <Field label="Closing note" count={[data.closing.length, 200]}>
                  <input type="text" value={data.closing} onChange={(e) => set("closing", e.target.value)} maxLength={200} />
                </Field>
              </div>
              <div className="ed-group">
                <div>
                  <p className="ed-group-h">Background music</p>
                  <p className="hint">Choose a track from our curated library or upload your own.</p>
                </div>
                <MusicPicker
                  templateSlug={templateSlug}
                  music={data.music}
                  musicSource={data.musicSource}
                  musicTrack={data.musicTrack}
                  musicName={data.musicName}
                  musicVolume={data.musicVolume}
                  musicStart={data.musicStart}
                  onPatch={(p) => setData((d) => ({ ...d, ...p }))}
                  onUpload={(files) => void upload("music", files)}
                  uploading={uploading}
                  uploadError={uploadError}
                />
              </div>
              <div className="ed-group">
                <div>
                  <Switch label="Countdown" hint="A live countdown to your date." checked={data.countdown} onChange={(v) => set("countdown", v)} />
                  <Switch label="Let guests share the invitation" hint="Shows a share button at the end." checked={data.allowShare} onChange={(v) => set("allowShare", v)} />
                  <Switch label="Guestbook" hint="Guests can leave wishes for everyone to read. You can hide any of them." checked={data.guestbook} onChange={(v) => set("guestbook", v)} />
                  {data.guestbook && <Switch label="Guests can add a photo" hint="Each wish can include one photo, great after the event. You can hide or delete any of them." checked={data.guestPhotos} onChange={(v) => set("guestPhotos", v)} />}
                </div>
              </div>
              <div className="ed-group">
                <p className="ed-group-h">After the event</p>
                <Switch label="Thank-you mode" hint="Turns the invitation into a thank-you page: replies close and the countdown hides. The guestbook stays open." checked={data.thanksOn} onChange={(v) => set("thanksOn", v)} />
                {data.thanksOn && (
                  <Field label="Thank-you message">
                    <textarea value={data.thanks} onChange={(e) => set("thanks", e.target.value)} maxLength={300} rows={3} placeholder="Thank you for celebrating with us. Your love and blessings made our day." />
                  </Field>
                )}
              </div>
              <div className="ed-group">
                <p className="ed-group-h">Contact details</p>
                <p className="hint">Optional. Shown at the end for guests with questions.</p>
                {[0, 1].map((i) => {
                  const c = data.contacts[i] ?? { name: "", phone: "" };
                  const patch = (p: Partial<typeof c>) => {
                    const list = [0, 1].map((k) => (k === i ? { ...c, ...p } : data.contacts[k] ?? { name: "", phone: "" }));
                    set("contacts", list.filter((x, k) => x.name || x.phone || k === 0));
                  };
                  return (
                    <div className="row2" key={i}>
                      <Field label={`Contact ${i + 1} name`}><input type="text" value={c.name} onChange={(e) => patch({ name: e.target.value })} maxLength={60} /></Field>
                      <Field label="Phone"><input type="tel" value={c.phone} onChange={(e) => patch({ phone: e.target.value })} maxLength={24} inputMode="tel" /></Field>
                    </div>
                  );
                })}
              </div>
              <div className="ed-group">
                <p className="ed-group-h">Design</p>
                <p className="hint">Switch to another design at any time. Everything you have written stays.</p>
                <div className="tpl-strip">
                  {TEMPLATES.map((t) => (
                    <button key={t.slug} type="button" className="tpl-pick" aria-pressed={t.slug === templateSlug} onClick={() => setTemplateSlug(t.slug)}>
                      <span><Image src={`/thumbs/${t.slug}.webp`} alt="" width={780} height={1688} sizes="84px" /></span>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === "review" && (
            <>
              <h1 className="ed-h">{published ? "Your invitation." : "Almost there."}</h1>
              <p className="ed-lead">{published ? "Changes you make are live as soon as they are saved." : "Open the preview and check every detail. You can come back and change anything, even after publishing."}</p>
              <div className="review-preview">
                <InvitationPhoneMockup t={template} sizes="96px" />
                <div>
                  <button type="button" className="btn btn-quiet btn-block" onClick={() => setPreview(true)}>Open full preview</button>
                  <p className="hint" style={{ marginTop: 8 }}>See it exactly as your guests will, opening animation included.</p>
                </div>
              </div>
              <div className="sheet checklist">
                {([
                  ["Names", namesOf(data) || "Not added yet", !!data.name1, "names"],
                  ["Date and time", data.date && data.time ? `${formatDate(data.date)}, ${formatTime(data.time)}` : "Not chosen yet", !!data.date && !!data.time, "when"],
                  ["Venue", data.venueName || "Not added yet", !!data.venueName, "when"],
                  ["Photos", data.portrait || data.gallery.length ? `${(data.portrait ? 1 : 0) + data.gallery.length} added` : "None. The design’s artwork is used", true, "photos"],
                  ["Events", data.events.filter((e) => e.title).length ? `${data.events.filter((e) => e.title).length} added` : "Main event only", true, "events"],
                  ["RSVP", data.rsvp.enabled ? `On, up to ${data.rsvp.maxPerInvite} per reply${data.rsvp.capacity ? `, capacity ${data.rsvp.capacity}` : ""}` : "Off", true, "rsvp"],
                ] as [string, string, boolean, StepKey][]).map(([label, value, ok, target]) => (
                  <div key={label} className="check" data-ok={ok}>
                    <span className="check-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="13" height="13">{ok ? <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M12 6v8M12 18v.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />}</svg>
                    </span>
                    <span className="check-text"><b>{label}</b><span>{value}</span></span>
                    <button type="button" className="text-link" onClick={() => go(target)}>{ok ? "Edit" : "Add"}</button>
                  </div>
                ))}
              </div>
              {!published && <p className="hint" style={{ marginTop: 14 }}>{guest ? `Next: sign in or create an account to save your invitation, then pay ${PRICE_LABEL} once.` : `Next is payment: ${PRICE_LABEL}, once.`} Your invitation is published as soon as it goes through.</p>}
            </>
          )}
        </main>

        <aside className="ed-side" aria-label="Live preview">
          {wide && (
            <>
              <div className="ed-side-phone">
                <div className="ed-side-screen" data-inv-scroller>
                  <Invitation key={templateSlug} t={sideT} startOpen />
                </div>
              </div>
              <p className="ed-side-note">Live preview. Use Preview to see the opening.</p>
            </>
          )}
        </aside>
      </div>

      <div className="ed-bar">
        <button type="button" className="btn btn-quiet" onClick={() => setPreview(true)}>Preview</button>
        <button type="button" className="btn btn-solid" onClick={next} disabled={leaving}>{leaving ? "One moment…" : nextLabel}</button>
      </div>

      <AnimatePresence>
        {preview && (
          <InvitationViewer
            key="edit-preview"
            t={resolved}
            title={namesOf(data) || template.name}
            note={data.name1 ? "Your preview" : "Sample names"}
            onClose={() => setPreview(false)}
            closeLabel="Back to edit"
            bar={
              <>
                <button type="button" className="btn btn-line" onClick={() => setPreview(false)}>Back to Edit</button>
                <button type="button" className="btn btn-solid" onClick={() => { setPreview(false); if (step === "review") void toPayment(); else next(); }}>
                  {step === "review" ? (published ? "Save and finish" : "Proceed to Payment") : "Continue"}
                </button>
              </>
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}
