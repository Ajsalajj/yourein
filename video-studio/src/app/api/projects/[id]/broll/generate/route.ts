import { z } from "zod";
import { route, HttpError } from "@/server/http";
import { importBroll } from "@/server/broll/import";
import { generationProviders } from "@/server/broll/registry";

export const maxDuration = 600;
const body = z.object({ prompt: z.string().min(3).max(400), durationSec: z.number().min(1).max(10).default(4), aspect: z.enum(["9:16", "16:9", "1:1"]).default("9:16") });

export const POST = route<{ id: string }>(async (req, { id }) => {
  const b = body.parse(await req.json());
  const g = generationProviders()[0];
  const st = g.status();
  if (!st.ok) throw new HttpError(409, `${g.name} is not configured. ${st.hint ?? ""}`);
  const out = await g.generate(b);
  return importBroll(id, { kind: "url", url: out.downloadUrl, allowedHosts: g.allowedHosts, filename: `generated-${Date.now()}.mp4` });
});
