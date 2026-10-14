import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const W = 1200;
const H = 630;
const INK = "#1B1814";
const SOFT = "#5F574C";
const GOLD = "#A98443";

let font: Buffer | null | undefined;
/** The site's display face (GFS Didot), read from the installed font package. Falls back to the default font. */
function didot(): Buffer | null {
  if (font !== undefined) return font;
  try {
    font = readFileSync(join(process.cwd(), "node_modules/@fontsource/gfs-didot/files/gfs-didot-latin-400-normal.woff"));
  } catch {
    font = null;
  }
  return font;
}

/** A picture from /public as a PNG data URL (the card renderer does not read WebP). Returns undefined if it cannot be read. */
async function picture(publicPath: string): Promise<string | undefined> {
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp(join(process.cwd(), "public", publicPath.replace(/^\//, ""))).resize({ height: 520 }).png().toBuffer();
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export type CardInput = { kicker: string; title: string; note?: string; art?: string; artBg?: string };

/** The one social card: cream paper, the YoureIn name, a page title and, where there is one, the design's artwork. */
export async function ogCard(input: CardInput): Promise<ImageResponse> {
  const art = input.art ? await picture(input.art) : undefined;
  const f = didot();
  const titleSize = input.title.length > 34 ? 60 : input.title.length > 22 ? 70 : 82;
  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", background: "#FBF8F1", fontFamily: f ? "Didot" : "sans-serif", color: INK }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 64px 72px", width: art ? 700 : 1056 }}>
          <div style={{ display: "flex", fontSize: 44, letterSpacing: -1 }}>
            <span>Youre</span>
            <span style={{ color: GOLD }}>In</span>
            <span>.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, color: GOLD, textTransform: "uppercase", fontFamily: "sans-serif" }}>{input.kicker}</div>
            <div style={{ display: "flex", marginTop: 18, fontSize: titleSize, lineHeight: 1.08, letterSpacing: -1 }}>{input.title}</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: SOFT, fontFamily: "sans-serif" }}>{input.note ?? "Animated digital invitations"}</div>
        </div>
        {art && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 500, height: H, background: input.artBg ?? "#F1E9DA" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art} height={520} style={{ height: 520 }} alt="" />
          </div>
        )}
      </div>
    ),
    { width: W, height: H, ...(f ? { fonts: [{ name: "Didot", data: f, style: "normal" as const, weight: 400 as const }] } : {}) },
  );
}
