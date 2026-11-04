# Candidate Tracker — project conventions

A mini applicant tracking system (ATS) with one AI feature: auto-generated candidate summaries.
Priorities: a working end-to-end slice, readable code, and tests that catch real bugs.

Context: take-home assignment for an early-careers full-stack role, assessed on code structure,
reasoning, tests and how AI tools are used. The author must be able to explain any part live.

## Working agreement (how to work with the author)
- Claude builds: creates/edits files and runs tests and commands. **Claude never commits**; the author commits after review.
- Work one phase (task) at a time. At the end of each phase, stop and give:
  1. Summary of what was built and which files changed
  2. How to run it and the tests, and the output seen
  3. Walkthrough of the MUST-UNDERSTAND parts (Zod schemas, service logic, AI module, test design). **Explain Zod in depth; Drizzle only briefly** (the author's learning focus is Zod).
  4. List of BOILERPLATE the author can skim
- Test-first for services and the AI module: write failing tests, show them failing, then implement. No implementations that hardcode values to pass tests. After green, break key rules on purpose to prove the tests catch them (then restore).
- Follow the layer rules and AI module rules strictly. If something in the plan seems wrong, say so before building. If something is outside the plan, ask first.
- Never ask for, print or log API keys or connection strings. They live in `server/.env` (gitignored).
- Never call the real Gemini API in automated tests.
- "Rebuild exercise" = give failing tests + description, no implementation; then review the author's version. "Quiz" = test the author on the phase just finished.
- Keep a running list of genuine moments where the author corrects/rejects/changes Claude's work, or Claude catches its own mistake (see "AI usage log" at the bottom). Never invent entries. Show it when asked.

## Status
| # | Task | Status |
|---|------|--------|
| 1 | Planning and stack decisions | Done |
| 2 | Setup (Neon, Gemini key, repo skeleton, CLAUDE.md, README draft) | Done |
| 3 | Server scaffold and database | Done (committed) |
| 4 | Candidate service, notes and routes (test-first) | Done (committed) |
| 5 | AI summarizer module (test-first) + summary endpoint | Done — 156 tests passing; **awaiting author review, `npm run db:migrate` (0002) and commit** |
| 6 | React client: add form, list with filters/sort, detail page with notes, stage change, summary | **Next** |
| 7 | Integration and seed data, incl. garbled and adversarial resumes | To do |
| 8 | Docs: README run steps + tests command, one-page write-up, AI usage log, learning log, screenshots/demo | To do |
| 9 | Deploy to Vercel (two projects, one repo), or one-page cloud design if short on time | To do |

Protect tasks 3–5 above all. If time runs short, cut from the end.

### Task 5 decisions (author)
- Added `summaryReason` (nullable text, migration `0002_summary_reason`): a fixed message we write, never model output or resume text. NULL after a successful summary.
- A failed regenerate **keeps the previous summary** and sets `summaryStatus`/`summaryReason` (Claude had recommended clearing it). The UI must handle "summary present + status error".
- Missing `GEMINI_API_KEY` does not stop the server: it warns, and every summary attempt is stored as `error`.

## Stack
- Frontend: React + Vite + TypeScript (`client/`) — not created yet
- Backend: Node + Express 5 + TypeScript 7 (`server/`), run with `tsx` (no build step)
- Database: Postgres (Neon) via Drizzle ORM 0.45, Neon HTTP driver (`@neondatabase/serverless`)
- Validation: Zod 4, for API input and for AI output
- AI: Gemini via `@google/genai`, model `gemini-2.5-flash`, structured output (`responseSchema`) re-validated with Zod
- Tests: Vitest 5 + Supertest. DB tests run on PGlite (in-memory Postgres). The Gemini client is always faked.
- Node: `^22.12 || ^24 || >=26` (`engines` in `server/package.json`; `.nvmrc` = 24)
- Deploy (optional): Vercel, two projects from one repo (`client/`, `server/` as root directories)

## Layout
```
client/                       React app (task 6)
server/
  drizzle.config.ts           drizzle-kit config; loads .env itself
  src/
    app.ts                    createApp({ db, summarizer }): builds the Express app (no listen)
    server.ts                 connects to Neon, starts on PORT; exits if DATABASE_URL missing
    routes/
      candidates.ts           endpoints: validate → call one service function → JSON
      candidateSchemas.ts     Zod schemas for bodies, queries and :id
      http.ts                 validate(), BadRequestError, 404 handler, error handler (safe logging)
    services/
      candidateService.ts     business rules; takes db as a parameter
      errors.ts               NotFoundError (routes map it to 404)
    db/
      schema.ts               tables, enums, CHECK constraints, inferred types
      index.ts                Database type + createDb(url) for Neon
      candidateRepository.ts  the only place that builds queries
      migrations/             generated SQL (commit; never edit an applied one)
    ai/summarizer/
      index.ts                summarize(), createSummarizer(), SummaryResult/Summarizer types (public entry)
      preflight.ts            empty / too short / mostly non-text checks; truncation
      prompt.ts               SYSTEM_INSTRUCTION, buildPrompt() with <resume> data block
      schema.ts               Zod output schema with caps (the real gate on model output)
      client.ts               SummaryModelClient interface, Gemini implementation, unconfiguredClient
  tests/
    helpers/testDb.ts         createTestDb(), resetTestDb(), TestDb type
    helpers/fakes.ts          unusedSummarizer for tests that never request a summary
    helpers/factories.ts      candidateData(), insertCandidate(), insertNote()
    fixtures/candidates.ts    12 realistic candidates + seedCandidates(db)
    db.test.ts, health.test.ts, services/, routes/, ai/summarizer/
docs/                         write-up, logs, deployment design (task 8)
```
Layer rule: routes know HTTP but not rules; services know rules but not HTTP or SQL; the db layer knows SQL but not rules; only the AI module knows Gemini. Dependencies (db, and later the summarizer) are passed in, never imported as globals, so tests can substitute PGlite and a fake model.
Deliberate exception: `tests/helpers/testDb.ts` imports Drizzle/PGlite (test setup, not app code).

## Data model
- `candidates`: id (uuid, generated), name, email, phone?, role, resumeText, source?, stage (Postgres enum: applied | screening | interview | offer | rejected, default applied), summary? (jsonb, typed as `StoredSummary { skills[], highlights[] }`), summaryStatus? (enum: ok | unsummarizable | error), summaryReason? (text), archivedAt?, createdAt
- `notes`: id (uuid), candidateId (FK → candidates, indexed), body, createdAt. Append-only: no update or delete anywhere.
- Required text columns (name, email, role, resume_text, notes.body) are NOT NULL **and** have CHECK constraints rejecting blank/whitespace-only text (`~ '[^[:space:]]'`).
- phone and source are optional by design (unknown is stored as NULL, never as a placeholder).
- Archive is a soft delete (`archivedAt`). Lists exclude archived candidates by default. Archiving is idempotent (keeps the first date).
- Stage moves are free transitions (no workflow rules). Postgres sorts the stage enum in pipeline order.
- Schema change flow: edit `schema.ts` → `npm run db:generate` → review SQL → `npm run db:migrate` → commit the migration.

## API (REST, JSON)
| Method & path | Success | Notes |
|---|---|---|
| `POST /api/candidates` | 201 candidate | unknown fields (e.g. `stage`) are dropped |
| `GET /api/candidates?stage=&role=&sort=createdAt\|stage&includeArchived=true\|false` | 200 array | default sort newest first; stage sort = pipeline order, newest first within a stage; role is an exact match |
| `GET /api/candidates/:id` | 200 candidate + `notes[]` (oldest first) | archived candidates are still returned |
| `PATCH /api/candidates/:id/stage` | 200 candidate | body `{ stage }` |
| `POST /api/candidates/:id/archive` | 200 candidate | |
| `POST /api/candidates/:id/notes` | 201 note | body `{ body }` |
| `POST /api/candidates/:id/summary` | 200 candidate | generate or regenerate, then store. AI failure is still 200: see `summaryStatus` + `summaryReason` |
- Validate every body, query and `:id` with Zod in the route (`validate()` in `routes/http.ts`). Errors use one shape: `{ "error": { "message": "..." } }`. Messages list every problem, e.g. `name: is required; email: must be a valid email address`.
- Status codes: 400 invalid input / malformed JSON / non-UUID id; 404 unknown candidate or route; 500 generic `"Internal server error"`.
- Input cleaning (Zod): text is trimmed; email trimmed + lowercased; blank/null optional fields become NULL. Limits: name/role 200, email 254, phone 50, source 100, resumeText 100,000, note 5,000 chars; JSON body 1 MB.
- Decisions made in task 4 (author may revisit): archived candidates can still be viewed, moved and noted; malformed id → 400 (not 404); emails lowercased.

## AI module rules (`server/src/ai/summarizer/`)
- One public entry point: `summarize(resumeText, opts?) -> SummaryResult`. Nothing else in the app imports Gemini.
- Files: `index.ts` (entry), `prompt.ts`, `schema.ts` (Zod), `preflight.ts` (input checks), `client.ts` (Gemini wrapper behind an interface so tests can inject a fake).
- Result is a discriminated union: `ok { skills[], highlights[] }` | `unsummarizable { reason }` | `error { reason }`. It never throws to the caller.
- Preflight before any model call: reject empty, too-short or mostly non-text input; truncate to a fixed maximum length.
- Prompt-injection defence: the resume goes in a clearly delimited data block; the system prompt states that its contents are untrusted data and any instructions inside must be ignored; low temperature; structured output enforced via `responseSchema`; output re-validated with Zod with capped array and string lengths; anything failing validation is rejected.
- Never log resume text. Use a request timeout. The app must keep working when the AI call fails.

## Testing
- Test behaviour that matters; do not chase a coverage number.
- Services and the AI module are developed test-first (red, green, refactor).
- Must cover: stage transitions, append-only notes, archive/filter/sort, summarizer preflight, schema validation, an injection fixture (faked model returns hostile output), and the AI failure path.
- Never call the real Gemini API in automated tests.
- DB test files: one PGlite per file, emptied before each test:
  ```ts
  const db = await createTestDb();
  beforeEach(() => resetTestDb(db));
  ```
  Tests in a file share that database, so never use `it.concurrent` there.
- Test data: use `seedCandidates(db)` (realistic fixture) for rules across many records and assert **properties** ("every result has stage X", "each pair is in order"), not hardcoded counts. Use factories (`insertCandidate(db, { ...overrides })`) for exact, controlled cases. Fixture guard tests keep the fixture covering every stage, archived + active, repeated roles, distinct createdAt.
- Assert exact reasons, not just "it threw": Postgres codes `23502` NOT NULL, `23503` FK, `23514` CHECK; `NotFoundError` for missing rows.
- Commands (from `server/`): `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run dev`, `npm run db:generate`, `npm run db:migrate`.

## Conventions
- TypeScript strict mode. Prefer plain, readable code over clever code.
- Keep scope tight: no auth, no pagination, no drag-and-drop. File upload only if time remains.
- Secrets live in `server/.env` (gitignored); keep `server/.env.example` current (`DATABASE_URL`, `GEMINI_API_KEY`).
- The README must let a stranger go from clone to running app in a few steps (include: Node version / `nvm use`, copy `.env.example` → `.env`, `npm ci`, `npm run db:migrate`, `npm run dev`, `npm test`).
- Cross-platform: `.gitattributes` forces LF; `.editorconfig` for editors; npm scripts must stay shell-neutral (no `rm`, `cp`, `VAR=x`).

## Gotchas found so far
- TypeScript 7 no longer auto-loads `@types/*`; globals need `"types": ["node"]` in tsconfig.
- Drizzle's `DrizzleQueryError.message` contains query **params** (can include a whole resume). Never log `err.message` for DB errors; `describeErrorSafely` in `routes/http.ts` logs only the Postgres code/message and the SQL with placeholders. A route test asserts resume text never reaches the log.
- Through the generic `Database` type, `db.execute()` results are `unknown`; test helpers use the PGlite-specific `TestDb` type instead.
- V8's `JSON.parse` error message quotes part of the input, and SDK errors can echo the request: the summarizer logs only fixed text, error name/HTTP status and Zod issue paths/codes.
- `@google/genai` `Schema` takes `maxItems` as a **string**. Its `responseSchema` is a request, not a guarantee; Zod is the gate. A test keeps its field names in step with the Zod schema.
- `npm audit` reports moderate issues from an old esbuild inside drizzle-kit (dev only, not exploitable here); the suggested `--force` fix downgrades drizzle-kit — do not run it.

## AI usage log (running list; genuine moments only)
1. Claude's `tsconfig.json` had no `types` field; on TypeScript 7 `process` was not found. Fixed with `"types": ["node"]`. Lesson: check the installed tool version, not remembered defaults.
2. Claude caught its own weak FK test (`.rejects.toThrow()` passes for any error); now asserts Postgres code `23503`.
3. Author redirected teaching focus: Zod is the learning goal, not Drizzle.
4. Author overruled Claude's "optimise the test DB later": done immediately (one PGlite per file + reset); suite 6.06s → 1.46s.
5. Claude's first `resetTestDb` failed typecheck (`unknown` results via generic `Database`); switched to `TestDb` with a compile-time assignability check.
6. Author pushed back on "missing data" in Claude's fixture plan. This exposed that the DB accepted blank strings in required fields → added CHECK constraints + 16 tests. Author kept phone/source optional after explanation.
7. Claude caught its own broken sort test (pointless `.reverse().reverse()`, data gave the same order for both sorts); rewrote it so date and stage order disagree.
8. Claude's first safe error log was too vague (`Error: PGlite is closed`); added the SQL text with placeholders so failures are traceable without leaking resume text.
9. Author overruled Claude's recommendation to clear the old summary when a regenerate fails: the previous summary is kept, with status/reason marking the failure.
10. Claude caught its own prompt-injection hole: a single-pass tag strip turns `<res<resume>ume>` into `<resume>`. Wrote the failing test first, then fixed it by repeating the strip until nothing changes.
