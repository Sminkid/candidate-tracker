import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Candidate, CandidateWithNotes, Note } from "../../src/api/types";
import { deferred, jsonResponse, makeCandidate, mockFetch } from "../helpers/api";
import { renderApp } from "../helpers/renderApp";

const note = (body: string, createdAt: string): Note => ({
  id: `note-${body}`,
  candidateId: "",
  body,
  createdAt,
});

function makeDetail(overrides: Partial<CandidateWithNotes> = {}): CandidateWithNotes {
  return {
    ...makeCandidate({
      name: "Mara Okafor",
      email: "mara@example.com",
      phone: "0400 000 123",
      role: "Frontend Engineer",
      source: "LinkedIn",
      stage: "interview",
      resumeText: "Senior Frontend Engineer.\nLed a TypeScript migration.",
    }),
    notes: [
      note("Moved to Interview after screening.", "2026-11-02T09:45:00Z"),
      note("Phone screen went well.", "2026-11-03T15:10:00Z"),
    ],
    ...overrides,
  };
}

type Route = (init: RequestInit) => Response | Promise<Response>;

// A small fake API for one candidate. Each test overrides only the routes it cares about.
function serveCandidate(candidate: CandidateWithNotes, routes: Record<string, Route> = {}) {
  const base = `/api/candidates/${candidate.id}`;
  const withoutNotes = (changes: Partial<Candidate>): Candidate => {
    const { notes: _notes, ...rest } = candidate;
    return { ...rest, ...changes };
  };
  const defaults: Record<string, Route> = {
    [`GET ${base}`]: () => jsonResponse(candidate),
    [`PATCH ${base}/stage`]: (init) => jsonResponse(withoutNotes(JSON.parse(String(init.body)))),
    [`POST ${base}/archive`]: () => jsonResponse(withoutNotes({ archivedAt: "2026-11-05T10:00:00Z" })),
    [`POST ${base}/notes`]: (init) =>
      jsonResponse(note(JSON.parse(String(init.body)).body, "2026-11-05T10:00:00Z"), 201),
    [`GET /api/candidates`]: () => jsonResponse([]),
  };
  return mockFetch((url, init) => {
    const key = `${init.method ?? "GET"} ${url.pathname}`;
    const route = routes[key] ?? defaults[key];
    return route ? route(init) : jsonResponse({ error: { message: "Route not found" } }, 404);
  });
}

function requests(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls.map(([input, init]) => ({
    key: `${init?.method ?? "GET"} ${new URL(String(input), "http://localhost").pathname}`,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }));
}

const summary = { skills: ["React", "TypeScript"], highlights: ["Led a TypeScript migration."] };

describe("candidate detail: loading", () => {
  it("shows the candidate's details, stage label and resume", async () => {
    const candidate = makeDetail();
    serveCandidate(candidate);
    renderApp(`/candidates/${candidate.id}`);

    expect(await screen.findByRole("heading", { level: 1, name: "Mara Okafor" })).toBeInTheDocument();
    const header = screen.getByRole("region", { name: "Mara Okafor" });
    expect(within(header).getByText("Interview", { selector: ".pill" })).toBeInTheDocument();
    expect(within(header).getByText("Frontend Engineer")).toBeInTheDocument();
    expect(within(header).getByText("0400 000 123")).toBeInTheDocument();
    expect(within(header).getByText("3 Nov 2026")).toBeInTheDocument();
    const resume = screen.getByRole("region", { name: "Resume / cover letter" });
    expect(resume).toHaveTextContent("Senior Frontend Engineer. Led a TypeScript migration.");
  });

  it("says 'Not given' for a missing phone or source", async () => {
    const candidate = makeDetail({ phone: null, source: null });
    serveCandidate(candidate);
    renderApp(`/candidates/${candidate.id}`);

    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });
    expect(screen.getAllByText("Not given")).toHaveLength(2);
  });

  it("shows 'Candidate not found' for an unknown id", async () => {
    mockFetch(() => jsonResponse({ error: { message: "Candidate x not found" } }, 404));
    renderApp("/candidates/00000000-0000-4000-8000-999999999999");

    expect(await screen.findByRole("heading", { name: "Candidate not found" })).toBeInTheDocument();
  });

  it("shows other failures with a way to try again", async () => {
    const candidate = makeDetail();
    let fail = true;
    serveCandidate(candidate, {
      [`GET /api/candidates/${candidate.id}`]: () =>
        fail ? jsonResponse({ error: { message: "Internal server error" } }, 500) : jsonResponse(candidate),
    });
    const { user } = renderApp(`/candidates/${candidate.id}`);

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Mara Okafor" })).toBeInTheDocument();
  });

  it("renders hostile text from the resume and the AI as plain text, never as HTML", async () => {
    const hostile = '<img src="x" onerror="alert(1)">';
    const candidate = makeDetail({
      resumeText: `Resume ${hostile}`,
      summaryStatus: "ok",
      summary: { skills: [hostile], highlights: [hostile] },
    });
    serveCandidate(candidate);
    const { container } = renderApp(`/candidates/${candidate.id}`);

    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText(hostile, { exact: false }).length).toBeGreaterThanOrEqual(3);
  });
});

