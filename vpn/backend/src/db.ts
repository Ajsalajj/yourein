import pg from "pg";

/** The small slice of SQL access the services need. */
export interface Queryable {
  query<T extends object = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Db extends Queryable {
  /** Runs [fn] in a transaction; rolls back if it throws. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function postgresDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  // Timestamps/numerics come back as JS values; bigint counters as strings
  // are converted where read.
  return {
    query: (sql, params) => pool.query(sql, params as unknown[]) as never,
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const out = await fn({ query: (sql, params) => client.query(sql, params as unknown[]) as never });
        await client.query("commit");
        return out;
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** Embedded Postgres (WASM) for local development and tests. */
export async function pgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) (await import("node:fs")).mkdirSync(dataDir, { recursive: true });
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  // PGlite runs one statement stream; serialise transactions.
  let chain: Promise<unknown> = Promise.resolve();
  return {
    query: (sql, params) => db.query(sql, params as unknown[]) as never,
    tx(fn) {
      const run = chain.then(() => db.transaction((t) => fn({ query: (sql, params) => t.query(sql, params as unknown[]) as never })));
      chain = run.catch(() => {});
      return run;
    },
    close: () => db.close(),
  };
}
