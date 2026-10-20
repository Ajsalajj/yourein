/** Tiny static file server with HTTP Range support. Dev/test helper only (the app serves media from /api/media). */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

export function serveDir(dir: string, port = 0): Promise<{ url: string; close: () => void }> {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = path.resolve(root, "." + rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    const size = fs.statSync(file).size;
    const type = file.endsWith(".mp4") ? "video/mp4" : file.endsWith(".wav") ? "audio/wav" : "application/octet-stream";
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": size });
      fs.createReadStream(file).pipe(res);
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, close: () => server.close() })));
}
