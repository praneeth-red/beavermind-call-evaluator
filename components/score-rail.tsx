import type { DimensionResult } from "../src/domain/types";

export function ScoreRail({ dimensions }: { dimensions: DimensionResult[] }) {
  return (
    <nav className="score-rail" aria-label="Dimension score rail">
      <ol>
        {dimensions.map((dimension) => {
          const ratio = dimension.active && dimension.maximum > 0
            ? Math.max(0, Math.min(100, ((dimension.score ?? 0) / dimension.maximum) * 100))
            : 0;

          return (
            <li key={dimension.dimension}>
              <a
                href={`#dimension-${dimension.dimension}`}
                aria-label={`Dimension ${dimension.dimension}: ${dimension.name}, ${dimension.score ?? "not applicable"} of ${dimension.maximum}`}
              >
                <span className="rail-bar" aria-hidden="true">
                  <span style={{ height: `${ratio}%` }} />
                </span>
                <span>{String(dimension.dimension).padStart(2, "0")}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
