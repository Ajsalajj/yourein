/**
 * Composes the built-in music library: ten short, loopable, original instrumental
 * pieces written by this script (no samples, no third-party recordings), so YoureIn
 * owns them outright.
 *
 * These are DEVELOPMENT PLACEHOLDERS. To use produced tracks instead, replace the files in
 * public/audio/builtin/ (same names, .m4a) and update durations in src/data/music.ts.
 *
 *   node scripts/make-music.mjs            all tracks
 *   node scripts/make-music.mjs our-story  one track
 *
 * Needs macOS (afconvert) to encode AAC.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const SR = 44100;
const OUT = path.join(process.cwd(), "public", "audio", "builtin");

/* ------------------------------------------------------------ the pieces */
/* key: MIDI root; prog: chords as scale degrees (0 = I); minor uses the natural minor scale */
const PIECES = [
  { id: "golden-vows", key: 60, minor: false, bpm: 70, bars: 24, prog: [0, 4, 5, 3], voices: { piano: 1, strings: 0.8, melody: "piano" } },
  { id: "moonlit-promise", key: 57, minor: true, bpm: 64, bars: 24, prog: [0, 5, 2, 6], voices: { piano: 0.9, strings: 0.6, pad: 0.7, melody: "piano" } },
  { id: "ivory-morning", key: 65, minor: false, bpm: 76, bars: 24, prog: [0, 3, 5, 4], voices: { piano: 0.9, guitar: 0.5, melody: "piano", sparse: true } },
  { id: "jasmine-night", key: 62, minor: true, bpm: 66, bars: 24, prog: [0, 6, 5, 6], voices: { oud: 0.9, strings: 0.7, drum: 0.35, melody: "oud" } },
  { id: "royal-celebration", key: 55, minor: false, bpm: 84, bars: 28, prog: [0, 4, 5, 3], voices: { strings: 1, piano: 0.5, drum: 0.5, flute: 0.6, melody: "flute" } },
  { id: "garden-in-bloom", key: 67, minor: false, bpm: 88, bars: 28, prog: [0, 5, 3, 4], voices: { guitar: 1, piano: 0.6, strings: 0.5, melody: "piano" } },
  { id: "forever-starts-here", key: 63, minor: false, bpm: 68, bars: 24, prog: [0, 5, 3, 4], voices: { piano: 1, strings: 0.9, melody: "piano", build: true } },
  { id: "velvet-evening", key: 58, minor: true, bpm: 62, bars: 24, prog: [0, 3, 6, 4], voices: { piano: 0.8, cello: 0.9, pad: 0.6, melody: "cello" } },
  { id: "lotus-sunrise", key: 64, minor: false, bpm: 72, bars: 24, prog: [0, 3, 0, 4], voices: { piano: 0.7, flute: 0.8, drum: 0.3, pad: 0.5, melody: "flute" } },
  { id: "our-story", key: 62, minor: false, bpm: 74, bars: 24, prog: [0, 4, 5, 3], voices: { piano: 1, pad: 0.7, melody: "piano", build: true, sparse: true } },
];

/* ---------------------------------------------------------------- helpers */
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const seedOf = (id) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
function chord(p, degree) {
  const sc = p.minor ? MINOR : MAJOR;
  return [0, 2, 4].map((i) => {
    const d = degree + i;
    return p.key + sc[d % 7] + 12 * Math.floor(d / 7);
  });
}
function scaleNote(p, degree) {
  const sc = p.minor ? MINOR : MAJOR;
  return p.key + sc[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);
}

