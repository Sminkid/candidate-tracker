import type { Summarizer } from "../ai/summarizer";
import type { Database } from "../db";
import * as repo from "../db/candidateRepository";
import type { Candidate, NewCandidate, Note, Stage } from "../db/schema";
import { NotFoundError } from "./errors";

// Business rules for candidates and notes. No HTTP and no SQL: routes call
// these functions, and these call the repository. The database is passed in,
// so tests use PGlite and production uses Neon with the same code.

export type CreateCandidateInput = Pick<NewCandidate, "name" | "email" | "role" | "resumeText"> &
  Partial<Pick<NewCandidate, "phone" | "source">>;
export type CandidateSort = "createdAt" | "stage";
export type ListCandidatesOptions = {
  stage?: Stage;
  role?: string;
  sort?: CandidateSort;
  includeArchived?: boolean;
};
export type CandidateWithNotes = Candidate & { notes: Note[] };

export async function createCandidate(db: Database, input: CreateCandidateInput): Promise<Candidate> {
  // Only the fields a caller may set. Stage, archive state and summary are
  // never taken from input, so every new candidate starts in "applied".
  return repo.insertCandidate(db, {
    name: input.name,
    email: input.email,
    role: input.role,
    resumeText: input.resumeText,
    phone: input.phone ?? null,
    source: input.source ?? null,
  });
}

export async function getCandidate(db: Database, id: string): Promise<CandidateWithNotes> {
  const candidate = await requireCandidate(db, id);
  const notes = await repo.findNotesForCandidate(db, id);
  return { ...candidate, notes };
}

export async function listCandidates(
  db: Database,
  options: ListCandidatesOptions = {},
): Promise<Candidate[]> {
  return repo.findCandidates(db, {
    stage: options.stage,
    role: options.role,
    sort: options.sort ?? "createdAt",
    includeArchived: options.includeArchived ?? false,
  });
}

// Stage moves are free transitions: any stage to any stage, by design.
export async function moveStage(db: Database, id: string, stage: Stage): Promise<Candidate> {
  const updated = await repo.updateCandidateStage(db, id, stage);
  if (!updated) throw candidateNotFound(id);
  return updated;
}

// Soft delete: the row stays (with its notes) and is hidden from default lists.
export async function archiveCandidate(db: Database, id: string): Promise<Candidate> {
  const archived = await repo.markCandidateArchived(db, id);
  if (!archived) throw candidateNotFound(id);
  return archived;
}

// Notes are append-only: this module deliberately has no update or delete for them.
export async function addNote(db: Database, candidateId: string, body: string): Promise<Note> {
  // Check first so callers get a clear NotFoundError, not a raw foreign-key error.
  await requireCandidate(db, candidateId);
  return repo.insertNote(db, candidateId, body);
}

export type SummaryDependencies = { summarizer: Summarizer };

// Generates (or regenerates) a candidate's AI summary and stores the outcome.
// The summarizer never throws, so an AI failure is stored as a status and
// reason, not raised as an HTTP error.
// On failure the previous summary is kept (the author's choice): the UI can
// still show it, marked with the failed status and reason.
export async function generateSummary(
  db: Database,
  id: string,
  { summarizer }: SummaryDependencies,
): Promise<Candidate> {
  const candidate = await requireCandidate(db, id);
  const result = await summarizer(candidate.resumeText);

  const update: repo.SummaryUpdate =
    result.status === "ok"
      ? {
          summary: { skills: result.skills, highlights: result.highlights },
          summaryStatus: "ok",
          summaryReason: null,
        }
      : // summary is left out on purpose, so the stored one is not touched.
        { summaryStatus: result.status, summaryReason: result.reason };

  const updated = await repo.updateCandidateSummary(db, id, update);
  if (!updated) throw candidateNotFound(id);
  return updated;
}

async function requireCandidate(db: Database, id: string): Promise<Candidate> {
  const candidate = await repo.findCandidateById(db, id);
  if (!candidate) throw candidateNotFound(id);
  return candidate;
}

function candidateNotFound(id: string): NotFoundError {
  return new NotFoundError(`Candidate ${id} not found`);
}
