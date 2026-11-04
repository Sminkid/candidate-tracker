import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { createTestDb } from "./helpers/testDb";
import { unusedSummarizer } from "./helpers/fakes";

describe("GET /health", () => {
  it("responds 200 with status ok", async () => {
    const app = createApp({ db: await createTestDb(), summarizer: unusedSummarizer });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
