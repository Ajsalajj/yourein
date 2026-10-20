import { route } from "@/server/http";
import { generationProviders, stockProviders } from "@/server/broll/registry";

/** Which B-roll sources are usable right now (each configured independently). */
export const GET = route(async (req) => {
  const origin = req.nextUrl.origin;
  const stock = await Promise.all(stockProviders(origin).map(async (p) => ({ id: p.id, name: p.name, kind: p.kind, license: p.license, ...(await p.status()) })));
  const gen = generationProviders().map((p) => ({ id: p.id, name: p.name, kind: "generator" as const, license: "depends on the service", ...p.status() }));
  return { providers: [...stock, ...gen] };
});
