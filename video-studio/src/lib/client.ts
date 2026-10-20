"use client";
import type { Asset, Project } from "./project";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

/** Real upload progress via XHR (fetch cannot report upload progress). */
export function uploadFile(projectId: string, file: File, kind: "video" | "audio", onProgress: (loaded: number, total: number) => void, signal?: AbortSignal): Promise<{ asset: Asset; project: Project }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/projects/${projectId}/upload?filename=${encodeURIComponent(file.name)}&kind=${kind}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded, e.total);
    xhr.onerror = () => reject(new ApiError(0, "Network error during upload"));
    xhr.onabort = () => reject(new ApiError(0, "Upload cancelled"));
    xhr.onload = () => {
      let body: { error?: string; asset?: Asset; project?: Project } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.asset && body.project) resolve({ asset: body.asset, project: body.project });
      else reject(new ApiError(xhr.status, body.error ?? `Upload failed (${xhr.status})`));
    };
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

export const mediaUrl = (projectId: string, assetId: string) => `/api/media/${projectId}/${assetId}`;
export const fmtTime = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(2).padStart(5, "0")}`;
};
export const fmtBytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);