/* ----------------------------------------------------------- instruments */
/* each adds into L/R buffers at a start time with a pan (-1..1) */
function add(L, R, at, buf, gain, pan) {
  const i0 = Math.floor(at * SR), gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < buf.length && i0 + i < L.length; i++) {
    L[i0 + i] += buf[i] * gl;
    R[i0 + i] += buf[i] * gr;
  }
}
function piano(f, dur) {
  const n = Math.floor((dur + 1.6) * SR), b = new Float32Array(n);
  for (let h = 1; h <= 7; h++) {
    const fh = f * h * (1 + 0.0004 * h * h), a = 1 / h ** 1.6, dec = 1.2 + h * 0.9;
    if (fh > SR / 2.2) break;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      b[i] += a * Math.sin(2 * Math.PI * fh * t) * Math.exp(-dec * t) * Math.min(1, t / 0.004);
    }
  }
  const rel = Math.floor(dur * SR);
  for (let i = rel; i < n; i++) b[i] *= Math.exp(-(i - rel) / SR / 0.25);
  return b;
}
function pad(f, dur, bright = 8, attack = 1.4) {
  const n = Math.floor((dur + 1.5) * SR), b = new Float32Array(n);
  for (const det of [-0.004, 0, 0.005]) {
    for (let k = 1; k <= bright; k++) {
      const fk = f * k * (1 + det);
      if (fk > SR / 2.2) break;
      const a = 1 / k ** 1.5 / 3, ph = Math.random() * 6.28;
      for (let i = 0; i < n; i++) b[i] += a * Math.sin(2 * Math.PI * fk * (i / SR) + ph);
    }
  }
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) / 0.6) : 1);
    b[i] *= env;
  }
  return b;
}
function bowed(f, dur, harmonics = 10, attack = 0.35) {
  const n = Math.floor((dur + 0.8) * SR), b = new Float32Array(n);
  for (let k = 1; k <= harmonics; k++) {
    const fk = f * k;
    if (fk > SR / 2.2) break;
    const a = 1 / k ** 1.25;
    for (let i = 0; i < n; i++) {
      const t = i / SR, vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t / 0.6);
      b[i] += a * Math.sin(2 * Math.PI * fk * vib * t);
    }
  }
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    b[i] *= 0.25 * Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) / 0.3) : 1);
  }
  return b;
}
function flute(f, dur) {
  const n = Math.floor((dur + 0.5) * SR), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, vib = 1 + 0.005 * Math.sin(2 * Math.PI * 5 * t) * Math.min(1, t / 0.4);
    const env = Math.min(1, t / 0.09) * (t > dur ? Math.exp(-(t - dur) / 0.15) : 1);
    b[i] = env * (Math.sin(2 * Math.PI * f * vib * t) + 0.18 * Math.sin(4 * Math.PI * f * vib * t) + 0.02 * (Math.random() * 2 - 1));
  }
  return b;
}
/* Karplus-Strong: guitar when bright, oud when darker and lower */
function pluck(f, dur, damp = 0.996, bright = 0.5) {
  const n = Math.floor((dur + 1.2) * SR), b = new Float32Array(n), p = Math.max(2, Math.round(SR / f)), ring = new Float32Array(p);
  for (let i = 0; i < p; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const cur = ring[idx], nxt = ring[(idx + 1) % p];
    const v = damp * (bright * cur + (1 - bright) * 0.5 * (cur + nxt));
    ring[idx] = 0.5 * (v + prev);
    prev = v;
    b[i] = cur;
    idx = (idx + 1) % p;
  }
  return b;
}
function drum(soft = 1) {
  const n = Math.floor(0.6 * SR), b = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 62 + 50 * Math.exp(-t * 30);
    lp += 0.08 * ((Math.random() * 2 - 1) - lp);
    b[i] = soft * (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 7) + 0.25 * lp * Math.exp(-t * 18));
  }
  return b;
}

/* ---------------------------------------------------------------- reverb */
function reverb(x, seed) {
  const combs = [1557, 1617, 1491, 1422].map((d) => d + seed), aps = [225 + seed, 556];
  const y = new Float32Array(x.length);
  for (const d of combs) {
    const buf = new Float32Array(d);
    let j = 0, f = 0;
    for (let i = 0; i < x.length; i++) {
      const out = buf[j];
      f = out * 0.7 + f * 0.3;
      buf[j] = x[i] + f * 0.84;
      y[i] += out * 0.25;
      j = (j + 1) % d;
    }
  }
  for (const d of aps) {
    const buf = new Float32Array(d);
    let j = 0;
    for (let i = 0; i < y.length; i++) {
      const b = buf[j], v = y[i];
      buf[j] = v + b * 0.5;
      y[i] = b - v * 0.5;
      j = (j + 1) % d;
    }
  }
  return y;
}

