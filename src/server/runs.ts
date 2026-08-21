import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import type {
  CallType,
  EvaluationResult,
  RunRecord,
} from "../domain/types";
import { evaluationCandidateSchema } from "../domain/evaluation-schema";
import type { Json, RunRow } from "./supabase";
import { MAX_TRANSCRIPT_LENGTH } from "./submission";
import { evaluatorTestModeEnabled } from "./test-mode";

export const STALE_RUN_ERROR =
  "The evaluation timed out. Please submit the transcript again.";
const SUBMISSION_LIMIT_ERROR = "SUBMISSION_LIMIT_REACHED";

export type PublicRun = Omit<RunRecord, "transcript" | "clientHash">;

type CreateRunInput = {
  callType: CallType;
  transcript: string;
  clientHash: string;
};

type RepositoryOptions = {
  now?: () => Date;
  staleAfterMs?: number;
};

type InMemoryRepositoryOptions = RepositoryOptions & {
  initialRuns?: RunRecord[];
};

class RunRepository {
  private readonly memory?: Map<string, RunRecord>;
  private readonly now: () => Date;
  private readonly staleAfterMs: number;

  constructor(memory?: Map<string, RunRecord>, options: RepositoryOptions = {}) {
    this.memory = memory;
    this.now = options.now ?? (() => new Date());
    this.staleAfterMs = options.staleAfterMs ?? 12 * 60_000;
  }

  get size() {
    return this.memory?.size ?? 0;
  }

