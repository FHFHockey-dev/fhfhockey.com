/**
 * Route runner pure core: parse a pasted route, build each step's query,
 * classify a step's answer per contract, and extract progress for the page.
 * No I/O; safe for the browser page and the tick.
 */
import { validateAdminRoutePath } from "components/Admin/adminRoutePath";

import {
  ROUTE_RUNNER_PATHS,
  getRouteRunnerSpec,
  type RouteRunnerContract,
  type RouteRunnerPath,
  type RouteRunnerRouteSpec
} from "./registry";

// vercel.json gives pages/api 240 s. Routes are told to answer by the step
// deadline; a step still running at the timeout is abandoned so the tick can
// record it before the kill; the lease outlives the kill so a dead tick's job
// is not taken again until its function is gone.
export const ROUTE_RUNNER_STEP_DEADLINE_MS = 220_000;
export const ROUTE_RUNNER_STEP_TIMEOUT_MS = 228_000;
export const ROUTE_RUNNER_LEASE_MS = 260_000;
// A rolling claim budget never goes below this, even late in a tick.
const MIN_CLAIM_BUDGET_MS = 30_000;
export const ROUTE_RUNNER_MAX_KILLS = 3;
export const ROUTE_RUNNER_MAX_STALLS = 3;
export const ROUTE_RUNNER_SOURCE_DOWN_WAIT_MS = 30 * 60_000;
export const ROUTE_RUNNER_JOB_TTL_MS = 72 * 60 * 60_000;

export const ROUTE_RUNNER_ACTIVE_STATUSES = [
  "queued",
  "running",
  "waiting"
] as const;
export type RouteRunnerStatus =
  | (typeof ROUTE_RUNNER_ACTIVE_STATUSES)[number]
  | "completed"
  | "failed"
  | "cancelled";

export type RouteQuery = Record<string, string>;

