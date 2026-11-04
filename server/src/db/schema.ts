import { sql, type SQL } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// A CHECK constraint: the column must contain at least one non-whitespace
// character. NOT NULL alone still allows "" and "   ".
function notBlank(constraintName: string, column: AnyPgColumn) {
  const hasVisibleCharacter: SQL = sql`${column} ~ '[^[:space:]]'`;
  return check(constraintName, hasVisibleCharacter);
}

export const stages = ["applied", "screening", "interview", "offer", "rejected"] as const;
export const stageEnum = pgEnum("stage", stages);

export const summaryStatuses = ["ok", "unsummarizable", "error"] as const;
export const summaryStatusEnum = pgEnum("summary_status", summaryStatuses);

// Shape of a stored AI summary. Defined here as a plain type so the db layer
// does not depend on the AI module.
export type StoredSummary = {
  skills: string[];
  highlights: string[];
};

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    role: text("role").notNull(),
    resumeText: text("resume_text").notNull(),
    source: text("source"),
    stage: stageEnum("stage").notNull().default("applied"),
    summary: jsonb("summary").$type<StoredSummary>(),
    summaryStatus: summaryStatusEnum("summary_status"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    notBlank("candidates_name_not_blank", table.name),
    notBlank("candidates_email_not_blank", table.email),
    notBlank("candidates_role_not_blank", table.role),
    notBlank("candidates_resume_text_not_blank", table.resumeText),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notes_candidate_id_idx").on(table.candidateId),
    notBlank("notes_body_not_blank", table.body),
  ],
);

export type Candidate = typeof candidates.$inferSelect;
export type NewCandidate = typeof candidates.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Stage = (typeof stages)[number];
