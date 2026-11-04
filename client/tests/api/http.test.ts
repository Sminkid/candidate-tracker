import { describe, it, expect } from "vitest";
import { apiRequest, ApiError, errorMessage } from "../../src/api/http";
import { jsonResponse, mockFetch } from "../helpers/api";

describe("apiRequest", () => {
  it("returns the parsed JSON body", async () => {
    mockFetch(() => jsonResponse([{ id: "1" }]));

    await expect(apiRequest("/api/candidates")).resolves.toEqual([{ id: "1" }]);
  });

  it("sends a body as JSON with the right content type", async () => {
    const fetchMock = mockFetch(() => jsonResponse({}, 201));

    await apiRequest("/api/candidates/1/notes", { method: "POST", body: { body: "Hi" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ body: "Hi" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("turns the server's error shape into an ApiError with its message and status", async () => {
    mockFetch(() => jsonResponse({ error: { message: "name: is required" } }, 400));

    const error = await apiRequest("/api/candidates").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: "name: is required" });
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    mockFetch(() => new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(apiRequest("/api/candidates")).rejects.toMatchObject({
      status: 502,
      message: "Request failed (502)",
    });
  });

  it("reports an unreachable server with a readable message", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });

    await expect(apiRequest("/api/candidates")).rejects.toMatchObject({
      status: 0,
      message: "Could not reach the server. Check that it is running and try again.",
    });
  });

  it("lets a cancelled request fail as a cancellation, not as an ApiError", async () => {
    mockFetch(() => {
      throw new DOMException("Aborted", "AbortError");
    });
    const controller = new AbortController();
    controller.abort();

    const error = await apiRequest("/api/candidates", { signal: controller.signal }).catch((err: unknown) => err);

    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe("errorMessage", () => {
  it("shows ApiError messages and hides anything else", () => {
    expect(errorMessage(new ApiError(400, "email: must be a valid email address"))).toBe(
      "email: must be a valid email address",
    );
    expect(errorMessage(new Error("TypeError: x is undefined"))).toBe("Something went wrong. Please try again.");
  });
});
