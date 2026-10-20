/** Provider abstraction for B-roll sources. Stock search and AI generation are configured independently. */
export interface StockResult {
  provider: string;
  id: string;
  title: string;
  thumbUrl: string;
  previewUrl: string;
  /** file the server downloads when the user picks this result */
  downloadUrl: string;
  durationSec: number;
  width: number;
  height: number;
  author: string;
  pageUrl: string;
  /** human-readable licence summary + what attribution (if any) is expected */
  license: string;
}

export type Orientation = "portrait" | "landscape" | "square";
export interface SearchQuery { query: string; orientation: Orientation; minDurationSec?: number; maxDurationSec?: number; perPage?: number; page?: number }

export interface ProviderStatus { ok: boolean; hint?: string }

export interface StockProvider {
  id: string;
  name: string;
  kind: "stock" | "library";
  license: string;
  /** hosts the server may download from for this provider (SSRF allowlist); empty for local files */
  allowedHosts: string[];
  status(): ProviderStatus | Promise<ProviderStatus>;
  search(q: SearchQuery): Promise<StockResult[]>;
}

export interface GenerationRequest { prompt: string; durationSec: number; aspect: "9:16" | "16:9" | "1:1" }
export interface GenerationProvider {
  id: string;
  name: string;
  status(): ProviderStatus;
  /** returns a downloadable video URL (the service decides how long it takes; the adapter polls) */
  generate(req: GenerationRequest): Promise<{ downloadUrl: string; title: string }>;
  allowedHosts: string[];
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
