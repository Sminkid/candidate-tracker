// One place that talks HTTP. Every API call goes through apiRequest(), which
// turns the server's error shape { "error": { "message": "..." } } into an ApiError.

// Empty in development (Vite proxies /api to Express). Set VITE_API_URL when the
// API lives on another origin, e.g. a separate Vercel deployment.
const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  signal?: AbortSignal;
};

export async function apiRequest<T>(path: string, { method = "GET", body, signal }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_BASE_URL + path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // A cancelled request is not a failure: let the caller recognise and ignore it.
    if (signal?.aborted) throw err;
    throw new ApiError(0, "Could not reach the server. Check that it is running and try again.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (hasErrorMessage(body)) return body.error.message;
  } catch {
    // Not JSON (e.g. a proxy error page). Fall through to the generic message.
  }
  return `Request failed (${response.status})`;
}

function hasErrorMessage(body: unknown): body is { error: { message: string } } {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const error = body.error;
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string";
}

// A message that is safe to show for any thrown value.
export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
}
