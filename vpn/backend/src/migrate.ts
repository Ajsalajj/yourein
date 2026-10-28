import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Db } from "./db.js";

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));

/** Applies the idempotent schema. */
export async function migrate(db: Db): Promise<void> {
  const sql = await readFile(schemaPath, "utf8");
  // Statements are separated by semicolons at line ends; none contain one inside.
  for (const stmt of sql.split(/;\s*$/m).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s))) {
    await db.query(stmt);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadConfig } = await import("./config.js");
  const { postgresDb, pgliteDb } = await import("./db.js");
  const config = loadConfig();
  const db = config.DATABASE_URL ? postgresDb(config.DATABASE_URL) : await pgliteDb(".data/pglite");
  await migrate(db);
  await db.close();
  console.log("schema applied");
}
