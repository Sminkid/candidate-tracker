import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Database } from "./index";
import { candidates, notes, type Candidate, type NewCandidate, type Note, type Stage } from "./schema";

// The only code that builds queries for candidates and notes.
// No business rules here: each function does one database operation and
// returns undefined when a row is missing, leaving the decision to the service.

export type CandidateFilter = {
  stage?: Stage;
  role?: string;
  includeArchived: boolean;
  sort: "createdAt" | "stage";
};

export async function insertCandidate(db: Database, values: NewCandidate): Promise<Candidate> {
  const [row] = await db.insert(candidates).values(values).returning();
  return row;
}

export async function findCandidateById(db: Database, id: string): Promise<Candidate | undefined> {
  const [row] = await db.select().from(candidates).where(eq(candidates.id, id));
  return row;
}

export async function findCandidates(db: Database, filter: CandidateFilter): Promise<Candidate[]> {
  const conditions: SQL[] = [];
  if (!filter.includeArchived) conditions.push(isNull(candidates.archivedAt));
  if (filter.stage) conditions.push(eq(candidates.stage, filter.stage));
  if (filter.role) conditions.push(eq(candidates.role, filter.role));

  // Postgres sorts an enum by its declared order (applied → rejected), not alphabetically.
  // id is a last tie-breaker so the order is always the same for identical timestamps.
  const orderBy =
    filter.sort === "stage"
      ? [asc(candidates.stage), desc(candidates.createdAt), asc(candidates.id)]
      : [desc(candidates.createdAt), asc(candidates.id)];

  return db
    .select()
    .from(candidates)
    .where(and(...conditions))
    .orderBy(...orderBy);
}

export async function updateCandidateStage(
  db: Database,
  id: string,
  stage: Stage,
): Promise<Candidate | undefined> {
  const [row] = await db
    .update(candidates)
    .set({ stage })
    .where(eq(candidates.id, id))
    .returning();
  return row;
}

// coalesce keeps an existing archivedAt, so archiving twice does not move the date.
export async function markCandidateArchived(db: Database, id: string): Promise<Candidate | undefined> {
  const [row] = await db
    .update(candidates)
    .set({ archivedAt: sql`coalesce(${candidates.archivedAt}, now())` })
    .where(eq(candidates.id, id))
    .returning();
  return row;
}

export async function insertNote(db: Database, candidateId: string, body: string): Promise<Note> {
  const [row] = await db.insert(notes).values({ candidateId, body }).returning();
  return row;
}

export async function findNotesForCandidate(db: Database, candidateId: string): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(eq(notes.candidateId, candidateId))
    .orderBy(asc(notes.createdAt), asc(notes.id));
}
