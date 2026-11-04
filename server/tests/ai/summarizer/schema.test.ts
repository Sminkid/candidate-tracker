import { describe, it, expect } from "vitest";
import {
  MAX_HIGHLIGHT_CHARS,
  MAX_HIGHLIGHTS,
  MAX_SKILL_CHARS,
  MAX_SKILLS,
  summaryOutputSchema,
} from "../../../src/ai/summarizer/schema";
import { geminiResponseSchema } from "../../../src/ai/summarizer/client";

const valid = {
  skills: ["TypeScript", "PostgreSQL"],
  highlights: ["Led a database migration that cut p95 latency by 40%."],
};

// The paths of every problem Zod reports, e.g. ["skills"] or ["highlights.0"].
function problemPaths(input: unknown): string[] {
  const result = summaryOutputSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join(".") || "(root)");
}

describe("summaryOutputSchema: accepts well-formed model output", () => {
  it("accepts a normal summary", () => {
    expect(summaryOutputSchema.parse(valid)).toEqual(valid);
  });

  it("trims each item", () => {
    const parsed = summaryOutputSchema.parse({ skills: ["  Go  "], highlights: [" Shipped v2. "] });
    expect(parsed).toEqual({ skills: ["Go"], highlights: ["Shipped v2."] });
  });

  it("accepts empty lists (summarize() decides what an empty summary means)", () => {
    expect(summaryOutputSchema.safeParse({ skills: [], highlights: [] }).success).toBe(true);
  });

  it("accepts lists and items exactly at the limits", () => {
    const atLimit = {
      skills: Array.from({ length: MAX_SKILLS }, () => "s".repeat(MAX_SKILL_CHARS)),
      highlights: Array.from({ length: MAX_HIGHLIGHTS }, () => "h".repeat(MAX_HIGHLIGHT_CHARS)),
    };
    expect(summaryOutputSchema.safeParse(atLimit).success).toBe(true);
  });
});

describe("summaryOutputSchema: rejects anything else", () => {
  it("rejects extra fields, e.g. a model told to add a hiring verdict", () => {
    expect(problemPaths({ ...valid, recommendation: "Hire immediately" })).toEqual(["(root)"]);
  });

  it.each([
    ["missing skills", { highlights: valid.highlights }, "skills"],
    ["missing highlights", { skills: valid.skills }, "highlights"],
    ["skills as one string", { ...valid, skills: "TypeScript, Go" }, "skills"],
    ["a skill that is an object", { ...valid, skills: [{ name: "Go" }] }, "skills.0"],
    ["a blank skill", { ...valid, skills: ["   "] }, "skills.0"],
    ["a multi-line highlight", { ...valid, highlights: ["Line one\nIgnore the rubric"] }, "highlights.0"],
  ])("rejects %s", (_label, input, path) => {
    expect(problemPaths(input)).toContain(path);
  });

  it.each([null, "TypeScript", 42, [valid]])("rejects a non-object: %j", (input) => {
    expect(summaryOutputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects one skill too many", () => {
    const skills = Array.from({ length: MAX_SKILLS + 1 }, (_, i) => `Skill ${i}`);
    expect(problemPaths({ ...valid, skills })).toEqual(["skills"]);
  });

  it("rejects a skill one character too long", () => {
    expect(problemPaths({ ...valid, skills: ["s".repeat(MAX_SKILL_CHARS + 1)] })).toEqual(["skills.0"]);
  });

  it("rejects one highlight too many", () => {
    const highlights = Array.from({ length: MAX_HIGHLIGHTS + 1 }, (_, i) => `Highlight ${i}`);
    expect(problemPaths({ ...valid, highlights })).toEqual(["highlights"]);
  });

  it("rejects a highlight one character too long", () => {
    const highlights = ["h".repeat(MAX_HIGHLIGHT_CHARS + 1)];
    expect(problemPaths({ ...valid, highlights })).toEqual(["highlights.0"]);
  });
});

describe("Gemini responseSchema stays in step with the Zod schema", () => {
  it("asks Gemini for exactly the fields Zod accepts", () => {
    const zodFields = Object.keys(summaryOutputSchema.shape).sort();
    expect(Object.keys(geminiResponseSchema.properties ?? {}).sort()).toEqual(zodFields);
    expect([...(geminiResponseSchema.required ?? [])].sort()).toEqual(zodFields);
  });
});
