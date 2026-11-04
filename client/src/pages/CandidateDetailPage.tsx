import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { archiveCandidate, getCandidate, moveStage } from "../api/candidates";
import { errorMessage } from "../api/http";
import { stages, type Candidate, type CandidateWithNotes, type Note } from "../api/types";
import { BackLink } from "../components/BackLink";
import { NotesPanel } from "../components/NotesPanel";
import { StagePill } from "../components/StagePill";
import { SummaryCard } from "../components/SummaryCard";
import { formatFullDate } from "../lib/format";
import { isStage, stageLabels } from "../lib/stages";
import { useApiData } from "../lib/useApiData";

export function CandidateDetailPage() {
  const { id = "" } = useParams();
  const { state, reload, setData } = useApiData((signal) => getCandidate(id, signal), id);

  if (state.status === "loading") {
    return (
      <DetailShell>
        <p className="muted">Loading candidate…</p>
      </DetailShell>
    );
  }

  if (state.status === "error") {
    // 404 = no such candidate; 400 = the id in the URL is not even a valid id.
    const notFound = state.httpStatus === 404 || state.httpStatus === 400;
    return (
      <DetailShell>
        {notFound ? (
          <>
            <h1 className="page-title">Candidate not found</h1>
            <p className="page-subtitle">They may have been removed, or the link is wrong.</p>
          </>
        ) : (
          <div className="alert alert--error" role="alert">
            <p>Couldn't load this candidate. {state.message}</p>
            <button type="button" className="button button--secondary alert__action" onClick={reload}>
              Try again
            </button>
          </div>
        )}
      </DetailShell>
    );
  }

  const candidate = state.data;

  // The server returns the updated candidate without notes, so keep the notes we have.
  const updateCandidate = (updated: Candidate) => setData((current) => ({ ...current, ...updated }));
  const appendNote = (note: Note) => setData((current) => ({ ...current, notes: [...current.notes, note] }));

  return (
    <DetailShell>
      <CandidateHeader candidate={candidate} onCandidateChange={updateCandidate} />
      <div className="detail-columns">
        <div className="detail-columns__main">
          <SummaryCard candidate={candidate} onCandidateChange={updateCandidate} />
          <section className="card section-card" aria-labelledby="resume-heading">
            <h2 id="resume-heading">Resume / cover letter</h2>
            {/* Plain text with line breaks kept; React escapes it, so pasted HTML stays text. */}
            <div className="resume-text">{candidate.resumeText}</div>
          </section>
        </div>
        <NotesPanel candidateId={candidate.id} notes={candidate.notes} onNoteAdded={appendNote} />
      </div>
    </DetailShell>
  );
}

function DetailShell({ children }: { children: ReactNode }) {
  return (
    <main className="page page--detail">
      <BackLink to="/">Candidates</BackLink>
      {children}
    </main>
  );
}

type HeaderProps = {
  candidate: CandidateWithNotes;
  onCandidateChange: (updated: Candidate) => void;
};

function CandidateHeader({ candidate, onCandidateChange }: HeaderProps) {
  const navigate = useNavigate();
  const [stageSaving, setStageSaving] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The select shows the stored stage; it only changes once the server agrees.
  async function handleStageChange(value: string) {
    if (!isStage(value)) return;
    setStageSaving(true);
    setError(null);
    try {
      onCandidateChange(await moveStage(candidate.id, value));
    } catch (err) {
      setError(`Couldn't change the stage. ${errorMessage(err)}`);
    } finally {
      setStageSaving(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setError(null);
    try {
      await archiveCandidate(candidate.id);
      // Archived candidates are hidden from the list, so go back to it.
      navigate("/");
    } catch (err) {
      setError(`Couldn't archive this candidate. ${errorMessage(err)}`);
      setArchiving(false);
    }
  }

  const archived = candidate.archivedAt !== null;

  return (
    <section className="card detail-header" aria-labelledby="candidate-name">
      <div className="detail-header__info">
        <div className="detail-header__title">
          <h1 id="candidate-name">{candidate.name}</h1>
          <StagePill stage={candidate.stage} />
        </div>
        <p className="detail-header__role">{candidate.role}</p>
        <dl className="facts">
          <Fact label="Email" value={candidate.email} />
          <Fact label="Phone" value={candidate.phone} />
          <Fact label="Source" value={candidate.source} />
          <Fact label="Added" value={formatFullDate(candidate.createdAt)} />
        </dl>
        {candidate.archivedAt && (
          <p className="archived-note">
            Archived on {formatFullDate(candidate.archivedAt)}. Hidden from the candidate list.
          </p>
        )}
      </div>

      <div className="detail-header__actions">
        <div className="field">
          <label htmlFor="stage-select">Move to stage</label>
          <select
            id="stage-select"
            value={candidate.stage}
            onChange={(e) => handleStageChange(e.target.value)}
            disabled={stageSaving}
          >
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabels[stage]}
              </option>
            ))}
          </select>
        </div>

        {/* Archive replaces delete. Asked once more because the app has no un-archive. */}
        {!archived && !confirmingArchive && (
          <button type="button" className="button button--secondary button--danger-text" onClick={() => setConfirmingArchive(true)}>
            Archive
          </button>
        )}
      </div>

      {confirmingArchive && (
        <div className="confirm" role="group" aria-labelledby="archive-question">
          <p id="archive-question">
            Archive {candidate.name}? They will be hidden from the candidate list. Notes are kept.
          </p>
          <div className="confirm__actions">
            <button type="button" className="button button--danger" onClick={handleArchive} disabled={archiving}>
              {archiving ? "Archiving…" : "Yes, archive"}
            </button>
            <button type="button" className="button button--secondary" onClick={() => setConfirmingArchive(false)} disabled={archiving}>
              Keep candidate
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="form-field__error detail-header__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? <span className="muted-inline">Not given</span>}</dd>
    </div>
  );
}
