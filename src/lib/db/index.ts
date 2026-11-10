import "server-only";
import { SCHEMA_SQL } from "./schema";
import { seedDatabase } from "./seed";

/**
 * Minimal database abstraction over PostgreSQL.
 *
 * - Production: set DATABASE_URL to any PostgreSQL database (Neon, Supabase,
 *   Vercel Postgres, RDS…). Connections are made with postgres.js.
 * - Local development: when DATABASE_URL is not set, an embedded PostgreSQL
 *   (PGlite) stores data in ./.data/pglite so the site runs with zero setup.
 *
 * All queries use positional parameters ($1, $2…) — never string concatenation.
 */
export type Db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  kind: "postgres" | "pglite" | "temporary";
};

type GlobalDb = { __varamDb?: Promise<Db> };
const g = globalThis as unknown as GlobalDb;

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      // Required for transaction-mode poolers (Neon / Supabase / PgBouncer)
      prepare: false,
      idle_timeout: 20,
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
    });
    return {
      kind: "postgres",
      async query<T>(text: string, params: unknown[] = []) {
        const rows = await sql.unsafe(text, params as never[]);
        return rows as unknown as T[];
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const path = await import("node:path");
  const fs = await import("node:fs/promises");

  // Serverless hosting without DATABASE_URL: fall back to a temporary embedded
  // database in /tmp so the storefront still works. It is re-seeded on each
  // cold start, so admin edits do NOT persist — connect PostgreSQL for that.
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (serverless) {
    console.warn("[db] DATABASE_URL is not set — using a temporary database. Admin changes will not be saved permanently.");
  }
  const defaultDir = serverless ? "/tmp/varam-pglite" : path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "pglite");
  const dir = process.env.PGLITE_DIR || defaultDir;
  await fs.mkdir(path.dirname(dir), { recursive: true });
  const pg = new PGlite(dir);
  await pg.waitReady;
  return {
    kind: serverless ? "temporary" : "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query(text, params);
      return res.rows as T[];
    },
  };
}

async function init(): Promise<Db> {
  const db = await connect();
  for (const statement of SCHEMA_SQL) {
    await db.query(statement);
  }
  await seedDatabase(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__varamDb) {
    g.__varamDb = init().catch((err) => {
      g.__varamDb = undefined;
      throw err;
    });
  }
  return g.__varamDb;
}

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
  const db = await getDb();
  return db.query<T>(text, params);
}
