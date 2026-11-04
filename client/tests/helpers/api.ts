import { vi } from "vitest";
import type { Candidate } from "../../src/api/types";

// The client is tested against a fake fetch: no server, no network.
// The handler gets the parsed URL and options and returns the Response the test wants.
type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

export function mockFetch(handler: Handler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) =>
    handler(new URL(String(input), "http://localhost"), init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Path + query of every request made so far, e.g. "/api/candidates?stage=offer".
export function requestedPaths(fetchMock: ReturnType<typeof mockFetch>): string[] {
  return fetchMock.mock.calls.map(([input]) => {
    const url = new URL(String(input), "http://localhost");
    return url.pathname + url.search;
  });
}

// A promise the test resolves by hand, to control which response arrives first.
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

let nextId = 1;

export function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  const id = `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
  return {
    id,
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: null,
    role: "Backend Engineer",
    resumeText: "Wrote the first published algorithm for a computing machine.",
    source: null,
    stage: "applied",
    summary: null,
    summaryStatus: null,
    summaryReason: null,
    archivedAt: null,
    createdAt: "2026-11-03T12:00:00.000Z",
    ...overrides,
  };
}
