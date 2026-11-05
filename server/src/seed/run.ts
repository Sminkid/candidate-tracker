import { createDb } from "../db";
import { describeErrorSafely } from "../routes/http";
import { seedDatabase } from "./seed";

// `npm run db:seed`: adds the demo candidates to the database in DATABASE_URL.
// Run `npm run db:migrate` first. Existing candidates are never changed.

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

try {
  const { added, skipped } = await seedDatabase(createDb(databaseUrl));
  console.log(`Seed finished: ${added} added, ${skipped} skipped (email already in the database).`);
} catch (err) {
  // Database errors can carry query parameters (whole resumes) in their message,
  // so log only the Postgres code/message, as the API's error handler does.
  console.error("Seed failed:", describeErrorSafely(err));
  process.exit(1);
}
