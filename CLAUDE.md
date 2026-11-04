# Candidate Tracker — project conventions

A mini applicant tracking system (ATS) with one AI feature: auto-generated candidate summaries.
Priorities: a working end-to-end slice, readable code, and tests that catch real bugs.

## Stack
- Frontend: React + Vite + TypeScript (`client/`)
- Backend: Node + Express + TypeScript (`server/`)
- Database: Postgres (Neon), accessed only through Drizzle ORM
- Validation: Zod, for API input and for AI output
- AI: Gemini via `@google/genai`, model `gemini-2.5-flash`, structured output (`responseSchema`) re-validated with Zod
- Tests: Vitest. DB tests run on PGlite (in-memory Postgres). The Gemini client is always faked in automated tests.
- Deploy (optional): Vercel, two projects from one repo (`client/`, `server/` as root directories)

## Layout
```
client/                 React app (list, form, detail)
server/src/
  app.ts                builds and exports the Express app (no listen)
  server.ts             starts the server on PORT
  routes/               HTTP only: validate with Zod, call a service, return JSON
  services/             business rules; no Express types
  db/                   schema.ts, connection, migrations; the only code importing drizzle
  ai/summarizer/        separate AI module (see rules below)
server/tests/
docs/                   write-up, logs, deployment design
```
Layer rule: routes know HTTP but not rules; services know rules but not HTTP or SQL; the db layer knows SQL but not rules; only the AI module knows Gemini.

## Data model
- `candidates`: id, name, email, phone?, role, resumeText, source?, stage (applied | screening | interview | offer | rejected, default applied), summary? (jsonb), summaryStatus?, archivedAt?, createdAt
- `notes`: id, candidateId (FK), body, createdAt. Append-only: no update or delete endpoint.
- Archive is a soft delete (`archivedAt`). Lists exclude archived candidates by default.
- Stage moves are free transitions (no workflow rules).

## API (REST, JSON)
- `POST /api/candidates`
- `GET /api/candidates?stage=&role=&sort=createdAt|stage`
- `GET /api/candidates/:id`
- `PATCH /api/candidates/:id/stage`
- `POST /api/candidates/:id/archive`
- `POST /api/candidates/:id/notes`
- `POST /api/candidates/:id/summary` (generate or regenerate, then store)
- Validate every body and query with Zod in the route. Errors use one shape: `{ "error": { "message": "..." } }`.

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

## Conventions
- TypeScript strict mode. Prefer plain, readable code over clever code.
- Keep scope tight: no auth, no pagination, no drag-and-drop. File upload only if time remains.
- Secrets live in `server/.env` (gitignored); keep `server/.env.example` current.
- The README must let a stranger go from clone to running app in a few steps.