  async createRun(input: CreateRunInput): Promise<RunRecord> {
    validateCreateInput(input);

    if (this.memory) {
      return this.createMemoryRun(input);
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("runs")
      .insert({
        call_type: input.callType,
        transcript: input.transcript,
        client_hash: input.clientHash,
      })
      .select("*")
      .single();
    if (error) throw error;
    return fromRow(data);
  }

  async createLimitedRun(
    input: CreateRunInput,
    cutoff: Date,
    limit: number,
  ): Promise<RunRecord> {
    validateCreateInput(input);
    if (!Number.isInteger(limit) || limit < 1 || Number.isNaN(cutoff.getTime())) {
      throw new Error("Invalid submission limit");
    }

    if (this.memory) {
      const recentRuns = [...this.memory.values()].filter(
        (run) =>
          run.clientHash === input.clientHash &&
          Date.parse(run.createdAt) > cutoff.getTime(),
      ).length;
      if (recentRuns >= limit) throw new Error(SUBMISSION_LIMIT_ERROR);
      return this.createMemoryRun(input);
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .rpc("create_limited_run", {
        p_call_type: input.callType,
        p_transcript: input.transcript,
        p_client_hash: input.clientHash,
        p_cutoff: cutoff.toISOString(),
        p_limit: limit,
      })
      .single();
    if (error) throw error;
    return fromRow(data);
  }

  async claimRun(id: string): Promise<RunRecord | null> {
    if (this.memory) {
      const run = this.memory.get(id);
      if (!run || run.status !== "queued") return null;
      run.status = "processing";
      run.startedAt = this.now().toISOString();
      return structuredClone(run);
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("runs")
      .update({ status: "processing" })
      .eq("id", id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  }

  async completeRun(id: string, result: EvaluationResult): Promise<void> {
    const parsedResult = parseEvaluationResult(result);

    if (this.memory) {
      const current = this.memory.get(id);
      if (!current || current.status !== "processing") invalidTransition();
      current.status = "completed";
      current.result = structuredClone(parsedResult);
      current.finishedAt = this.now().toISOString();
      return;
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("runs")
      .update({
        status: "completed",
        result_json: parsedResult as unknown as Json,
      })
      .eq("id", id)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) invalidTransition();
  }

  async failRun(id: string, publicError: string): Promise<void> {
    if (!publicError.trim() || /[\r\n]/.test(publicError) || publicError.length > 300) {
      throw new Error("Public run errors must be safe, single-line messages");
    }
    if (!(await this.setFailed(id, publicError))) invalidTransition();
  }

  async getPublicRun(id: string): Promise<PublicRun | null> {
    let run = await this.readRun(id);
    if (!run) return null;

    if (run.status === "queued" || run.status === "processing") {
      const cutoff = new Date(
        this.now().getTime() - this.staleAfterMs,
      ).toISOString();
      if (this.isStale(run, cutoff)) {
        await this.setStaleFailed(run, cutoff);
        run = await this.readRun(id);
        if (!run) return null;
      }
    }

    const { transcript: _transcript, clientHash: _clientHash, ...publicRun } = run;
    return publicRun;
  }

  async getCompletedRunTranscript(id: string): Promise<string | null> {
    const run = await this.readRun(id);
    return run?.status === "completed" ? run.transcript : null;
  }

  private async setFailed(id: string, publicError: string): Promise<boolean> {
    if (this.memory) {
      const run = this.memory.get(id);
      if (!run || !["queued", "processing"].includes(run.status)) return false;
      run.status = "failed";
      run.result = null;
      run.publicError = publicError;
      run.finishedAt = this.now().toISOString();
      return true;
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("runs")
      .update({ status: "failed", result_json: null, public_error: publicError })
      .eq("id", id)
      .in("status", ["queued", "processing"])
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  private async setStaleFailed(
    observed: RunRecord,
    cutoff: string,
  ): Promise<boolean> {
    const anchor = observed.status === "queued" ? "createdAt" : "startedAt";
    if (this.memory) {
      const run = this.memory.get(observed.id);
      if (
        !run ||
        run.status !== observed.status ||
        !run[anchor] ||
        Date.parse(run[anchor]) >= Date.parse(cutoff)
      ) {
        return false;
      }
      run.status = "failed";
      run.result = null;
      run.publicError = STALE_RUN_ERROR;
      run.finishedAt = this.now().toISOString();
      return true;
    }

    const supabase = await getSupabase();
    const query = supabase
      .from("runs")
      .update({
        status: "failed",
        result_json: null,
        public_error: STALE_RUN_ERROR,
      })
      .eq("id", observed.id)
      .eq("status", observed.status);
    const { data, error } = await (observed.status === "queued"
      ? query.lt("created_at", cutoff)
      : query.lt("started_at", cutoff))
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  private async readRun(id: string): Promise<RunRecord | null> {
    if (this.memory) {
      const run = this.memory.get(id);
      if (!run) return null;
      const storedRun = structuredClone(run);
      if (storedRun.result !== null) {
        storedRun.result = parseEvaluationResult(storedRun.result);
      }
      return storedRun;
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  }

  private isStale(run: RunRecord, cutoff: string) {
    const anchor = run.status === "processing" ? run.startedAt : run.createdAt;
    return Boolean(anchor && Date.parse(anchor) < Date.parse(cutoff));
  }

  private createMemoryRun(input: CreateRunInput): RunRecord {
    if (!this.memory) throw new Error("Memory repository is unavailable");
    const run: RunRecord = {
      id: randomUUID(),
      ...input,
      status: "queued",
      result: null,
      publicError: null,
      createdAt: this.now().toISOString(),
      startedAt: null,
      finishedAt: null,
    };
    this.memory.set(run.id, run);
    return structuredClone(run);
  }
}

function invalidTransition(): never {
  throw new Error("Invalid run transition");
}

function validateCreateInput(input: CreateRunInput) {
  if (
    !["kickoff", "coaching"].includes(input.callType) ||
    input.transcript.trim().length === 0 ||
    input.transcript.length > MAX_TRANSCRIPT_LENGTH ||
    !/^[a-f0-9]{64}$/.test(input.clientHash)
  ) {
    throw new Error("Invalid run submission");
  }
}

export function isSubmissionLimitError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "message" in error &&
      error.message === SUBMISSION_LIMIT_ERROR,
  );
}

function parseEvaluationResult(input: unknown): EvaluationResult {
  return evaluationCandidateSchema.parse(input) as EvaluationResult;
}

function fromRow(row: RunRow): RunRecord {
  return {
    id: row.id,
    callType: row.call_type,
    transcript: row.transcript,
    clientHash: row.client_hash,
    status: row.status,
    result:
      row.result_json === null ? null : parseEvaluationResult(row.result_json),
    publicError: row.public_error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

async function getSupabase() {
  return (await import("./supabase")).getSupabase();
}

const productionRepository = new RunRepository();

async function withRepository<T>(
  operation: (repository: RunRepository) => Promise<T>,
) {
  if (!evaluatorTestModeEnabled()) return operation(productionRepository);

  const path = process.env.EVALUATOR_TEST_STORE;
  if (
    !path ||
    !/^beavermind-call-evaluator-[0-9a-f-]{36}\.json$/.test(basename(path))
  ) {
    throw new Error("Evaluator test store is not safely configured");
  }

  let initialRuns: RunRecord[] = [];
  try {
    initialRuns = JSON.parse(await readFile(path, "utf8")) as RunRecord[];
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const memory = new Map(
    initialRuns.map((run) => [run.id, structuredClone(run)]),
  );
  const repository = new RunRepository(memory);
  try {
    return await operation(repository);
  } finally {
    await writeFile(path, JSON.stringify([...memory.values()]));
  }
}

export const createRun = (input: CreateRunInput) =>
  withRepository((repository) => repository.createRun(input));
export const createLimitedRun = (
  input: CreateRunInput,
  cutoff: Date,
  limit: number,
) =>
  withRepository((repository) =>
    repository.createLimitedRun(input, cutoff, limit),
  );
export const claimRun = (id: string) =>
  withRepository((repository) => repository.claimRun(id));
export const completeRun = (id: string, result: EvaluationResult) =>
  withRepository((repository) => repository.completeRun(id, result));
export const failRun = (id: string, publicError: string) =>
  withRepository((repository) => repository.failRun(id, publicError));
export const getPublicRun = (id: string) =>
  withRepository((repository) => repository.getPublicRun(id));
export const getCompletedRunTranscript = (id: string) =>
  withRepository((repository) => repository.getCompletedRunTranscript(id));

export function createInMemoryRunRepository(
  options: InMemoryRepositoryOptions = {},
) {
  const memory = new Map(
    options.initialRuns?.map((run) => [run.id, structuredClone(run)]),
  );
  return new RunRepository(memory, options);
}
