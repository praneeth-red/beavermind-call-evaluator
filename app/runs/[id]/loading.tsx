export default function LoadingRun() {
  return (
    <main className="status-shell" aria-live="polite">
      <span className="status-pulse" aria-hidden="true" />
      <p className="eyebrow">Loading run</p>
      <h1>Opening the evaluation</h1>
    </main>
  );
}
