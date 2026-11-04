import { candidates, notes, type Candidate, type NewCandidate, type NewNote, type Note } from "../../src/db/schema";
import type { TestDb } from "./testDb";

// Factories: build one valid row with sensible defaults. Pass only the fields
// that matter for your test; everything else is filled in.
// Use these when a test needs one exact, controlled situation.

export function candidateData(overrides: Partial<NewCandidate> = {}): NewCandidate {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "Backend Engineer",
    resumeText: "Wrote the first published algorithm for a computing machine.",
    ...overrides,
  };
}

export async function insertCandidate(
  db: TestDb,
  overrides: Partial<NewCandidate> = {},
): Promise<Candidate> {
  const [row] = await db.insert(candidates).values(candidateData(overrides)).returning();
  return row;
}

export async function insertNote(
  db: TestDb,
  candidateId: string,
  overrides: Partial<Omit<NewNote, "candidateId">> = {},
): Promise<Note> {
  const [row] = await db
    .insert(notes)
    .values({ candidateId, body: "Good first call.", ...overrides })
    .returning();
  return row;
}
