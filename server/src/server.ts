import { createGeminiClient, createSummarizer, unconfiguredClient } from "./ai/summarizer";
import { createApp } from "./app";
import { createDb } from "./db";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// Without a Gemini key the app still runs; summary requests are stored as "error".
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.warn("GEMINI_API_KEY is not set: AI summaries are disabled.");
}
const summarizer = createSummarizer({
  client: geminiApiKey ? createGeminiClient({ apiKey: geminiApiKey }) : unconfiguredClient,
});

const port = Number(process.env.PORT ?? 3000);

createApp({ db: createDb(databaseUrl), summarizer }).listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
