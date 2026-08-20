# BeaverMind call evaluator

Paste a synthetic kick-off or coaching transcript and receive a permanent, evidence-backed report URL plus a matching PDF. The evaluator scores 12 rubric dimensions, ties positive scores to exact speaking turns, applies caps in application code, and stores the canonical report for later refreshes.

Live deployment: https://beavermind-call-evaluator.vercel.app

## Deployment status on 2026-08-21

The application and its isolated Supabase database are deployed. Submission, durable status, safe terminal failure, refresh, mobile layout, and public-data boundaries have been verified with all four synthetic fixtures. Model-dependent completion is currently blocked because Vercel AI Gateway refuses requests until the Vercel account has a valid payment card on file. The application converts that provider failure into the fixed public failure message as designed. No completed production report or production PDF is claimed while that external billing requirement remains unresolved.

## Architecture

- Next.js 16 renders the submission form, status page, HTML report, and PDF route.
- Supabase stores one `runs` row per submission. Row-level security is enabled with no browser policies; only server-side service-role calls can access rows.
- Vercel AI Gateway calls `openai/gpt-5.6-luna` with Vercel OIDC. No OpenAI or AI Gateway API key is used.
- The browser receives only public run state. It never receives the transcript, client hash, provider response, raw error, or database credential.

The lifecycle is deliberately small:

1. A Server Action validates the call type and 1 to 65,000 character transcript.
2. One atomic Postgres function rate-limits and creates a queued run.
3. Next.js `after` starts server-side evaluation after the redirect response.
4. An atomic claim changes the run from queued to processing, so duplicate workers do not call the model twice.
5. The worker validates the structured model result once, allows one fixed repair request, and stores either a canonical completed result or a safe terminal failure.
6. The permanent run page polls only while queued or processing. Refreshing never creates or restarts work.
7. HTML and PDF routes render the same stored result and never invoke the model.

## Scoring decisions

The application, not the model, calculates dimension caps, raw points, active maximum, normalized score, total caps, and grade.

- The coaching source rubric's listed dimension maxima total 105 even though its prose says 100. Raw audit points preserve that 105-point scale, while the report score is `round(raw active points / active maximum * 100)`.
- Coaching diagnostics and movement dimensions can be inactive. An inactive dimension contributes neither points nor maximum, with no undefined redistribution.
- Dimension caps apply first. The lowest applicable total cap then applies.
- Transcripts have no timestamps, so coach word share is used and labeled as a talk-time estimate.
- Every evidence quote must be an exact substring of its declared parsed speaking turn.
- Coaching live booking requires distinct link, action, and confirmation turns across both coach and client. Otherwise dimension 10 is capped at zero.

## Local setup

Requirements: Node.js 20.9 or newer, npm, and the Supabase CLI for a real database.

```bash
npm ci
cp .env.example .env.local
```

Server environment variables:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CLIENT_HASH_SALT=
```

Use a long random `CLIENT_HASH_SALT`. Keep all three values server-only. Link a Supabase project and apply the checked-in migration:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Then run the app:

```bash
npm run dev
```

The real model path is intended for Vercel, where AI Gateway receives Vercel OIDC automatically. Do not add a provider API key.

## Tests

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

Unit and integration tests cover fixture integrity, scoring and evidence rules, run transitions, atomic submission limits, the Luna worker boundary, report markup, and real PDF bytes. Playwright starts a real local Next.js process and covers both call types, permanent URLs, refresh, close-tab background completion, terminal failure, 12 disclosures, exact evidence, mobile overflow, and PDF download.

`npm run test:e2e` sets `EVALUATOR_TEST_MODE=1`, uses a deterministic model result, and stores runs in a per-suite file under the operating system temp directory. The suite removes that file before and after use. Next.js startup and server runtime both throw if test mode is enabled in production. Test mode is never a deployment setting.

## Security and privacy

- RLS is enabled and no anon or authenticated policies expose `runs`.
- The Supabase service-role key, client-hash salt, and OIDC token remain server-side.
- Anonymous limits use an HMAC-SHA-256 client hash; the source address is never stored.
- Run UUIDs are unguessable share links, not authentication. Anyone with a run URL can read that report.
- Report and transcript-derived content render as React text, never injected HTML.
- Run pages are `noindex`; status and PDF responses use `no-store`.
- Public errors are fixed, single-line messages. Raw model and storage errors remain server-side.

## Deployment

1. Create a new Supabase project and apply `supabase/migrations/202608210001_create_runs.sql`.
2. Create a Vercel project and add only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CLIENT_HASH_SALT` to preview and production server environments.
3. Leave `EVALUATOR_TEST_MODE` unset.
4. Deploy a preview and verify it before promoting or deploying production.
5. Confirm AI Gateway uses Vercel OIDC and that no provider key exists.

## Known limits

- Only pasted `kickoff` and `coaching` transcripts are supported.
- There are no accounts, uploads, report index, rubric editor, analytics, or deletion UI.
- Anonymous clients can create 10 runs per rolling hour.
- A transcript is limited to 65,000 characters.
- Browser textarea line endings are normalized before validation so the server limit matches the visible character counter. The largest fixture is 64,801 bytes and 64,795 browser characters.
- One invalid model result receives one repair request; a second invalid result fails safely.
- Queued or processing work older than five minutes becomes a terminal timeout failure.
- Word share is only an estimate of talk time.
- A run URL is durable and shareable but not access-controlled.

The four checked-in transcripts are synthetic exercise fixtures pinned from exercise commit `9b7a813bdc8ed3707b1c55e3187c17c57542cf9c`.
