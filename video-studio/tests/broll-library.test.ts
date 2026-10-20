import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("local library: tokenised search over file names and tag files, real ffprobe/thumbnail, nothing outside the folder", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lib-"));
  const lib = path.join(dir, "library", "broll");
  fs.mkdirSync(lib, { recursive: true });
  for (const n of ["ocean_waves.mp4", "city_traffic.mp4"]) execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=160x284:r=15:d=2", "-pix_fmt", "yuv420p", path.join(lib, n)]);
  fs.writeFileSync(path.join(lib, "city_traffic.txt"), "cars highway night");
  process.env.DATA_DIR = dir;
  const { matchScore: ms } = await import("../src/server/broll/library");
  assert.ok(ms("ocean sunset", "Ocean_Sunset_01.mp4") === 1 && ms("ocean", "oceans.mp4") === 1 && ms("car", "ocean.mp4") === 0);
  const { libraryProvider, matchScore } = await import("../src/server/broll/library");
  const prov = libraryProvider("http://x");
  assert.equal((await prov.status()).ok, true);
  const r = await prov.search({ query: "waves", orientation: "portrait" });
  assert.deepEqual(r.map((x) => x.id), ["ocean_waves.mp4"]);
  assert.ok(Math.abs(r[0].durationSec - 2) < 0.2 && r[0].width === 160);
  assert.ok(fs.existsSync(path.join(lib, ".thumbs", "ocean_waves.mp4.jpg")));
  assert.deepEqual((await prov.search({ query: "highway", orientation: "portrait" })).map((x) => x.id), ["city_traffic.mp4"]);
  assert.equal((await prov.search({ query: "unrelated", orientation: "portrait" })).length, 0);
  const { isSafeLibraryName } = await import("../src/server/broll/library");
  assert.ok(!isSafeLibraryName("../x.mp4") && !isSafeLibraryName("a/b.mp4") && isSafeLibraryName("ok clip (1).mp4"));
});
