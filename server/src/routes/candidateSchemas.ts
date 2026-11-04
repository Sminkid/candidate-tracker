import { z } from "zod";
import { stages } from "../db/schema";

// Zod schemas for everything the candidate routes accept. Each one checks the
// shape at runtime AND cleans the value (trim, lowercase), so services only
// ever receive valid, tidy input.

// Required text: must be a string, is trimmed, and must not be empty afterwards.
const requiredText = (maxLength: number) =>
  z
    .string({ error: (issue) => (issue.input === undefined ? "is required" : "must be text") })
    .trim()
    .min(1, "is required")
    .max(maxLength, `must be at most ${maxLength} characters`);

// Optional text: may be missing, null or blank; all three are stored as "no value".
const optionalText = (maxLength: number) =>
  z
    .string({ error: "must be text" })
    .trim()
    .max(maxLength, `must be at most ${maxLength} characters`)
    .nullish()
    .transform((value) => (value ? value : undefined));

// Optional phone: stored as typed (trimmed), so "+353 (0)87 123 4567" stays readable.
// The real limit counts digits only: 15 is the international maximum (E.164),
// whatever spaces, brackets or dashes surround them. The character cap only
// stops someone pasting a paragraph into the field.
const MAX_PHONE_DIGITS = 15;
const MAX_PHONE_CHARS = 30;
const optionalPhone = z
  .string({ error: "must be text" })
  .trim()
  .max(MAX_PHONE_CHARS, `must be at most ${MAX_PHONE_CHARS} characters`)
  .refine(
    (value) => value.replace(/\D/g, "").length <= MAX_PHONE_DIGITS,
    `must have at most ${MAX_PHONE_DIGITS} digits`,
  )
  .nullish()
  .transform((value) => (value ? value : undefined));

export const candidateIdParams = z.object({
  id: z.uuid("must be a valid candidate id"),
});

export const createCandidateBody = z.object({
  name: requiredText(200),
  email: z
    .string({ error: (issue) => (issue.input === undefined ? "is required" : "must be text") })
    .trim()
    .toLowerCase()
    .pipe(z.email("must be a valid email address").max(100, "must be at most 100 characters")),
  phone: optionalPhone,
  role: requiredText(200),
  resumeText: requiredText(100_000),
  source: optionalText(100),
});

export const listCandidatesQuery = z.object({
  stage: z.enum(stages, `must be one of: ${stages.join(", ")}`).optional(),
  role: optionalText(200),
  sort: z.enum(["createdAt", "stage"], "must be createdAt or stage").optional(),
  // Query strings are always text, so turn "true"/"false" into a real boolean.
  includeArchived: z
    .enum(["true", "false"], "must be true or false")
    .optional()
    .transform((value) => value === "true"),
});

export const moveStageBody = z.object({
  stage: z.enum(stages, `must be one of: ${stages.join(", ")}`),
});

export const addNoteBody = z.object({
  body: requiredText(5_000),
});
