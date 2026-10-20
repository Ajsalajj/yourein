import fsp from "node:fs/promises";
import path from "node:path";
import { route, HttpError } from "@/server/http";
import { isSafeLibraryName, libraryDir } from "@/server/broll/library";

export const GET = route(async (req) => {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!isSafeLibraryName(name)) throw new HttpError(400, "Invalid name");
  const buf = await fsp.readFile(path.join(libraryDir(), ".thumbs", `${name}.jpg`)).catch(() => null);
  if (!buf) throw new HttpError(404, "No thumbnail");
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" } });
});
