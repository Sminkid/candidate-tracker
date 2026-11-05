import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, resetTestDb } from "../helpers/testDb";
import { candidateData, insertCandidate } from "../helpers/factories";
import { fixtureCandidates, seedCandidates } from "../fixtures/candidates";
import { stages, type Candidate, type Stage } from "../../src/db/schema";
import {
  addNote,
  archiveCandidate,
  createCandidate,
  generateSummary,
  getCandidate,
  listCandidates,
  moveStage,
} from "../../src/services/candidateService";
import { NotFoundError } from "../../src/services/errors";
import type { Summarizer, SummaryResult } from "../../src/ai/summarizer";

const db = await createTestDb();
beforeEach(() => resetTestDb(db));

const stageOrder = (stage: Stage) => stages.indexOf(stage);

describe("createCandidate", () => {
  it("stores the candidate and starts them in the applied stage", async () => {
    const created = await createCandidate(db, candidateData({ name: "Grace Hopper" }));

    expect(created.name).toBe("Grace Hopper");
    expect(created.stage).toBe("applied");
    expect(created.archivedAt).toBeNull();

    const stored = await getCandidate(db, created.id);
    expect(stored.name).toBe("Grace Hopper");
  });
});

describe("getCandidate", () => {
  it("returns the candidate with their notes, oldest first", async () => {
    const candidate = await insertCandidate(db);
    await addNote(db, candidate.id, "Phone screen booked");
    await addNote(db, candidate.id, "Strong on SQL");

    const result = await getCandidate(db, candidate.id);

    expect(result.id).toBe(candidate.id);
    expect(result.notes.map((n) => n.body)).toEqual(["Phone screen booked", "Strong on SQL"]);
  });

  it("still returns an archived candidate, so their record stays viewable", async () => {
    const candidate = await insertCandidate(db);
    await archiveCandidate(db, candidate.id);

    const result = await getCandidate(db, candidate.id);

    expect(result.archivedAt).toBeInstanceOf(Date);
  });

  it("throws NotFoundError for an unknown id", async () => {
    await expect(getCandidate(db, randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listCandidates (realistic fixture)", () => {
  it("excludes archived candidates by default", async () => {
    await seedCandidates(db);

    const result = await listCandidates(db);

    const activeInFixture = fixtureCandidates.filter((c) => !c.archivedAt).length;
    expect(result).toHaveLength(activeInFixture);
    expect(result.every((c) => c.archivedAt === null)).toBe(true);
  });

  it("includes archived candidates when asked", async () => {
    await seedCandidates(db);

    const result = await listCandidates(db, { includeArchived: true });

    expect(result).toHaveLength(fixtureCandidates.length);
  });

  it.each(stages)("filters by stage: %s", async (stage) => {
    await seedCandidates(db);

    const result = await listCandidates(db, { stage, includeArchived: true });

    const expected = fixtureCandidates.filter((c) => c.stage === stage).length;
    expect(result).toHaveLength(expected);
    expect(result.every((c) => c.stage === stage)).toBe(true);
  });

  it("filters by role", async () => {
    await seedCandidates(db);

    const result = await listCandidates(db, { role: "Backend Engineer" });

    const expected = fixtureCandidates.filter(
      (c) => c.role === "Backend Engineer" && !c.archivedAt,
    ).length;
    expect(result).toHaveLength(expected);
    expect(result.every((c) => c.role === "Backend Engineer")).toBe(true);
  });

  it("combines stage and role filters", async () => {
    await seedCandidates(db);

    const result = await listCandidates(db, { stage: "interview", role: "Backend Engineer" });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((c) => c.stage === "interview" && c.role === "Backend Engineer")).toBe(true);
  });

  it("sorts newest first by default", async () => {
    await seedCandidates(db);

    const result = await listCandidates(db, { includeArchived: true });

    expectEachPair(result, (a, b) => a.createdAt.getTime() >= b.createdAt.getTime());
  });

  it("sorts by pipeline stage (applied → rejected), newest first within a stage", async () => {
    await seedCandidates(db);

    const result = await listCandidates(db, { sort: "stage", includeArchived: true });

    expectEachPair(result, (a, b) => {
      if (a.stage !== b.stage) return stageOrder(a.stage) < stageOrder(b.stage);
      return a.createdAt.getTime() >= b.createdAt.getTime();
    });
  });
});

describe("listCandidates (exact cases)", () => {
  it("returns an empty list when there are no candidates", async () => {
    expect(await listCandidates(db)).toEqual([]);
  });

  it("gives opposite orders for the two sorts when date and stage disagree", async () => {
    const olderApplied = await insertCandidate(db, {
      stage: "applied",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const newerOffer = await insertCandidate(db, {
      stage: "offer",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });

    const byDate = await listCandidates(db, { sort: "createdAt" });
    const byStage = await listCandidates(db, { sort: "stage" });

    expect(byDate.map((c) => c.id)).toEqual([newerOffer.id, olderApplied.id]);
    expect(byStage.map((c) => c.id)).toEqual([olderApplied.id, newerOffer.id]);
  });

  it("matches role exactly, not as a partial match", async () => {
    await insertCandidate(db, { role: "Backend Engineer" });
    await insertCandidate(db, { role: "Senior Backend Engineer" });

    const result = await listCandidates(db, { role: "Backend Engineer" });

    expect(result.map((c) => c.role)).toEqual(["Backend Engineer"]);
  });
});

describe("moveStage", () => {
  // Stage moves are free transitions: any stage can move to any other,
  // including backwards (e.g. reopening a rejected candidate).
  const moves: Array<[Stage, Stage]> = [
    ["applied", "interview"],
    ["interview", "screening"],
    ["rejected", "applied"],
    ["offer", "rejected"],
  ];

  it.each(moves)("moves %s → %s", async (from, to) => {
    const candidate = await insertCandidate(db, { stage: from });

    const moved = await moveStage(db, candidate.id, to);

    expect(moved.stage).toBe(to);
    expect((await getCandidate(db, candidate.id)).stage).toBe(to);
  });

  it("changes only the stage", async () => {
    const candidate = await insertCandidate(db, { phone: "+44 7700 900123" });

    const moved = await moveStage(db, candidate.id, "offer");

    expect({ ...moved, stage: candidate.stage }).toEqual(candidate);
  });

  it("throws NotFoundError for an unknown id", async () => {
    await expect(moveStage(db, randomUUID(), "offer")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("archiveCandidate", () => {
  it("sets archivedAt and removes the candidate from the default list", async () => {
    const kept = await insertCandidate(db, { name: "Kept" });
    const archived = await insertCandidate(db, { name: "Archived" });

    const result = await archiveCandidate(db, archived.id);

    expect(result.archivedAt).toBeInstanceOf(Date);
    expect((await listCandidates(db)).map((c) => c.id)).toEqual([kept.id]);
  });

  it("is safe to repeat: archiving twice keeps the original archive time", async () => {
    const candidate = await insertCandidate(db);

    const first = await archiveCandidate(db, candidate.id);
    const second = await archiveCandidate(db, candidate.id);

    expect(second.archivedAt).toEqual(first.archivedAt);
  });

  it("throws NotFoundError for an unknown id", async () => {
    await expect(archiveCandidate(db, randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("addNote", () => {
  it("appends a note to the candidate", async () => {
    const candidate = await insertCandidate(db);

    const note = await addNote(db, candidate.id, "Great portfolio");

    expect(note.candidateId).toBe(candidate.id);
    expect(note.body).toBe("Great portfolio");
    expect(note.createdAt).toBeInstanceOf(Date);
  });

  it("keeps earlier notes unchanged when a new one is added (append-only)", async () => {
    const candidate = await insertCandidate(db);
    const first = await addNote(db, candidate.id, "First impression: good");

    await addNote(db, candidate.id, "Second round booked");

    const { notes } = await getCandidate(db, candidate.id);
    expect(notes).toHaveLength(2);
    // Look the note up by value, not position: both notes can share a createdAt
    // (same millisecond), and then their order is decided by random ids.
    expect(notes).toContainEqual(first);
  });

  it("throws NotFoundError for an unknown candidate instead of a database error", async () => {
    await expect(addNote(db, randomUUID(), "Orphan")).rejects.toBeInstanceOf(NotFoundError);
  });
});

// Checks a rule between every neighbouring pair in a list, e.g. "a is newer than b".
function expectEachPair(list: Candidate[], rule: (a: Candidate, b: Candidate) => boolean) {
  expect(list.length).toBeGreaterThan(1);
  for (let i = 0; i < list.length - 1; i++) {
    expect(rule(list[i], list[i + 1]), `items ${i} and ${i + 1} out of order`).toBe(true);
  }
}

describe("generateSummary", () => {
  // A fake summarizer that always gives the same result. Real AI is never called.
  const summarizerReturning = (result: SummaryResult) => vi.fn<Summarizer>(async () => result);

  const okResult: SummaryResult = {
    status: "ok",
    skills: ["COBOL", "Compilers"],
    highlights: ["Invented the first compiler."],
  };
  const existingSummary = { skills: ["Go"], highlights: ["Earlier summary."] };

  it("summarizes the candidate's resume and stores the result", async () => {
    const candidate = await insertCandidate(db, { resumeText: "Invented the first compiler." });
    const summarizer = summarizerReturning(okResult);

    const updated = await generateSummary(db, candidate.id, { summarizer });

    expect(summarizer).toHaveBeenCalledWith("Invented the first compiler.");
    expect(updated).toMatchObject({
      id: candidate.id,
      summary: { skills: ["COBOL", "Compilers"], highlights: ["Invented the first compiler."] },
      summaryStatus: "ok",
      summaryReason: null,
    });
    expect(await getCandidate(db, candidate.id)).toMatchObject({
      summary: updated.summary,
      summaryStatus: "ok",
    });
  });

  it.each<SummaryResult>([
    { status: "unsummarizable", reason: "Resume text is too short to summarize" },
    { status: "error", reason: "The AI service timed out" },
  ])("stores status $status and the reason when there is no summary yet", async (result) => {
    const candidate = await insertCandidate(db);

    const updated = await generateSummary(db, candidate.id, { summarizer: summarizerReturning(result) });

    expect(updated).toMatchObject({
      summary: null,
      summaryStatus: result.status,
      summaryReason: "reason" in result ? result.reason : null,
    });
  });

  it("keeps the previous summary when regenerating fails", async () => {
    const candidate = await insertCandidate(db, { summary: existingSummary, summaryStatus: "ok" });

    const updated = await generateSummary(db, candidate.id, {
      summarizer: summarizerReturning({ status: "error", reason: "The AI service failed" }),
    });

    expect(updated).toMatchObject({
      summary: existingSummary,
      summaryStatus: "error",
      summaryReason: "The AI service failed",
    });
  });

  it("replaces the summary and clears the old reason when regenerating succeeds", async () => {
    const candidate = await insertCandidate(db, {
      summary: existingSummary,
      summaryStatus: "error",
      summaryReason: "The AI service failed",
    });

    const updated = await generateSummary(db, candidate.id, { summarizer: summarizerReturning(okResult) });

    expect(updated).toMatchObject({
      summary: { skills: okResult.skills, highlights: okResult.highlights },
      summaryStatus: "ok",
      summaryReason: null,
    });
  });

  it("only changes the requested candidate", async () => {
    const target = await insertCandidate(db, { email: "target@example.com" });
    const other = await insertCandidate(db, { email: "other@example.com" });

    await generateSummary(db, target.id, { summarizer: summarizerReturning(okResult) });

    expect(await getCandidate(db, other.id)).toMatchObject({ summary: null, summaryStatus: null });
  });

  it("throws NotFoundError for an unknown candidate without calling the AI", async () => {
    const summarizer = summarizerReturning(okResult);

    await expect(generateSummary(db, randomUUID(), { summarizer })).rejects.toBeInstanceOf(NotFoundError);
    expect(summarizer).not.toHaveBeenCalled();
  });
});
