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

      <div className="report-intro-grid">
        <section className="paper-section" aria-labelledby="brief-heading">
          <p className="eyebrow">Coach brief</p>
          <h2 id="brief-heading">What the call shows</h2>
          <p>{result.brief}</p>
        </section>

        <section className="paper-section risks" aria-labelledby="risks-heading">
          <p className="eyebrow">Retention watch</p>
          <h2 id="risks-heading">Red flags</h2>
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
      </div>

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

      <div className="audit-grid">
        <section className="paper-section" aria-labelledby="caps-heading">
          <p className="eyebrow">Score controls</p>
          <h2 id="caps-heading">Applied caps</h2>
          {result.appliedDimensionCaps.length === 0 && result.appliedTotalCaps.length === 0 ? (
            <p>No score caps were applied.</p>
          ) : (
            <ul className="plain-list">
              {result.appliedDimensionCaps.map((cap, index) => (
                <li key={`dimension-${cap.dimension}-${index}`}>
                  Dimension {cap.dimension}, maximum {cap.maximum}: {cap.reason}
                </li>
              ))}
              {result.appliedTotalCaps.map((cap, index) => (
                <li key={`total-${cap.maximum}-${index}`}>
                  Total maximum {cap.maximum}: {cap.reason}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="paper-section" aria-labelledby="assumptions-heading">
          <p className="eyebrow">Audit notes</p>
          <h2 id="assumptions-heading">Assumptions</h2>
          <ul className="plain-list">
            {result.assumptions.map((assumption, index) => (
              <li key={`${assumption}-${index}`}>{assumption}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
