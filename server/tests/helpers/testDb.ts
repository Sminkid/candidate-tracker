import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../../src/db/schema";
import type { Database } from "../../src/db";

const migrationsFolder = fileURLToPath(new URL("../../src/db/migrations", import.meta.url));

// The PGlite-specific type, so raw queries in this helper have typed results.
// It is still a Database, so it can be passed straight to services (checked below).
export type TestDb = PgliteDatabase<typeof schema>;

// An in-memory Postgres built from the same migration files we apply to Neon.
// Starting one is slow (~0.7s), so each test file creates one and calls
// resetTestDb before each test instead of creating a new one per test.
export async function createTestDb(): Promise<TestDb> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder });
  return db;
}

// Empties every table in the public schema. It reads the table list from
// Postgres rather than hardcoding it, so tables added later are cleared too.
// (Drizzle's own migration log lives in a separate "drizzle" schema, so it is kept.)
export async function resetTestDb(db: TestDb): Promise<void> {
  const result = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const tableNames = result.rows.map((row) => `"${row.tablename}"`);
  if (tableNames.length === 0) return;

  await db.execute(sql.raw(`truncate table ${tableNames.join(", ")} cascade`));
}

// Compile-time check: a test database must be usable wherever the app expects a Database.
// If this line ever errors, services could no longer be tested against PGlite.
const _testDbIsADatabase: (db: TestDb) => Database = (db) => db;
