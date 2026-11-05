import type { z } from "zod";
import type { Database } from "../db";
import { validate } from "../routes/http";
import {
  addNote,
  archiveCandidate,
  createCandidate,
  listCandidates,
  moveStage,
} from "../services/candidateService";
import { seedCandidates, seedCandidateSchema, type SeedCandidate } from "./seedData";

// Fills a database with demo candidates. Safe to run on a database that
// already has real data, and safe to run twice:
//   - every entry is validated first; if one is invalid, nothing is written
//   - a candidate whose email already exists is skipped, never changed
//   - it only ADDS rows, through the same service functions the API uses
//   - it never calls the AI (no summarizer is passed in)
//
// Not a transaction: the Neon HTTP driver cannot hold one open across calls.
// If a run stops halfway, re-running skips the candidates already created.

export type SeedResult = { added: number; skipped: number };

type ValidSeedCandidate = z.output<typeof seedCandidateSchema>;

export async function seedDatabase(
  db: Database,
  data: SeedCandidate[] = seedCandidates,
): Promise<SeedResult> {
  const entries = data.map(validateEntry);

  const existing = await listCandidates(db, { includeArchived: true });
  const takenEmails = new Set(existing.map((candidate) => candidate.email.toLowerCase()));

  let added = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (takenEmails.has(entry.input.email)) {
      skipped++;
      continue;
    }

    // Same steps a recruiter would take in the UI: add, move, write notes, archive.
    const candidate = await createCandidate(db, entry.input);
    if (entry.stage !== "applied") await moveStage(db, candidate.id, entry.stage);
    for (const body of entry.notes) await addNote(db, candidate.id, body);
    if (entry.archived) await archiveCandidate(db, candidate.id);

    takenEmails.add(entry.input.email);
    added++;
  }

  return { added, skipped };
}

// Reuses the routes' validate() so messages look like the API's,
// prefixed with which entry is wrong (1-based, as you'd count in the file).
function validateEntry(entry: SeedCandidate, index: number): ValidSeedCandidate {
  try {
    return validate(seedCandidateSchema, entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Seed entry ${index + 1} (${entry.input.name}): ${message}`);
  }
}
