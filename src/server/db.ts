/**
 * Database access.
 *
 * Production: set DATABASE_URL to any PostgreSQL database (Neon, Supabase, Vercel Postgres, RDS).
 * Local development: with no DATABASE_URL, an embedded PostgreSQL (PGlite) stores data in ./.data,
 * so `npm run dev` works with nothing to install.
 */
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TEMPLATES } from "@/data/templates";
import { CURRENCY, PRICE } from "@/config/site";
import { SCHEMA_SQL } from "./schema";

export type Row = Record<string, unknown>;
type Query = (text: string, params?: unknown[]) => Promise<Row[]>;
type Driver = { query: Query; tx: <T>(fn: (q: Query) => Promise<T>) => Promise<T>; kind: "postgres" | "embedded" };

declare global {
  var __yourein_db: Promise<Driver> | undefined;
}

async function open(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  let driver: Driver;
  let exec: (sql: string) => Promise<unknown>;

  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    exec = (s) => pool.query(s);
    driver = {
      kind: "postgres",
      query: async (text, params) => (await pool.query(text, params as unknown[])).rows,
      tx: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const out = await fn(async (text, params) => (await client.query(text, params as unknown[])).rows);
          await client.query("commit");
          return out;
        } catch (e) {
          await client.query("rollback").catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const hosted = !!process.env.VERCEL;
    const dir = process.env.YOUREIN_DATA_DIR || (hosted ? path.join(os.tmpdir(), "yourein-db") : path.join(process.cwd(), ".data", "db"));
    if (hosted) console.warn("[yourein] DATABASE_URL is not set. Using a temporary database that will not keep data. Set DATABASE_URL before taking real customers.");
    mkdirSync(dir, { recursive: true });
    const db = new PGlite(dir);
    exec = (s) => db.exec(s);
    driver = {
      kind: "embedded",
      query: async (text, params) => (await db.query(text, params as unknown[])).rows as Row[],
      tx: (fn) => db.transaction((t) => fn(async (text, params) => (await t.query(text, params as unknown[])).rows as Row[])) as Promise<never>,
    };
  }

  await exec(SCHEMA_SQL);
  /* the template list lives in code; mirror it so orders and invitations can reference it */
  for (const t of TEMPLATES) {
    await driver.query(
      "insert into templates (slug, name, category, price, currency) values ($1, $2, $3, $4, $5) on conflict (slug) do update set name = excluded.name, category = excluded.category, price = excluded.price, currency = excluded.currency",
      [t.slug, t.name, t.category, PRICE * 100, CURRENCY],
    );
  }
  return driver;
}

function db(): Promise<Driver> {
  if (!globalThis.__yourein_db) {
    globalThis.__yourein_db = open().catch((e) => {
      globalThis.__yourein_db = undefined;
      throw e;
    });
  }
  return globalThis.__yourein_db;
}

function build(strings: TemplateStringsArray, values: unknown[]) {
  return strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), "");
}

export type Sql = <T = Row>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;

/** Tagged-template query: values become bound parameters, never string-concatenated SQL. */
export const sql: Sql = async <T = Row>(strings: TemplateStringsArray, ...values: unknown[]) =>
  (await (await db()).query(build(strings, values), values)) as T[];

/**
 * For queries whose shape depends on filters (the admin lists). `text` must contain only $1, $2... placeholders;
 * every value goes in `params` and is bound, never concatenated into the SQL.
 */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await db()).query(text, params)) as T[];
}

/** Run several statements atomically. */
export async function transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const d = await db();
  return d.tx((q) => fn((async (strings: TemplateStringsArray, ...values: unknown[]) => q(build(strings, values), values)) as Sql));
}

export async function databaseKind() {
  return (await db()).kind;
}
