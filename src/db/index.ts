import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type GlobalWithDb = typeof globalThis & {
  __kkvalPool?: Pool;
  __kkvalDb?: NodePgDatabase<typeof schema>;
};

const globalForDb = globalThis as GlobalWithDb;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Check your .env file.",
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!globalForDb.__kkvalPool) {
    globalForDb.__kkvalPool = new Pool({
      connectionString: getConnectionString(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForDb.__kkvalPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.__kkvalDb) {
    globalForDb.__kkvalDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__kkvalDb;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value ?? receiver;
  },
});

export async function closeDb(): Promise<void> {
  if (globalForDb.__kkvalPool) {
    await globalForDb.__kkvalPool.end();
    globalForDb.__kkvalPool = undefined;
    globalForDb.__kkvalDb = undefined;
  }
}
