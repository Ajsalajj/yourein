/** Upload validation shared by the server route and the browser (pre-flight) so both agree. */
export const VIDEO_EXT: Record<string, string> = { ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };
export const AUDIO_EXT: Record<string, string> = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg" };

export type UploadCheck = { ok: true; ext: string; mime: string } | { ok: false; status: number; error: string };

function extOf(name: string) {
  const m = name.toLowerCase().match(/\.[a-z0-9]{1,5}$/);
  return m ? m[0] : "";
}

/** `head` (first 16 bytes) is optional: pre-flight checks pass only name/size, the server also sniffs content. */
export function validateUpload(i: { filename: string; size: number; kind: "video" | "audio"; head?: Uint8Array }): UploadCheck {
  const table = i.kind === "video" ? VIDEO_EXT : AUDIO_EXT;
  const ext = extOf(i.filename);
  if (!table[ext]) return { ok: false, status: 415, error: `Unsupported ${i.kind} type "${ext || "(none)"}". Allowed: ${Object.keys(table).join(", ")}` };
  if (i.size <= 0) return { ok: false, status: 400, error: "The file is empty" };
  if (i.head) {
    const h = i.head;
    const ascii = (a: number, b: number) => String.fromCharCode(...Array.from(h.slice(a, b)));
    const isMp4 = ascii(4, 8) === "ftyp";
    const isWebm = h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3;
    const isWav = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
    const isMp3 = ascii(0, 3) === "ID3" || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0);
    const isOgg = ascii(0, 4) === "OggS";
    const okByExt: Record<string, boolean> = { ".mp4": isMp4, ".m4v": isMp4, ".mov": isMp4 || ascii(4, 8) === "moov" || ascii(4, 8) === "wide" || ascii(4, 8) === "mdat", ".webm": isWebm, ".mp3": isMp3, ".wav": isWav, ".m4a": isMp4, ".aac": isMp3, ".ogg": isOgg };
    if (!okByExt[ext]) return { ok: false, status: 415, error: `The file content does not look like a ${ext} file` };
  }
  return { ok: true, ext, mime: table[ext] };
}
