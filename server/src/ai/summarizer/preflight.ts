// Cheap checks on the resume text BEFORE any model call. Input that cannot
// give a useful summary is rejected here, so we never pay for (or trust) a
// model answer about it. Long input is cut to a fixed size.

export const MIN_RESUME_CHARS = 50;
export const MAX_RESUME_CHARS = 20_000;

// At least half of the visible characters must be letters (any language).
// Garbled PDF extracts, number dumps and symbol noise fall below this.
const MIN_LETTER_RATIO = 0.5;

export type PreflightResult =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; reason: string };

export function preflight(resumeText: string): PreflightResult {
  const trimmed = resumeText.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: "Resume text is empty" };
  }
  if (trimmed.length < MIN_RESUME_CHARS) {
    return { ok: false, reason: "Resume text is too short to summarize" };
  }

  const truncated = trimmed.length > MAX_RESUME_CHARS;
  const text = truncated ? trimmed.slice(0, MAX_RESUME_CHARS) : trimmed;

  if (letterRatio(text) < MIN_LETTER_RATIO) {
    return { ok: false, reason: "Resume text is mostly symbols or numbers, not readable text" };
  }

  return { ok: true, text, truncated };
}

// Share of non-whitespace characters that are letters. \p{L} matches letters
// in every script (é, ü, 東), so non-English resumes are not penalised.
function letterRatio(text: string): number {
  const visible = text.replace(/\s/g, "");
  const letters = visible.match(/\p{L}/gu)?.length ?? 0;
  return letters / visible.length;
}
