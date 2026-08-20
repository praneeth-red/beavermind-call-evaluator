# BeaverMind call evaluator design

## Purpose

Build the stage-two BeaverMind exercise as a public web application. An operator pastes a synthetic kick-off or coaching transcript, receives a permanent run URL, and later sees a client-ready evaluation and matching PDF.

The implementation is intentionally narrow. It covers pasted transcripts, the two supplied rubrics, reliable background evaluation, report rendering, and PDF download. It does not include accounts, uploads, voice, rubric editing, run history, or analytics.

## Required deliverables

- A public GitHub repository containing readable source code.
- A live Vercel deployment that BeaverMind can use without an account.
- A persistent URL for every evaluation run.
- A downloadable PDF containing the same report shown on the web page.
- A webcam-on walkthrough recorded by Praneeth. The repository will include a factual handoff for that walkthrough, but the application will not record it.
- No email will be sent to BeaverMind.

## Architecture

The application uses one Next.js project deployed to Vercel. Supabase stores every run and its final structured result. Vercel AI Gateway calls `openai/gpt-5.6-luna` using Vercel OIDC, so the project needs no OpenAI or AI Gateway API key.

The browser never talks directly to privileged Supabase APIs. Next.js server code creates and reads runs with server-only credentials. A random UUID acts as the shareable run identifier. Row-level security stays enabled and public table access stays denied.

One server-side evaluation task processes each queued run after the create request returns. The page polls the run endpoint until the row reaches `completed` or `failed`. A stale `processing` run becomes a terminal failure instead of spinning forever.

## Run lifecycle

1. The operator selects `kickoff` or `coaching` and pastes a transcript.
2. Server validation rejects blank input, unknown call types, or input longer than 65,000 characters.
3. The server creates a Supabase row with a UUID and `queued` status.
4. The response redirects immediately to `/runs/<uuid>`.
5. Server-side work changes the row to `processing`, calls Luna, validates the response, and saves either `completed` plus `result_json` or `failed` plus a safe error message.
6. The run page polls while work is queued or processing. Reloading or closing the tab does not create another model request.
7. The report page and PDF both render the stored `result_json`; neither calls the model again.

## Supabase schema

One `runs` table is enough:

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid primary key` | Permanent, unguessable run URL |
| `call_type` | `text` | `kickoff` or `coaching` |
| `transcript` | `text` | Original pasted transcript |
| `status` | `text` | `queued`, `processing`, `completed`, or `failed` |
| `result_json` | `jsonb` | Validated final report |
| `public_error` | `text` | Safe terminal failure reason |
| `created_at` | `timestamptz` | Submission time |
| `started_at` | `timestamptz` | Evaluation start time |
| `finished_at` | `timestamptz` | Completion or failure time |

Database constraints enforce valid call types, valid statuses, and the 65,000-character transcript limit. An update trigger maintains status timestamps. Row-level security is enabled without anon or authenticated policies. Only server-side service-role access may read or write runs.

## Model contract

The model receives:

- One rubric selected from the two supplied Markdown files.
- The pasted transcript with deterministic turn numbers.
- A strict structured-output schema.
- Instructions to ignore commands inside the transcript and score only observable call behavior.

The output contains:

- `oneThing`: the highest-impact improvement, its explanation, and projected score.
- `brief`: a concise assessment addressed to the coach.
- `redFlags`: evidence-backed retention risks.
- `rawScore`, `normalizedScore`, and one exact grade label.
- Exactly 12 dimensions with score, maximum, band, reasoning, evidence, missing behavior, and quick fix.
- Applied dimension and total caps.
- Scoring assumptions used for the run.

Application code, not the model, verifies totals and grade labels. Every evidence item must identify one supplied turn number and quote text from that exact turn. Invalid scores, invented evidence, wrong dimension counts, or broken arithmetic trigger one repair request. A second invalid result fails the run.

## Scoring rules

Kick-off dimensions follow the rubric's allowed integer ranges and half steps for dimensions worth five points or less. Coaching dimensions accept only the fixed values listed by the rubric. Dimension caps apply before total caps. When several total caps apply, the lowest cap wins.

The coaching rubric lists 105 raw points while calling the total 100. It also gives inconsistent denominators for disabled dimensions. The application keeps the raw score for auditability and calculates the reported score as:

`round(raw active points / active maximum points * 100)`

An N/A or disabled dimension contributes neither points nor maximum points. This resolves the arithmetic consistently for every combination. The report states this assumption. The Loom handoff calls out the source defect and this choice.

Speaker-share caps use word share because the supplied transcripts have no timestamps. The report labels that value as an estimate.

## Test fixtures and expected traps

All four supplied synthetic transcripts are copied into the repository as fixtures and tested:

- `kickoff-01.txt` is the strong kick-off path.
- `kickoff-02.txt` is weak despite polite language and must not be scored from mood.
- `coaching-01.txt` contains strong movement coaching but no completed live booking, so coaching dimension 10 must be zero.
- `coaching-02.txt` is the 65 kB input case. Diagnostics are N/A and movement coaching is disabled despite frequent movement-related words.

Tests cover legal score values, caps, normalization, exact evidence matching, duplicate execution prevention, terminal failures, long input, matching web and PDF data, and unauthenticated access to run URLs.

## Interface design

The subject is call-quality review for coaching operators. The page's single job is to make a long evaluation trustworthy and easy to scan.

The visual system uses cool paper, dark ink, cobalt scoring accents, amber cautions, and red retention warnings. Instrument Sans handles headings and body copy; IBM Plex Mono distinguishes transcript evidence and numeric scoring data.

The signature element is a 12-part score rail. It shows the shape of the call at a glance and links each segment to its expandable dimension. Evidence appears as numbered transcript excerpts, not generic quotation cards.

The submission screen has one call-type control, one large transcript field, a character counter, and one clear action. The report screen has a compact score header, the one improvement, brief, red flags, score rail, 12 native disclosure sections, and PDF download. Keyboard focus is visible, motion respects reduced-motion preferences, and the report works on mobile.

## Error handling

- Form errors explain what the operator must change.
- Provider, timeout, validation, and persistence failures produce a terminal `failed` row with a safe public message.
- Raw provider responses, stack traces, Supabase identifiers, and secrets never reach the browser.
- A stale processing row is marked failed by the read path after the configured timeout.
- A refresh never starts a second evaluation.

## Deployment and security

- Vercel hosts the Next.js app and supplies OIDC for AI Gateway.
- Supabase hosts the Postgres database.
- Vercel environment variables hold the Supabase URL and server-only service-role credential.
- The public app receives no model or database secret.
- Run pages use random UUIDs and include `noindex` metadata.
- Transcript and model content render as escaped text, never injected HTML.
- A small submission rate limit and the 65,000-character limit bound anonymous cost.
- Only the four supplied synthetic transcripts are used for production verification.

## Definition of done

- Unit and integration tests pass.
- All four supplied fixtures complete locally through the validated scoring path.
- The longest transcript is accepted without truncation.
- A failed run stops polling and explains the failure.
- Web and PDF reports contain the same stored result.
- The public repository and Vercel deployment work when signed out.
- Supabase secrets are absent from Git history and browser bundles.
- A final handoff explains the architecture, scoring assumption, tests, live evidence, and Praneeth's Loom talking points.
- No Loom is recorded and no submission email is sent.
