import express from "express";
import type { Database } from "./db";
import { createCandidatesRouter } from "./routes/candidates";
import { errorHandler, notFoundHandler } from "./routes/http";

export type AppDependencies = {
  db: Database;
};

// Builds the app without starting it, so tests can pass in a PGlite database
// and call it with Supertest. server.ts passes the real Neon database.
export function createApp({ db }: AppDependencies) {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/candidates", createCandidatesRouter(db));

  // Order matters: these run only if no route above sent a response.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
