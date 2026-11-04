import { describe, it, expect } from "vitest";
import { MAX_RESUME_CHARS, MIN_RESUME_CHARS, preflight } from "../../../src/ai/summarizer/preflight";

const realisticResume = `Priya Sharma — priya.sharma@example.com — +44 7700 900123
Backend Engineer, 2019–2026. Built payment APIs in TypeScript and Go handling 1.2M requests/day.
Led migration from MySQL 5.7 to Postgres 15; cut p95 latency by 40%. BSc Computer Science (2:1).`;

describe("preflight: rejects input not worth sending to the model", () => {
  it.each([
    ["an empty string", ""],
    ["only whitespace", "   \n\t  \r\n "],
  ])("rejects %s as empty", (_label, input) => {
    expect(preflight(input)).toEqual({ ok: false, reason: "Resume text is empty" });
  });

  it("rejects text that is too short", () => {
    expect(preflight("Python developer")).toEqual({
      ok: false,
      reason: "Resume text is too short to summarize",
    });
  });

  it("measures length after trimming, so padding does not count", () => {
    const tooShort = "a".repeat(MIN_RESUME_CHARS - 1);
    expect(preflight(`   ${tooShort}   `).ok).toBe(false);
    expect(preflight("a".repeat(MIN_RESUME_CHARS)).ok).toBe(true);
  });

  it.each([
    ["symbols", "%$#@!*&^~|<>".repeat(20)],
    ["numbers", "0123 4567 8910 ".repeat(20)],
    ["control characters from a broken PDF extract", "\u0000\u0001\u0002\u0003\u0004\u0005".repeat(30) + "ab"],
  ])("rejects text that is mostly %s", (_label, input) => {
    expect(preflight(input)).toEqual({
      ok: false,
      reason: "Resume text is mostly symbols or numbers, not readable text",
    });
  });
});

describe("preflight: accepts real resumes", () => {
  it("accepts a normal resume full of dates, numbers, emails and punctuation", () => {
    const result = preflight(realisticResume);
    expect(result).toEqual({ ok: true, text: realisticResume, truncated: false });
  });

  it("accepts resumes in other languages and scripts", () => {
    const french = "Développeuse full-stack à Montréal. Expérience: React, Node.js, PostgreSQL. Équipe de 5.";
    const japanese = "東京のソフトウェアエンジニア。バックエンド開発とデータベース設計の経験が五年あります。チームリーダーとして新人の育成も担当しました。";
    expect(preflight(french).ok).toBe(true);
    expect(preflight(japanese).ok).toBe(true);
  });

  it("returns the trimmed text", () => {
    const result = preflight(`\n\n  ${realisticResume}  \n`);
    expect(result).toEqual({ ok: true, text: realisticResume, truncated: false });
  });
});

describe("preflight: truncation", () => {
  it("cuts text longer than the maximum and says so", () => {
    const long = "Experienced engineer. ".repeat(2_000) + "TAIL-MARKER";
    expect(long.length).toBeGreaterThan(MAX_RESUME_CHARS);

    const result = preflight(long);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(MAX_RESUME_CHARS);
    expect(long.startsWith(result.text)).toBe(true);
    expect(result.text).not.toContain("TAIL-MARKER");
  });

  it("keeps text of exactly the maximum length untouched", () => {
    const exact = "word ".repeat(MAX_RESUME_CHARS / 5 - 1) + "last.";
    expect(exact).toHaveLength(MAX_RESUME_CHARS);

    expect(preflight(exact)).toEqual({ ok: true, text: exact, truncated: false });
  });
});
