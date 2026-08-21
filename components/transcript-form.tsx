"use client";

import { useActionState, useState, type DragEvent } from "react";
import { useFormStatus } from "react-dom";

import { submitTranscript } from "../app/actions";
import type { CallType } from "../src/domain/types";

const EXAMPLES = [
  { value: "kickoff-01", label: "Kick-off 01", callType: "kickoff" },
  { value: "kickoff-02", label: "Kick-off 02", callType: "kickoff" },
  { value: "coaching-01", label: "Coaching 01", callType: "coaching" },
  { value: "coaching-02", label: "Coaching 02", callType: "coaching" },
] as const satisfies readonly {
  value: string;
  label: string;
  callType: CallType;
}[];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Starting…" : "Evaluate call"}
    </button>
  );
}

function formatFileSize(bytes: number) {
  return bytes < 1_024 ? `${bytes} B` : `${(bytes / 1_024).toFixed(1)} KB`;
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
  const [inputError, setInputError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [state, formAction] = useActionState(submitTranscript, { error: null });

  async function loadExample(value: string) {
    const example = EXAMPLES.find((item) => item.value === value);
    if (!example) return;

    setInputError(null);
    try {
      const response = await fetch(`/examples/${example.value}.txt`);
      if (!response.ok) throw new Error("Example not found");
      setTranscript(await response.text());
      setLoadedFile(null);
      setCallType(example.callType);
    } catch {
      setInputError("The example transcript could not be loaded.");
    }
  }

  async function loadFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) {
      setInputError("Choose a plain .txt file.");
      setLoadedFile(null);
      return;
    }

    setInputError(null);
    try {
      setTranscript(await file.text());
      setLoadedFile(file);
    } catch {
      setInputError("The text file could not be read.");
      setLoadedFile(null);
    }
  }

  function handleDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (
      event.relatedTarget instanceof Node
      && event.currentTarget.contains(event.relatedTarget)
    ) return;
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files[0]);
  }

  return (
    <form action={formAction} className="transcript-form">
      <CallTypeChoices value={callType} onChange={setCallType} />

      <label className="transcript-label" htmlFor="transcript">
        <span>Transcript</span>
        <small>Paste text, upload a .txt file, or load one of the supplied examples.</small>
      </label>
      <div
        className="file-dropzone"
        data-dragging={isDragging}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="dropzone-copy">
          <strong>{isDragging ? "Drop to load transcript" : "Drop a transcript here"}</strong>
          <small>Plain .txt file</small>
        </div>
        <label className="file-picker">
          <input
            type="file"
            accept=".txt,text/plain"
            aria-label="Upload .txt file"
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
          <span>Choose file</span>
        </label>
      </div>
      {loadedFile ? (
        <div className="file-receipt" aria-live="polite">
          <span>Loaded</span>
          <strong>{loadedFile.name}</strong>
          <small>{formatFileSize(loadedFile.size)}</small>
        </div>
      ) : null}
      <div className="example-row">
        <span className="alternate-label">or load a supplied example</span>
        <label className="example-picker">
          <span>Example transcript</span>
          <select
            aria-label="Load example transcript"
            defaultValue=""
            onChange={(event) => void loadExample(event.target.value)}
          >
            <option value="" disabled>Choose an example</option>
            {EXAMPLES.map((example) => (
              <option key={example.value} value={example.value}>
                {example.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        id="transcript"
        name="transcript"
        value={transcript}
        onChange={(event) => {
          setTranscript(event.target.value);
          setLoadedFile(null);
        }}
        rows={6}
        required
        spellCheck={false}
      />
      <div className="form-footer">
        <span className="character-count" aria-live="polite">
          {transcript.length.toLocaleString("en-US")} characters
        </span>
        <SubmitButton />
      </div>
      {inputError || state.error ? (
        <p className="form-error" role="alert">{inputError || state.error}</p>
      ) : null}
    </form>
  );
}
