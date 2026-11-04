import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Candidate } from "../../src/api/types";
import { deferred, jsonResponse, makeCandidate, mockFetch, requestedPaths } from "../helpers/api";
import { renderApp } from "../helpers/renderApp";

const mara = makeCandidate({
  name: "Mara Okafor",
  email: "mara@example.com",
  role: "Frontend Engineer",
  stage: "interview",
  source: "LinkedIn",
});
const priya = makeCandidate({ name: "Priya Nair", role: "Data Analyst", stage: "applied", source: null });
const tom = makeCandidate({ name: "Tom Becker", role: "Frontend Engineer", stage: "offer" });

// A fake API that filters by stage like the real one. Good enough for these tests.
function serveCandidates(candidates: Candidate[]) {
  return mockFetch((url) => {
    const stage = url.searchParams.get("stage");
    return jsonResponse(stage ? candidates.filter((c) => c.stage === stage) : candidates);
  });
}

const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1); // skip the header row

describe("candidate list", () => {
  it("shows each candidate with a link to their page, role, stage label, source and date", async () => {
    serveCandidates([mara, priya]);
    renderApp("/");

    const link = await screen.findByRole("link", { name: "Mara Okafor" });
    expect(link).toHaveAttribute("href", `/candidates/${mara.id}`);

    const [maraRow, priyaRow] = rows();
    expect(within(maraRow).getByText("Frontend Engineer")).toBeInTheDocument();
    expect(within(maraRow).getByText("Interview")).toBeInTheDocument(); // stage as text, not colour only
    expect(within(maraRow).getByText("LinkedIn")).toBeInTheDocument();
    expect(within(maraRow).getByText("3 Nov")).toBeInTheDocument();
    expect(within(priyaRow).getByLabelText("No source")).toBeInTheDocument();
    expect(screen.getByText("2 candidates")).toBeInTheDocument();
  });

  it("filters by stage through the API and remembers the filter in the URL", async () => {
    const fetchMock = serveCandidates([mara, priya, tom]);
    const { user } = renderApp("/");
    await screen.findByRole("link", { name: "Mara Okafor" });

    await user.selectOptions(screen.getByLabelText("Stage"), "offer");

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByRole("link", { name: "Tom Becker" })).toBeInTheDocument();
    expect(requestedPaths(fetchMock)).toContain("/api/candidates?stage=offer");
    expect(screen.getByLabelText("Stage")).toHaveValue("offer");
  });

  it("starts from filters already in the URL", async () => {
    const fetchMock = serveCandidates([mara, priya, tom]);
    renderApp("/?stage=interview&sort=stage");

    await screen.findByRole("link", { name: "Mara Okafor" });

    expect(requestedPaths(fetchMock)).toContain("/api/candidates?stage=interview&sort=stage");
    expect(screen.getByLabelText("Stage")).toHaveValue("interview");
    expect(screen.getByLabelText("Sort by")).toHaveValue("stage");
  });

  it("does not send an unknown stage from the URL to the API", async () => {
    const fetchMock = serveCandidates([mara]);
    renderApp("/?stage=hired");

    await screen.findByRole("link", { name: "Mara Okafor" });

    expect(requestedPaths(fetchMock).every((path) => !path.includes("hired"))).toBe(true);
    expect(screen.getByLabelText("Stage")).toHaveValue("");
  });

  it("builds the role filter from the data", async () => {
    serveCandidates([mara, priya, tom]);
    renderApp("/");

    await screen.findByRole("option", { name: "Data Analyst" });

    const options = within(screen.getByLabelText("Role applied for")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["All roles", "Data Analyst", "Frontend Engineer"]);
  });

  it("sends the chosen role and sort to the API", async () => {
    const fetchMock = serveCandidates([mara, priya, tom]);
    const { user } = renderApp("/");
    await screen.findByRole("option", { name: "Data Analyst" });

    await user.selectOptions(screen.getByLabelText("Role applied for"), "Data Analyst");
    await user.selectOptions(screen.getByLabelText("Sort by"), "stage");

    await waitFor(() =>
      expect(requestedPaths(fetchMock)).toContain("/api/candidates?role=Data+Analyst&sort=stage"),
    );
  });

  it("shows a message when nothing matches", async () => {
    serveCandidates([]);
    renderApp("/");

    expect(await screen.findByText("No candidates match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the error and can try again", async () => {
    let fail = true;
    mockFetch(() => (fail ? jsonResponse({ error: { message: "Internal server error" } }, 500) : jsonResponse([mara])));
    const { user } = renderApp("/");

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load candidates. Internal server error");

    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Mara Okafor" })).toBeInTheDocument();
  });

  it("never lets a slow, older response replace a newer one", async () => {
    const slowScreening = deferred<Response>();
    mockFetch((url) => {
      const stage = url.searchParams.get("stage");
      if (stage === "screening") return slowScreening.promise;
      if (stage === "offer") return jsonResponse([tom]);
      return jsonResponse([mara, priya, tom]);
    });
    const { user } = renderApp("/");
    await screen.findByRole("link", { name: "Mara Okafor" });

    // The user picks Screening (slow), then Offer (fast) before Screening answers.
    await user.selectOptions(screen.getByLabelText("Stage"), "screening");
    await user.selectOptions(screen.getByLabelText("Stage"), "offer");
    await screen.findByRole("link", { name: "Tom Becker" });

    // Now the old Screening request finally answers.
    slowScreening.resolve(jsonResponse([makeCandidate({ name: "Stale Result", stage: "screening" })]));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.queryByText("Stale Result")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tom Becker" })).toBeInTheDocument();
  });
});
