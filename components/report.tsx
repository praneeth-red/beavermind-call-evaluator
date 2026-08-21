"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import type {
  Evidence,
  EvaluationResult,
  TranscriptTurn,
} from "../src/domain/types";
import { ScoreRail } from "./score-rail";

type SelectEvidence = (turn: number, trigger: HTMLButtonElement) => void;

function ScoreGauge({
  score,
  grade,
}: {
  score: number;
  grade: EvaluationResult["grade"];
}) {
  const gaugePosition = score < 60 ? score / 3 : 20 + (score - 60) * 2;
  const selectorRadians = ((180 - gaugePosition * 1.8) * Math.PI) / 180;
  const selectorX = Math.round((100 + 104 * Math.cos(selectorRadians)) * 10) / 10;
  const selectorY = Math.round((100 - 104 * Math.sin(selectorRadians)) * 10) / 10;
  const selectorAngle = Math.round((gaugePosition * 1.8 - 90) * 10) / 10;

  return (
    <div
      className="score-gauge"
      data-score={score}
      role="img"
      aria-label={`Overall score: ${score} out of 100, ${grade}`}
    >
      <div className="score-gauge-meter" aria-hidden="true">
        <svg viewBox="-14 -14 228 128">
          <defs>
            <linearGradient id="score-gauge-gradient" x1="10" y1="0" x2="190" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--gauge-red)" />
              <stop offset="18%" stopColor="var(--gauge-red)" />
              <stop offset="22%" stopColor="var(--gauge-orange)" />
              <stop offset="38%" stopColor="var(--gauge-orange)" />
              <stop offset="42%" stopColor="var(--gauge-yellow)" />
              <stop offset="58%" stopColor="var(--gauge-yellow)" />
              <stop offset="62%" stopColor="var(--gauge-blue)" />
              <stop offset="78%" stopColor="var(--gauge-blue)" />
              <stop offset="82%" stopColor="var(--gauge-green)" />
              <stop offset="100%" stopColor="var(--gauge-green)" />
            </linearGradient>
            <filter id="score-gauge-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <path className="score-gauge-track" d="M 10 100 A 90 90 0 0 1 190 100" />
          <path className="score-gauge-glow" d="M 10 100 A 90 90 0 0 1 190 100" filter="url(#score-gauge-soft-glow)" />
          <path className="score-gauge-gradient" d="M 10 100 A 90 90 0 0 1 190 100" />
          <path
            className="score-gauge-selector"
            d="M -6 -7 L 6 -7 L 0 5 Z"
            transform={`translate(${selectorX} ${selectorY}) rotate(${selectorAngle})`}
          />
        </svg>
        <div className="score-gauge-reading">
          <span><strong>{score}</strong> / 100</span>
          <b>{grade}</b>
        </div>
      </div>
      <ol className="score-gauge-legend" aria-label="Score bands">
        <li className="score-zone-fail"><span>Fail</span><small>0–59</small></li>
        <li className="score-zone-risk"><span>At risk</span><small>60–69</small></li>
        <li className="score-zone-inconsistent" aria-label="Inconsistent, 70 to 79"><span>Incon<wbr />sistent</span><small>70–79</small></li>
        <li className="score-zone-strong"><span>Strong</span><small>80–89</small></li>
        <li className="score-zone-elite"><span>Elite</span><small>90–100</small></li>
      </ol>
    </div>
  );
}

export function citedEvidenceTurns(result: EvaluationResult): number[] {
  return [
    ...new Set([
      ...result.dimensions.flatMap((dimension) =>
        dimension.evidence.map((evidence) => evidence.turn)),
      ...result.redFlags.flatMap((flag) =>
        flag.evidence.map((evidence) => evidence.turn)),
    ]),
  ].sort((left, right) => left - right);
}

function EvidenceList({
  evidence,
  onSelect,
}: {
  evidence: Evidence[];
  onSelect: SelectEvidence;
}) {
  if (evidence.length === 0) return <p className="empty-evidence">No supporting turn was scored.</p>;

  return (
    <ul className="evidence-list">
      {evidence.map((item, index) => (
        <li key={`${item.turn}-${index}`}>
          <button
            type="button"
            className="evidence-turn"
            onClick={(event) => onSelect(item.turn, event.currentTarget)}
          >
            Turn {item.turn}
          </button>
          <q>{item.quote}</q>
        </li>
      ))}
    </ul>
  );
}