describe("candidate detail: stage and archive", () => {
  it("moves the candidate to another stage", async () => {
    const candidate = makeDetail();
    const fetchMock = serveCandidate(candidate);
    const { user } = renderApp(`/candidates/${candidate.id}`);
    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Move to stage" }), "offer");

    const header = screen.getByRole("region", { name: "Mara Okafor" });
    await waitFor(() => expect(within(header).getByText("Offer", { selector: ".pill" })).toBeInTheDocument());
    expect(requests(fetchMock)).toContainEqual({
      key: `PATCH /api/candidates/${candidate.id}/stage`,
      body: { stage: "offer" },
    });
  });

  it("keeps the old stage and says so when the change fails", async () => {
    const candidate = makeDetail();
    serveCandidate(candidate, {
      [`PATCH /api/candidates/${candidate.id}/stage`]: () =>
        jsonResponse({ error: { message: "Internal server error" } }, 500),
    });
    const { user } = renderApp(`/candidates/${candidate.id}`);
    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Move to stage" }), "offer");

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't change the stage. Internal server error");
    expect(screen.getByRole("combobox", { name: "Move to stage" })).toHaveValue("interview");
  });

  it("archives only after confirming, then returns to the list", async () => {
    const candidate = makeDetail();
    const fetchMock = serveCandidate(candidate);
    const { user, currentPath } = renderApp(`/candidates/${candidate.id}`);
    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(requests(fetchMock).map((r) => r.key)).not.toContain(`POST /api/candidates/${candidate.id}/archive`);

    await user.click(screen.getByRole("button", { name: "Yes, archive" }));

    await waitFor(() => expect(currentPath()).toBe("/"));
    expect(requests(fetchMock).map((r) => r.key)).toContain(`POST /api/candidates/${candidate.id}/archive`);
  });

  it("can back out of archiving", async () => {
    const candidate = makeDetail();
    const fetchMock = serveCandidate(candidate);
    const { user } = renderApp(`/candidates/${candidate.id}`);
    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });

    await user.click(screen.getByRole("button", { name: "Archive" }));
    await user.click(screen.getByRole("button", { name: "Keep candidate" }));

    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(requests(fetchMock).map((r) => r.key)).not.toContain(`POST /api/candidates/${candidate.id}/archive`);
  });

  it("marks an archived candidate and offers no Archive button", async () => {
    const candidate = makeDetail({ archivedAt: "2026-11-04T09:00:00Z" });
    serveCandidate(candidate);
    renderApp(`/candidates/${candidate.id}`);

    expect(await screen.findByText(/Archived on 4 Nov 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    // Archived candidates can still be moved and noted (task 4 decision).
    expect(screen.getByRole("combobox", { name: "Move to stage" })).toBeEnabled();
  });
});

