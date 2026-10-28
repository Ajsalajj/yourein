import { z } from "zod";

/**
 * All configuration comes from the environment. Secrets are read once at
 * start-up and never logged; `describeConfig` prints only which features
 * are enabled.
 */
const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8080),
  HOST: z.string().default("0.0.0.0"),

  /** Postgres connection string. Empty in development = embedded PGlite in ./.data. */
  DATABASE_URL: z.string().default(""),

  /** Supabase project URL, e.g. https://abcd.supabase.co */
  SUPABASE_URL: z.string().url(),
  /** Legacy HS256 JWT secret. If unset, tokens are verified against the project's JWKS. */
  SUPABASE_JWT_SECRET: z.string().optional(),
  /** Service role key: only used to delete auth users on account deletion. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  /** 32-byte key (base64) sealing gateway agent secrets at rest. */
  SECRETS_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, "SECRETS_KEY must be 32 bytes, base64"),

  /** Admins must have completed MFA (Supabase aal2). */
  ADMIN_REQUIRE_MFA: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  /** Comma-separated origins allowed to call /admin (the admin dashboard). */
  ADMIN_ORIGINS: z.string().default(""),

  /** Google Play: Android package and base64 service-account JSON with Android Publisher access. */
  PLAY_PACKAGE_NAME: z.string().default("app.orvane.vpn"),
  PLAY_SERVICE_ACCOUNT_JSON: z.string().optional(),
  /** Pub/Sub push audience and sender for Real-time developer notifications. */
  PLAY_RTDN_AUDIENCE: z.string().optional(),
  PLAY_RTDN_SERVICE_ACCOUNT: z.string().optional(),

  /** How often gateways are health-checked, in seconds. 0 disables. */
  MONITOR_INTERVAL_S: z.coerce.number().int().min(0).default(60),

  /** Trust X-Forwarded-For from this many proxies (for rate limiting by client IP). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production");
  }
  return parsed.data;
}

export function describeConfig(c: Config): Record<string, unknown> {
  return {
    env: c.NODE_ENV,
    database: c.DATABASE_URL ? "postgres" : "embedded (pglite)",
    jwt: c.SUPABASE_JWT_SECRET ? "HS256 secret" : "JWKS",
    accountDeletion: c.SUPABASE_SERVICE_ROLE_KEY ? "enabled" : "disabled (no service role key)",
    playBilling: c.PLAY_SERVICE_ACCOUNT_JSON ? "enabled" : "disabled",
    rtdn: c.PLAY_RTDN_AUDIENCE ? "enabled" : "disabled",
    adminMfa: c.ADMIN_REQUIRE_MFA,
  };
}
