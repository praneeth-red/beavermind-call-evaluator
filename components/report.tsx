import type { Evidence, EvaluationResult } from "../src/domain/types";
import { ScoreRail } from "./score-rail";

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) return <p className="empty-evidence">No supporting turn was scored.</p>;

  return (
    <ul className="evidence-list">
      {evidence.map((item, index) => (
        <li key={`${item.turn}-${index}`}>
          <span>Turn {item.turn}</span>
          <q>{item.quote}</q>
        </li>
      ))}
    </ul>
  );
}

export function Report({
  result,
  runId,
}: {
  result: EvaluationResult;
  runId: string;
}) {
  return (
    <main className="report-shell">
      <header className="report-header">
        <div>
          <p className="eyebrow">Call evaluation</p>
          <div className="score-lockup">
            <strong>{result.normalizedScore}</strong>
            <span>
              <span>out of 100</span>
              <b>{result.grade}</b>
            </span>
          </div>
        </div>
        <a className="secondary-action" href={`/api/runs/${runId}/pdf`}>
          Download PDF
        </a>
      </header>

      <section className="one-thing" aria-labelledby="one-thing-heading">
        <p className="eyebrow">One change</p>
        <h1 id="one-thing-heading">{result.oneThing.improvement}</h1>
        <p>{result.oneThing.explanation}</p>
        <span>Projected score: {result.oneThing.projectedScore}</span>
      </section>

      <section className="paper-section coach-brief" aria-labelledby="brief-heading">
        <p className="eyebrow">Coach brief</p>
        <h2 id="brief-heading">What the call shows</h2>
        <p>{result.brief}</p>
      </section>

      <section className="dimensions-section" aria-labelledby="dimensions-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Evidence map</p>
            <h2 id="dimensions-heading">Twelve scored dimensions</h2>
          </div>
          <p>Select a rail segment or open a row to inspect the score.</p>
        </div>

        <ScoreRail dimensions={result.dimensions} />

        <div className="dimension-list">
          {result.dimensions.map((dimension) => (
            <details id={`dimension-${dimension.dimension}`} key={dimension.dimension}>
              <summary>
                <span className="dimension-number">
                  {String(dimension.dimension).padStart(2, "0")}
                </span>
                <span className="dimension-title">
                  <strong>{dimension.name}</strong>
                  <span>{dimension.band}</span>
                </span>
                <span className="dimension-score">
                  {dimension.score === null ? "N/A" : dimension.score}
                  <small> / {dimension.maximum}</small>
                </span>
              </summary>
              <div className="dimension-body">
                <div>
                  <h3>Reasoning</h3>
                  <p>{dimension.reasoning}</p>
                </div>
                <div>
                  <h3>Exact turn evidence</h3>
                  <EvidenceList evidence={dimension.evidence} />
                </div>
                <div className="dimension-actions">
                  <div>
                    <h3>Missing behavior</h3>
                    <p>{dimension.missingBehavior}</p>
                  </div>
                  <div>
                    <h3>Quick fix</h3>
                    <p>{dimension.quickFix}</p>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="paper-section risks risks-final" aria-labelledby="risks-heading">
        <div className="risks-header">
          <p className="eyebrow">Retention watch</p>
          <h2 id="risks-heading">Red flags</h2>
        </div>
        {result.redFlags.length === 0 ? (
          <p>No evidence-backed retention risks were identified.</p>
        ) : (
          <ul className="risk-list">
            {result.redFlags.map((flag, index) => (
              <li key={`${flag.risk}-${index}`}>
                <h3>{flag.risk}</h3>
                <p>{flag.explanation}</p>
                <EvidenceList evidence={flag.evidence} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
