import { TranscriptForm } from "../components/transcript-form";

export const maxDuration = 300;

export default function HomePage() {
  return (
    <main className="submission-shell">
      <header className="tool-header">
        <p className="eyebrow">BeaverMind call evaluator</p>
        <h1>Call transcript evaluator</h1>
        <p>
          Load an example, upload a file, or paste a transcript to score the call against exact speaking turns.
        </p>
      </header>

      <section className="submission-main" aria-label="Start a call evaluation">
        <TranscriptForm />
      </section>
    </main>
  );
}
