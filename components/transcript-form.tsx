"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitTranscript } from "../app/actions";

const MAX_TRANSCRIPT_LENGTH = 65_000;

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Starting…" : "Evaluate call"}
    </button>
  );
}

export function TranscriptForm() {
  const [transcript, setTranscript] = useState("");
  const [state, formAction] = useActionState(submitTranscript, { error: null });

  return (
    <form action={formAction} className="transcript-form">
      <fieldset>
        <legend>Call type</legend>
        <label>
          <input type="radio" name="callType" value="kickoff" defaultChecked />
          <span>
            <strong>Kick-off</strong>
            <small>Set-up, expectations, and the working agreement</small>
          </span>
        </label>
        <label>
          <input type="radio" name="callType" value="coaching" />
          <span>
            <strong>Coaching</strong>
            <small>Diagnosis, coaching movement, and the next call</small>
          </span>
        </label>
      </fieldset>

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
