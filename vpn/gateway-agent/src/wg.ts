import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface PeerState {
  publicKey: string;
  allowedIps: string[];
  latestHandshake: number; // unix seconds, 0 = never
  rx: number;
  tx: number;
}

const KEY = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/;
const CIDR = /^(?:(?:\d{1,3}\.){3}\d{1,3}\/(?:3[0-2]|[12]?\d)|[0-9a-fA-F:]+\/(?:12[0-8]|1[01]\d|\d?\d))$/;

export const isKey = (k: unknown): k is string => typeof k === "string" && KEY.test(k);
export const isCidr = (c: unknown): c is string => typeof c === "string" && CIDR.test(c);

/**
 * Thin wrapper over the `wg` tool. Arguments are passed as an argv array
 * (no shell), and every key and CIDR is validated before use.
 */
export class Wg {
  constructor(
    private readonly iface: string,
    private readonly bin = "wg",
  ) {
    if (!/^[a-zA-Z0-9_.-]{1,15}$/.test(iface)) throw new Error("bad interface name");
  }

  async setPeer(publicKey: string, allowedIps: string[]): Promise<void> {
    if (!isKey(publicKey) || allowedIps.length === 0 || !allowedIps.every(isCidr)) throw new Error("invalid peer");
    await run(this.bin, ["set", this.iface, "peer", publicKey, "allowed-ips", allowedIps.join(",")]);
  }

  async removePeer(publicKey: string): Promise<void> {
    if (!isKey(publicKey)) throw new Error("invalid key");
    await run(this.bin, ["set", this.iface, "peer", publicKey, "remove"]);
  }

  /** Parses `wg show <iface> dump`. The first line is the interface itself. */
  async peers(): Promise<PeerState[]> {
    const { stdout } = await run(this.bin, ["show", this.iface, "dump"], { maxBuffer: 64 * 1024 * 1024 });
    return stdout
      .trim()
      .split("\n")
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const f = line.split("\t");
        // public-key, preshared-key, endpoint, allowed-ips, latest-handshake, rx, tx, keepalive
        return {
          publicKey: f[0] ?? "",
          allowedIps: f[3] && f[3] !== "(none)" ? f[3].split(",") : [],
          latestHandshake: Number(f[4] ?? 0),
          rx: Number(f[5] ?? 0),
          tx: Number(f[6] ?? 0),
        };
      });
  }
}
