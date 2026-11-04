import { Link, useSearchParams } from "react-router";
import { listCandidates, type CandidateFilters } from "../api/candidates";
import { stages } from "../api/types";
import { StagePill } from "../components/StagePill";
import { formatShortDate } from "../lib/format";
import { readListFilters, roleOptions, writeListFilters } from "../lib/listFilters";
import { isStage, stageLabels } from "../lib/stages";
import { useApiData } from "../lib/useApiData";

export function CandidateListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readListFilters(searchParams);
  const filterKey = writeListFilters(filters).toString();

  // The list itself: fetched again whenever the filters in the URL change.
  const { state, reload } = useApiData((signal) => listCandidates(filters, signal), filterKey);
  // Every active candidate, only to build the role dropdown (one extra request on page load).
  const { state: allCandidates } = useApiData((signal) => listCandidates({}, signal), "all");

  const roles = roleOptions(allCandidates.status === "ready" ? allCandidates.data : [], filters.role);

  function updateFilters(change: Partial<CandidateFilters>) {
    setSearchParams(writeListFilters({ ...filters, ...change }));
  }

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Candidates</h1>
        {/* Announced by screen readers when the count changes after filtering. */}
        <p className="muted" aria-live="polite">
          {state.status === "ready" ? countLabel(state.data.length) : ""}
        </p>
      </div>

      <div className="filters">
        <label className="field">
          Stage
          <select
            value={filters.stage ?? ""}
            onChange={(e) => updateFilters({ stage: isStage(e.target.value) ? e.target.value : undefined })}
          >
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabels[stage]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Role applied for
          <select value={filters.role ?? ""} onChange={(e) => updateFilters({ role: e.target.value || undefined })}>
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Sort by
          <select
            value={filters.sort}
            onChange={(e) => updateFilters({ sort: e.target.value === "stage" ? "stage" : "createdAt" })}
          >
            <option value="createdAt">Date added (newest)</option>
            <option value="stage">Stage (pipeline order)</option>
          </select>
        </label>
      </div>

      <div className="card table-card">
        {state.status === "loading" && <p className="table-message">Loading candidates…</p>}

        {state.status === "error" && (
          <div className="table-message" role="alert">
            <p className="muted">Couldn't load candidates. {state.message}</p>
            <button type="button" className="button button--secondary" onClick={reload}>
              Try again
            </button>
          </div>
        )}

        {state.status === "ready" && state.data.length === 0 && (
          <p className="table-message">No candidates match these filters.</p>
        )}

        {state.status === "ready" && state.data.length > 0 && (
          <table className="candidate-table">
            <caption className="visually-hidden">Candidates</caption>
            <thead>
              <tr>
                <th scope="col">Candidate</th>
                <th scope="col">Role</th>
                <th scope="col">Stage</th>
                <th scope="col">Source</th>
                <th scope="col">Added</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((candidate) => (
                <tr key={candidate.id}>
                  <td className="candidate-table__person">
                    <Link to={`/candidates/${candidate.id}`} className="candidate-table__name">
                      {candidate.name}
                    </Link>
                    <div className="candidate-table__email">{candidate.email}</div>
                  </td>
                  <td>{candidate.role}</td>
                  <td>
                    <StagePill stage={candidate.stage} />
                  </td>
                  <td>{candidate.source ?? <span aria-label="No source">—</span>}</td>
                  <td>{formatShortDate(candidate.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "candidate" : "candidates"}`;
}
