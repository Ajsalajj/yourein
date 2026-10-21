"""Compact, read-only summary of an .ffx preset: per text animator the selector settings and every animated/static property, with keyframes.
usage: ffx_summary.py file.ffx"""
import struct, sys, json
d = open(sys.argv[1], "rb").read()
def cstr(b): return b.split(b"\0")[0].decode("utf-8", "replace")
def walk(buf, off, end):
    while off + 8 <= end:
        cid = buf[off:off + 4].decode("latin1"); size = struct.unpack(">I", buf[off + 4:off + 8])[0]
        yield cid, off + 8, size
        off += 8 + size + (size & 1)
out = []  # flat stream of (depth, kind, payload)
def rec(buf, off, end, depth, name):
    cur = name
    for cid, o, size in walk(buf, off, end):
        body = buf[o:o + size]
        if cid == "LIST":
            t = body[:4].decode("latin1")
            if t == "list":
                # keyframes: lhd3 header + ldat records
                kfs = []
                for c2, o2, s2 in walk(buf, o + 4, o + size):
                    if c2 == "ldat":
                        n = s2 // 48 if s2 % 48 == 0 else 0
                        for k in range(n):
                            r = buf[o2 + k * 48:o2 + (k + 1) * 48]
                            kfs.append({"t": struct.unpack(">I", r[:4])[0], "v": struct.unpack(">d", r[8:16])[0], "flags": r[4:8].hex(), "ease": [round(x, 4) for x in struct.unpack(">dddd", r[16:48])]})
                    elif c2 == "lhd3":
                        pass
                out.append((depth, "keyframes", cur, kfs))
            else:
                rec(buf, o + 4, o + size, depth + 1, cur)
        elif cid in ("tdmn", "pdnm"):
            cur = cstr(body); out.append((depth, "prop", cur, None))
        elif cid == "tdsn":
            out.append((depth, "name", cstr(body), None))
        elif cid == "Utf8":
            out.append((depth, "utf8", body.decode("utf-8", "replace"), None))
        elif cid == "cdat":
            n = size // 8; out.append((depth, "value", cur, [round(v, 5) for v in struct.unpack(">" + "d" * n, body[:n * 8])]))
        elif cid == "tdb4":
            out.append((depth, "dims", cur, struct.unpack(">H", body[8:10])[0] if size > 10 else None))
rec(d, 12, len(d), 0, "")
DEFAULT = {"ADBE Text Scale 3D": [100.0, 100.0, 100.0], "ADBE Text Fill Opacity": [100.0], "ADBE Text Stroke Opacity": [100.0], "ADBE 3DText Front Opacity": [100.0], "ADBE 3DText Front Ambient": [100.0], "ADBE 3DText Front Diffuse": [50.0], "ADBE 3DText Front Specular": [50.0], "ADBE 3DText Front Shininess": [5.0]}
last = None; pending = None
def flush():
    pass
for idx, (dep, kind, a, b) in enumerate(out):
    pad = "  " * dep
    if kind == "prop": last = a
    elif kind == "name" and a and a != "Utf8": print(f"{pad}[name] {a}")
    elif kind == "utf8": print(f"{pad}[text] {a[:400]!r}")
    elif kind == "value":
        if a.startswith("ADBE 3DText") or a in ("ADBE Text Fill Color", "ADBE Text Stroke Color", "ADBE Text Line Anchor", "ADBE Text Track Type", "ADBE Text Character Change Type", "ADBE Text Character Range", "ADBE Text Anchor Point 3D", "ADBE Text Position 3D") and all(x in (0.0, 255.0, 50.0, 1.0) for x in b[:3]): continue
        v = [x for x in b]; trimmed = v[:3] if len(v) >= 3 and a in ("ADBE Text Scale 3D", "ADBE Text Anchor Point 3D", "ADBE Text Position 3D") else (v[:1] if all(x == 0 for x in v[1:]) else v[:4])
        if DEFAULT.get(a) == trimmed[:len(DEFAULT.get(a, []))] and a in DEFAULT: continue
        if trimmed == [0.0] and a.startswith(("ADBE Text", "ADBE 3DText")) and a not in ("ADBE Text Percent Start", "ADBE Text Percent Offset", "ADBE Text Index Start", "ADBE Text Index End", "ADBE Text Index Offset", "ADBE Text Opacity"): continue
        print(f"{pad}{a} = {trimmed}")
    elif kind == "keyframes":
        print(f"{pad}{a} KEYFRAMES(frames@1024 ticks) " + ", ".join(f"f{k['t']/1024:g}:{k['v']:g}[{k['flags']}|{k['ease']}]" for k in b))
