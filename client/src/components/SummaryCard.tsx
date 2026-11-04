import { useState } from "react";
import { generateSummary } from "../api/candidates";
import { errorMessage } from "../api/http";
import type { Candidate } from "../api/types";
import { summaryButtonLabel, summaryView } from "../lib/summaryView";

type Props = {
  candidate: Candidate;
  // Called with the candidate the server returns after a summary attempt.
  onCandidateChange: (updated: Candidate) => void;
};

// The AI summary card. Which state it shows comes from summaryView(); this
// component only draws it and runs the Generate / Regenerate / Try again button.
export function SummaryCard({ candidate, onCandidateChange }: Props) {
  const [generating, setGenerating] = useState(false);
  // Set only when the request itself failed (server down, 500). An AI failure
  // is not a request failure: it comes back as summaryStatus "error".
  const [requestError, setRequestError] = useState<string | null>(null);

  const view = summaryView(candidate);

  async function handleGenerate() {
    setGenerating(true);
    setRequestError(null);
    try {
      onCandidateChange(await generateSummary(candidate.id));
    } catch (err) {
      setRequestError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="card section-card" aria-labelledby="summary-heading">
      <div className="section-card__header">
        <div className="summary-title">
          <SparkleIcon />
          <h2 id="summary-heading">AI summary</h2>
        </div>
        <button type="button" className="button button--secondary" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating…" : summaryButtonLabel(view)}
        </button>
      </div>

      {/* Screen readers hear the new state when it changes. */}
      <div aria-live="polite">
        {requestError && (
          <div className="notice notice--error" role="alert">
            <p className="notice__title">The summary request failed</p>
            <p>{requestError} The rest of this profile still works.</p>
          </div>
        )}

        {view.kind === "none" && (
          <p className="summary-empty">
            No summary yet. Generate one to see key skills and experience highlights from the resume.
          </p>
        )}

        {view.kind === "ok" && <SummaryContent summary={view.summary} />}

        {view.kind === "unsummarizable" && (
          <div className="notice">
            <p className="notice__title">This resume can't be summarised</p>
            <p>{sentence(view.reason)} You can still read the resume below.</p>
          </div>
        )}

        {view.kind === "error" && (
          <div className="notice notice--error">
            <p className="notice__title">The summary couldn't be generated</p>
            <p>
              {sentence(view.reason)} The rest of this profile still works. Try again in a minute.
            </p>
          </div>
        )}

        {(view.kind === "error" || view.kind === "unsummarizable") && view.previous && (
          <SummaryContent summary={view.previous} title="Previous summary" />
        )}
      </div>
    </section>
  );
}

type Summary = NonNullable<Candidate["summary"]>;

// Skills and highlights are model output: rendered as plain text (React escapes
// it), never as HTML, so a hostile resume cannot inject markup through them.
function SummaryContent({ summary, title }: { summary: Summary; title?: string }) {
  return (
    <div className="summary-content">
      {title && <h3 className="summary-content__previous">{title}</h3>}
      {summary.skills.length > 0 && (
        <>
          <h3>Key skills</h3>
          <ul className="skill-list">
            {summary.skills.map((skill, index) => (
              <li key={`${index}-${skill}`}>{skill}</li>
            ))}
          </ul>
        </>
      )}
      {summary.highlights.length > 0 && (
        <>
          <h3>Experience highlights</h3>
          <ul className="highlight-list">
            {summary.highlights.map((highlight, index) => (
              <li key={`${index}-${highlight}`}>{highlight}</li>
            ))}
          </ul>
        </>
      )}
      <p className="summary-disclaimer">AI summaries can be wrong. Check this against the resume below.</p>
    </div>
  );
}

// Server reasons have no full stop ("Resume text is too short to summarize").
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#2F4BDA" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 1.5l1.4 3.8 3.8 1.4-3.8 1.4L8 12l-1.4-3.9L2.8 6.7l3.8-1.4z" />
    </svg>
  );
}
