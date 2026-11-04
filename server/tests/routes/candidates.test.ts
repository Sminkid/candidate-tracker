import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { createTestDb, resetTestDb } from "../helpers/testDb";
import { candidateData, insertCandidate, insertNote } from "../helpers/factories";
import { seedCandidates } from "../fixtures/candidates";
import { unusedSummarizer } from "../helpers/fakes";
import type { Summarizer } from "../../src/ai/summarizer";

const db = await createTestDb();
// Tests that need a summary set its answer with mockResolvedValueOnce;
// otherwise asking for one fails the test.
const summarizer = vi.fn<Summarizer>();
const app = createApp({ db, summarizer });
beforeEach(async () => {
  summarizer.mockReset().mockImplementation(unusedSummarizer);
  await resetTestDb(db);
});

const validBody = {
  name: "Grace Hopper",
  email: "grace@example.com",
  role: "Backend Engineer",
  resumeText: "Invented the first compiler. Rear admiral, US Navy.",
};

// A valid email address exactly `length` characters long.
function emailOfLength(length: number) {
  const domain = "@example.com";
  return "a".repeat(length - domain.length) + domain;
}

// Every error response must use the one shape from CLAUDE.md.
function expectErrorShape(body: unknown) {
  expect(body).toEqual({ error: { message: expect.any(String) } });
}

describe("POST /api/candidates", () => {
  it("creates a candidate and returns 201", async () => {
    const res = await request(app).post("/api/candidates").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...validBody, stage: "applied", archivedAt: null });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it("cleans input: trims text, lowercases email, turns empty optional fields into null", async () => {
    const res = await request(app)
      .post("/api/candidates")
      .send({ ...validBody, name: "  Grace Hopper  ", email: " Grace@Example.COM ", phone: "  ", source: "" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Grace Hopper",
      email: "grace@example.com",
      phone: null,
      source: null,
    });
  });

  it("ignores fields the client may not set, like stage", async () => {
    const res = await request(app)
      .post("/api/candidates")
      .send({ ...validBody, stage: "offer", archivedAt: "2026-01-01" });

    expect(res.status).toBe(201);
    expect(res.body.stage).toBe("applied");
    expect(res.body.archivedAt).toBeNull();
  });

  it("stores phone numbers as typed (only trimmed), keeping their formatting", async () => {
    const res = await request(app)
      .post("/api/candidates")
      .send({ ...validBody, phone: "  +353 (0)87 123 4567  " });

    expect(res.status).toBe(201);
    expect(res.body.phone).toBe("+353 (0)87 123 4567");
  });

  it("allows a phone number with 15 digits, however it is formatted", async () => {
    const phone = "+1 (234) 567-8901-2345"; // 22 characters, 15 digits
    const res = await request(app).post("/api/candidates").send({ ...validBody, phone });

    expect(res.status).toBe(201);
    expect(res.body.phone).toBe(phone);
  });

  it("explains a phone number with too many digits", async () => {
    const res = await request(app)
      .post("/api/candidates")
      .send({ ...validBody, phone: "+1 (234) 567-8901-23456" }); // 16 digits

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("phone: must have at most 15 digits");
  });

  it("allows a 100-character email", async () => {
    const email = emailOfLength(100);
    const res = await request(app).post("/api/candidates").send({ ...validBody, email });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
  });

  const invalidBodies: Array<[string, Record<string, unknown>, string]> = [
    ["name is missing", { ...validBody, name: undefined }, "name"],
    ["name is blank", { ...validBody, name: "   " }, "name"],
    ["email is not an email", { ...validBody, email: "banana" }, "email"],
    ["email is too long", { ...validBody, email: emailOfLength(101) }, "email"],
    // 15 digits but 31 characters: the overall cap stops pasted paragraphs.
    ["phone is too long overall", { ...validBody, phone: "1-2-3-4-5-6-7-8-9-0-1-2-3-4-5--" }, "phone"],
    ["role is missing", { ...validBody, role: undefined }, "role"],
    ["resumeText is not text", { ...validBody, resumeText: 42 }, "resumeText"],
    ["name is too long", { ...validBody, name: "x".repeat(201) }, "name"],
  ];

  it.each(invalidBodies)("returns 400 when %s", async (_label, body, field) => {
    const res = await request(app).post("/api/candidates").send(body);

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
    expect(res.body.error.message).toContain(field);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/candidates")
      .set("Content-Type", "application/json")
      .send('{"name": "Grace",');

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
  });

  it("returns 400 when there is no body at all", async () => {
    const res = await request(app).post("/api/candidates");

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
  });
});

