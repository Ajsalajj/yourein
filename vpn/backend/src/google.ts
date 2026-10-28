import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";

/** Normalised subscription state from the Play Developer API. */
export interface PlaySubscription {
  state: "active" | "grace" | "on_hold" | "paused" | "canceled" | "expired" | "pending";
  productId: string;
  basePlanId: string | null;
  expiresAt: Date | null;
  autoRenewing: boolean;
  acknowledged: boolean;
  /** Orvane user id set as obfuscatedAccountId at purchase. */
  accountId: string | null;
  /** Previous token this purchase replaces (upgrade / resubscribe). */
  linkedPurchaseToken: string | null;
  testPurchase: boolean;
}

export interface PlayApi {
  getSubscription(purchaseToken: string): Promise<PlaySubscription>;
  acknowledge(productId: string, purchaseToken: string): Promise<void>;
}

export class PlayApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const STATE_MAP: Record<string, PlaySubscription["state"]> = {
  SUBSCRIPTION_STATE_ACTIVE: "active",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace",
  SUBSCRIPTION_STATE_ON_HOLD: "on_hold",
  SUBSCRIPTION_STATE_PAUSED: "paused",
  SUBSCRIPTION_STATE_CANCELED: "canceled",
  SUBSCRIPTION_STATE_EXPIRED: "expired",
  SUBSCRIPTION_STATE_PENDING: "pending",
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: "expired",
};

/** Maps a purchases.subscriptionsv2 resource. Exported for tests. */
export function parseSubscriptionV2(j: Record<string, any>): PlaySubscription {
  const item = (j.lineItems as any[] | undefined)?.[0] ?? {};
  return {
    state: STATE_MAP[j.subscriptionState as string] ?? "expired",
    productId: item.productId ?? "",
    basePlanId: item.offerDetails?.basePlanId ?? null,
    expiresAt: item.expiryTime ? new Date(item.expiryTime) : null,
    autoRenewing: Boolean(item.autoRenewingPlan?.autoRenewEnabled),
    acknowledged: j.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    accountId: j.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    linkedPurchaseToken: j.linkedPurchaseToken ?? null,
    testPurchase: j.testPurchase !== undefined,
  };
}

/** Whether a subscription currently grants Premium. */
export function grantsPremium(s: Pick<PlaySubscription, "state" | "expiresAt">, now = new Date()): boolean {
  if (s.state === "active" || s.state === "grace") return true;
  // Cancelled subscriptions keep access until the paid period ends.
  if (s.state === "canceled") return s.expiresAt !== null && s.expiresAt > now;
  return false;
}

/** Google Play Developer API using a service account (OAuth 2 JWT bearer flow). */
export class GooglePlayApi implements PlayApi {
  private token: { value: string; exp: number } | null = null;
  private readonly sa: { client_email: string; private_key: string; token_uri?: string };

  constructor(serviceAccountJsonBase64: string, private readonly packageName: string) {
    this.sa = JSON.parse(Buffer.from(serviceAccountJsonBase64, "base64").toString("utf8"));
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value;
    const tokenUri = this.sa.token_uri ?? "https://oauth2.googleapis.com/token";
    const key = await importPKCS8(this.sa.private_key, "RS256");
    const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(this.sa.client_email)
      .setAudience(tokenUri)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);
    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new PlayApiError(res.status, "google oauth failed");
    const j = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }

  private async call(method: string, path: string): Promise<any> {
    const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${this.packageName}${path}`, {
      method,
      headers: { authorization: `Bearer ${await this.accessToken()}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new PlayApiError(res.status, `play api ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async getSubscription(purchaseToken: string) {
    return parseSubscriptionV2(await this.call("GET", `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`));
  }

  async acknowledge(productId: string, purchaseToken: string) {
    await this.call(
      "POST",
      `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    );
  }
}

/** Verifies the OIDC token Pub/Sub attaches to push deliveries (RTDN). */
export function pubsubPushVerifier(audience: string, serviceAccountEmail: string) {
  const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  return async (bearer: string): Promise<boolean> => {
    try {
      const { payload } = await jwtVerify(bearer, jwks, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience,
      });
      return payload.email === serviceAccountEmail && payload.email_verified === true;
    } catch {
      return false;
    }
  };
}
