import { describe, it, expect } from "vitest";
import { summaryButtonLabel, summaryView } from "../../src/lib/summaryView";

const summary = { skills: ["Go"], highlights: ["Shipped v2."] };

describe("summaryView", () => {
  it("shows nothing generated yet when there is no status", () => {
    expect(summaryView({ summary: null, summaryStatus: null, summaryReason: null })).toEqual({ kind: "none" });
  });

  it("shows the summary when the last attempt succeeded", () => {
    expect(summaryView({ summary, summaryStatus: "ok", summaryReason: null })).toEqual({ kind: "ok", summary });
  });

  it("treats ok-without-a-summary as none instead of drawing an empty card", () => {
    expect(summaryView({ summary: null, summaryStatus: "ok", summaryReason: null })).toEqual({ kind: "none" });
  });

  it.each(["unsummarizable", "error"] as const)("shows the %s reason, with no previous summary", (status) => {
    expect(summaryView({ summary: null, summaryStatus: status, summaryReason: "Some reason" })).toEqual({
      kind: status,
      reason: "Some reason",
      previous: null,
    });
  });

  it("keeps the previous summary after a failed regenerate (task 5 decision)", () => {
    expect(summaryView({ summary, summaryStatus: "error", summaryReason: "The AI service timed out" })).toEqual({
      kind: "error",
      reason: "The AI service timed out",
      previous: summary,
    });
  });

  it("still explains a failure when no reason was stored", () => {
    const view = summaryView({ summary: null, summaryStatus: "error", summaryReason: null });
    expect(view).toMatchObject({ kind: "error", reason: "No reason was recorded." });
  });
});

describe("summaryButtonLabel", () => {
  it.each([
    [{ kind: "none" } as const, "Generate summary"],
    [{ kind: "ok", summary } as const, "Regenerate"],
    [{ kind: "unsummarizable", reason: "x", previous: null } as const, "Try again"],
    [{ kind: "error", reason: "x", previous: null } as const, "Try again"],
  ])("labels the button for %j as %s", (view, label) => {
    expect(summaryButtonLabel(view)).toBe(label);
  });
});
