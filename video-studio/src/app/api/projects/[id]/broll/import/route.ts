import { z } from "zod";
import { route, HttpError } from "@/server/http";
import { importBroll } from "@/server/broll/import";
import { stockProviders } from "@/server/broll/registry";

export const maxDuration = 300;
const body = z.object({ provider: z.string(), id: z.string().max(200), downloadUrl: z.string().max(2000), title: z.string().max(200).default("broll") });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const b = body.parse(await req.json());
  const p = stockProviders(req.nextUrl.origin).find((x) => x.id === b.provider);
  if (!p) throw new HttpError(404, "Unknown provider");
  if (p.kind === "library") return importBroll(id, { kind: "library", name: b.id });
  const st = await p.status();
  if (!st.ok) throw new HttpError(409, `${p.name} is not configured. ${st.hint ?? ""}`);
  return importBroll(id, { kind: "url", url: b.downloadUrl, allowedHosts: p.allowedHosts, filename: `${p.id}-${b.id}.mp4` });
});
