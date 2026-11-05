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
| 5 | AI summarizer module (test-first) + summary endpoint | Done (committed) |
| 6 | React client: add form, list with filters/sort, detail page with notes, stage change, summary | Done (committed): list, add form, detail; 76 client tests |
| 7 | Integration and seed data, incl. garbled and adversarial resumes | Seed done (committed): `npm run db:seed`, 10 demo candidates, 13 tests. **Integration check still to do** (whole app on real data, incl. the 3 demo AI cases) |
| 8 | Docs: README run steps + tests command, one-page write-up, AI usage log, learning log, screenshots/demo | **Partly done**: README drafted (getting started incl. root `npm ci` + `npm run dev`, tests, deployment + TS 7 workarounds, architecture, input rules, AI feature, demo data, limitations). To do: `docs/` folder (doesn't exist yet), one-page write-up, AI usage log (copy from below), learning log, screenshots/demo |
| 9 | Deploy to Vercel (two projects, one repo), or one-page cloud design if short on time | **Done** (out of order, alongside task 7): server project at `https://candidate-tracker-pfqj.vercel.app` (`/health` and `/api/candidates` returned 200 on 2026-11-05); client project deployed and confirmed working by the author (2026-11-05); `client/vercel.json` points at the server |

Protect tasks 3–5 above all. If time runs short, cut from the end.

### Task 5 decisions (author)
- Added `summaryReason` (nullable text, migration `0002_summary_reason`): a fixed message we write, never model output or resume text. NULL after a successful summary.
- A failed regenerate **keeps the previous summary** and sets `summaryStatus`/`summaryReason` (Claude had recommended clearing it). The UI must handle "summary present + status error".
- Missing `GEMINI_API_KEY` does not stop the server: it warns, and every summary attempt is stored as `error`.

### Task 6 decisions (author)
- Summaries are **manual only**: a never-summarised candidate (`summaryStatus` null) shows "No summary yet" + a Generate button. No auto-call after save.
- Client gets **logic + component tests** (Vitest + React Testing Library, jsdom, fetch faked).
- Unsummarisable state: **show the stored reason + a "Try again" button** (Claude had recommended no retry, since preflight on the same text fails the same way).
- Summary card states (from `summaryView`): none ("No summary yet" + Generate), ok, unsummarizable, error, and error/unsummarizable **with the previous summary shown below the notice**. Error copy uses the stored reason and says the rest of the profile still works. No "generated at" line (no timestamp stored).
- Detail: archive asks for confirmation inline (there is no un-archive), then returns to the list; archived candidates show "Archived on …" and no Archive button. Stage select only changes after the server succeeds. Notes newest first; blank notes blocked; draft kept on failure.
- Claude's choices (author may revisit): role filter options come from the data (an extra unfiltered list request), not a hardcoded list; list filters live in the URL query string; plain CSS with design tokens as CSS variables; client writes its own API types (dates are strings) instead of importing from server/.
- Add form: no client copy of the server's Zod rules. Native `required`/`type=email`/`maxLength` catch obvious mistakes; the server's 400 message is split per field (`splitServerErrors`). Source options = design list + "Careers page" (used in the fixture). After save it opens `/candidates/:id`.

### Task 7 decisions
- Seed is worth having: a reviewer runs the app on **their own** Neon database (their own `DATABASE_URL`), which starts empty; the seed makes every feature visible and lets the README point at specific demo candidates.
- Seed data lives in `src/seed/seedData.ts`, **separate from the test fixture**, so demo changes never move test data (Claude's choice; the cost is some duplication).
- Inserts go **through the service layer** (create → move stage → notes → archive), after validating every entry with the API's own Zod schemas (`seedCandidateSchema` wraps `createCandidateBody` + `addNoteBody`). One invalid entry → nothing written.
- **Skip by email** (case-insensitive): never updates or deletes, safe to re-run, keeps the author's manually entered candidate. Not a transaction (Neon HTTP); a half-finished run is resumed by re-running.
- 10 demo candidates. Failures are logged with `describeErrorSafely` (exported from `routes/http.ts` for this), never raw `err.message`.
- No summaries seeded and no summarizer passed in: Generate is clicked live. Demo AI cases: garbled (preflight: mostly symbols), too short (preflight), prompt injection (reaches the model).

### Task 9 decisions (author)
- **Proxy, not CORS** (Claude's recommendation, author agreed): `client/vercel.json` rewrites `/api/*` to the server project (`https://candidate-tracker-pfqj.vercel.app`), so the browser only ever sees one origin, exactly like the Vite proxy in dev. No CORS code on the server, `VITE_API_URL` stays unset, preview deploys work. Cost: the server URL is hardcoded in `client/vercel.json`. CORS would only be needed if other websites had to call the API from a browser (out of scope). Neither option is access control: with no auth, the API is public either way.
- **SPA fallback**: the same file rewrites every other path to `/index.html`, so refreshing `/candidates/:id` works. The `/api` rule must stay first.
- **Two entry points, one builder**: `createProductionApp()` (`src/productionApp.ts`) reads env and wires Neon + Gemini; it **throws** if `DATABASE_URL` is missing. `src/server.ts` (local) turns that into `process.exit(1)` and calls `listen()`; `index.ts` (Vercel) default-exports the app and never listens.
- Vercel server project: Root Directory `server`, env vars `DATABASE_URL`, `GEMINI_API_KEY`, `VERCEL_EXPERIMENTAL_BACKENDS=1`. `server/vercel.json` sets `buildCommand: npm run typecheck` (see Gotchas). Client project: Root Directory `client`, no env vars.

## Stack
- Frontend: React 19 + Vite 8 + TypeScript 7 (`client/`), react-router 8 (declarative `<Routes>`), plain CSS. Dev: Vite proxies `/api` to `localhost:3000`. Production: `client/vercel.json` proxies `/api` to the server project. `VITE_API_URL` (another API origin) exists but is unused; leave it unset
- Backend: Node + Express 5 + TypeScript 7 (`server/`), run with `tsx` (no build step)
- Database: Postgres (Neon) via Drizzle ORM 0.45, Neon HTTP driver (`@neondatabase/serverless`). The HTTP driver only works with Neon, not a plain local Postgres
- Validation: Zod 4, for API input and for AI output
- AI: Gemini via `@google/genai`, model `gemini-2.5-flash`, structured output (`responseSchema`) re-validated with Zod
- Tests: Vitest 5 + Supertest. DB tests run on PGlite (in-memory Postgres). The Gemini client is always faked.
- Node: `^22.12 || ^24 || >=26` (`engines` in `server/package.json`; `.nvmrc` = 24)
- Deploy: Vercel, two projects from one repo (`client/`, `server/` as root directories). The server runs as one Vercel Function via Vercel's zero-config Express support; Vercel bundles it (no build step of our own)

## Layout
```
client/
  src/
    App.tsx                   AppRoutes (BrowserRouter in main.tsx, MemoryRouter in tests)
    api/                      types.ts (JSON shapes), http.ts (apiRequest, ApiError), candidates.ts (one function per endpoint)
    lib/                      useApiData (load + cancel stale requests), listFilters (URL <-> filters), stages, format
    lib/summaryView.ts        which summary card state to show + button label
    lib/formErrors.ts         splits the server's "field: problem; ..." message into per-field errors
    components/, pages/       Layout, StagePill, BackLink, SummaryCard, NotesPanel; CandidateListPage, AddCandidatePage, CandidateDetailPage, NotFoundPage
    index.css                 design tokens (CSS variables) + classes
  tests/                      helpers/ (mockFetch, makeCandidate, renderApp + LocationProbe), lib/, api/, pages/
  vercel.json                 rewrites: /api/* → server project (proxy), everything else → index.html (SPA)
server/
  index.ts                    Vercel entry: default-exports createProductionApp() (no listen)
  vercel.json                 buildCommand = typecheck (skips Vercel's TS-7-incompatible check)
  drizzle.config.ts           drizzle-kit config; loads .env itself
  src/
    app.ts                    createApp({ db, summarizer }): builds the Express app (no listen)
    productionApp.ts          createProductionApp(): real Neon + Gemini from env; throws if DATABASE_URL missing
    server.ts                 local entry: createProductionApp(), listen on PORT; exits if DATABASE_URL missing
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
    seed/                     seedData.ts (demo data + seedCandidateSchema), seed.ts (seedDatabase(db)), run.ts (CLI for `npm run db:seed`)
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
    db.test.ts, health.test.ts, services/, routes/, ai/summarizer/, seed/
docs/                         (not created yet) write-up, logs, deployment design (task 8)
```
Layer rule: routes know HTTP but not rules; services know rules but not HTTP or SQL; the db layer knows SQL but not rules; only the AI module knows Gemini. Dependencies (db, and later the summarizer) are passed in, never imported as globals, so tests can substitute PGlite and a fake model.
Deliberate exception: `tests/helpers/testDb.ts` imports Drizzle/PGlite (test setup, not app code).

## Data model
- `candidates`: id (uuid, generated), name, email, phone?, role, resumeText, source?, stage (Postgres enum: applied | screening | interview | offer | rejected, default applied), summary? (jsonb, typed as `StoredSummary { skills[], highlights[] }`), summaryStatus? (enum: ok | unsummarizable | error), summaryReason? (text), archivedAt?, createdAt
- `notes`: id (uuid), candidateId (FK → candidates, indexed), body, createdAt. Append-only: no update or delete anywhere.
- Required text columns (name, email, role, resume_text, notes.body) are NOT NULL **and** have CHECK constraints rejecting blank/whitespace-only text (`~ '[^[:space:]]'`).
- phone and source are optional by design (unknown is stored as NULL, never as a placeholder).
- Phone numbers are stored as typed (trimmed), formatting kept. The limit is **15 digits** (the E.164 maximum), counted ignoring spaces, brackets, `+` and dashes, plus a 30-character overall cap.
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
- Input cleaning (Zod): text is trimmed; email trimmed + lowercased; blank/null optional fields become NULL. Limits: name/role 200, email 100, phone 15 digits / 30 chars, source 100, resumeText 100,000, note 5,000 chars; JSON body 1 MB.
- Decisions made in task 4 (author may revisit): archived candidates can still be viewed, moved and noted; malformed id → 400 (not 404); emails lowercased.

## AI module rules (`server/src/ai/summarizer/`)
- One public entry point: `summarize(resumeText, opts?) -> SummaryResult`. Nothing else in the app imports Gemini.
- Files: `index.ts` (entry), `prompt.ts`, `schema.ts` (Zod), `preflight.ts` (input checks), `client.ts` (Gemini wrapper behind an interface so tests can inject a fake).
- Result is a discriminated union: `ok { skills[], highlights[] }` | `unsummarizable { reason }` | `error { reason }`. It never throws to the caller.
- Preflight before any model call: reject empty, too-short or mostly non-text input; truncate to a fixed maximum length.
- Prompt-injection defence: the resume goes in a clearly delimited data block; the system prompt states that its contents are untrusted data and any instructions inside must be ignored; low temperature; structured output enforced via `responseSchema`; output re-validated with Zod with capped array and string lengths; anything failing validation is rejected.
- Never log resume text. Use a request timeout. The app must keep working when the AI call fails.

## Testing
- Current counts (2026-11-05, all green): server 175 tests in 9 files, client 76 tests in 7 files.
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
- Client commands (from `client/`): `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`. Run the server too for real data.
- Commands (from `server/`): `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run dev`, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` (adds demo candidates to the **live** DB; skips existing emails, never changes rows), `npm run db:studio` (Drizzle Studio on the **live** DB: view only; edits bypass Zod and the append-only notes rule).
- Root commands (from repo root, after `npm ci` there): `npm run dev` runs server + client together (`concurrently`, labelled output, Ctrl+C stops both); `npm test` runs both suites. The root `package.json` holds only these helpers; client/ and server/ stay separate npm projects (no workspaces), so each keeps its own lockfile for its Vercel project.

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
- create-vite's `tsconfig.app.json` had no `"strict": true`; added explicitly to both client tsconfigs.
- `useApiData` must not set "loading" inside an effect (oxlint `set-state-in-effect`): results are stored with their request key and "loading" is derived. The `aborted` guard is still needed, or a late stale answer overwrites the current one (the race test proves it).
- Rows inserted back-to-back in a test can share a `createdAt` (PGlite), and the tiebreak is a random UUID. Don't assert positions among such rows; give them distinct `createdAt` via factories, or match by value.
- Client tests need Node ≥ 22: on Node 20, undici's zstd decompress crashes the Vitest workers. Run `nvm use` first.
- `npm audit` reports moderate issues from an old esbuild inside drizzle-kit (dev only, not exploitable here); the suggested `--force` fix downgrades drizzle-kit — do not run it.
- **Vercel + TypeScript 7 (three problems, found in order):**
  1. Vercel's default Node build compiles with a temporary `tsconfig.json` in `/tmp` that `extends` ours. `types: ["node"]` is then looked up from `/tmp` → `TS2688 Cannot find type definition file for 'node'`. Fix: `"typeRoots": ["./node_modules/@types"]` in `server/tsconfig.json` (relative paths resolve from the file that declares them).
  2. That default build keeps extensionless relative imports (`./src/productionApp`), which Node's ESM loader rejects (`ERR_MODULE_NOT_FOUND`; reproduced locally). Fix: env var `VERCEL_EXPERIMENTAL_BACKENDS=1` on the server project, which bundles with rolldown and resolves them.
  3. The experimental build then type-checks through TypeScript's JavaScript API (`ts.sys`), which TypeScript 7 (native) no longer has → `Cannot read properties of undefined (reading 'readFile')`. Fix: `server/vercel.json` `buildCommand: "npm run typecheck"`. Any Build Command makes Vercel skip its own check; ours emits no `dist/`/`build/`/`output/`, so Vercel still bundles `index.ts` itself, and a type error still fails the deploy.
- Vercel picks the first matching entry file (`Multiple entrypoints found: index.ts, src/app.ts. Using index.ts`). `src/app.ts` must not be the only match: it exports `createApp` by name, not an app.
- `/health` is not under `/api`, so it is not proxied: check it on the server project's own domain.

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
11. Author chose manual-only summaries over Claude's recommendation to auto-generate after save.
12. Author chose logic + component tests for the client, more than Claude's recommended pure-logic-only tests.
13. The linter caught Claude's `useApiData` setting state synchronously in an effect; rewrote it to derive "loading" from the request key.
14. Claude's first add-form tests found fields with `getByLabelText`, which matched the label's full text including the visually shown "Required" tag. Switched to accessible names (`getByRole(..., { name })`), which also verifies the tag is hidden from screen readers.
15. A break-test showed Claude's double-submit guard (`if (saving) return`) was dead code: the disabled button already prevents it. Removed instead of kept untested.
16. Author chose "show reason + Try again" for unsummarisable resumes over Claude's recommendation of no retry button.
17. Adding the detail page made Claude's add-form tests throw unhandled errors: their fake API answered the detail page's GET without `notes`. Fixed the fake to match the real API shape.
18. Author tightened limits (phone 50 → 15, email 254 → 100). Claude flagged that 15 characters would reject two of the realistic fixture numbers (spaces count); the author chose to strip spaces before validating and to clean existing rows with a data migration.
19. Claude's first "break it on purpose" script for the phone rule silently did nothing (its regex did not match, so the code was unchanged and the tests still passed). Spotted from the printed code and redone by hand: putting `.max()` before `.overwrite()` fails 2 tests.
20. Author asked Claude to review decision 18. Claude pointed out the "15" came from E.164, which counts digits, while the rule counted `+()-` too, and that stripping spaces hurt readability. Author switched to "store as typed, at most 15 digits, 30 characters overall", which removed the data migration.
21. Break-tests are now checked to have applied before reading the result: two of Claude's `sed` sabotages either did not match or hit every `.trim()` in the file; both redone by hand.
22. Wiring up the root `npm test` exposed a flaky test of Claude's from task 4 (append-only notes, ~1 in 3 runs): two notes created in the same millisecond tie on `createdAt`, the random-UUID tiebreak then decides order, so `notes[0]` was sometimes the second note. Fixed the test to find the note by value (`toContainEqual`), since order is tested elsewhere; 10/10 green, and a sabotage that rewrites earlier notes still fails it.
23. While discussing the seed, Claude said a reviewer could use "their own Neon (or local Postgres)" database. Claude then caught that this is wrong: the Neon HTTP driver only talks to Neon. The README said the same ("any Postgres connection string works"); both corrected.
24. First Vercel build failed with `TS2688`. Claude's first guess (Vercel skipped devDependencies, so `@types/node` was missing) was wrong: the 194 installed packages match the lockfile's full Linux install, dev included. The real cause was found by reading Vercel's builder source (temporary `tsconfig` in `/tmp`) and reproducing the error locally before changing anything.