"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_FIT, fitStyle, type PhotoFit } from "@/lib/invite";

type Props = {
  src: string;
  /** Width / height of the frame the photo is shown in. */
  aspect: number;
  /** "oval" and "arch" frames are drawn in that shape so the host sees what guests will see. */
  shape?: "oval" | "arch" | "rect";
  title: string;
  note?: string;
  initial?: PhotoFit;
  onSave: (fit: PhotoFit) => void;
  onCancel: () => void;
};

const MIN_Z = 1, MAX_Z = 3;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, step = 0.1) => Math.round(v / step) * step;

/**
 * Position a photo in its frame: drag to move, pinch / scroll / slider to zoom. Nothing is cut from the file;
 * only the position (x, y) and zoom (z) are saved, and the invitation shows the photo the same way.
 */
export function PhotoAdjuster({ src, aspect, shape = "rect", title, note, initial, onSave, onCancel }: Props) {
  const [fit, setFit] = useState<PhotoFit>(initial ?? DEFAULT_FIT);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; z: number } | null>(null);

  /* moving the finger right by dx pixels shows more of the photo's left side */
  const pan = useCallback((dx: number, dy: number) => {
    const box = boxRef.current;
    if (!box || !natural) return;
    const bw = box.clientWidth, bh = box.clientHeight;
    setFit((f) => {
      const s = Math.max(bw / natural.w, bh / natural.h) * f.z; // screen pixels per photo pixel
      const vw = bw / s, vh = bh / s; // visible part of the photo, in photo pixels
      const nx = natural.w > vw + 0.5 ? f.x - (dx / s / (natural.w - vw)) * 100 : f.x;
      const ny = natural.h > vh + 0.5 ? f.y - (dy / s / (natural.h - vh)) * 100 : f.y;
      return { ...f, x: clamp(nx, 0, 100), y: clamp(ny, 0, 100) };
    });
  }, [natural]);

  const zoomTo = (z: number) => setFit((f) => ({ ...f, z: clamp(z, MIN_Z, MAX_Z) }));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: fit.z };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      zoomTo(pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.current.dist)));
    } else if (pointers.current.size === 1) {
      pan(next.x - prev.x, next.y - prev.y);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!pointers.current.size) setDragging(false);
  };

  /* scroll wheel / trackpad pinch zooms; the page itself must not scroll */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setFit((f) => ({ ...f, z: clamp(f.z * Math.exp(-e.deltaY * 0.0025), MIN_Z, MAX_Z) }));
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const save = () => onSave({ x: round(fit.x), y: round(fit.y), z: round(fit.z, 0.01) });

  return (
    <div className="modal adj-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card adj-card">
        <h2 className="adj-h">{title}</h2>
        <p className="adj-sub">Drag to move. Pinch, scroll or use the slider to zoom.</p>
        <div
          ref={boxRef}
          className={`adj-box adj-${shape}${dragging ? " is-dragging" : ""}`}
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} style={fitStyle(fit)} />
          <span className="adj-grid" aria-hidden="true" />
        </div>
        <label className="adj-zoom">
          <span aria-hidden="true">−</span>
          <input type="range" min={MIN_Z} max={MAX_Z} step={0.01} value={fit.z} onChange={(e) => zoomTo(Number(e.target.value))} aria-label="Zoom" />
          <span aria-hidden="true">+</span>
        </label>
        {note && <p className="adj-note">{note}</p>}
        <div className="adj-actions">
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setFit(DEFAULT_FIT)}>Reset</button>
          <span className="adj-spacer" />
          <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-solid" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
