import type { Candidate } from "../api/types";

type Summary = NonNullable<Candidate["summary"]>;

// What the AI summary card should show, decided from the stored fields alone.
// Kept out of the component so every case can be tested directly.
//
// After a failed attempt the server keeps the previous summary (an author
// decision in task 5), so "error" and "unsummarizable" can come with one.
export type SummaryView =
  | { kind: "none" }
  | { kind: "ok"; summary: Summary }
  | { kind: "unsummarizable"; reason: string; previous: Summary | null }
  | { kind: "error"; reason: string; previous: Summary | null };

const FALLBACK_REASON = "No reason was recorded.";

export function summaryView(candidate: Pick<Candidate, "summary" | "summaryStatus" | "summaryReason">): SummaryView {
  const { summary, summaryStatus, summaryReason } = candidate;

  switch (summaryStatus) {
    case "ok":
      // "ok" without a summary should never happen; show "none" rather than an empty card.
      return summary ? { kind: "ok", summary } : { kind: "none" };
    case "unsummarizable":
    case "error":
      return { kind: summaryStatus, reason: summaryReason ?? FALLBACK_REASON, previous: summary };
    case null:
      return { kind: "none" };
  }
}

export function summaryButtonLabel(view: SummaryView): string {
  switch (view.kind) {
    case "none":
      return "Generate summary";
    case "ok":
      return "Regenerate";
    case "unsummarizable":
    case "error":
      return "Try again";
  }
}
