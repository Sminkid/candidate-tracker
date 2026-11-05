import { createGeminiClient, createSummarizer, unconfiguredClient } from "./ai/summarizer";
import { createApp } from "./app";
import { createDb } from "./db";

// Builds the app with the real Neon database and Gemini client from env vars.
// Shared by server.ts (local: listens on a port) and index.ts (Vercel: default export).
export function createProductionApp() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  // Without a Gemini key the app still runs; summary requests are stored as "error".
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn("GEMINI_API_KEY is not set: AI summaries are disabled.");
  }
  const summarizer = createSummarizer({
    client: geminiApiKey ? createGeminiClient({ apiKey: geminiApiKey }) : unconfiguredClient,
  });

  return createApp({ db: createDb(databaseUrl), summarizer });
}
