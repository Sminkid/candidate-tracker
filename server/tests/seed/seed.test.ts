import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, resetTestDb } from "../helpers/testDb";
import { insertCandidate, insertNote } from "../helpers/factories";
import { stages, type Candidate } from "../../src/db/schema";
import { addNoteBody, createCandidateBody } from "../../src/routes/candidateSchemas";
import { getCandidate, listCandidates } from "../../src/services/candidateService";
import { preflight } from "../../src/ai/summarizer/preflight";
import { seedDatabase } from "../../src/seed/seed";
import { seedCandidates, type SeedCandidate } from "../../src/seed/seedData";

const db = await createTestDb();
beforeEach(() => resetTestDb(db));

const allCandidates = () => listCandidates(db, { includeArchived: true });
const normalisedEmail = (entry: SeedCandidate) => entry.input.email.trim().toLowerCase();
const seedEntryNamed = (name: string) => {
  const entry = seedCandidates.find((candidate) => candidate.input.name === name);
  if (!entry) throw new Error(`No seed entry named ${name}`);
  return entry;
};
const sorted = (values: string[]) => [...values].sort();

async function countNotes(rows: Candidate[]): Promise<number> {
  const details = await Promise.all(rows.map((row) => getCandidate(db, row.id)));
  return details.reduce((total, detail) => total + detail.notes.length, 0);
}

// Guards on the data itself: keep the demo covering every feature.
describe("seed data", () => {
  it("passes the same Zod schemas the API uses", () => {
    for (const entry of seedCandidates) {
      expect(createCandidateBody.safeParse(entry.input).success, entry.input.name).toBe(true);
      for (const body of entry.notes ?? []) {
        expect(addNoteBody.safeParse({ body }).success, `${entry.input.name}: ${body}`).toBe(true);
      }
    }
  });

  it("has no two candidates with the same email (case-insensitive)", () => {
    const emails = seedCandidates.map(normalisedEmail);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("covers every stage, archived and active candidates, and a repeated role", () => {
    const seededStages = new Set(seedCandidates.map((entry) => entry.stage ?? "applied"));
    expect([...seededStages].sort()).toEqual([...stages].sort());

    expect(seedCandidates.some((entry) => entry.archived)).toBe(true);
    expect(seedCandidates.some((entry) => !entry.archived)).toBe(true);

    const roles = seedCandidates.map((entry) => entry.input.role);
    expect(new Set(roles).size).toBeLessThan(roles.length);
  });

  it("includes a garbled and a too-short resume that preflight rejects", () => {
    expect(preflight(seedEntryNamed("Ciarán Byrne").input.resumeText)).toEqual({
      ok: false,
      reason: "Resume text is mostly symbols or numbers, not readable text",
    });
    expect(preflight(seedEntryNamed("Rory Doyle").input.resumeText)).toEqual({
      ok: false,
      reason: "Resume text is too short to summarize",
    });
  });

  it("includes a prompt-injection resume that passes preflight, so it reaches the model", () => {
    const resume = seedEntryNamed("Morgan Lee").input.resumeText;
    expect(resume).toContain("Ignore all previous instructions");
    expect(preflight(resume).ok).toBe(true);
  });
});

describe("seedDatabase", () => {
  it("adds every seed candidate to an empty database", async () => {
    const result = await seedDatabase(db);

    expect(result).toEqual({ added: seedCandidates.length, skipped: 0 });
    expect(await allCandidates()).toHaveLength(seedCandidates.length);
  });

  it("stores each candidate with its stage, archive state and notes, cleaned like the API", async () => {
    await seedDatabase(db);
    const byEmail = new Map((await allCandidates()).map((row) => [row.email, row]));

    for (const entry of seedCandidates) {
      const stored = byEmail.get(normalisedEmail(entry));
      expect(stored, entry.input.name).toBeDefined();
      if (!stored) continue;

      expect(stored.stage).toBe(entry.stage ?? "applied");
      expect(stored.archivedAt !== null).toBe(entry.archived ?? false);

      // Notes can share a createdAt in PGlite, so compare as sets (order is tested in the service).
      const { notes } = await getCandidate(db, stored.id);
      expect(sorted(notes.map((note) => note.body))).toEqual(sorted(entry.notes ?? []));
    }
  });

  it("never generates summaries (the demo clicks Generate live)", async () => {
    await seedDatabase(db);

    for (const row of await allCandidates()) {
      expect(row.summary).toBeNull();
      expect(row.summaryStatus).toBeNull();
      expect(row.summaryReason).toBeNull();
    }
  });

  it("adds nothing when run a second time", async () => {
    await seedDatabase(db);
    const before = await allCandidates();
    const notesBefore = await countNotes(before);

    const result = await seedDatabase(db);

    expect(result).toEqual({ added: 0, skipped: seedCandidates.length });
    const after = await allCandidates();
    expect(after).toHaveLength(before.length);
    expect(await countNotes(after)).toBe(notesBefore);
  });

  it("leaves an existing candidate with the same email untouched (case-insensitive)", async () => {
    const entry = seedCandidates[0];
    const existing = await insertCandidate(db, {
      name: "Entered by hand",
      email: normalisedEmail(entry).toUpperCase(),
      stage: "offer",
    });
    await insertNote(db, existing.id, { body: "My own note" });

    const result = await seedDatabase(db);

    expect(result).toEqual({ added: seedCandidates.length - 1, skipped: 1 });
    const kept = await getCandidate(db, existing.id);
    expect(kept.name).toBe("Entered by hand");
    expect(kept.stage).toBe("offer");
    expect(kept.notes.map((note) => note.body)).toEqual(["My own note"]);
    expect(await allCandidates()).toHaveLength(seedCandidates.length);
  });

  it("keeps candidates that are not in the seed data", async () => {
    const mine = await insertCandidate(db, { email: "someone.else@example.com" });

    await seedDatabase(db);

    expect((await allCandidates()).map((row) => row.id)).toContain(mine.id);
  });

  it("writes nothing if any entry is invalid, and says which entry and field", async () => {
    const data: SeedCandidate[] = [
      seedCandidates[0],
      { input: { ...seedCandidates[1].input, email: "not-an-email" } },
    ];

    await expect(seedDatabase(db, data)).rejects.toThrow(
      `Seed entry 2 (${seedCandidates[1].input.name}): input.email: must be a valid email address`,
    );
    expect(await allCandidates()).toEqual([]);
  });

  it("rejects a blank note before writing anything", async () => {
    const data: SeedCandidate[] = [{ ...seedCandidates[0], notes: ["   "] }];

    await expect(seedDatabase(db, data)).rejects.toThrow(
      `Seed entry 1 (${seedCandidates[0].input.name}): notes.0: is required`,
    );
    expect(await allCandidates()).toEqual([]);
  });
});