function TranscriptDrawer({
  turns,
  evidenceTurns,
  selectedTurn,
  onSelect,
  onClose,
}: {
  turns: TranscriptTurn[];
  evidenceTurns: number[];
  selectedTurn: number | null;
  onSelect: (turn: number) => void;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const turnRefs = useRef(new Map<number, HTMLLIElement>());
  const [overlay, setOverlay] = useState(false);
  const open = selectedTurn !== null;
  const selectedIndex = selectedTurn === null
    ? -1
    : evidenceTurns.indexOf(selectedTurn);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 899px)");
    const update = () => setOverlay(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    if (overlay) document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !overlay) return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      if (overlay) document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, overlay]);

  useEffect(() => {
    if (selectedTurn === null) return;
    const scroller = scrollRef.current;
    const selected = turnRefs.current.get(selectedTurn);
    if (!scroller || !selected) return;
    scroller.scrollTo({
      top: Math.max(
        0,
        selected.offsetTop - (scroller.clientHeight - selected.offsetHeight) / 2,
      ),
    });
  }, [selectedTurn]);

  return (
    <div
      className="transcript-drawer-layer"
      data-open={open}
      aria-hidden={!open}
      inert={!open}
    >
      <button
        type="button"
        className="transcript-drawer-backdrop"
        aria-label="Close transcript evidence"
        tabIndex={-1}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className="transcript-drawer"
        role="dialog"
        aria-modal={overlay || undefined}
        aria-labelledby="transcript-drawer-heading"
      >
        <header>
          <div>
            <p className="eyebrow">Transcript evidence</p>
            <h2 id="transcript-drawer-heading">
              {selectedTurn === null ? "Full call" : `Turn ${selectedTurn}`}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="transcript-drawer-close"
            aria-label="Close transcript evidence"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <nav className="transcript-drawer-nav" aria-label="Evidence turn navigation">
          <button
            type="button"
            disabled={selectedIndex <= 0}
            onClick={() => onSelect(evidenceTurns[selectedIndex - 1])}
          >
            Previous evidence
          </button>
          <span>{selectedIndex < 0 ? 0 : selectedIndex + 1} of {evidenceTurns.length}</span>
          <button
            type="button"
            disabled={selectedIndex < 0 || selectedIndex >= evidenceTurns.length - 1}
            onClick={() => onSelect(evidenceTurns[selectedIndex + 1])}
          >
            Next evidence
          </button>
        </nav>

        <div ref={scrollRef} className="transcript-drawer-scroll">
          <ol>
            {turns.map((turn) => (
              <li
                key={turn.number}
                ref={(node) => {
                  if (node) turnRefs.current.set(turn.number, node);
                  else turnRefs.current.delete(turn.number);
                }}
                data-selected={turn.number === selectedTurn}
              >
                <p>
                  <span>Turn {turn.number}</span>
                  <strong>{turn.speaker}</strong>
                </p>
                <p>{turn.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}

export function Report({
  result,
  runId,
  turns,
}: {
  result: EvaluationResult;
  runId: string;
  turns: TranscriptTurn[];
}) {
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const evidenceTurns = citedEvidenceTurns(result);

  const selectEvidence = useCallback((turn: number, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setSelectedTurn(turn);
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedTurn(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <div className="report-workspace" data-drawer-open={selectedTurn !== null}>
      <main className="report-shell">
        <header className="report-header">
        <div>
          <p className="eyebrow">Call evaluation</p>
          <ScoreGauge score={result.normalizedScore} grade={result.grade} />
        </div>
        <div className="report-actions">
          <Link className="secondary-action" href="/">
            ← Evaluate another call
          </Link>
          <a className="secondary-action" href={`/api/runs/${runId}/pdf`}>
            Download PDF
          </a>
        </div>
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
                  <EvidenceList evidence={dimension.evidence} onSelect={selectEvidence} />
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
                <EvidenceList evidence={flag.evidence} onSelect={selectEvidence} />
              </li>
            ))}
          </ul>
        )}
        </section>
      </main>

      <TranscriptDrawer
        turns={turns}
        evidenceTurns={evidenceTurns}
        selectedTurn={selectedTurn}
        onSelect={setSelectedTurn}
        onClose={closeDrawer}
      />
    </div>
  );
}
