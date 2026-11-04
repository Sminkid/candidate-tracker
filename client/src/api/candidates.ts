import { apiRequest } from "./http";
import type { Candidate, Stage } from "./types";

// One function per endpoint. Components call these, never fetch() directly.

export type CandidateSort = "createdAt" | "stage";

export type CandidateFilters = {
  stage?: Stage;
  role?: string;
  sort?: CandidateSort;
};

export function listCandidates(filters: CandidateFilters = {}, signal?: AbortSignal): Promise<Candidate[]> {
  const params = new URLSearchParams();
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.role) params.set("role", filters.role);
  if (filters.sort && filters.sort !== "createdAt") params.set("sort", filters.sort);
  const query = params.toString();
  return apiRequest<Candidate[]>(`/api/candidates${query ? `?${query}` : ""}`, { signal });
}
