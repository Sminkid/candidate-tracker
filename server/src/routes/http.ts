import type { ErrorRequestHandler, RequestHandler } from "express";
import type { z } from "zod";
import { NotFoundError } from "../services/errors";

// HTTP plumbing shared by all routes: input validation, and turning errors
// into the one response shape from CLAUDE.md: { "error": { "message": "..." } }.

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

// Checks `data` against a Zod schema. Returns the cleaned, typed value, or
// throws a BadRequestError that lists every problem, e.g. "name: is required".
export function validate<Schema extends z.ZodType>(schema: Schema, data: unknown): z.output<Schema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    throw new BadRequestError(message);
  }
  return result.data;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: "Route not found" } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof BadRequestError) {
    res.status(400).json({ error: { message: err.message } });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: { message: err.message } });
    return;
  }
  // express.json() marks a body it could not parse with this type.
  if (isJsonParseError(err)) {
    res.status(400).json({ error: { message: "Request body is not valid JSON" } });
    return;
  }

  console.error("Unhandled error:", describeErrorSafely(err));
  res.status(500).json({ error: { message: "Internal server error" } });
};

function isJsonParseError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed";
}

// Never log resume text. Drizzle's error message includes the query parameters
// (which can contain a whole resume), so for wrapped database errors we log only
// the SQL text (values appear as $1, $2...) and the underlying Postgres code and message.
function describeErrorSafely(err: unknown): string {
  if (!(err instanceof Error)) return "Non-error value thrown";
  const cause = err.cause;
  if (cause instanceof Error) {
    const code = "code" in cause ? ` [${String(cause.code)}]` : "";
    const query = "query" in err ? ` | query: ${String(err.query)}` : "";
    return `Database error: ${cause.message}${code}${query}`;
  }
  return `${err.name}: ${err.message}`;
}
