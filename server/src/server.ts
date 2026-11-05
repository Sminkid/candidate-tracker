import { createProductionApp } from "./productionApp";

// Local entry point (npm run dev / start). On Vercel, index.ts is used instead.
let app;
try {
  app = createProductionApp();
} catch (err) {
  console.error(err instanceof Error ? err.message : "Could not start the server.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