export function isActiveStatus(status: string): boolean {
  return (ROUTE_RUNNER_ACTIVE_STATUSES as readonly string[]).includes(status);
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

// A pasted absolute URL from these origins is accepted as its path and query.
// The host is never contacted: the tick runs the route in-process.
const KNOWN_ORIGINS = ["https://fhfhockey.com", "https://www.fhfhockey.com"];
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

export type ParsedRunnerInput =
  | {
      ok: true;
      routePath: RouteRunnerPath;
      query: RouteQuery;
      contract: RouteRunnerContract;
      ignoredParams: string[];
    }
  | { ok: false; error: string };

export function parseRunnerInput(
  input: string,
  extraOrigins: readonly string[] = []
): ParsedRunnerInput {
  let candidate = input.trim();
  const absolute = candidate.match(/^(https?:\/\/[^/?#\s]+)([/?#][^\s]*)?$/i);
  if (absolute) {
    const origin = absolute[1].toLowerCase();
    const allowed =
      KNOWN_ORIGINS.includes(origin) ||
      LOCAL_ORIGIN.test(origin) ||
      extraOrigins.some((extra) => extra.toLowerCase() === origin);
    if (!allowed) {
      return {
        ok: false,
        error: "Paste a path (/api/...) or a URL from this site."
      };
    }
    candidate = absolute[2] ?? "/";
  }

  const validated = validateAdminRoutePath(candidate);
  if (!validated.ok) return validated;

  const url = new URL(validated.path, "https://same-origin.invalid");
  const routePath = url.pathname.replace(/\/+$/, "");
  const spec = getRouteRunnerSpec(routePath);
  if (!spec) {
    return {
      ok: false,
      error: `${routePath} is not on the route runner allowlist. Allowed: ${ROUTE_RUNNER_PATHS.join(", ")}.`
    };
  }

  const entries = new Map<string, string>();
  const ignoredParams: string[] = [];
  for (const [key, value] of url.searchParams) {
    if (entries.has(key) || ignoredParams.includes(key)) {
      return { ok: false, error: `Repeated parameter "${key}" is not supported.` };
    }
    if (spec.runnerParams?.includes(key)) {
      ignoredParams.push(key);
      continue;
    }
    entries.set(key, value);
  }

  return {
    ok: true,
    routePath: routePath as RouteRunnerPath,
    query: Object.fromEntries(entries),
    contract: spec.contract,
    ignoredParams
  };
}

function withoutRunnerParams(
  spec: RouteRunnerRouteSpec,
  query: RouteQuery
): RouteQuery {
  const result: RouteQuery = {};
  for (const [key, value] of Object.entries(query)) {
    if (!spec.runnerParams?.includes(key)) result[key] = value;
  }
  return result;
}

/** The query actually sent on a step: the job's query plus runtime bounds. */
export function buildStepQuery(
  spec: RouteRunnerRouteSpec,
  query: RouteQuery,
  tickStartedAtMs: number,
  nowMs: number
): RouteQuery {
  const step = withoutRunnerParams(spec, query);
  if (spec.deadlineParam) {
    step[spec.deadlineParam] = String(
      tickStartedAtMs +
        ROUTE_RUNNER_STEP_DEADLINE_MS -
        (spec.deadlineHeadroomMs ?? 0)
    );
  }
  if (spec.maxRuntimeParam && spec.maxRuntimeMs != null) {
    step[spec.maxRuntimeParam] = String(
      Math.max(
        MIN_CLAIM_BUDGET_MS,
        spec.maxRuntimeMs - Math.max(0, nowMs - tickStartedAtMs)
      )
    );
  }
  return step;
}

// ---------------------------------------------------------------------------
// Classify
// ---------------------------------------------------------------------------

export type StepResult = { statusCode: number; body: unknown };

export type StepDecision =
  | { kind: "continue"; nextQuery: RouteQuery; reason: string }
  | { kind: "complete"; reason: string }
  | { kind: "wait"; delayMs: number; reason: string }
  | { kind: "fail"; reason: string };

type Body = Record<string, any>;

function asRecord(value: unknown): Body | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Body)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[1-9]\d*$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function is2xx(statusCode: number) {
  return statusCode >= 200 && statusCode < 300;
}

/** A short reason from the body: message, then error. */
function bodyMessage(body: Body | null): string | null {
  const text = nonEmptyString(body?.message) ?? nonEmptyString(body?.error);
  return text ? text.slice(0, 300) : null;
}

function withMessage(prefix: string, body: Body | null) {
  const message = bodyMessage(body);
  return message ? `${prefix}: ${message}` : prefix;
}

/** Flat string query from a route's resume request; null if not flat. */
function scalarQuery(value: unknown): RouteQuery | null {
  const record = asRecord(value);
  if (!record) return null;
  const result: RouteQuery = {};
  for (const [key, field] of Object.entries(record)) {
    if (typeof field === "string") result[key] = field;
    else if (typeof field === "number" && Number.isFinite(field)) {
      result[key] = String(field);
    } else if (typeof field === "boolean") result[key] = String(field);
    else return null;
  }
  return result;
}

function dropKeys(query: RouteQuery, keys: readonly string[]): RouteQuery {
  const result: RouteQuery = {};
  for (const [key, value] of Object.entries(query)) {
    if (!keys.includes(key)) result[key] = value;
  }
  return result;
}

export function sameQuery(left: RouteQuery, right: RouteQuery): boolean {
  const leftKeys = Object.keys(left);
  return (
    leftKeys.length === Object.keys(right).length &&
    leftKeys.every((key) => right[key] === left[key])
  );
}

function classifyOnce(result: StepResult, body: Body | null): StepDecision {
  if (
    is2xx(result.statusCode) &&
    body?.success !== false &&
    !nonEmptyString(body?.error)
  ) {
    return { kind: "complete", reason: withMessage(`HTTP ${result.statusCode}`, body) };
  }
  return { kind: "fail", reason: withMessage(`HTTP ${result.statusCode}`, body) };
}

function classifyNst(
  result: StepResult,
  body: Body | null,
  sentQuery: RouteQuery,
  runnerParams: readonly string[]
): StepDecision | null {
  const operationStatus = body?.operationStatus;
  if (
    result.statusCode === 200 &&
    body?.success === true &&
    !nonEmptyString(body.error) &&
    body.resume?.required !== true &&
    (operationStatus == null ||
      operationStatus === "completed" ||
      operationStatus === "skipped_no_completed_games")
  ) {
    return {
      kind: "complete",
      reason:
        operationStatus === "skipped_no_completed_games"
          ? "NST: no completed games in the scope."
          : "NST: every source in the scope is done."
    };
  }
  if (result.statusCode !== 207 || operationStatus !== "continuation_required") {
    return null;
  }
  const fail = (reason: string): StepDecision => ({ kind: "fail", reason });
  if (nonEmptyString(body?.error) || body?.success !== false) {
    return fail("NST continuation is malformed (error set or success not false).");
  }
  if (body?.nstProgress?.auditPersistence !== "confirmed") {
    return fail("NST continuation has no confirmed progress acknowledgement.");
  }
  const replay =
    body.resume?.required === true ? scalarQuery(body.resume?.request?.query) : null;
  if (!replay) {
    return fail("NST continuation has no replayable resume.request.query.");
  }
  const nextQuery = dropKeys(replay, runnerParams);
  const cursor = positiveInteger(nextQuery.cursor);
  const sentCursor = positiveInteger(sentQuery.cursor) ?? 0;
  if (cursor == null || cursor <= sentCursor) {
    return fail("NST continuation cursor is not a positive integer past the cursor sent.");
  }
  const scope = dropKeys(nextQuery, ["cursor"]);
  const sentScope = dropKeys(sentQuery, ["cursor", ...runnerParams]);
  if (!sameQuery(scope, sentScope)) {
    return fail("NST continuation query does not replay the request that was sent.");
  }
  const total = body.nstProgress?.continuation?.totalUrls;
  return {
    kind: "continue",
    nextQuery,
    reason: `NST continuation: cursor ${cursor}${Number.isSafeInteger(total) ? ` of ${total}` : ""}.`
  };
}

function classifyRolling(
  result: StepResult,
  body: Body | null,
  sentQuery: RouteQuery,
  runnerParams: readonly string[]
): StepDecision | null {
  const nextResumeFrom =
    positiveInteger(body?.resume?.nextResumeFrom) ??
    positiveInteger(body?.runSummary?.nextResumeFrom);
  const partial =
    result.statusCode === 207 &&
    body?.operationStatus === "partial" &&
    body?.resume?.required === true;
  const bounded =
    is2xx(result.statusCode) &&
    body?.success !== false &&
    !nonEmptyString(body?.error) &&
    nextResumeFrom != null;
  if (!partial && !bounded) return null;

  // Keep the pasted tuning params; pin the scope the route resolved
  // (dates, profile) from resume.request, then move the cursor.
  const resumeRequest = scalarQuery(body?.resume?.request) ?? {};
  const nextQuery = dropKeys({ ...sentQuery, ...resumeRequest }, runnerParams);
  const scope = asRecord(body?.executionScope);
  if (scope?.implicitDailyWindowApplied === true) {
    if (!nextQuery.startDate && isIsoDate(scope.startDate)) nextQuery.startDate = scope.startDate;
    if (!nextQuery.endDate && isIsoDate(scope.endDate)) nextQuery.endDate = scope.endDate;
  }
  if (nextResumeFrom != null) nextQuery.resumeFrom = String(nextResumeFrom);
  const remaining =
    body?.resume?.remainingPlayerCount ?? body?.runSummary?.remainingPlayerCount;
  return {
    kind: "continue",
    nextQuery,
    reason:
      nextResumeFrom != null
        ? `Rolling: ${Number.isSafeInteger(remaining) ? `${remaining} players left; ` : ""}resumeFrom ${nextResumeFrom}.`
        : "Rolling: stopped at the runtime budget before any player finished; replaying."
  };
}

function classifyNextStartDate(
  result: StepResult,
  body: Body | null,
  sentQuery: RouteQuery
): StepDecision | null {
  const moreWork = body?.complete === false || body?.stoppedEarly === true;
  if (!is2xx(result.statusCode) || !moreWork) return null;
  if (!isIsoDate(body?.nextStartDate)) {
    return {
      kind: "fail",
      reason: withMessage("The route reported unfinished work without a nextStartDate", body)
    };
  }
  const remaining = body?.remainingDatesCount;
  const failed = Number.isSafeInteger(body?.failedRequests) && body?.failedRequests > 0
    ? ` ${body?.failedRequests} failed request(s) will be retried.`
    : "";
  return {
    kind: "continue",
    nextQuery: { ...sentQuery, startDate: body.nextStartDate },
    reason: `${Number.isSafeInteger(remaining) ? `${remaining} date(s) left; ` : ""}next startDate ${body.nextStartDate}.${failed}`
  };
}

/**
 * Turns a step's answer into the job's next move. `sentQuery` is the job's
 * query for this step (without runtime params).
 */
export function classifyStepResult(
  contract: RouteRunnerContract,
  result: StepResult,
  sentQuery: RouteQuery,
  runnerParams: readonly string[] = []
): StepDecision {
  const body = asRecord(result.body);
  if (result.statusCode === 503 && body?.operationStatus === "source_down") {
    return {
      kind: "wait",
      delayMs: ROUTE_RUNNER_SOURCE_DOWN_WAIT_MS,
      reason: withMessage("Source down (503 source_down); replaying the same query in 30 min", body)
    };
  }
  const decision =
    contract === "nst_resume"
      ? classifyNst(result, body, sentQuery, runnerParams)
      : contract === "rolling_resume_from"
        ? classifyRolling(result, body, sentQuery, runnerParams)
        : contract === "next_start_date"
          ? classifyNextStartDate(result, body, sentQuery)
          : null;
  return decision ?? classifyOnce(result, body);
}

/** A continuation that asks for the same query again makes no progress. */
export function applyStallGuard(
  decision: StepDecision,
  sentQuery: RouteQuery,
  previousStalls: number
): { decision: StepDecision; stalls: number } {
  if (decision.kind !== "continue" || !sameQuery(decision.nextQuery, sentQuery)) {
    return { decision, stalls: 0 };
  }
  const stalls = previousStalls + 1;
  if (stalls >= ROUTE_RUNNER_MAX_STALLS) {
    return {
      decision: {
        kind: "fail",
        reason: `No progress: the route asked for the same query ${stalls} steps in a row.`
      },
      stalls
    };
  }
  return {
    decision: {
      ...decision,
      reason: `${decision.reason} No progress this step (${stalls}/${ROUTE_RUNNER_MAX_STALLS}).`
    },
    stalls
  };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type StepProgress = {
  /** Units written this step (see rowsUnit); null when the body has none. */
  rows: number | null;
  rowsUnit: "rows" | "sources" | "urls";
  /** Absolute position in the whole scope (NST cursor). */
  done: number | null;
  total: number | null;
  /** Position relative to this step's own scope (rolling, team daily). */
  remaining: number | null;
  scopeTotal: number | null;
  unit: string | null;
  cursor: string | null;
  operationStatus: string | null;
  message: string | null;
};

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function firstCount(record: Body | null, keys: readonly string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = count(record[key]);
    if (value != null) return value;
  }
  return null;
}

const ROW_KEYS = [
  "rows_affected",
  "rowsAffected",
  "totalRowsAffected",
  "rowsUpserted",
  "totalUpdates",
  "playersUpdated",
  "confirmedRowsAffected"
] as const;

export function extractStepProgress(rawBody: unknown): StepProgress {
  const body = asRecord(rawBody);
  const progress: StepProgress = {
    rows: null,
    rowsUnit: "rows",
    done: null,
    total: null,
    remaining: null,
    scopeTotal: null,
    unit: null,
    cursor: null,
    operationStatus: nonEmptyString(body?.operationStatus),
    message: bodyMessage(body)
  };
  if (!body) return progress;

  const runSummary = asRecord(body.runSummary);
  const summary = asRecord(body.summary);
  const datasetResults = Array.isArray(summary?.datasetResults)
    ? summary.datasetResults
    : null;
  const sourceCounts = asRecord(body.nstProgress?.sourceOutcomes?.counts);

  const rows =
    count(runSummary?.rowsUpserted) ??
    firstCount(body, ROW_KEYS) ??
    (datasetResults
      ? datasetResults.reduce(
          (sum: number, entry: unknown) => sum + (count(asRecord(entry)?.inserted) ?? 0),
          0
        )
      : null);
  if (rows != null) {
    progress.rows = rows;
  } else if (count(sourceCounts?.rows_persisted) != null) {
    progress.rows = count(sourceCounts?.rows_persisted);
    progress.rowsUnit = "sources";
  } else if (count(body.pendingUrlsProcessed) != null) {
    progress.rows = count(body.pendingUrlsProcessed);
    progress.rowsUnit = "urls";
  }

  const continuation = asRecord(body.nstProgress?.continuation);
  if (count(continuation?.nextIndex) != null && count(continuation?.totalUrls) != null) {
    progress.done = count(continuation?.nextIndex);
    progress.total = count(continuation?.totalUrls);
    progress.unit = "urls";
    progress.cursor = `cursor ${progress.done}`;
  } else if (runSummary && count(runSummary.remainingPlayerCount) != null) {
    progress.remaining = count(runSummary.remainingPlayerCount);
    progress.scopeTotal = count(runSummary.totalPlayersAfterResumeFilter);
    progress.unit = "players";
    const next = positiveInteger(runSummary.nextResumeFrom);
    progress.cursor = next != null ? `resumeFrom ${next}` : null;
  } else if (count(body.remainingDatesCount) != null) {
    progress.remaining = count(body.remainingDatesCount);
    progress.scopeTotal = count(summary?.totalDates);
    progress.unit = "dates";
  }
  if (!progress.cursor && isIsoDate(body.nextStartDate)) {
    progress.cursor = `startDate ${body.nextStartDate}`;
  }
  return progress;
}

export type JobProgress = {
  unit: string | null;
  done: number | null;
  total: number | null;
  cursor: string | null;
  rowsUnit: string;
  stalls: number;
};

export function readJobProgress(value: unknown): JobProgress | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    unit: nonEmptyString(record.unit),
    done: count(record.done),
    total: count(record.total),
    cursor: nonEmptyString(record.cursor),
    rowsUnit: nonEmptyString(record.rowsUnit) ?? "rows",
    stalls: count(record.stalls) ?? 0
  };
}

/** Folds one step's progress into the job's running progress. */
export function mergeJobProgress(
  previous: JobProgress | null,
  step: StepProgress,
  stalls: number
): JobProgress {
  const sameUnit = previous?.unit != null && previous.unit === step.unit;
  let done = previous?.done ?? null;
  let total = previous?.total ?? null;
  if (step.done != null && step.total != null) {
    done = step.done;
    total = step.total;
  } else if (step.remaining != null && step.scopeTotal != null) {
    // The step's scope starts at the resume point: what came before it is done.
    const priorDone = sameUnit ? (previous?.done ?? 0) : 0;
    total = Math.max(sameUnit ? (previous?.total ?? 0) : 0, priorDone + step.scopeTotal);
    done = Math.max(0, total - step.remaining);
  }
  return {
    unit: step.unit ?? previous?.unit ?? null,
    done,
    total,
    cursor: step.cursor ?? previous?.cursor ?? null,
    rowsUnit: step.rows != null ? step.rowsUnit : (previous?.rowsUnit ?? step.rowsUnit),
    stalls
  };
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

export type RouteRunnerEventLike = {
  id: number;
  at: string;
  level: string;
  message: string;
  step: number | null;
  status_code: number | null;
  rows: number | null;
  progress: unknown;
  duration_ms: number | null;
};

export type TimelinePoint = {
  atMs: number;
  step: number;
  rowsTotal: number;
  durationMs: number | null;
  done: number | null;
  total: number | null;
};

/** One point per step result (events that carry a status code). */
export function buildTimeline(events: readonly RouteRunnerEventLike[]): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  let rowsTotal = 0;
  for (const event of events) {
    if (event.status_code == null || event.step == null) continue;
    const atMs = Date.parse(event.at);
    if (!Number.isFinite(atMs)) continue;
    const progress = asRecord(event.progress);
    const storedTotal = count(progress?.rowsTotal);
    rowsTotal = storedTotal ?? rowsTotal + (event.rows ?? 0);
    points.push({
      atMs,
      step: event.step,
      rowsTotal,
      durationMs: event.duration_ms,
      done: count(progress?.done),
      total: count(progress?.total)
    });
  }
  return points;
}

/** Remaining time from the recent step rate, or null when unknown. */
export function estimateEtaMs(
  points: readonly TimelinePoint[],
  window = 6
): number | null {
  const known = points.filter((point) => point.done != null && point.total != null);
  if (known.length < 2) return null;
  const recent = known.slice(-window);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const elapsed = last.atMs - first.atMs;
  const advanced = (last.done ?? 0) - (first.done ?? 0);
  if (elapsed <= 0 || advanced <= 0) return null;
  const left = Math.max(0, (last.total ?? 0) - (last.done ?? 0));
  return Math.round((left * elapsed) / advanced);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/** One terminal line: time, step, HTTP status, operationStatus, rows, progress, message. */
export function formatEventLine(event: RouteRunnerEventLike): string {
  const at = new Date(event.at);
  const time = Number.isFinite(at.getTime())
    ? at.toISOString().slice(11, 19)
    : "--:--:--";
  const progress = asRecord(event.progress);
  const parts = [time];
  if (event.step != null) parts.push(`step ${event.step}`);
  if (event.status_code != null) parts.push(`HTTP ${event.status_code}`);
  const operationStatus = nonEmptyString(progress?.operationStatus);
  if (operationStatus) parts.push(operationStatus);
  if (event.rows != null) {
    parts.push(`+${event.rows} ${nonEmptyString(progress?.rowsUnit) ?? "rows"}`);
  }
  const done = count(progress?.done);
  const total = count(progress?.total);
  if (done != null && total != null) {
    parts.push(`${done}/${total}${progress?.unit ? ` ${progress.unit}` : ""}`);
  }
  if (event.duration_ms != null) parts.push(`${(event.duration_ms / 1000).toFixed(1)}s`);
  return `${parts.join("  ")}  ${event.message}`;
}
