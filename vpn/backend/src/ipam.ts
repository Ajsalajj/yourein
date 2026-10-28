/**
 * Address allocation inside a gateway's client pool.
 *
 * Host index 1 is the gateway itself; clients get 2..(size-2). The same
 * index is used in the IPv6 pool, so a device's v4 and v6 addresses line up.
 */

export function parseCidr(cidr: string): { base: bigint; bits: number; v6: boolean } {
  const [addr, len] = cidr.split("/");
  if (!addr || len === undefined) throw new Error(`bad cidr ${cidr}`);
  const v6 = addr.includes(":");
  const bits = v6 ? 128 : 32;
  const prefix = Number(len);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) throw new Error(`bad prefix ${cidr}`);
  const value = v6 ? ipv6ToBig(addr) : ipv4ToBig(addr);
  const hostBits = BigInt(bits - prefix);
  const base = (value >> hostBits) << hostBits;
  return { base, bits: bits - prefix, v6 };
}

export function ipv4ToBig(ip: string): bigint {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) throw new Error(`bad ipv4 ${ip}`);
  return parts.reduce((acc, p) => (acc << 8n) + BigInt(p), 0n);
}

export function bigToIpv4(n: bigint): string {
  return [24n, 16n, 8n, 0n].map((s) => ((n >> s) & 255n).toString()).join(".");
}

export function ipv6ToBig(ip: string): bigint {
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const groups = tail !== undefined ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  if (groups.length !== 8) throw new Error(`bad ipv6 ${ip}`);
  return groups.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g || "0", 16)), 0n);
}

export function bigToIpv6(n: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) groups.push(((n >> BigInt(i * 16)) & 0xffffn).toString(16));
  // Compress the longest run of zero groups.
  let best = -1, bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== "0") { i++; continue; }
    let j = i;
    while (j < 8 && groups[j] === "0") j++;
    if (j - i > bestLen && j - i > 1) { best = i; bestLen = j - i; }
    i = j;
  }
  if (best < 0) return groups.join(":");
  return `${groups.slice(0, best).join(":")}::${groups.slice(best + bestLen).join(":")}`;
}

/** Strips a "/32" style suffix that Postgres inet text may carry. */
export const hostOf = (inet: string) => inet.split("/")[0]!;

/**
 * Lowest free host index in the v4 pool, given addresses already in use.
 * Returns null when the pool is exhausted.
 */
export function nextFreeIndex(cidr: string, used: Iterable<string>): number | null {
  const pool = parseCidr(cidr);
  if (pool.v6) throw new Error("ipv4 pool expected");
  const size = 1n << BigInt(pool.bits);
  const taken = new Set<bigint>();
  for (const u of used) taken.add(ipv4ToBig(hostOf(u)) - pool.base);
  for (let i = 2n; i < size - 1n; i++) if (!taken.has(i)) return Number(i);
  return null;
}

export function addressAt(cidr: string, index: number): string {
  const pool = parseCidr(cidr);
  const n = pool.base + BigInt(index);
  return pool.v6 ? bigToIpv6(n) : bigToIpv4(n);
}

export function indexOf(cidr: string, address: string): number {
  const pool = parseCidr(cidr);
  const v = pool.v6 ? ipv6ToBig(hostOf(address)) : ipv4ToBig(hostOf(address));
  return Number(v - pool.base);
}
