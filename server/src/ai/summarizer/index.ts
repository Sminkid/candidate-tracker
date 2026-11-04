import type { SummaryModelClient } from "./client";
import { preflight } from "./preflight";
import { buildPrompt, SYSTEM_INSTRUCTION } from "./prompt";
import { summaryOutputSchema, type SummaryOutput } from "./schema";

// Public entry point of the AI module. The rest of the app calls summarize()
// (through a Summarizer) and gets back a result object. It never throws:
// every failure becomes { status: "error" } so callers can store it and move on.

export type SummaryResult =
  | { status: "ok"; skills: string[]; highlights: string[] }
  | { status: "unsummarizable"; reason: string }
  | { status: "error"; reason: string };

export type SummarizeOptions = {
  client: SummaryModelClient;
  timeoutMs?: number;
};

// What services receive: summarize() with the client and timeout already chosen.
export type Summarizer = (resumeText: string) => Promise<SummaryResult>;

export const DEFAULT_TIMEOUT_MS = 20_000;

export async function summarize(resumeText: string, opts: SummarizeOptions): Promise<SummaryResult> {
  const checked = preflight(resumeText);
  if (!checked.ok) {
    return { status: "unsummarizable", reason: checked.reason };
  }

  let rawAnswer: string;
  try {
    rawAnswer = await callModelWithTimeout(
      opts.client,
      { systemInstruction: SYSTEM_INSTRUCTION, prompt: buildPrompt(checked.text) },
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof SummaryTimeoutError) {
      logFailure("The AI service timed out");
      return { status: "error", reason: "The AI service timed out" };
    }
    logFailure("The AI service failed", describeErrorSafely(err));
    return { status: "error", reason: "The AI service failed" };
  }

  const output = parseModelAnswer(rawAnswer);
  if (!output) {
    return { status: "error", reason: "The AI returned an invalid summary" };
  }
  if (output.skills.length === 0 && output.highlights.length === 0) {
    return { status: "unsummarizable", reason: "The AI found no skills or highlights in this resume" };
  }
  return { status: "ok", skills: output.skills, highlights: output.highlights };
}

export function createSummarizer(opts: SummarizeOptions): Summarizer {
  return (resumeText) => summarize(resumeText, opts);
}

// Untrusted text → validated summary, or undefined if it is not exactly the shape we accept.
function parseModelAnswer(rawAnswer: string): SummaryOutput | undefined {
  let json: unknown;
  try {
    json = JSON.parse(rawAnswer);
  } catch {
    // Not logging the parse error: its message quotes part of the answer.
    logFailure("The AI returned an invalid summary", "answer was not JSON");
    return undefined;
  }

  const result = summaryOutputSchema.safeParse(json);
  if (!result.success) {
    // Only paths and codes (e.g. "skills:too_big"), never the values.
    const problems = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}:${issue.code}`);
    logFailure("The AI returned an invalid summary", problems.join(", "));
    return undefined;
  }
  return result.data;
}

class SummaryTimeoutError extends Error {
  constructor() {
    super("Summary request timed out");
    this.name = "SummaryTimeoutError";
  }
}

// Races the model call against a timer. When the timer wins, the request's
// AbortSignal is fired so the real client cancels its HTTP call.
async function callModelWithTimeout(
  client: SummaryModelClient,
  request: { systemInstruction: string; prompt: string },
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new SummaryTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([client.generateJson({ ...request, signal: controller.signal }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Never log resume text. Error messages from the SDK can echo the request,
// so only the error's name and HTTP status (if any) are logged.
function describeErrorSafely(err: unknown): string {
  if (!(err instanceof Error)) return "non-error value thrown";
  const status = "status" in err && typeof err.status === "number" ? ` (HTTP ${err.status})` : "";
  return `${err.name}${status}`;
}

function logFailure(reason: string, detail?: string): void {
  console.warn(`Summary failed: ${reason}${detail ? ` [${detail}]` : ""}`);
}

export type { ModelRequest, SummaryModelClient } from "./client";
export { createGeminiClient, unconfiguredClient } from "./client";
