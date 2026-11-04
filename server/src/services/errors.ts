// Errors that describe a broken business rule, not an HTTP status.
// Routes decide how each one maps to a response (NotFoundError → 404).

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
