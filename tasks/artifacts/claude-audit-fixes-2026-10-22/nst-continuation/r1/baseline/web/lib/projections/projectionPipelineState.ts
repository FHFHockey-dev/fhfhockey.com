import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

export const PROJECTION_INPUT_PIPELINE_KEY = "projection_input_ingest";
export const PROJECTION_INPUT_SCOPE_KEY = "completed_game_slates";

type PipelineStatus = "running" | "complete" | "failed";
type PipelineTransition = "acquire" | "advance" | "complete" | "fail";

type PipelineStateRow = {
  pipeline_key: string;
  scope_key: string;
  operation_key: string;
  revision: number;
  status: PipelineStatus;
  cursor_game_id: number | null;
  cursor_date: string | null;
  range_start_date: string;
  range_end_date: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type ProjectionPipelineLease = {
  pipelineKey: string;
  scopeKey: string;
  operationKey: string;
  revision: number;
  status: PipelineStatus;
  cursorGameId: number | null;
  cursorDate: string | null;
  rangeStartDate: string;
  rangeEndDate: string;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export type ProjectionPipelineBacklogOperation = Pick<
  ProjectionPipelineLease,
  | "operationKey"
  | "rangeStartDate"
  | "rangeEndDate"
  | "cursorDate"
  | "cursorGameId"
  | "status"
>;

type StateClient = {
  from(table: "projection_pipeline_state"): {
    select(columns: string): {
      eq(column: string, value: string): any;
    };
  };
  rpc(
    functionName: "advance_projection_pipeline_state_v1",
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PIPELINE_OR_OPERATION_KEY = /^[a-z0-9][a-z0-9_:-]{0,63}$/;
const SCOPE_KEY = /^[A-Za-z0-9][A-Za-z0-9_.:@/+~-]{0,127}$/;
const FAILURE_CODE = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;

function requirePipelineOrOperationKey(value: string, field: string): string {
  if (!PIPELINE_OR_OPERATION_KEY.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function requireScopeKey(value: string): string {
  if (!SCOPE_KEY.test(value)) throw new Error("Invalid pipeline scope key");
  return value;
}

function requireFailureCode(value: string): string {
  if (!FAILURE_CODE.test(value)) throw new Error("Invalid failure code");
  return value;
}

function requireDate(value: string, field: string): string {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (
    error &&
    typeof error === "object" &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return new Error((error as { message: string }).message);
  }
  return new Error(fallback);
}

function timestampsRepresentSameInstant(
  left: string | null,
  right: string | null,
): boolean {
  if (left === null || right === null) return left === right;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return !Number.isNaN(leftMs) && !Number.isNaN(rightMs) && leftMs === rightMs;
}

function parseState(data: unknown): ProjectionPipelineLease {
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("Pipeline state RPC did not return exactly one receipt");
  }
  const row = data[0] as Partial<PipelineStateRow>;
  if (
    typeof row.pipeline_key !== "string" ||
    typeof row.scope_key !== "string" ||
    typeof row.operation_key !== "string" ||
    !Number.isSafeInteger(row.revision) ||
    Number(row.revision) <= 0 ||
    !["running", "complete", "failed"].includes(String(row.status)) ||
    typeof row.range_start_date !== "string" ||
    typeof row.range_end_date !== "string" ||
    (row.cursor_game_id != null &&
      (!Number.isSafeInteger(row.cursor_game_id) || row.cursor_game_id <= 0)) ||
    (row.cursor_date != null && !ISO_DATE.test(row.cursor_date)) ||
    (row.lease_expires_at != null &&
      Number.isNaN(Date.parse(row.lease_expires_at))) ||
    typeof row.updated_at !== "string" ||
    Number.isNaN(Date.parse(row.updated_at))
  ) {
    throw new Error("Pipeline state RPC returned an invalid receipt");
  }
  return {
    pipelineKey: row.pipeline_key,
    scopeKey: row.scope_key,
    operationKey: row.operation_key,
    revision: Number(row.revision),
    status: row.status as PipelineStatus,
    cursorGameId: row.cursor_game_id ?? null,
    cursorDate: row.cursor_date ?? null,
    rangeStartDate: row.range_start_date,
    rangeEndDate: row.range_end_date,
    leaseOwner: row.lease_owner ?? null,
    leaseExpiresAt: row.lease_expires_at ?? null,
    lastError: row.last_error ?? null,
    updatedAt: row.updated_at,
  };
}

function unwrapStateRow(data: unknown): PipelineStateRow | null {
  if (data == null) return null;
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Projection pipeline state read returned an invalid row");
  }
  const row = data as PipelineStateRow;
  if (
    !Number.isSafeInteger(row.revision) ||
    row.revision <= 0 ||
    !["running", "complete", "failed"].includes(row.status)
  ) {
    throw new Error("Projection pipeline state is malformed");
  }
  return row;
}

async function readState(args: {
  client: StateClient;
  pipelineKey: string;
  scopeKey: string;
  operationKey: string;
}): Promise<PipelineStateRow | null> {
  const query = args.client
    .from("projection_pipeline_state")
    .select(
      "pipeline_key,scope_key,operation_key,revision,status,cursor_game_id,cursor_date,range_start_date,range_end_date,lease_owner,lease_expires_at,last_error,updated_at",
    )
    .eq("pipeline_key", args.pipelineKey)
    .eq("scope_key", args.scopeKey)
    .eq("operation_key", args.operationKey);
  const { data, error } = await query.maybeSingle();
  if (error) throw toError(error, "Projection pipeline state read failed");
  return unwrapStateRow(data);
}

export async function readOldestProjectionPipelineBacklog(args: {
  supabase: SupabaseClient<Database>;
  throughDate: string;
  pipelineKey?: string;
  scopeKey?: string;
}): Promise<ProjectionPipelineBacklogOperation | null> {
  const client = args.supabase as unknown as StateClient;
  const pipelineKey = requirePipelineOrOperationKey(
    args.pipelineKey ?? PROJECTION_INPUT_PIPELINE_KEY,
    "pipeline key",
  );
  const scopeKey = requireScopeKey(args.scopeKey ?? PROJECTION_INPUT_SCOPE_KEY);
  const throughDate = requireDate(args.throughDate, "pipeline backlog date");
  const query = client
    .from("projection_pipeline_state")
    .select(
      "pipeline_key,scope_key,operation_key,revision,status,cursor_game_id,cursor_date,range_start_date,range_end_date,lease_owner,lease_expires_at,last_error,updated_at",
    )
    .eq("pipeline_key", pipelineKey)
    .eq("scope_key", scopeKey)
    .in("status", ["running", "failed"])
    .like("operation_key", "canonical:%")
    .lte("range_end_date", throughDate)
    .order("range_start_date", { ascending: true })
    .order("operation_key", { ascending: true })
    .limit(1);
  const { data, error } = await query.maybeSingle();
  if (error) throw toError(error, "Projection pipeline backlog read failed");
  const row = unwrapStateRow(data);
  if (!row) return null;
  const state = parseState([row]);
  if (
    state.pipelineKey !== pipelineKey ||
    state.scopeKey !== scopeKey ||
    state.status === "complete" ||
    state.rangeEndDate > throughDate ||
    !state.operationKey.startsWith("canonical:")
  ) {
    throw new Error("Projection pipeline backlog read returned an invalid row");
  }
  return {
    operationKey: state.operationKey,
    rangeStartDate: state.rangeStartDate,
    rangeEndDate: state.rangeEndDate,
    cursorDate: state.cursorDate,
    cursorGameId: state.cursorGameId,
    status: state.status,
  };
}

async function transition(args: {
  client: StateClient;
  current: ProjectionPipelineLease | null;
  pipelineKey: string;
  scopeKey: string;
  operationKey: string;
  transition: PipelineTransition;
  nextStatus: PipelineStatus;
  cursorGameId: number | null;
  cursorDate: string | null;
  rangeStartDate: string;
  rangeEndDate: string;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
}): Promise<ProjectionPipelineLease> {
  const { data, error } = await args.client.rpc(
    "advance_projection_pipeline_state_v1",
    {
      p_expected_revision: args.current?.revision ?? 0,
      p_last_error: args.lastError,
      p_lease_expires_at: args.leaseExpiresAt,
      p_lease_owner: args.leaseOwner,
      p_next_cursor_date: args.cursorDate,
      p_next_cursor_game_id: args.cursorGameId,
      p_next_status: args.nextStatus,
      p_operation_key: args.operationKey,
      p_pipeline_key: args.pipelineKey,
      p_range_end_date: args.rangeEndDate,
      p_range_start_date: args.rangeStartDate,
      p_scope_key: args.scopeKey,
      p_transition: args.transition,
    },
  );
  if (error)
    throw toError(error, "Projection pipeline state transition failed");
  const next = parseState(data);
  if (
    next.pipelineKey !== args.pipelineKey ||
    next.scopeKey !== args.scopeKey ||
    next.operationKey !== args.operationKey ||
    next.status !== args.nextStatus ||
    next.revision !== (args.current?.revision ?? 0) + 1 ||
    next.cursorGameId !== args.cursorGameId ||
    next.cursorDate !== args.cursorDate ||
    next.rangeStartDate !== args.rangeStartDate ||
    next.rangeEndDate !== args.rangeEndDate ||
    next.lastError !== args.lastError ||
    (args.nextStatus === "running" &&
      (next.leaseOwner !== args.leaseOwner ||
        !timestampsRepresentSameInstant(
          next.leaseExpiresAt,
          args.leaseExpiresAt,
        ))) ||
    (args.nextStatus !== "running" &&
      (next.leaseOwner !== null || next.leaseExpiresAt !== null))
  ) {
    throw new Error("Projection pipeline state receipt does not match request");
  }
  return next;
}

export function buildProjectionPipelineOperationKey(args: {
  startDate: string;
  endDate: string;
  force: boolean;
}): string {
  const startDate = requireDate(args.startDate, "pipeline start date");
  const endDate = requireDate(args.endDate, "pipeline end date");
  if (startDate > endDate) throw new Error("Invalid pipeline date range");
  return `${args.force ? "force" : "canonical"}:${startDate}:${endDate}`;
}

export async function acquireProjectionPipelineLease(args: {
  supabase: SupabaseClient<Database>;
  pipelineKey?: string;
  scopeKey?: string;
  operationKey: string;
  rangeStartDate: string;
  rangeEndDate: string;
  initialCursorDate: string;
  leaseMs?: number;
  now?: Date;
}): Promise<ProjectionPipelineLease> {
  const client = args.supabase as unknown as StateClient;
  const pipelineKey = requirePipelineOrOperationKey(
    args.pipelineKey ?? PROJECTION_INPUT_PIPELINE_KEY,
    "pipeline key",
  );
  const scopeKey = requireScopeKey(args.scopeKey ?? PROJECTION_INPUT_SCOPE_KEY);
  const operationKey = requirePipelineOrOperationKey(
    args.operationKey,
    "pipeline operation key",
  );
  const rangeStartDate = requireDate(args.rangeStartDate, "range start date");
  const rangeEndDate = requireDate(args.rangeEndDate, "range end date");
  const initialCursorDate = requireDate(
    args.initialCursorDate,
    "initial cursor date",
  );
  const leaseMs = args.leaseMs ?? 10 * 60 * 1000;
  if (
    !Number.isSafeInteger(leaseMs) ||
    leaseMs < 30_000 ||
    leaseMs > 15 * 60 * 1000
  ) {
    throw new Error(
      "Pipeline lease duration must be between 30 seconds and 15 minutes",
    );
  }
  const now = args.now ?? new Date();
  const existing = await readState({
    client,
    pipelineKey,
    scopeKey,
    operationKey,
  });
  const current = existing ? parseState([existing]) : null;
  if (current?.status === "complete") {
    if (
      current.rangeStartDate !== rangeStartDate ||
      current.rangeEndDate !== rangeEndDate
    ) {
      throw new Error(
        "Completed pipeline operation range does not match request",
      );
    }
    return current;
  }
  const shouldResume =
    current?.status === "failed" || current?.status === "running";
  const leaseOwner = randomUUID();
  return transition({
    client,
    current,
    pipelineKey,
    scopeKey,
    operationKey,
    transition: "acquire",
    nextStatus: "running",
    cursorGameId: shouldResume ? current.cursorGameId : null,
    cursorDate: shouldResume
      ? (current.cursorDate ?? initialCursorDate)
      : initialCursorDate,
    rangeStartDate,
    rangeEndDate,
    leaseOwner,
    leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
    lastError: null,
  });
}

export async function advanceProjectionPipelineLease(args: {
  supabase: SupabaseClient<Database>;
  lease: ProjectionPipelineLease;
  nextCursorDate: string;
  nextCursorGameId: number | null;
  leaseMs?: number;
  now?: Date;
}): Promise<ProjectionPipelineLease> {
  if (args.lease.status !== "running" || !args.lease.leaseOwner) {
    throw new Error("Cannot advance a pipeline state without an active lease");
  }
  const leaseMs = args.leaseMs ?? 10 * 60 * 1000;
  const now = args.now ?? new Date();
  return transition({
    client: args.supabase as unknown as StateClient,
    current: args.lease,
    pipelineKey: args.lease.pipelineKey,
    scopeKey: args.lease.scopeKey,
    operationKey: args.lease.operationKey,
    transition: "advance",
    nextStatus: "running",
    cursorGameId: args.nextCursorGameId,
    cursorDate: requireDate(args.nextCursorDate, "next cursor date"),
    rangeStartDate: args.lease.rangeStartDate,
    rangeEndDate: args.lease.rangeEndDate,
    leaseOwner: args.lease.leaseOwner,
    leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
    lastError: null,
  });
}

export async function finishProjectionPipelineLease(args: {
  supabase: SupabaseClient<Database>;
  lease: ProjectionPipelineLease;
  outcome: "complete" | "failed";
  failureCode?: string;
}): Promise<ProjectionPipelineLease> {
  if (args.lease.status !== "running" || !args.lease.leaseOwner) {
    throw new Error("Cannot finish a pipeline state without an active lease");
  }
  const failed = args.outcome === "failed";
  const failureCode = failed
    ? requireFailureCode(args.failureCode ?? "projection_input_failed")
    : null;
  return transition({
    client: args.supabase as unknown as StateClient,
    current: args.lease,
    pipelineKey: args.lease.pipelineKey,
    scopeKey: args.lease.scopeKey,
    operationKey: args.lease.operationKey,
    transition: failed ? "fail" : "complete",
    nextStatus: failed ? "failed" : "complete",
    cursorGameId: args.lease.cursorGameId,
    cursorDate: args.lease.cursorDate,
    rangeStartDate: args.lease.rangeStartDate,
    rangeEndDate: args.lease.rangeEndDate,
    leaseOwner: args.lease.leaseOwner,
    leaseExpiresAt: null,
    lastError: failureCode,
  });
}
