// Uses neon-http adapter (HTTP fetch-based, pairs with neon() function from @neondatabase/serverless)
// Lazy initialization: neon() is only called when db is first accessed (not at module evaluation).
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _neon: ReturnType<typeof neon> | null = null;

export function getNeon() {
  if (!_neon) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    _neon = neon(process.env.DATABASE_URL);
  }
  return _neon;
}

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    _db = drizzle(getNeon(), { schema });
  }
  return _db;
}

// Convenience proxy so existing code using `db.select()` etc. continues to work
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export * from "./schema";
