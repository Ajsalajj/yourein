import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTemplate } from "@/data/templates";
import { eventTitleOf, formatDate } from "@/lib/invite";
import { getMedia, getPublished } from "@/server/invitations";
import type { PhotoFit } from "@/lib/invite";

const W = 1200;
const H = 630;
const SLUG = /^[a-z0-9-]{1,80}$/;

const fonts = new Map<string, Buffer | null>();
function font(pkg: string, file: string): Buffer | null {
  if (!fonts.has(file)) {
    try {
      fonts.set(file, readFileSync(join(process.cwd(), "node_modules/@fontsource", pkg, "files", file)));
    } catch {
      fonts.set(file, null);
    }
  }
  return fonts.get(file)!;
}

/** The couple's own portrait as a PNG data URL (the card renderer reads neither WebP nor HEIC). */
async function portrait(mediaId: string | null | undefined, fit?: PhotoFit): Promise<string | undefined> {
  if (!mediaId) return undefined;
  try {
    const media = await getMedia(mediaId);
    if (!media || !media.mime.startsWith("image/")) return undefined;
    const sharp = (await import("sharp")).default;
    const W = 460, H = 540;
    let img = sharp(await sharp(media.bytes).rotate().toBuffer());
    if (fit && (fit.z > 1 || fit.x !== 50 || fit.y !== 50)) {
      /* the same framing the host chose in the editor: the visible part is xp*(width - visible) from the left */
      const { width = 0, height = 0 } = await img.metadata();
      const s = Math.max(W / width, H / height) * fit.z;
      const vw = Math.min(width, Math.round(W / s)), vh = Math.min(height, Math.round(H / s));
      img = img.extract({ left: Math.round((fit.x / 100) * (width - vw)), top: Math.round((fit.y / 100) * (height - vh)), width: vw, height: vh });
    }
    const buf = await img.resize(W, H, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * The picture shown when an invitation link is shared (WhatsApp, Instagram, Facebook, iMessage): the couple's real
 * names, the occasion and the date, in the design's own colours, with their portrait if they added one.
 * Only what the public invitation page already shows to anyone with the link; never the venue, guests or replies.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inv = SLUG.test(slug) ? await getPublished(slug) : null;
  if (!inv || inv.status !== "published") return new Response("Not found", { status: 404 });
  const t = getTemplate(inv.templateSlug);
  const th = t?.theme ?? { bg: "#FBF8F1", ink: "#1B1814", soft: "#5F574C", accent: "#A98443", script: "pinyon" as const };
  const d = inv.data;

  const photo = await portrait(d.portrait, d.portrait ? d.photoFit[d.portrait] : undefined);
  const script = th.script === "allura" ? font("allura", "allura-latin-400-normal.woff") : font("pinyon-script", "pinyon-script-latin-400-normal.woff");
  const caps = font("cinzel", "cinzel-latin-400-normal.woff");

  const n1 = (d.name1 || "").trim(), n2 = (d.name2 || "").trim();
  const longest = Math.max(n1.length, n2.length);
  const nameSize = longest > 24 ? 58 : longest > 16 ? 76 : longest > 11 ? 92 : 112;
  const date = d.date ? formatDate(d.date) : "";
  const kicker = `${eventTitleOf(d)} invitation`;
  const textWidth = photo ? 700 : W;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", background: th.bg, color: th.ink }}>
        <div style={{ width: textWidth, height: H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 56px", textAlign: "center" }}>
          <div style={{ display: "flex", fontFamily: caps ? "Cinzel" : "serif", fontSize: 26, letterSpacing: 8, textTransform: "uppercase", color: th.accent }}>{kicker}</div>
          <div style={{ display: "flex", width: 120, height: 2, background: th.accent, opacity: 0.6, margin: "26px 0 18px" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: script ? "Script" : "serif", fontSize: nameSize, lineHeight: 1.15 }}>
            <span>{n1}</span>
            {n2 && <span style={{ fontSize: nameSize * 0.55, color: th.accent, margin: "-4px 0" }}>&amp;</span>}
            {n2 && <span>{n2}</span>}
          </div>
          {date && <div style={{ display: "flex", marginTop: 26, fontFamily: caps ? "Cinzel" : "serif", fontSize: 30, letterSpacing: 4, color: th.soft }}>{date}</div>}
        </div>
        {photo && (
          <div style={{ width: W - textWidth, height: H, display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} width={420} height={500} style={{ width: 420, height: 500, objectFit: "cover", borderRadius: "210px 210px 18px 18px", border: `3px solid ${th.accent}` }} alt="" />
          </div>
        )}
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        ...(script ? [{ name: "Script", data: script, style: "normal" as const, weight: 400 as const }] : []),
        ...(caps ? [{ name: "Cinzel", data: caps, style: "normal" as const, weight: 400 as const }] : []),
      ],
      /* the URL carries the last-edit time, so a cached card is never stale */
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable" },
    },
  );
}
