import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, resetTestDb } from "./helpers/testDb";
import { candidateData, insertCandidate, insertNote } from "./helpers/factories";
import { seedCandidates } from "./fixtures/candidates";
import { candidates, notes, stages, type NewCandidate } from "../src/db/schema";

// One database for this file; emptied before every test.
const db = await createTestDb();
beforeEach(() => resetTestDb(db));

describe("test database (PGlite + migrations)", () => {
  it("stores a candidate and fills in the schema defaults", async () => {
    const saved = await insertCandidate(db);

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.stage).toBe("applied");
    expect(saved.archivedAt).toBeNull();
    expect(saved.summary).toBeNull();
    expect(saved.createdAt).toBeInstanceOf(Date);
  });

  const requiredFields = ["name", "email", "role", "resumeText"] as const;

  it.each(requiredFields)("rejects a candidate with no %s", async (missingField) => {
    const { [missingField]: _removed, ...incomplete } = candidateData();

    await expect(
      // The cast skips TypeScript's compile-time check on purpose: we want to
      // prove the database itself refuses the row, as a last line of defence.
      db.insert(candidates).values(incomplete as NewCandidate),
    ).rejects.toMatchObject({ cause: { code: "23502" } }); // Postgres: not_null_violation
  });

  // NOT NULL blocks a missing value, but "" or "   " is not NULL. These CHECK
  // constraints make Postgres refuse blank text in the required fields too.
  const blankValues = ["", "   ", "\t\n "];

  describe.each(requiredFields)("blank %s", (field) => {
    it.each(blankValues)("rejects %j", async (blank) => {
      await expect(insertCandidate(db, { [field]: blank })).rejects.toMatchObject({
        cause: { code: "23514" }, // Postgres: check_violation
      });
    });
  });

  it.each(blankValues)("rejects a note whose body is %j", async (blank) => {
    const candidate = await insertCandidate(db);

    await expect(insertNote(db, candidate.id, { body: blank })).rejects.toMatchObject({
      cause: { code: "23514" },
    });
  });

  it("accepts text that has surrounding spaces but real content", async () => {
    const saved = await insertCandidate(db, { name: "  Ada Lovelace  " });

    expect(saved.name).toBe("  Ada Lovelace  ");
  });

  it("allows phone and source to be left empty", async () => {
    const saved = await insertCandidate(db, { phone: null, source: null });

    expect(saved.phone).toBeNull();
    expect(saved.source).toBeNull();
  });

  it("rejects a note that points at a candidate that does not exist", async () => {
    await expect(
      insertNote(db, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toMatchObject({ cause: { code: "23503" } }); // Postgres: foreign_key_violation
  });

  it("resetTestDb empties every table, so tests cannot see each other's data", async () => {
    const candidate = await insertCandidate(db);
    await insertNote(db, candidate.id);

    await resetTestDb(db);

    expect(await db.select().from(candidates)).toHaveLength(0);
    expect(await db.select().from(notes)).toHaveLength(0);
  });
});

// Guards the fixture itself: if someone edits it and removes, say, the only
// archived candidate, archive tests would pass without testing anything.
describe("realistic candidate fixture", () => {
  it("stores every fixture candidate", async () => {
    const seeded = await seedCandidates(db);

    expect(await db.select().from(candidates)).toHaveLength(seeded.length);
  });

  it("covers every stage, both archived and active, and repeated roles", async () => {
    const seeded = await seedCandidates(db);

    expect(new Set(seeded.map((c) => c.stage))).toEqual(new Set(stages));
    expect(seeded.some((c) => c.archivedAt !== null)).toBe(true);
    expect(seeded.some((c) => c.archivedAt === null)).toBe(true);

    const roles = seeded.map((c) => c.role);
    expect(new Set(roles).size).toBeLessThan(roles.length);
  });

  it("gives every candidate a distinct createdAt, so sort order is well defined", async () => {
    const seeded = await seedCandidates(db);
    const timestamps = seeded.map((c) => c.createdAt.getTime());

    expect(new Set(timestamps).size).toBe(timestamps.length);
  });
});
