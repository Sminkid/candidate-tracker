import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { deferred, jsonResponse, makeCandidate, mockFetch } from "../helpers/api";
import { renderApp } from "../helpers/renderApp";

type User = ReturnType<typeof renderApp>["user"];

// Finds a field by its accessible name: what a screen reader announces.
// (getByLabelText would match the label's full text, including the hidden "Required" tag.)
function field(name: string): HTMLElement {
  return screen.getByRole(name === "Source" ? "combobox" : "textbox", { name });
}

async function fillRequiredFields(user: User) {
  await user.type(field("Full name"), "Mara Okafor");
  await user.type(field("Email"), "mara@example.com");
  await user.type(field("Role applied for"), "Frontend Engineer");
  await user.type(field("Resume or cover letter"), "Senior frontend engineer.");
}

// A fake API: POST creates the candidate; GET returns it as the detail page
// expects (with its notes), because a successful save opens that page.
function serveCreate(created = makeCandidate()) {
  return mockFetch((_url, init) =>
    init.method === "POST" ? jsonResponse(created, 201) : jsonResponse({ ...created, notes: [] }),
  );
}

// The parsed JSON body of every POST to /api/candidates.
function postedBodies(fetchMock: ReturnType<typeof mockFetch>): unknown[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

describe("add candidate form", () => {
  it("has a labelled field for everything the API accepts, and no stage field", () => {
    renderApp("/candidates/new");

    for (const label of ["Full name", "Email", "Role applied for", "Phone", "Source", "Resume or cover letter"]) {
      expect(field(label)).toBeInTheDocument();
    }
    expect(field("Full name")).toBeRequired();
    expect(field("Phone")).not.toBeRequired();
    expect(screen.queryByRole("combobox", { name: /stage/i })).not.toBeInTheDocument();
    expect(field("Resume or cover letter")).toHaveAccessibleDescription(
      "The AI summary is generated from this text.",
    );
  });

  it("hides the header's Add candidate button on this page", () => {
    renderApp("/candidates/new");

    expect(screen.queryByRole("link", { name: "Add candidate" })).not.toBeInTheDocument();
  });

  it("sends the form to the API and opens the new candidate's page", async () => {
    const created = makeCandidate({ name: "Mara Okafor" });
    const fetchMock = serveCreate(created);
    const { user, currentPath } = renderApp("/candidates/new");

    await fillRequiredFields(user);
    await user.type(field("Phone"), "0400 000 123");
    await user.selectOptions(field("Source"), "LinkedIn");
    await user.click(screen.getByRole("button", { name: "Save candidate" }));

    await waitFor(() => expect(currentPath()).toBe(`/candidates/${created.id}`));
    expect(postedBodies(fetchMock)).toEqual([
      {
        name: "Mara Okafor",
        email: "mara@example.com",
        role: "Frontend Engineer",
        resumeText: "Senior frontend engineer.",
        phone: "0400 000 123",
        source: "LinkedIn",
      },
    ]);
  });

  it("sends empty optional fields as empty text (the server stores them as null)", async () => {
    const fetchMock = serveCreate();
    const { user } = renderApp("/candidates/new");

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Save candidate" }));

    await waitFor(() => expect(postedBodies(fetchMock)).toHaveLength(1));
    expect(postedBodies(fetchMock)[0]).toMatchObject({ phone: "", source: "" });
  });

  it("shows each server validation error under its field and keeps what was typed", async () => {
    mockFetch(() =>
      jsonResponse({ error: { message: "name: is required; email: must be a valid email address" } }, 400),
    );
    const { user, currentPath } = renderApp("/candidates/new");
    await fillRequiredFields(user);
    // Only spaces: the browser's `required` accepts this, the server's trim() + min(1) does not.
    await user.clear(field("Full name"));
    await user.type(field("Full name"), "   ");

    await user.click(screen.getByRole("button", { name: "Save candidate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please fix the fields marked below.");
    const name = field("Full name");
    expect(name).toBeInvalid();
    expect(name).toHaveAccessibleDescription("Full name is required");
    expect(field("Email")).toHaveAccessibleDescription(
      "Email must be a valid email address",
    );
    expect(field("Role applied for")).not.toHaveAttribute("aria-invalid");
    expect(field("Role applied for")).toHaveValue("Frontend Engineer");
    expect(currentPath()).toBe("/candidates/new");
  });

  it("shows a general message when the server cannot be reached, and allows another try", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const { user } = renderApp("/candidates/new");
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: "Save candidate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server. Check that it is running and try again.",
    );
    expect(screen.getByRole("button", { name: "Save candidate" })).toBeEnabled();
  });

  it("disables the button while saving, so a double click creates one candidate", async () => {
    const response = deferred<Response>();
    const created = makeCandidate();
    const fetchMock = mockFetch((_url, init) =>
      init.method === "POST" ? response.promise : jsonResponse({ ...created, notes: [] }),
    );
    const { user } = renderApp("/candidates/new");
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", { name: "Save candidate" }));
    const saving = screen.getByRole("button", { name: "Saving…" });
    expect(saving).toBeDisabled();
    await user.click(saving);

    response.resolve(jsonResponse(created, 201));
    await waitFor(() => expect(postedBodies(fetchMock)).toHaveLength(1));
  });

  it("Cancel goes back to the list without sending anything", async () => {
    const fetchMock = mockFetch(() => jsonResponse([]));
    const { user, currentPath } = renderApp("/candidates/new");

    await user.click(screen.getByRole("link", { name: "Cancel" }));

    expect(currentPath()).toBe("/");
    expect(postedBodies(fetchMock)).toHaveLength(0);
  });
});
