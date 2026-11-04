// The JSON the server sends. These mirror the server's Drizzle types, with one
// difference: dates arrive as ISO strings, not Date objects, because JSON has no date type.
// The client and server are separate projects (separate Vercel deploys), so the
// types are written out here instead of imported from server/.

export const stages = ["applied", "screening", "interview", "offer", "rejected"] as const;
export type Stage = (typeof stages)[number];

export type SummaryStatus = "ok" | "unsummarizable" | "error";

export type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  resumeText: string;
  source: string | null;
  stage: Stage;
  summary: { skills: string[]; highlights: string[] } | null;
  summaryStatus: SummaryStatus | null;
  summaryReason: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type Note = {
  id: string;
  candidateId: string;
  body: string;
  createdAt: string;
};

export type CandidateWithNotes = Candidate & { notes: Note[] };
