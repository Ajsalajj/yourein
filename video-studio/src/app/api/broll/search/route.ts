import { route, HttpError } from "@/server/http";
import { stockProviders } from "@/server/broll/registry";

export const GET = route(async (req) => {
  const sp = req.nextUrl.searchParams;
  const provider = sp.get("provider") ?? "library";
  const query = (sp.get("q") ?? "").trim().slice(0, 120);
  const orientation = (["portrait", "landscape", "square"] as const).find((o) => o === sp.get("orientation")) ?? "portrait";
  const p = stockProviders(req.nextUrl.origin).find((x) => x.id === provider);
  if (!p) throw new HttpError(404, "Unknown provider");
  const st = await p.status();
  if (!st.ok && p.kind === "stock") throw new HttpError(409, `${p.name} is not configured. ${st.hint ?? ""}`);
  const minDuration = Number(sp.get("minDuration") ?? 0) || undefined;
  try {
    return { provider: p.id, query, results: await p.search({ query, orientation, minDurationSec: minDuration, perPage: 12 }) };
  } catch (e) {
    throw new HttpError(502, `${p.name} search failed: ${(e as Error).message}`);
  }
});
