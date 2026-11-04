import { z } from "zod";

// The only shape of model output we accept. Gemini is ASKED for this shape
// (responseSchema in client.ts), but model output is untrusted: a resume can
// contain instructions, and the model might follow them. So every answer is
// checked again here, and anything that does not fit is rejected, not repaired.

export const MAX_SKILLS = 15;
export const MAX_SKILL_CHARS = 60;
export const MAX_HIGHLIGHTS = 5;
export const MAX_HIGHLIGHT_CHARS = 200;

// One short, single-line piece of text. Trimmed first, then checked.
const item = (maxChars: number) =>
  z
    .string()
    .trim()
    .min(1, "must not be blank")
    .max(maxChars, `must be at most ${maxChars} characters`)
    .regex(/^[^\r\n]*$/, "must be a single line");

// strictObject: unknown keys (e.g. "recommendation") make the whole answer
// invalid, instead of being silently dropped as z.object would do.
export const summaryOutputSchema = z.strictObject({
  skills: z.array(item(MAX_SKILL_CHARS)).max(MAX_SKILLS, `must have at most ${MAX_SKILLS} items`),
  highlights: z
    .array(item(MAX_HIGHLIGHT_CHARS))
    .max(MAX_HIGHLIGHTS, `must have at most ${MAX_HIGHLIGHTS} items`),
});

export type SummaryOutput = z.output<typeof summaryOutputSchema>;