describe("candidate detail: notes", () => {
  it("lists notes newest first with when they were written", async () => {
    const candidate = makeDetail();
    serveCandidate(candidate);
    renderApp(`/candidates/${candidate.id}`);

    const notes = await screen.findByRole("region", { name: "Notes" });
    const items = within(notes).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Phone screen went well.");
    expect(items[1]).toHaveTextContent("Moved to Interview after screening.");
    expect(items[0].querySelector("time")).toHaveAttribute("dateTime", "2026-11-03T15:10:00Z");
  });

  it("adds a note to the top of the list and clears the box", async () => {
    const candidate = makeDetail();
    const fetchMock = serveCandidate(candidate);
    const { user } = renderApp(`/candidates/${candidate.id}`);
    const box = await screen.findByRole("textbox", { name: "Add a note" });

    await user.type(box, "Offer call booked.");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    const notes = screen.getByRole("region", { name: "Notes" });
    await waitFor(() => expect(within(notes).getAllByRole("listitem")[0]).toHaveTextContent("Offer call booked."));
    expect(box).toHaveValue("");
    expect(requests(fetchMock)).toContainEqual({
      key: `POST /api/candidates/${candidate.id}/notes`,
      body: { body: "Offer call booked." },
    });
  });

  it("cannot add a blank note", async () => {
    const candidate = makeDetail();
    serveCandidate(candidate);
    const { user } = renderApp(`/candidates/${candidate.id}`);
    const box = await screen.findByRole("textbox", { name: "Add a note" });

    await user.type(box, "   ");

    expect(screen.getByRole("button", { name: "Add note" })).toBeDisabled();
  });

  it("keeps the draft when saving fails", async () => {
    const candidate = makeDetail();
    serveCandidate(candidate, {
      [`POST /api/candidates/${candidate.id}/notes`]: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const { user } = renderApp(`/candidates/${candidate.id}`);
    const box = await screen.findByRole("textbox", { name: "Add a note" });

    await user.type(box, "Important detail");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't add the note.");
    expect(box).toHaveValue("Important detail");
  });

  it("has no way to edit or delete a note", async () => {
    const candidate = makeDetail();
    serveCandidate(candidate);
    renderApp(`/candidates/${candidate.id}`);

    const notes = await screen.findByRole("region", { name: "Notes" });
    const buttons = within(notes).getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual(["Add note"]);
  });
});

describe("candidate detail: AI summary", () => {
  const summaryCard = () => screen.getByRole("region", { name: "AI summary" });

  it("offers to generate a summary when there is none, then shows it", async () => {
    const candidate = makeDetail();
    const fetchMock = serveCandidate(candidate, {
      [`POST /api/candidates/${candidate.id}/summary`]: () =>
        jsonResponse({ ...candidate, notes: undefined, summary, summaryStatus: "ok" }),
    });
    const { user } = renderApp(`/candidates/${candidate.id}`);
    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });
    expect(summaryCard()).toHaveTextContent("No summary yet.");

    await user.click(within(summaryCard()).getByRole("button", { name: "Generate summary" }));

    expect(await within(summaryCard()).findByText("TypeScript")).toBeInTheDocument();
    expect(within(summaryCard()).getByText("Led a TypeScript migration.")).toBeInTheDocument();
    expect(within(summaryCard()).getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(requests(fetchMock).map((r) => r.key)).toContain(`POST /api/candidates/${candidate.id}/summary`);
    // Notes are still there: the summary response has none, and they must not be lost.
    expect(within(screen.getByRole("region", { name: "Notes" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows skills, highlights and the accuracy warning for a stored summary", async () => {
    const candidate = makeDetail({ summary, summaryStatus: "ok" });
    serveCandidate(candidate);
    renderApp(`/candidates/${candidate.id}`);

    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });
    expect(within(summaryCard()).getByText("React")).toBeInTheDocument();
    expect(summaryCard()).toHaveTextContent("AI summaries can be wrong.");
  });

  it("explains an unsummarisable resume and offers to try again", async () => {
    const candidate = makeDetail({
      summaryStatus: "unsummarizable",
      summaryReason: "Resume text is too short to summarize",
    });
    serveCandidate(candidate);
    renderApp(`/candidates/${candidate.id}`);

    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });
    expect(summaryCard()).toHaveTextContent("This resume can't be summarised");
    expect(summaryCard()).toHaveTextContent("Resume text is too short to summarize.");
    expect(within(summaryCard()).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("explains an AI failure and says the rest of the profile still works", async () => {
    const candidate = makeDetail({ summaryStatus: "error", summaryReason: "The AI service timed out" });
    serveCandidate(candidate);
    renderApp(`/candidates/${candidate.id}`);

    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });
    expect(summaryCard()).toHaveTextContent("The summary couldn't be generated");
    expect(summaryCard()).toHaveTextContent("The AI service timed out.");
    expect(summaryCard()).toHaveTextContent("The rest of this profile still works.");
  });

  it("shows the previous summary under the error after a failed regenerate", async () => {
    const candidate = makeDetail({ summary, summaryStatus: "error", summaryReason: "The AI service failed" });
    serveCandidate(candidate);
    renderApp(`/candidates/${candidate.id}`);

    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });
    expect(summaryCard()).toHaveTextContent("The summary couldn't be generated");
    expect(within(summaryCard()).getByRole("heading", { name: "Previous summary" })).toBeInTheDocument();
    expect(within(summaryCard()).getByText("React")).toBeInTheDocument();
  });

  it("disables the button while generating", async () => {
    const candidate = makeDetail();
    const pending = deferred<Response>();
    serveCandidate(candidate, { [`POST /api/candidates/${candidate.id}/summary`]: () => pending.promise });
    const { user } = renderApp(`/candidates/${candidate.id}`);
    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });

    await user.click(within(summaryCard()).getByRole("button", { name: "Generate summary" }));

    expect(within(summaryCard()).getByRole("button", { name: "Generating…" })).toBeDisabled();
    pending.resolve(jsonResponse({ ...candidate, notes: undefined, summary, summaryStatus: "ok" }));
    expect(await within(summaryCard()).findByRole("button", { name: "Regenerate" })).toBeEnabled();
  });

  it("keeps the rest of the page working when the summary request itself fails", async () => {
    const candidate = makeDetail();
    serveCandidate(candidate, {
      [`POST /api/candidates/${candidate.id}/summary`]: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const { user } = renderApp(`/candidates/${candidate.id}`);
    await screen.findByRole("heading", { level: 1, name: "Mara Okafor" });

    await user.click(within(summaryCard()).getByRole("button", { name: "Generate summary" }));

    expect(await within(summaryCard()).findByRole("alert")).toHaveTextContent(
      "The rest of this profile still works.",
    );
    expect(screen.getByRole("textbox", { name: "Add a note" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Move to stage" })).toBeEnabled();
  });
});
