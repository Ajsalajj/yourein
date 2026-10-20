/** Upload validation shared by the server route and the browser (pre-flight) so both agree. */
export const VIDEO_EXT: Record<string, string> = { ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };
export const AUDIO_EXT: Record<string, string> = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg" };

export const FONT_EXT: Record<string, string> = { ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2" };
export const MAX_FONT_BYTES = 20 * 1024 * 1024;

export type UploadCheck = { ok: true; ext: string; mime: string } | { ok: false; status: number; error: string };

function extOf(name: string) {
  const m = name.toLowerCase().match(/\.[a-z0-9]{1,5}$/);
  return m ? m[0] : "";
}

/** `head` (first 16 bytes) is optional: pre-flight checks pass only name/size, the server also sniffs content. */
export function validateUpload(i: { filename: string; size: number; kind: "video" | "audio" | "font"; head?: Uint8Array }): UploadCheck {
  const table = i.kind === "video" ? VIDEO_EXT : i.kind === "font" ? FONT_EXT : AUDIO_EXT;
  const ext = extOf(i.filename);
  if (!table[ext]) return { ok: false, status: 415, error: `Unsupported ${i.kind} type "${ext || "(none)"}". Allowed: ${Object.keys(table).join(", ")}` };
  if (i.size <= 0) return { ok: false, status: 400, error: "The file is empty" };
  if (i.kind === "font" && i.size > MAX_FONT_BYTES) return { ok: false, status: 413, error: "Font files are limited to 20 MB" };
  if (i.head) {
    const h = i.head;
    const ascii = (a: number, b: number) => String.fromCharCode(...Array.from(h.slice(a, b)));
    const isMp4 = ascii(4, 8) === "ftyp";
    const isWebm = h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3;
    const isWav = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
    const isMp3 = ascii(0, 3) === "ID3" || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0);
    const isOgg = ascii(0, 4) === "OggS";
    const isTtf = (h[0] === 0 && h[1] === 1 && h[2] === 0 && h[3] === 0) || ascii(0, 4) === "true";
    const okByExt: Record<string, boolean> = { ".ttf": isTtf, ".otf": ascii(0, 4) === "OTTO" || isTtf, ".woff": ascii(0, 4) === "wOFF", ".woff2": ascii(0, 4) === "wOF2", ".mp4": isMp4, ".m4v": isMp4, ".mov": isMp4 || ascii(4, 8) === "moov" || ascii(4, 8) === "wide" || ascii(4, 8) === "mdat", ".webm": isWebm, ".mp3": isMp3, ".wav": isWav, ".m4a": isMp4, ".aac": isMp3, ".ogg": isOgg };
    if (!okByExt[ext]) return { ok: false, status: 415, error: `The file content does not look like a ${ext} file` };
  }
  return { ok: true, ext, mime: table[ext] };
}
