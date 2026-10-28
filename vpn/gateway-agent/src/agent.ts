import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer as createHttp, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createHttps } from "node:https";
import { isCidr, isKey, Wg } from "./wg.js";

export interface AgentOptions {
  secret: string;
  wg: Wg;
  maxSkewSeconds?: number;
  now?: () => number;
}

const ACTIVE_WINDOW_S = 180;

/**
 * HTTP handler for the gateway agent.
 *
 * Every request must be signed by the Orvane API with this gateway's
 * secret over timestamp, nonce, method, path and body; stale timestamps and
 * replayed signatures are rejected. The agent keeps no logs of peers,
 * endpoints or traffic - only counts.
 */
export function createHandler(opts: AgentOptions) {
  const skew = opts.maxSkewSeconds ?? 60;
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  const seen = new Map<string, number>(); // signature -> expiry

  function authorised(req: IncomingMessage, path: string, body: string): boolean {
    const ts = String(req.headers["x-orvane-ts"] ?? "");
    const nonce = String(req.headers["x-orvane-nonce"] ?? "");
    const sig = String(req.headers["x-orvane-signature"] ?? "");
    const t = Number(ts);
    if (!Number.isInteger(t) || Math.abs(now() - t) > skew || !/^[0-9a-f]{64}$/.test(sig) || !/^[0-9a-f]{16,64}$/.test(nonce)) return false;
    const bodyHash = createHash("sha256").update(body).digest("hex");
    const expected = createHmac("sha256", opts.secret).update(`${ts}\n${nonce}\n${req.method}\n${path}\n${bodyHash}`).digest("hex");
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return false;
    for (const [k, exp] of seen) if (exp < now()) seen.delete(k);
    if (seen.has(sig)) return false;
    seen.set(sig, now() + skew * 2);
    return true;
  }

  const send = (res: ServerResponse, status: number, body?: unknown) => {
    res.writeHead(status, body === undefined ? {} : { "content-type": "application/json" });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };

  return async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 8 * 1024 * 1024) return send(res, 413);
      chunks.push(c as Buffer);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    const url = new URL(req.url ?? "/", "http://agent");
    const path = url.pathname;

    if (!authorised(req, path, body)) return send(res, 401);

    try {
      const parsed = body ? JSON.parse(body) : {};
      if (req.method === "GET" && path === "/v1/health") {
        const peers = await opts.wg.peers();
        const t = now();
        return send(res, 200, {
          peers: peers.length,
          activePeers: peers.filter((p) => p.latestHandshake > 0 && t - p.latestHandshake < ACTIVE_WINDOW_S).length,
          rxBytes: peers.reduce((a, p) => a + p.rx, 0),
          txBytes: peers.reduce((a, p) => a + p.tx, 0),
        });
      }
      const single = /^\/v1\/peers\/([^/]+)$/.exec(path);
      if (single) {
        const key = decodeURIComponent(single[1]!);
        if (!isKey(key)) return send(res, 400, { error: "bad key" });
        if (req.method === "PUT") {
          const ips = parsed.allowedIps;
          if (!Array.isArray(ips) || ips.length === 0 || !ips.every(isCidr)) return send(res, 400, { error: "bad allowedIps" });
          await opts.wg.setPeer(key, ips);
          return send(res, 204);
        }
        if (req.method === "DELETE") {
          await opts.wg.removePeer(key);
          return send(res, 204);
        }
      }
      if (req.method === "PUT" && path === "/v1/peers") {
        const desired = parsed.peers;
        if (!Array.isArray(desired) || !desired.every((p) => isKey(p?.publicKey) && Array.isArray(p.allowedIps) && p.allowedIps.every(isCidr))) {
          return send(res, 400, { error: "bad peers" });
        }
        const want = new Map<string, string[]>(desired.map((p: { publicKey: string; allowedIps: string[] }) => [p.publicKey, p.allowedIps]));
        const current = await opts.wg.peers();
        let added = 0, removed = 0;
        for (const p of current) {
          if (!want.has(p.publicKey)) {
            await opts.wg.removePeer(p.publicKey);
            removed++;
          }
        }
        const have = new Map(current.map((p) => [p.publicKey, [...p.allowedIps].sort().join(",")]));
        for (const [k, ips] of want) {
          if (have.get(k) !== [...ips].sort().join(",")) {
            await opts.wg.setPeer(k, ips);
            added++;
          }
        }
        return send(res, 200, { added, removed, total: want.size });
      }
      return send(res, 404);
    } catch (e) {
      console.error(JSON.stringify({ level: "error", msg: "request failed", err: (e as Error).name }));
      return send(res, 500);
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.env;
  const secret = env.AGENT_SECRET;
  if (!secret || secret.length < 32) throw new Error("AGENT_SECRET (from the admin dashboard) is required");
  const handler = createHandler({ secret, wg: new Wg(env.WG_INTERFACE ?? "wg0", env.WG_BIN ?? "wg") });
  const port = Number(env.PORT ?? 8443);
  const server =
    env.TLS_CERT && env.TLS_KEY
      ? createHttps({ cert: readFileSync(env.TLS_CERT), key: readFileSync(env.TLS_KEY), minVersion: "TLSv1.2" }, handler)
      : env.AGENT_INSECURE_HTTP === "true"
        ? createHttp(handler)
        : (() => {
            throw new Error("TLS_CERT and TLS_KEY are required (AGENT_INSECURE_HTTP=true only for local testing)");
          })();
  server.listen(port, () => console.log(JSON.stringify({ level: "info", msg: "agent listening", port, tls: !!env.TLS_CERT })));
}
