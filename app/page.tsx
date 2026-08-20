import { TranscriptForm } from "../components/transcript-form";

export const maxDuration = 300;

type PageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const safeError = typeof error === "string" ? error.slice(0, 300) : undefined;

  return (
    <main className="submission-shell">
      <section className="submission-main">
        <p className="eyebrow">BeaverMind call evaluator</p>
        <h1>Trace every score back to the call.</h1>
        <p className="lede">
          Paste a synthetic kick-off or coaching transcript. The report checks each rubric dimension against exact speaking turns.
        </p>
        <TranscriptForm error={safeError} />
      </section>

      <aside className="report-specimen" aria-labelledby="specimen-heading">
        <p className="eyebrow">Report specimen</p>
        <h2 id="specimen-heading">What this review checks</h2>
        <ol>
          <li><span>12</span><p><strong>Rubric dimensions</strong> scored under the selected call type.</p></li>
          <li><span>01</span><p><strong>Highest-impact change</strong> with a projected score.</p></li>
          <li><span>↳</span><p><strong>Exact turn evidence</strong> for every positive behavior.</p></li>
        </ol>
        <p className="privacy-note">Your run gets a permanent private-by-link URL. Refreshing it never starts another evaluation.</p>
      </aside>
    </main>
  );
}
