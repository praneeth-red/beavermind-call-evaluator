# BeaverMind call evaluator implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, verify, and publicly deploy a persistent transcript evaluator for the two BeaverMind call rubrics.

**Architecture:** A Next.js application creates one Supabase run row per pasted transcript, performs one server-side GPT-5.6 Luna evaluation through Vercel AI Gateway, validates every score and evidence quote, and stores the final JSON. The report page polls the stored run and renders the same JSON as HTML and PDF.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript 7.0.2, Supabase JS 2.112.3, Vercel AI SDK 7.0.70, Zod 4.4.3, React PDF 4.6.1, Vitest 4.1.11, Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-08-21-call-evaluator-design.md`

## Global constraints

- Use `openai/gpt-5.6-luna` through Vercel AI Gateway OIDC. Do not create or accept an OpenAI API key.
- Accept only `kickoff` and `coaching` transcripts from 1 to 65,000 characters.
- Persist each run before model work starts and never restart work on page refresh.
- Return exactly 12 dimensions with exact transcript evidence.
- Calculate caps, totals, normalization, and grade labels in application code.
- Store privileged Supabase credentials only in server-side environment variables.
- Use only the four supplied synthetic transcripts for verification.
- Do not send email and do not record a Loom.

---

### Task 1: Project foundation and source fixtures

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `fixtures/rubrics/*.md`
- Create: `fixtures/transcripts/*.txt`
- Create: `src/domain/types.ts`
- Test: `src/domain/fixtures.test.ts`

**Interfaces:**
- Produces `CallType = "kickoff" | "coaching"`, `TranscriptTurn`, `Evidence`, `DimensionResult`, `EvaluationResult`, and `RunRecord`.
- Produces pinned local copies of all two rubrics and four transcripts from exercise commit `9b7a813bdc8ed3707b1c55e3187c17c57542cf9c`.

- [ ] **Step 1: Write the failing fixture test**

Assert that both rubrics exist, each defines 12 dimensions, all four transcripts exist, every nonblank transcript line matches `[Speaker]: text`, and `coaching-02.txt` is at least 64,000 characters.

- [ ] **Step 2: Run the fixture test and verify RED**

Run: `npm test -- src/domain/fixtures.test.ts`

Expected: FAIL because the project and fixture loader do not exist.

- [ ] **Step 3: Add the minimum project files and fixture loader**

Use Node file reads from `fixtures/`; do not fetch source material at runtime. Keep styling to a valid empty shell until Task 5.

- [ ] **Step 4: Run the fixture test and verify GREEN**

Run: `npm test -- src/domain/fixtures.test.ts`

Expected: PASS with six fixture checks.

- [ ] **Step 5: Commit**

Stage only the Task 1 files and commit `feat: add exercise fixtures and domain types`.

### Task 2: Deterministic scoring validation

**Files:**
- Create: `src/domain/rubric-config.ts`
- Create: `src/domain/transcript.ts`
- Create: `src/domain/evaluation-schema.ts`
- Create: `src/domain/validate-evaluation.ts`
- Test: `src/domain/validate-evaluation.test.ts`

**Interfaces:**
- `parseTranscript(text: string): TranscriptTurn[]`
- `validateEvaluation(callType: CallType, transcript: string, candidate: unknown): EvaluationResult`
- `gradeFor(score: number): "ELITE" | "STRONG" | "INCONSISTENT" | "AT RISK" | "FAIL"`
- `normalizeScore(raw: number, activeMaximum: number): number`

- [ ] **Step 1: Write failing scoring tests**

Cover exact dimension count, coaching fixed buckets, kick-off legal ranges and half steps, disabled dimensions, word-share caps, lowest total cap, grade boundaries, exact evidence turn matching, active-maximum normalization, and the two fixture traps: coaching-01 dimension 10 equals zero; coaching-02 dimensions 2 and 4 are inactive.

- [ ] **Step 2: Run the scoring tests and verify RED**

Run: `npm test -- src/domain/validate-evaluation.test.ts`

Expected: FAIL because the scoring modules do not exist.

- [ ] **Step 3: Implement the smallest validator**

Parse the candidate with Zod, replace model totals with calculated totals, verify evidence quotes against their numbered source turns, apply dimension caps before the lowest total cap, and normalize active points to 100.

- [ ] **Step 4: Run the scoring tests and verify GREEN**

Run: `npm test -- src/domain/validate-evaluation.test.ts`

Expected: PASS with no snapshot-only assertions.

- [ ] **Step 5: Commit**

Stage only Task 2 files and commit `feat: validate rubric scores and evidence`.

### Task 3: Supabase run lifecycle

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608210001_create_runs.sql`
- Create: `src/server/env.ts`
- Create: `src/server/supabase.ts`
- Create: `src/server/runs.ts`
- Test: `src/server/runs.test.ts`

**Interfaces:**
- `createRun(input: { callType: CallType; transcript: string; clientHash: string }): Promise<RunRecord>`
- `claimRun(id: string): Promise<RunRecord | null>` performs an atomic queued-to-processing transition.
- `completeRun(id: string, result: EvaluationResult): Promise<void>`
- `failRun(id: string, publicError: string): Promise<void>`
- `getPublicRun(id: string): Promise<PublicRun | null>` converts stale work to a terminal failure.

- [ ] **Step 1: Write failing lifecycle tests**

Use an in-memory repository implementation to prove valid transitions, duplicate claim rejection, safe public errors, stale processing failure, and that refresh reads never create work.

- [ ] **Step 2: Run the lifecycle tests and verify RED**

Run: `npm test -- src/server/runs.test.ts`

Expected: FAIL because the repository and state machine do not exist.

- [ ] **Step 3: Add the migration and repository**

Create one RLS-protected `runs` table with UUID, call type, transcript, client hash, status, JSON result, public error, and timestamps. Add checks and an index on `(client_hash, created_at)`.

- [ ] **Step 4: Run lifecycle tests and verify GREEN**

Run: `npm test -- src/server/runs.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Stage only Task 3 files and commit `feat: persist evaluation run lifecycle`.

### Task 4: Luna evaluation worker

**Files:**
- Create: `src/server/prompt.ts`
- Create: `src/server/model.ts`
- Create: `src/server/evaluate-run.ts`
- Test: `src/server/evaluate-run.test.ts`

**Interfaces:**
- `buildEvaluationPrompt(callType: CallType, transcript: string): Promise<string>`
- `requestCandidate(prompt: string, repair?: string): Promise<unknown>` calls `openai/gpt-5.6-luna` with structured output.
- `evaluateRun(id: string): Promise<void>` claims, evaluates, validates, repairs once, and completes or fails.

- [ ] **Step 1: Write failing worker tests**

Inject the model request function. Prove a valid response completes once, invalid evidence triggers one repair, a second invalid response fails safely, provider failure fails safely, and two worker invocations produce one model call.

- [ ] **Step 2: Run worker tests and verify RED**

Run: `npm test -- src/server/evaluate-run.test.ts`

Expected: FAIL because worker modules do not exist.

- [ ] **Step 3: Implement the worker**

Use Vercel AI SDK structured output with `openai/gpt-5.6-luna`, `reasoningEffort: "high"`, a bounded output limit, and no transcript caching. Keep the model client behind one injected function for real tests.

- [ ] **Step 4: Run worker tests and verify GREEN**

Run: `npm test -- src/server/evaluate-run.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Stage only Task 4 files and commit `feat: evaluate runs with Luna`.

### Task 5: Submission and report interface

**Files:**
- Create: `app/page.tsx`
- Create: `app/actions.ts`
- Create: `app/runs/[id]/page.tsx`
- Create: `app/runs/[id]/loading.tsx`
- Create: `app/api/runs/[id]/route.ts`
- Create: `components/transcript-form.tsx`
- Create: `components/run-status.tsx`
- Create: `components/report.tsx`
- Create: `components/score-rail.tsx`
- Modify: `app/globals.css`
- Test: `components/report.test.tsx`

**Interfaces:**
- `submitTranscript(formData: FormData)` validates, rate-limits, creates a run, starts server-side work, and redirects.
- `GET /api/runs/:id` returns only `PublicRun`.
- `Report({ result }: { result: EvaluationResult })` renders the complete client report.

- [ ] **Step 1: Write failing report tests**

Assert the score, exact grade, one improvement, brief, red flags, 12 disclosures, evidence text, assumptions, and PDF link render. Assert model HTML is escaped.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `npm test -- components/report.test.tsx`

Expected: FAIL because report components do not exist.

- [ ] **Step 3: Build the minimum accessible interface**

Use native form controls and `<details>`. Apply the approved cool-paper visual system, visible focus, responsive layout, reduced motion, and the 12-part score rail. Add an honest 65,000-character counter.

- [ ] **Step 4: Run UI tests and verify GREEN**

Run: `npm test -- components/report.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Stage only Task 5 files and commit `feat: add transcript submission and report UI`.

### Task 6: Matching PDF

**Files:**
- Create: `src/pdf/report-document.tsx`
- Create: `app/api/runs/[id]/pdf/route.ts`
- Test: `src/pdf/report-document.test.tsx`

**Interfaces:**
- `ReportDocument({ result }: { result: EvaluationResult })` renders all required report sections.
- `GET /api/runs/:id/pdf` returns `application/pdf` from the stored result only.

- [ ] **Step 1: Write the failing PDF test**

Render a known result to a buffer. Assert the PDF signature, nontrivial byte length, all 12 dimension titles, and that the route never invokes the model.

- [ ] **Step 2: Run PDF tests and verify RED**

Run: `npm test -- src/pdf/report-document.test.tsx`

Expected: FAIL because the PDF document does not exist.

- [ ] **Step 3: Implement the PDF**

Use React PDF with the same stored result and restrained page styles. Add page numbers, sensible wrapping, and evidence blocks that can continue across pages.

- [ ] **Step 4: Run PDF tests and verify GREEN**

Run: `npm test -- src/pdf/report-document.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Stage only Task 6 files and commit `feat: generate client-ready PDF reports`.

### Task 7: End-to-end verification and public delivery

**Files:**
- Create: `tests/e2e/evaluator.spec.ts`
- Create: `playwright.config.ts`
- Create: `README.md`
- Create: `docs/loom-handoff.md`
- Modify: `.env.example`

**Interfaces:**
- Browser test submits both call types, observes a permanent URL, reloads, reaches a terminal state, opens 12 dimensions, and downloads a PDF.
- README explains architecture, setup, scoring assumption, security, tests, and known limits.

- [ ] **Step 1: Write the failing browser test**

Use a deterministic local model adapter for browser tests. Verify persistent route shape, refresh behavior, completed and failed states, evidence, 12 dimensions, mobile width, and PDF download.

- [ ] **Step 2: Run the browser test and verify RED**

Run: `npm run test:e2e`

Expected: FAIL until the local adapter and complete route are wired.

- [ ] **Step 3: Finish local wiring and documentation**

Add the local deterministic adapter only behind `EVALUATOR_TEST_MODE=1`. Document that production refuses test mode. Add the factual Loom handoff without recording anything.

- [ ] **Step 4: Run all local checks**

Run: `npm test && npm run lint && npm run build && npm run test:e2e`

Expected: all commands exit 0 with no warnings that affect correctness.

- [ ] **Step 5: Provision and deploy**

Create a new Supabase project, link it, push the migration, create a public GitHub repository from a clean public history, enable Vercel AI Gateway OIDC, set server environment variables, and deploy to Vercel.

- [ ] **Step 6: Verify production safely**

Run all four supplied transcripts. Confirm signed-out access, persistent URLs, exact fixture traps, terminal failure behavior without a real prospect, PDF download, mobile layout, no browser console errors, and no secret in the bundle or Git history.

- [ ] **Step 7: Final commit and handoff**

Commit only related files, push, and return the public repository, live deployment, test evidence, architecture breakdown, scoring assumption, and Praneeth's Loom talking points. Do not send an email and do not record a Loom.
