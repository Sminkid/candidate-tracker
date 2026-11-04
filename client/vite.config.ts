import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    // In development the browser calls /api on the Vite server, which forwards
    // to Express. Same origin, so the API needs no CORS setup for local work.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
  },
});
