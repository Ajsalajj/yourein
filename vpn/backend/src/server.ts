import { buildApp } from "./app.js";
import { supabaseVerifier } from "./auth.js";
import { describeConfig, loadConfig } from "./config.js";
import { Sealer } from "./crypto.js";
import { pgliteDb, postgresDb } from "./db.js";
import { HttpGatewayClient } from "./gateway.js";
import { GooglePlayApi, pubsubPushVerifier } from "./google.js";
import { migrate } from "./migrate.js";
import { supabaseUserDeleter, type Deps } from "./services/context.js";
import { Monitor } from "./services/monitor.js";

const config = loadConfig();
const db = config.DATABASE_URL ? postgresDb(config.DATABASE_URL) : await pgliteDb(".data/pglite");
await migrate(db);

const sealer = new Sealer(config.SECRETS_KEY);
const log = {
  info: (o: object, m?: string) => console.log(JSON.stringify({ level: "info", msg: m, ...o })),
  warn: (o: object, m?: string) => console.warn(JSON.stringify({ level: "warn", msg: m, ...o })),
  error: (o: object, m?: string) => console.error(JSON.stringify({ level: "error", msg: m, ...o })),
};

const deps: Deps = {
  db,
  config,
  sealer,
  gateways: new HttpGatewayClient(sealer),
  play: config.PLAY_SERVICE_ACCOUNT_JSON ? new GooglePlayApi(config.PLAY_SERVICE_ACCOUNT_JSON, config.PLAY_PACKAGE_NAME) : null,
  deleteAuthUser: config.SUPABASE_SERVICE_ROLE_KEY ? supabaseUserDeleter(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY) : null,
  log,
};

const app = await buildApp({
  deps,
  verify: supabaseVerifier(config),
  verifyPubsub:
    config.PLAY_RTDN_AUDIENCE && config.PLAY_RTDN_SERVICE_ACCOUNT
      ? pubsubPushVerifier(config.PLAY_RTDN_AUDIENCE, config.PLAY_RTDN_SERVICE_ACCOUNT)
      : null,
});

const monitor = new Monitor(deps);
log.info(describeConfig(config), "starting");
await app.listen({ port: config.PORT, host: config.HOST });
monitor.start(config.MONITOR_INTERVAL_S);

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    monitor.stop();
    await app.close();
    await db.close();
    process.exit(0);
  });
}
