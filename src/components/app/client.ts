"use client";

/** Small fetch helper for the signed-in screens. Throws an Error with a message that is safe to show. */
export async function api<T = Record<string, unknown>>(method: string, url: string, data?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: data === undefined ? undefined : { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  } catch {
    throw new Error("You seem to be offline. Please check your connection and try again.");
  }
  const out = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.assign(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    throw new Error("Please sign in again.");
  }
  if (!res.ok) throw Object.assign(new Error(out.error || "Something went wrong. Please try again."), { code: out.code as string | undefined });
  return out as T;
}

/** Shrinks a photo in the browser before upload, so phone photos send quickly. */
export async function shrinkImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
  } catch {
    return file;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
