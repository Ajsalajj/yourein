import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { bearerFrom, type Principal, type Verifier } from "./auth.js";
import { forbidden, HttpError, unauthorized } from "./errors.js";
import { getPlans, me, deleteAccount } from "./services/accounts.js";
import * as admin from "./services/admin.js";
import { handleRtdn, verifyGooglePurchase } from "./services/billing.js";
import type { Deps } from "./services/context.js";
import { provision, removeDevice, rotateDeviceKey } from "./services/tunnels.js";
import type { ServerRow } from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export interface AppOptions {
  deps: Deps;
  verify: Verifier;
  /** Verifies Pub/Sub push tokens for Play RTDN; null disables the endpoint. */
  verifyPubsub: ((bearer: string) => Promise<boolean>) | null;
}

export async function buildApp({ deps, verify, verifyPubsub }: AppOptions) {
  const { config } = deps;
  const app = Fastify({
    // Request logs carry method, route and status only - no bodies, no
    // client IPs, no auth headers.
    logger:
      config.NODE_ENV === "test"
        ? false
        : {
            level: "info",
            serializers: {
              req: (r) => ({ method: r.method, url: r.routeOptions?.url ?? "unknown" }),
              res: (r) => ({ statusCode: r.statusCode }),
            },
          },
    trustProxy: (_addr: string, hop: number) => hop < config.TRUST_PROXY_HOPS,
    bodyLimit: 32 * 1024,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  const adminOrigins = config.ADMIN_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  await app.register(cors, {
    // The Android app doesn't need CORS; only the admin dashboard does.
    origin: (origin, cb) => cb(null, !origin ? false : adminOrigins.includes(origin)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
  await app.register(rateLimit, {
    global: true,
    // After auth hooks, so signed-in requests are keyed by account.
    hook: "preHandler",
    max: 120,
    timeWindow: "1 minute",
    // Signed-in calls are limited per account, anonymous ones per IP.
    keyGenerator: (req) => req.principal?.userId ?? req.ip,
    errorResponseBuilder: () => ({ statusCode: 429, error: { code: "rate_limited", message: "Too many requests" } }),
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: { code: "validation_failed", message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") } });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return reply.status(429).send({ error: { code: "rate_limited" } });
    if (status && status < 500) return reply.status(status).send({ error: { code: "bad_request" } });
    deps.log.error({ err: (err as Error).message }, "unhandled error");
    return reply.status(500).send({ error: { code: "internal" } });
  });

  const authenticate = async (req: FastifyRequest) => {
    const token = bearerFrom(req.headers.authorization);
    if (!token) throw unauthorized();
    req.principal = await verify(token);
  };
  const requireAdmin = async (req: FastifyRequest) => {
    await authenticate(req);
    const p = req.principal!;
    if (p.role !== "admin") throw forbidden();
    if (config.ADMIN_REQUIRE_MFA && p.aal !== "aal2") throw forbidden("mfa_required");
  };
  const principal = (req: FastifyRequest) => req.principal!;

  // ---------- Public ----------

  app.get("/health", { config: { rateLimit: false } }, async () => ({ ok: true }));

  app.get("/v1/servers", async () => {
    const { rows } = await deps.db.query<ServerRow>("select * from servers where enabled order by country_code, city");
    return {
      servers: rows.map((s) => ({
        id: s.id,
        name: s.name,
        countryCode: s.country_code,
        city: s.city,
        tier: s.tier,
        status: s.status,
        // Only report load the gateway measured recently.
        loadPercent: s.last_seen_at && Date.now() - s.last_seen_at.getTime() < 5 * 60_000 ? s.load_percent : null,
        probe: { host: s.probe_host, port: s.probe_port },
      })),
    };
  });

  app.get("/v1/plans", async () => {
    const p = await getPlans(deps.db);
    return {
      productId: p.productId,
      monthlyBasePlan: p.monthlyBasePlan,
      yearlyBasePlan: p.yearlyBasePlan,
      freeDeviceLimit: p.freeDeviceLimit,
      premiumDeviceLimit: p.premiumDeviceLimit,
    };
  });

  // ---------- Signed-in users ----------

  app.register(async (user) => {
    user.addHook("onRequest", authenticate);

    user.get("/v1/me", async (req) => me(deps, principal(req)));

    user.delete("/v1/me", { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } }, async (req, reply) => {
      await deleteAccount(deps, principal(req));
      return reply.status(204).send();
    });

    const TunnelBody = z.object({
      serverId: z.string().min(1).max(64),
      publicKey: z.string().max(64),
      deviceName: z.string().trim().min(1).max(60),
      platform: z.enum(["android"]),
    });
    user.post("/v1/tunnels", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req) =>
      provision(deps, principal(req), TunnelBody.parse(req.body)),
    );

    user.delete<{ Params: { id: string } }>("/v1/devices/:id", async (req, reply) => {
      await removeDevice(deps, principal(req), z.string().uuid().parse(req.params.id));
      return reply.status(204).send();
    });

    const RotateBody = z.object({ oldPublicKey: z.string().max(64), newPublicKey: z.string().max(64) });
    user.post("/v1/devices/rotate", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (req, reply) => {
      const b = RotateBody.parse(req.body);
      await rotateDeviceKey(deps, principal(req), b.oldPublicKey, b.newPublicKey);
      return reply.status(204).send();
    });

    const VerifyBody = z.object({ productId: z.string().min(1).max(100), purchaseToken: z.string().min(10).max(4096) });
    user.post("/v1/billing/google/verify", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
      const b = VerifyBody.parse(req.body);
      return verifyGooglePurchase(deps, principal(req), b.productId, b.purchaseToken);
    });
  });

  // ---------- Google Play RTDN (Pub/Sub push) ----------

  app.post("/v1/billing/google/rtdn", async (req, reply) => {
    if (!verifyPubsub) return reply.status(404).send();
    const token = bearerFrom(req.headers.authorization);
    if (!token || !(await verifyPubsub(token))) return reply.status(401).send();
    await handleRtdn(deps, req.body);
    // Acknowledge so Pub/Sub doesn't redeliver; failures are retried by
    // the next notification or the app's own verification.
    return reply.status(204).send();
  });

  // ---------- Administration ----------

  app.register(async (a) => {
    a.addHook("onRequest", requireAdmin);
    const actor = principal;

    a.get("/admin/v1/analytics", async () => admin.analytics(deps));
    a.get<{ Querystring: { q?: string; offset?: string } }>("/admin/v1/users", async (req) =>
      admin.listUsers(deps, req.query.q ?? "", 50, Number(req.query.offset ?? 0) || 0),
    );
    a.get<{ Params: { id: string } }>("/admin/v1/users/:id", async (req) => admin.userDetail(deps, z.string().uuid().parse(req.params.id)));
    a.post<{ Params: { id: string } }>("/admin/v1/users/:id/suspend", async (req, reply) => {
      const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
      await admin.suspendUser(deps, actor(req), z.string().uuid().parse(req.params.id), reason);
      return reply.status(204).send();
    });
    a.post<{ Params: { id: string } }>("/admin/v1/users/:id/unsuspend", async (req, reply) => {
      await admin.unsuspendUser(deps, actor(req), z.string().uuid().parse(req.params.id));
      return reply.status(204).send();
    });
    a.delete<{ Params: { id: string } }>("/admin/v1/devices/:id", async (req, reply) => {
      await admin.revokeDevice(deps, actor(req), z.string().uuid().parse(req.params.id));
      return reply.status(204).send();
    });

    a.get("/admin/v1/servers", async () => admin.listServersAdmin(deps));
    a.post("/admin/v1/servers", async (req, reply) => reply.status(201).send(await admin.createServer(deps, actor(req), admin.ServerInput.parse(req.body))));
    a.patch<{ Params: { id: string } }>("/admin/v1/servers/:id", async (req) =>
      admin.updateServer(deps, actor(req), req.params.id, admin.ServerPatch.parse(req.body)),
    );
    a.delete<{ Params: { id: string } }>("/admin/v1/servers/:id", async (req, reply) => {
      await admin.deleteServer(deps, actor(req), req.params.id);
      return reply.status(204).send();
    });
    a.post<{ Params: { id: string } }>("/admin/v1/servers/:id/reconcile", async (req) => admin.reconcileServer(deps, actor(req), req.params.id));

    a.get("/admin/v1/plans", async () => getPlans(deps.db));
    a.patch("/admin/v1/plans", async (req) => admin.updatePlans(deps, actor(req), admin.PlanPatch.parse(req.body)));
    a.get("/admin/v1/audit", async () => admin.auditLog(deps));
  });

  return app;
}
