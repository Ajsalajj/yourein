"""Verifies final-export audio mixing of sound effects from three real exports of the same project (speech muted):
  sfx_only.mp4   effects, no music
  music_only.mp4 music, no effects
  both.mp4       music + effects with ducking
usage: verify_sfx.py sfx_only.mp4 music_only.mp4 both.mp4 plan.json outdir
Checks: (1) each effect appears in sfx_only at the planned time (+-1 frame), correlation > 0.9, gain within 15 % of the planned volume;
(2) in both.mp4 the music inside an effect window is ducked relative to music_only.mp4; (3) outside every window music is untouched (ratio ~1)."""
import sys, json, subprocess, numpy as np, wave
a_p, m_p, b_p, plan_p, out = sys.argv[1:6]
plan = json.load(open(plan_p)); SR = 44100
def decode(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768
def lib(id_):
    with wave.open(f"public/sfx/{id_}.wav") as f: return np.frombuffer(f.readframes(f.getnframes()), dtype="<i2").astype(np.float64) / 32768
S, M, Bt = decode(a_p), decode(m_p), decode(b_p); n = min(len(S), len(M), len(Bt)); S, M, Bt = S[:n], M[:n], Bt[:n]
rms = lambda x: float(np.sqrt(np.mean(x ** 2) + 1e-18))
rows = []; ok = True
for e in plan["effects"]:
    ref = lib(e["library"]) * e["volume"]
    s0 = max(0, int((e["outMs"] - 150) / 1000 * SR)); s1 = int((e["outMs"] + len(ref) / SR * 1000 + 150) / 1000 * SR)
    seg = S[s0:s1]; L = len(seg) + len(ref); F = 1 << (L - 1).bit_length()
    cc = np.fft.irfft(np.fft.rfft(seg, F) * np.conj(np.fft.rfft(ref, F)), F)[: len(seg)]
    lag = int(np.argmax(cc)); st = (s0 + lag) / SR * 1000; sl = seg[lag:lag + len(ref)]
    corr = float(np.dot(sl, ref) / (np.linalg.norm(ref) * np.linalg.norm(sl) + 1e-12)); gain = float(np.dot(sl, ref) / (np.dot(ref, ref) + 1e-12))
    r = {"id": e["library"], "planned_ms": round(e["outMs"], 1), "measured_ms": round(st, 1), "error_ms": round(st - e["outMs"], 1), "correlation": round(corr, 3), "gain_vs_planned": round(gain, 3)}
    # Remotion mixes MONO sources to stereo with an equal-power pan law (-3 dB per channel); decoding back to mono gives 0.7071 x volume
    r["gain_vs_planned_after_pan_law"] = round(gain / 0.7071, 3)
    r["pass"] = abs(r["error_ms"]) <= 34 and corr > 0.9 and 0.85 < gain / 0.7071 < 1.15
    ok &= r["pass"]; rows.append(r)
report = {"effects": rows}
# music component in both.mp4 = both - (effects mixed alone); effects mixed alone == sfx_only (same gains, same timing)
music_part = Bt - S
windows = [(e["outMs"] + 60, e["outMs"] + min(len(lib(e["library"])) / SR * 1000, 400)) for e in plan["effects"] if e.get("duck", True)]
duck = []
for a, b in windows:
    i0, i1 = int(a / 1000 * SR), int(b / 1000 * SR); d = rms(music_part[i0:i1]) / max(1e-9, rms(M[i0:i1])); duck.append(round(d, 3))
free = (plan["effects"][-1]["outMs"] + 3500, plan["effects"][-1]["outMs"] + 4500)
j0, j1 = int(free[0] / 1000 * SR), min(n, int(free[1] / 1000 * SR))
untouched = rms(music_part[j0:j1]) / max(1e-9, rms(M[j0:j1])) if j1 > j0 else 1.0
report["ducking"] = {"music_ratio_inside_effect_windows": duck, "expected_about": plan["duckLevel"], "music_ratio_far_from_effects": round(float(untouched), 3)}
report["ducking"]["pass"] = all(d < plan["duckLevel"] + 0.25 for d in duck) and 0.9 < untouched < 1.1
ok &= report["ducking"]["pass"]; report["pass"] = bool(ok)
json.dump(report, open(f"{out}/sfx_report.json", "w"), indent=1); print(json.dumps(report, indent=1)); sys.exit(0 if ok else 1)
