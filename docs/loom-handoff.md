# Loom handoff

No Loom was recorded by the implementation workflow. This is a factual outline for Praneeth to record separately with webcam on.

## Current recording blocker

Do not record the completed-report walkthrough yet. As of 2026-08-21, the live application and database are healthy, but Vercel AI Gateway returns a generic 403 until the Vercel account has a valid payment card on file. All four synthetic fixtures were accepted and failed safely without exposing the provider response. After billing access is enabled, rerun all four fixtures, verify the two coaching traps, download the real production PDF, and check production logs before recording.

## Suggested walkthrough

### 1. State the outcome

Show the public submission page and say:

> This evaluator turns a BeaverMind kick-off or coaching transcript into a permanent evidence-backed report and matching PDF. Every positive score must point to an exact speaking turn.

### 2. Submit one strong fixture

- Select the correct call type.
- Paste one supplied synthetic transcript.
- Submit and point out the immediate permanent `/runs/<uuid>` URL.
- Refresh while the run is active to show that the URL persists and no second evaluation starts.
- Explain that the row is created before model work and claimed atomically by one worker.

### 3. Walk through the report

- Show normalized score and exact grade.
- Show the single highest-impact change and projected score.
- Open the red flags and exact turn evidence.
- Use the 12-part rail, then open several native dimension rows.
- Show reasoning, score/maximum, evidence, missing behavior, and quick fix.
- Show applied caps and assumptions.
- Download the PDF and compare its fields with the HTML report.

### 4. Explain the source-rubric decisions

Use this wording:

> The coaching rubric's dimension maxima add up to 105 even though the document calls the total 100. I preserve raw points for audit, remove inactive dimensions from both points and maximum, and normalize the active result to 100. The transcript has no timestamps, so the talk-time cap uses coach word share and labels it as an estimate.

Also mention:

- Dimension caps apply before the lowest total cap.
- Inactive dimensions receive no points and no maximum; there is no invented redistribution.
- A live next call needs link, action, and confirmation evidence across coach and client. Without that, coaching dimension 10 is zero.

### 5. Show the two trap fixtures

- `coaching-01.txt`: strong movement coaching does not override the missing completed live booking. Dimension 10 must be zero.
- `coaching-02.txt`: repeated movement words do not create movement coaching. Diagnostics is N/A and movement coaching is disabled. The source is 64,801 bytes and the browser correctly shows and accepts 64,795 characters after line-ending normalization, without truncation.

### 6. Explain reliability and security

- Supabase stores one durable run and canonical result.
- Refresh and PDF generation never call the model.
- Vercel AI Gateway uses OIDC with no provider API key.
- The browser never receives transcript text, client hash, service-role credential, raw provider output, or raw errors.
- RLS has no public policies.
- The anonymous limit is 10 runs per one-way client hash per rolling hour.
- A safe terminal failure stops polling and does not expose internal details.

### 7. Close with proof

After the Gateway blocker is cleared and the checks are rerun, show the public repository, the production deployment, the passing local checks, all four completed synthetic fixture URLs, one persistent refresh, the mobile layout, the downloaded final PDF, and the clean production log scan.

## Recording checklist

- Webcam is on.
- No private tabs, credentials, project identifiers, service-role keys, salts, or account data are visible.
- Use only the four supplied synthetic transcripts.
- Keep the browser console clear or closed unless showing the verified zero-error check.
- Do not show Vercel or Supabase secret-value screens.
- Do not claim timestamp-based talk time.
- Do not say the rubric natively resolves the 105-point mismatch.
- Do not say run URLs are authenticated or private.
- Do not send an email from this workflow.
