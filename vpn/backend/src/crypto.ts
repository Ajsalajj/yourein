import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** AES-256-GCM sealing for secrets stored in the database. */
export class Sealer {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) throw new Error("sealing key must be 32 bytes");
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return ["v1", iv.toString("base64"), body.toString("base64"), c.getAuthTag().toString("base64")].join(".");
  }

  open(sealed: string): string {
    const [v, iv, body, tag] = sealed.split(".");
    if (v !== "v1" || !iv || !body || !tag) throw new Error("unsupported sealed value");
    const d = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
  }
}

/** A WireGuard key is 32 bytes, standard base64 with padding (44 chars). */
export function isWireGuardKey(s: unknown): s is string {
  return typeof s === "string" && /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/.test(s) && Buffer.from(s, "base64").length === 32;
}

export const sha256Hex = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

/**
 * Request signature shared with gateway agents:
 * HMAC-SHA256(secret, `${ts}\n${nonce}\n${METHOD}\n${path}\n${sha256(body)}`), hex.
 * The nonce makes identical requests in the same second distinguishable,
 * so the agent's replay cache never rejects a legitimate retry.
 */
export function signRequest(secret: string, ts: string, nonce: string, method: string, path: string, body: string): string {
  return createHmac("sha256", secret).update(`${ts}\n${nonce}\n${method.toUpperCase()}\n${path}\n${sha256Hex(body)}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
