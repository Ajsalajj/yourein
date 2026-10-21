"""Read-only dump of an After Effects .ffx preset (RIFX container) as a readable tree: property match names, user names, static values and keyframes.
usage: ffx_dump.py file.ffx [--raw]   (the file is only READ; nothing is imported into the project)"""
import struct, sys, re
data = open(sys.argv[1], "rb").read(); RAW = "--raw" in sys.argv
assert data[:4] == b"RIFX", "not an RIFX/ffx file"
def cstr(b): return b.split(b"\0")[0].decode("utf-8", "replace")
def chunks(buf, off, end):
    while off + 8 <= end:
        cid = buf[off:off + 4].decode("latin1"); size = struct.unpack(">I", buf[off + 4:off + 8])[0]
        yield cid, off + 8, size
        off += 8 + size + (size & 1)
def show(buf, off, end, depth):
    pad = "  " * depth
    for cid, o, size in chunks(buf, off, end):
        body = buf[o:o + size]
        if cid == "LIST":
            print(f"{pad}LIST {body[:4].decode('latin1')}")
            show(buf, o + 4, o + size, depth + 1)
        elif cid in ("tdmn", "tdsn", "pdnm", "nmrp"):
            print(f"{pad}{cid} {cstr(body)!r}")
        elif cid == "Utf8":
            print(f"{pad}Utf8 {body.decode('utf-8','replace')!r}")
        elif cid == "cdat":
            n = size // 8; vals = struct.unpack(">" + "d" * n, body[:n * 8]) if n else ()
            print(f"{pad}cdat {[round(v, 5) for v in vals]}")
        elif cid in ("tdb4",):
            print(f"{pad}tdb4 flags={body[:8].hex()} len={size}")
        elif cid in ("lkhd", "ldat", "lhd3"):
            print(f"{pad}{cid} len={size} {body[:48].hex()}" if RAW else f"{pad}{cid} len={size}")
        else:
            print(f"{pad}{cid} len={size}" + (f" {body[:40].hex()}" if RAW else ""))
show(data, 12, len(data), 0)
