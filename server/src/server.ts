import { createApp } from "./app";
import { createDb } from "./db";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);

createApp({ db: createDb(databaseUrl) }).listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
