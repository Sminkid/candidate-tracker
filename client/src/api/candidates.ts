import { apiRequest } from "./http";
import type { Candidate, CandidateWithNotes, Note, Stage } from "./types";

// One function per endpoint. Components call these, never fetch() directly.

export type CandidateSort = "createdAt" | "stage";

export type CandidateFilters = {
  stage?: Stage;
  role?: string;
  sort?: CandidateSort;
};

// What the add form sends. The server trims, lowercases the email and turns
// blank optional fields into null, so the client sends what the user typed.
export type NewCandidateInput = {
  name: string;
  email: string;
  role: string;
  resumeText: string;
  phone?: string;
  source?: string;
};

export function createCandidate(input: NewCandidateInput): Promise<Candidate> {
  return apiRequest<Candidate>("/api/candidates", { method: "POST", body: input });
}

export function listCandidates(filters: CandidateFilters = {}, signal?: AbortSignal): Promise<Candidate[]> {
  const params = new URLSearchParams();
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.role) params.set("role", filters.role);
  if (filters.sort && filters.sort !== "createdAt") params.set("sort", filters.sort);
  const query = params.toString();
  return apiRequest<Candidate[]>(`/api/candidates${query ? `?${query}` : ""}`, { signal });
}

export function getCandidate(id: string, signal?: AbortSignal): Promise<CandidateWithNotes> {
  return apiRequest<CandidateWithNotes>(`/api/candidates/${encodeURIComponent(id)}`, { signal });
}

export function moveStage(id: string, stage: Stage): Promise<Candidate> {
  return apiRequest<Candidate>(`/api/candidates/${encodeURIComponent(id)}/stage`, {
    method: "PATCH",
    body: { stage },
  });
}

export function archiveCandidate(id: string): Promise<Candidate> {
  return apiRequest<Candidate>(`/api/candidates/${encodeURIComponent(id)}/archive`, { method: "POST" });
}

export function addNote(candidateId: string, body: string): Promise<Note> {
  return apiRequest<Note>(`/api/candidates/${encodeURIComponent(candidateId)}/notes`, {
    method: "POST",
    body: { body },
  });
}

// Always resolves with the updated candidate when the candidate exists, even if
// the AI failed: the outcome is in summaryStatus and summaryReason.
export function generateSummary(id: string): Promise<Candidate> {
  return apiRequest<Candidate>(`/api/candidates/${encodeURIComponent(id)}/summary`, { method: "POST" });
}
