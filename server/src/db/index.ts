import { neon } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Any Postgres-backed Drizzle instance with our schema: Neon in production,
// PGlite in tests. Services accept this type so they never care which one it is.
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDb(databaseUrl: string): Database {
  return drizzle(neon(databaseUrl), { schema });
}

export { schema };