describe("GET /api/candidates", () => {
  it("lists active candidates, newest first, with dates as ISO strings", async () => {
    await seedCandidates(db);

    const res = await request(app).get("/api/candidates");

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(1);
    expect(res.body.every((c: { archivedAt: unknown }) => c.archivedAt === null)).toBe(true);
    const dates: string[] = res.body.map((c: { createdAt: string }) => c.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("passes stage, role, sort and includeArchived through to the service", async () => {
    await seedCandidates(db);

    const res = await request(app).get("/api/candidates").query({
      stage: "applied",
      role: "Backend Engineer",
      sort: "stage",
      includeArchived: "true",
    });

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(
      res.body.every(
        (c: { stage: string; role: string }) => c.stage === "applied" && c.role === "Backend Engineer",
      ),
    ).toBe(true);
    expect(res.body.some((c: { archivedAt: unknown }) => c.archivedAt !== null)).toBe(true);
  });

  it.each([
    ["an unknown stage", { stage: "hired" }],
    ["an unknown sort", { sort: "name" }],
    ["a non-boolean includeArchived", { includeArchived: "yes" }],
  ])("returns 400 for %s", async (_label, query) => {
    const res = await request(app).get("/api/candidates").query(query);

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
  });
});

describe("GET /api/candidates/:id", () => {
  it("returns the candidate with notes", async () => {
    const candidate = await insertCandidate(db);
    await insertNote(db, candidate.id, { body: "Lovely chat" });

    const res = await request(app).get(`/api/candidates/${candidate.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(candidate.id);
    expect(res.body.notes).toEqual([expect.objectContaining({ body: "Lovely chat" })]);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request(app).get(`/api/candidates/${randomUUID()}`);

    expect(res.status).toBe(404);
    expectErrorShape(res.body);
  });

  it("returns 400 for an id that is not a UUID", async () => {
    const res = await request(app).get("/api/candidates/not-a-uuid");

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
  });
});

describe("PATCH /api/candidates/:id/stage", () => {
  it("moves the candidate to the new stage", async () => {
    const candidate = await insertCandidate(db);

    const res = await request(app)
      .patch(`/api/candidates/${candidate.id}/stage`)
      .send({ stage: "interview" });

    expect(res.status).toBe(200);
    expect(res.body.stage).toBe("interview");
  });

  it("returns 400 for a stage that does not exist", async () => {
    const candidate = await insertCandidate(db);

    const res = await request(app)
      .patch(`/api/candidates/${candidate.id}/stage`)
      .send({ stage: "hired" });

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
    expect(res.body.error.message).toContain("stage");
  });

  it("returns 404 for an unknown candidate", async () => {
    const res = await request(app)
      .patch(`/api/candidates/${randomUUID()}/stage`)
      .send({ stage: "offer" });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/candidates/:id/archive", () => {
  it("archives the candidate so they leave the default list", async () => {
    const candidate = await insertCandidate(db);

    const res = await request(app).post(`/api/candidates/${candidate.id}/archive`);
    const list = await request(app).get("/api/candidates");

    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toEqual(expect.any(String));
    expect(list.body).toEqual([]);
  });

  it("returns 404 for an unknown candidate", async () => {
    const res = await request(app).post(`/api/candidates/${randomUUID()}/archive`);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/candidates/:id/notes", () => {
  it("adds a trimmed note and returns 201", async () => {
    const candidate = await insertCandidate(db);

    const res = await request(app)
      .post(`/api/candidates/${candidate.id}/notes`)
      .send({ body: "  Strong references  " });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ candidateId: candidate.id, body: "Strong references" });
  });

  it("returns 400 for a blank note", async () => {
    const candidate = await insertCandidate(db);

    const res = await request(app).post(`/api/candidates/${candidate.id}/notes`).send({ body: " " });

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
  });

  it("returns 404 for an unknown candidate", async () => {
    const res = await request(app)
      .post(`/api/candidates/${randomUUID()}/notes`)
      .send({ body: "Hello" });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/candidates/:id/summary", () => {
  it("generates, stores and returns the summary", async () => {
    const candidate = await insertCandidate(db, { resumeText: "Built compilers for 30 years." });
    summarizer.mockResolvedValueOnce({ status: "ok", skills: ["Compilers"], highlights: ["Wrote A-0."] });

    const res = await request(app).post(`/api/candidates/${candidate.id}/summary`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: candidate.id,
      summary: { skills: ["Compilers"], highlights: ["Wrote A-0."] },
      summaryStatus: "ok",
      summaryReason: null,
    });
    expect(summarizer).toHaveBeenCalledWith("Built compilers for 30 years.");

    const reloaded = await request(app).get(`/api/candidates/${candidate.id}`);
    expect(reloaded.body.summary).toEqual(res.body.summary);
  });

  it("responds normally when the AI fails, and the app keeps working", async () => {
    const candidate = await insertCandidate(db);
    summarizer.mockResolvedValueOnce({ status: "error", reason: "The AI service timed out" });

    const res = await request(app).post(`/api/candidates/${candidate.id}/summary`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      summary: null,
      summaryStatus: "error",
      summaryReason: "The AI service timed out",
    });
    const list = await request(app).get("/api/candidates");
    expect(list.status).toBe(200);
  });

  it("returns 404 for an unknown candidate", async () => {
    const res = await request(app).post(`/api/candidates/${randomUUID()}/summary`);

    expect(res.status).toBe(404);
    expectErrorShape(res.body);
    expect(summarizer).not.toHaveBeenCalled();
  });

  it("returns 400 for an id that is not a UUID", async () => {
    const res = await request(app).post("/api/candidates/not-a-uuid/summary");

    expect(res.status).toBe(400);
    expectErrorShape(res.body);
  });
});

describe("routes that must not exist", () => {
  it.each(["put", "patch", "delete"] as const)(
    "notes are append-only: %s on a note returns 404",
    async (method) => {
      const candidate = await insertCandidate(db);
      const note = await insertNote(db, candidate.id);

      const res = await request(app)[method](`/api/candidates/${candidate.id}/notes/${note.id}`);

      expect(res.status).toBe(404);
      expectErrorShape(res.body);
    },
  );

  it("candidates cannot be hard-deleted", async () => {
    const candidate = await insertCandidate(db, candidateData());

    const res = await request(app).delete(`/api/candidates/${candidate.id}`);

    expect(res.status).toBe(404);
  });
});

describe("unexpected errors", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a generic 500 and never logs resume text", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // A database whose connection is closed: every query fails with a real driver error,
    // and Drizzle puts the query parameters (including the resume) in its error message.
    const brokenDb = await createTestDb();
    await (brokenDb as unknown as { $client: { close(): Promise<void> } }).$client.close();
    const brokenApp = createApp({ db: brokenDb, summarizer: unusedSummarizer });
    const secretResume = "SECRET-RESUME-TEXT confidential career history";

    const res = await request(brokenApp)
      .post("/api/candidates")
      .send({ ...validBody, resumeText: secretResume });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: "Internal server error" } });
    expect(consoleError).toHaveBeenCalled();
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain("SECRET-RESUME-TEXT");
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nope");

    expect(res.status).toBe(404);
    expectErrorShape(res.body);
  });
});
