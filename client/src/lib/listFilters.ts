import type { CandidateFilters } from "../api/candidates";
import type { Candidate } from "../api/types";
import { isStage } from "./stages";

// The list filters live in the URL (?stage=offer&sort=stage), so they survive a
// page reload and the back button from a detail page. These two functions are
// the only place that reads and writes them.

// Anything unexpected in the URL is ignored rather than sent to the API.
export function readListFilters(params: URLSearchParams): CandidateFilters {
  const stage = params.get("stage");
  const role = params.get("role")?.trim();
  return {
    stage: isStage(stage) ? stage : undefined,
    role: role ? role : undefined,
    sort: params.get("sort") === "stage" ? "stage" : "createdAt",
  };
}

// Defaults are left out, so the plain list has a clean URL.
export function writeListFilters(filters: CandidateFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.role) params.set("role", filters.role);
  if (filters.sort === "stage") params.set("sort", "stage");
  return params;
}

// Role filter options come from the data, not a hardcoded list, so a new role
// appears without a code change. The selected role is kept even if no current
// candidate has it, so the dropdown never silently shows the wrong value.
export function roleOptions(candidates: Candidate[], selected?: string): string[] {
  const roles = new Set(candidates.map((candidate) => candidate.role));
  if (selected) roles.add(selected);
  return [...roles].sort((a, b) => a.localeCompare(b));
}
