type ReportSkeletonProps = {
  eyebrow: string;
  title: string;
  description?: string;
  note?: string | null;
};

export function ReportSkeleton({
  eyebrow,
  title,
  description,
  note,
}: ReportSkeletonProps) {
  return (
    <main className="report-shell report-skeleton" aria-busy="true">
      <header className="skeleton-status" aria-live="polite">
        <div className="skeleton-score-lockup">
          <p className="eyebrow">{eyebrow}</p>
          <div className="skeleton-score" aria-hidden="true">
            <span />
            <div><i /><i /></div>
          </div>
        </div>
        <div className="skeleton-status-copy">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
          {note ? <p className="status-note">{note}</p> : null}
        </div>
      </header>

      <section className="one-thing skeleton-panel" aria-labelledby="skeleton-change-heading">
        <p className="eyebrow">One change</p>
        <h2 id="skeleton-change-heading" className="skeleton-line skeleton-line-long">
          <span className="sr-only">Preparing the most useful change</span>
        </h2>
        <p className="skeleton-line skeleton-line-medium" aria-hidden="true" />
        <span className="skeleton-line skeleton-line-short" aria-hidden="true" />
      </section>

      <section className="paper-section skeleton-panel skeleton-brief" aria-labelledby="skeleton-brief-heading">
        <p className="eyebrow">Coach brief</p>
        <h2 id="skeleton-brief-heading">What the call shows</h2>
        <div className="skeleton-copy" aria-hidden="true"><i /><i /><i /></div>
      </section>

      <section className="dimensions-section skeleton-dimensions" aria-labelledby="skeleton-dimensions-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Evidence map</p>
            <h2 id="skeleton-dimensions-heading">Twelve scored dimensions</h2>
          </div>
          <p>Scoring transcript evidence…</p>
        </div>
        <div className="skeleton-rail" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <i key={index} style={{ height: `${28 + (index % 6) * 12}%` }} />
          ))}
        </div>
        <ol className="skeleton-dimension-list" aria-label="Preparing twelve scored dimensions">
          {Array.from({ length: 12 }, (_, index) => (
            <li className="skeleton-dimension" key={index}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <i aria-hidden="true" />
              <b aria-hidden="true" />
            </li>
          ))}
        </ol>
      </section>

      <section className="paper-section risks risks-final skeleton-panel" aria-labelledby="skeleton-risks-heading">
        <p className="eyebrow">Retention watch</p>
        <h2 id="skeleton-risks-heading">Red flags</h2>
        <div className="skeleton-copy" aria-hidden="true"><i /><i /></div>
      </section>
    </main>
  );
}