/* ---------------------------------------------------------------- compose */
function compose(p) {
  const r = rng(seedOf(p.id));
  const beat = 60 / p.bpm, bar = beat * 4, tail = 3;
  const len = p.bars * bar, n = Math.ceil((len + tail) * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const v = p.voices;
  let lastMel = 7;

  for (let b = 0; b < p.bars; b++) {
    const t0 = b * bar, deg = p.prog[b % p.prog.length], ch = chord(p, deg);
    /* a gentle build: the second half is fuller when asked */
    const lift = v.build ? 0.6 + 0.4 * Math.min(1, b / (p.bars * 0.6)) : 1;
    const intro = b < 2 ? 0.55 + 0.225 * b : 1;
    const g = lift * intro;

    if (v.strings) for (const m of ch) add(L, R, t0, bowed(hz(m - 12), bar * 1.02, 9, 0.5), 0.33 * v.strings * g, (m % 3) - 1);
    if (v.pad) for (const m of ch) add(L, R, t0, pad(hz(m), bar * 1.05, 6), 0.08 * v.pad * g, ((m % 5) - 2) / 2);
    if (v.cello) add(L, R, t0, bowed(hz(ch[0] - 24), bar, 12, 0.25), 0.42 * v.cello * g, -0.2);

    if (v.piano) {
      add(L, R, t0, piano(hz(ch[0] - 24), bar * 0.9), 0.32 * v.piano * g, -0.3);
      if (!v.sparse || b % 2 === 0) add(L, R, t0 + 2 * beat, piano(hz(ch[0] - 12), bar * 0.45), 0.2 * v.piano * g, -0.25);
      const arp = [0, 1, 2, 1, 2, 0, 1, 2];
      const step = v.sparse ? 2 : 1;
      for (let i = 0; i < 8; i += step) add(L, R, t0 + i * beat * 0.5, piano(hz(ch[arp[i]] + (i > 3 ? 12 : 0)), beat * 0.9), 0.14 * v.piano * g, 0.2 + 0.1 * (i % 3));
    }
    if (v.guitar) {
      const pat = [0, 1, 2, 1, 0, 2, 1, 2];
      for (let i = 0; i < 8; i++) add(L, R, t0 + i * beat * 0.5, pluck(hz(ch[pat[i]] - 12 + (i % 4 === 3 ? 12 : 0)), beat, 0.9965, 0.55), 0.2 * v.guitar * g, -0.35 + 0.1 * (i % 2));
    }
    if (v.oud) {
      const pat = [0, 2, 1, 2];
      for (let i = 0; i < 4; i++) add(L, R, t0 + i * beat, pluck(hz(ch[pat[i]] - 12), beat * 1.2, 0.9955, 0.2), 0.22 * v.oud * g, -0.3);
    }
    if (v.drum && b >= 2) {
      add(L, R, t0, drum(1), 0.5 * v.drum, 0);
      add(L, R, t0 + 2.5 * beat, drum(0.6), 0.5 * v.drum, 0.1);
    }

    /* melody: stepwise around chord tones, resting now and then */
    if (b >= 2 && v.melody) {
      const notes = v.sparse ? 2 : r() < 0.5 ? 3 : 4;
      const lens = notes === 2 ? [2, 2] : notes === 3 ? [1.5, 0.5, 2] : [1, 1, 1, 1];
      let at = t0;
      for (let i = 0; i < notes; i++) {
        const target = deg + [0, 2, 4][Math.floor(r() * 3)] + 7;
        lastMel = Math.abs(target - lastMel) > 3 ? lastMel + Math.sign(target - lastMel) * 2 : target;
        const m = scaleNote(p, lastMel), d = lens[i] * beat;
        if (r() > 0.12) {
          const pan = 0.15;
          if (v.melody === "piano") add(L, R, at, piano(hz(m), d * 0.95), 0.2 * g, pan);
          if (v.melody === "flute") add(L, R, at, flute(hz(m), d * 0.92), 0.13 * g, pan);
          if (v.melody === "oud") add(L, R, at, pluck(hz(m), d, 0.9965, 0.3), 0.26 * g, pan);
          if (v.melody === "cello") add(L, R, at, bowed(hz(m - 12), d * 0.95, 12, 0.2), 0.32 * g, pan);
        }
        at += d;
      }
    }
  }

  /* reverb, then fold the tail back onto the start so the loop is seamless */
  const wl = reverb(L, 0), wr = reverb(R, 23);
  for (let i = 0; i < n; i++) {
    L[i] = 0.78 * L[i] + 0.32 * wl[i];
    R[i] = 0.78 * R[i] + 0.32 * wr[i];
  }
  const loopN = Math.floor(len * SR), outL = L.slice(0, loopN), outR = R.slice(0, loopN);
  for (let i = loopN; i < n; i++) {
    outL[i - loopN] += L[i];
    outR[i - loopN] += R[i];
  }
  let peak = 0;
  for (let i = 0; i < loopN; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
  const k = 0.84 / (peak || 1);
  for (let i = 0; i < loopN; i++) {
    outL[i] *= k;
    outR[i] *= k;
  }
  return { L: outL, R: outR, seconds: len };
}

function wav(L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  return buf;
}

mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const tmp = path.join(os.tmpdir(), "yourein-music");
mkdirSync(tmp, { recursive: true });
for (const p of PIECES.filter((x) => !only || x.id === only)) {
  const t = Date.now();
  const { L, R, seconds } = compose(p);
  const w = path.join(tmp, `${p.id}.wav`), out = path.join(OUT, `${p.id}.m4a`);
  writeFileSync(w, wav(L, R));
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "96000", w, out]);
  rmSync(w);
  const mm = Math.floor(seconds / 60), ss = String(Math.round(seconds % 60)).padStart(2, "0");
  console.log(`${p.id.padEnd(22)} ${mm}:${ss}  (${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
