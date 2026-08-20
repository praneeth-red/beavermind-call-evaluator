"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitTranscript } from "../app/actions";
import type { CallType } from "../src/domain/types";

const MAX_TRANSCRIPT_LENGTH = 65_000;

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Starting…" : "Evaluate call"}
    </button>
  );
}

export function CallTypeChoices({
  value,
  onChange,
}: {
  value: CallType;
  onChange: (value: CallType) => void;
}) {
  return (
    <fieldset>
      <legend>Call type</legend>
      <label>
        <input
          type="radio"
          name="callType"
          value="kickoff"
          checked={value === "kickoff"}
          onChange={() => onChange("kickoff")}
        />
        <span>
          <strong>Kick-off</strong>
          <small>Set-up, expectations, and the working agreement</small>
        </span>
      </label>
      <label>
        <input
          type="radio"
          name="callType"
          value="coaching"
          checked={value === "coaching"}
          onChange={() => onChange("coaching")}
        />
        <span>
          <strong>Coaching</strong>
          <small>Diagnosis, coaching movement, and the next call</small>
        </span>
      </label>
    </fieldset>
  );
}

export function TranscriptForm() {
  const [callType, setCallType] = useState<CallType>("kickoff");
  const [transcript, setTranscript] = useState("");
  const [state, formAction] = useActionState(submitTranscript, { error: null });

  return (
    <form action={formAction} className="transcript-form">
      <CallTypeChoices value={callType} onChange={setCallType} />

      <label className="transcript-label" htmlFor="transcript">
        <span>Transcript</span>
        <small>Use speaker labels such as [Coach]: and [Client]: on each turn.</small>
      </label>
      <textarea
        id="transcript"
        name="transcript"
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        maxLength={MAX_TRANSCRIPT_LENGTH}
        rows={18}
        required
        spellCheck={false}
      />
      <div className="form-footer">
        <span className="character-count" aria-live="polite">
          {transcript.length.toLocaleString("en-US")} / {MAX_TRANSCRIPT_LENGTH.toLocaleString("en-US")}
        </span>
        <SubmitButton />
      </div>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    </form>
  );
}
