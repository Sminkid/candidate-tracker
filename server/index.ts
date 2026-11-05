import type { Express } from "express";
import { createProductionApp } from "./src/productionApp";

// Vercel entry point. Vercel looks for an Express app in a fixed list of files
// (app, index, server, then the same under src/) and runs the default export as
// one serverless function, so this file must not call listen().
const app: Express = createProductionApp();

export default app;
