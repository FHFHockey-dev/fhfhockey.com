import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import adminOnly from "utils/adminOnlyMiddleware";
import { CronTimedResponse, withCronJobTiming } from "lib/cron/timingContract";
import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import {
  parseQueryBoolean,
  parseQueryPositiveInt,
  parseQueryString,
} from "lib/api/queryParams";
import { getRollingForgeStageDependencyContract } from "lib/rollingForgePipeline";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { classifyStoredShiftChartStrengthGame } from "lib/projections/shiftChartCompletenessServer";
import { hasCompleteStoredPbpGame } from "lib/projections/pbpCompletenessServer";

import {
  buildExpectedPbpSourceEvidence,
  fetchPbpGame,
  isCompleteFinalPbpPayload,
} from "lib/projections/ingest/pbp";
import {
  buildShiftStrengthUpserts,
  fetchAllNhleShiftChartsSnapshotForGame,
} from "lib/projections/ingest/shifts";
import { captureProjectionRawSourceSnapshots } from "lib/projections/ingest/rawSnapshotPersistence";
import {
  persistCapturedGameNormalization,
  type PlayByPlayPayload,
  type ShiftChartsPayload,
} from "lib/supabase/Upserts/nhlRawGamecenter.mjs";
import {
  buildProjectionInputRpcPayload,
  persistProjectionGameInputs,
  readProjectionInputManifest,
} from "lib/projections/ingest/projectionInputPersistence";
import {
  acquireProjectionPipelineLease,
  advanceProjectionPipelineLease,
  buildProjectionPipelineOperationKey,
  finishProjectionPipelineLease,
  PROJECTION_INPUT_PIPELINE_KEY,
  readOldestProjectionPipelineBacklog,
  type ProjectionPipelineLease,
} from "lib/projections/projectionPipelineState";

type Result = {
  success: boolean;
  startDate: string;
  endDate: string;
  chunkDays: number;
  resumeFromDate: string | null;
  nextStartDate: string | null;
  durationMs: string;
  timedOut: boolean;
  maxDurationMs: string;
  gamesTotal: number;
  gamesProcessed: number;
  pbpGamesUpserted: number;
  pbpPlaysUpserted: number;
  shiftRowsUpserted: number;
  rowsUpserted: number;
  gamesVerified: number;
  gamesIdempotent: number;
  pbpPlaysVerified: number;
  shiftRowsVerified: number;
  rowsVerified: number;
  pbpPlaysPruned: number;
  shiftRowsPruned: number;
  rowsPruned: number;
  failedRows: number;
  skipped: number;
  skipReasons: {
    alreadyHadPbpAndShifts: number;
    alreadyHadPbpOnly: number;
    alreadyHadShiftTotalsOnly: number;
    gamecenterFeedUnavailable: number;
    sourceDataRejected: number;
  };
  debug?: {
    sampled: Array<{
      gameId: number;
      date: string;
      pbpExists: boolean;
      shiftTotalsExist: boolean;
      action: "skipped" | "ingested";
    }>;
  };
  maxGames: number | null;
  nextGameId: number | null;
  lastCompletedGameId: number | null;
  durableOperationAlreadyComplete?: boolean;
  // Durable scheduled mode: source-rejected games parked for a later retry
  // (SOURCE_REJECTION_RETRY_SCOPE_KEY) and what happened to them this call.
  sourceRejectionRetries?: {
    retried: number;
    recovered: number;
    pending: number;
    final: number;
  };
  errors: Array<{
    gameId: number;
    date: string;
    stage:
      | "list_games"
      | "precheck_pbp"
      | "precheck_shifts"
      | "fetch_pbp"
      | "fetch_shifts"
      | "capture_raw_sources"
      | "persist_inputs"
      | "verify_pbp"
      | "verify_shifts"
      | "normalize_gamecenter"
      | "advance_cursor"
      | "finish_cursor";
    message: string;
    // True when the game was skipped so later games could still run.
    isolated?: boolean;
    // The skipped game is parked and retried by later scheduled calls until
    // DURABLE_SOURCE_REJECTION_GRACE_DAYS have passed.
    retryPending?: boolean;
  }>;
  dependencyContract?: ReturnType<
    typeof getRollingForgeStageDependencyContract
  >;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function getParam(req: NextApiRequest, key: string): string | undefined {
  const queryValue = parseQueryString(req.query[key]);
  if (queryValue) return queryValue.trim();

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isoDateOnly(d: string): string {
  return d.slice(0, 10);
}

function parseIsoCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return isoDateOnly(date.toISOString()) === value ? date : null;
}

export function previousUtcDate(now = new Date()): string {
  const previous = new Date(now.getTime());
  previous.setUTCDate(previous.getUTCDate() - 1);
  return isoDateOnly(previous.toISOString());
}

// NHL can publish an empty or still-settling shift feed shortly after a game.
// The durable scheduled cursor skips such a game at once, so the rest of its
// slate (and every later slate) is ingested, and parks it in a retry row that
// later scheduled calls retry until it is this many UTC days old; then it is
// recorded as a final rejection. A game whose retry row cannot be written
// holds the cursor instead, so it is never silently dropped.
export const DURABLE_SOURCE_REJECTION_GRACE_DAYS = 2;
export const SOURCE_REJECTION_RETRY_SCOPE_KEY = "source_rejected_games";
const SOURCE_REJECTION_PENDING = "source_rejected_pending";
const SOURCE_REJECTION_FINAL = "source_rejected_final";
const MAX_SOURCE_REJECTION_RETRIES = 8;

type SourceRejectionCode =
  | typeof SOURCE_REJECTION_PENDING
  | typeof SOURCE_REJECTION_FINAL;

function sourceRejectionLease(game: { id: number; date: string }) {
  return acquireProjectionPipelineLease({
    supabase,
    scopeKey: SOURCE_REJECTION_RETRY_SCOPE_KEY,
    operationKey: `game:${game.id}`,
    rangeStartDate: game.date,
    rangeEndDate: game.date,
    initialCursorDate: game.date,
    leaseMs: 30_000,
  });
}

/** Parks (pending) or closes (final) a source-rejected game; false if nothing was stored. */
async function recordSourceRejection(
  game: { id: number; date: string },
  code: SourceRejectionCode,
): Promise<boolean> {
  const lease = await sourceRejectionLease(game);
  if (lease.status !== "running") return false;
  await finishProjectionPipelineLease({
    supabase,
    lease,
    outcome: "failed",
    failureCode: code,
  });
  return true;
}

async function clearSourceRejection(game: { id: number; date: string }) {
  const lease = await sourceRejectionLease(game);
  if (lease.status === "running") {
    await finishProjectionPipelineLease({ supabase, lease, outcome: "complete" });
  }
}

/** Parked games still inside their retry window, oldest first. A row left
 * running by a dead caller counts once its short lease has expired. */
async function listParkedSourceRejections(
  excludeGameIds: Set<number>,
): Promise<Array<{ id: number; date: string }>> {
  assertSupabase();
  const { data, error } = await supabase
    .from("projection_pipeline_state")
    .select("operation_key,status,range_start_date,lease_expires_at,last_error")
    .eq("pipeline_key", PROJECTION_INPUT_PIPELINE_KEY)
    .eq("scope_key", SOURCE_REJECTION_RETRY_SCOPE_KEY)
    // Final rows accumulate forever; filtering them here keeps them from
    // crowding pending games out of the oldest-first page.
    .or(`and(status.eq.failed,last_error.eq.${SOURCE_REJECTION_PENDING}),status.eq.running`)
    .order("range_start_date", { ascending: true })
    .limit(MAX_SOURCE_REJECTION_RETRIES * 4);
  if (error) throw error;
  const now = Date.now();
  const parked: Array<{ id: number; date: string }> = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const match = /^game:([1-9]\d*)$/.exec(String(row.operation_key));
    const id = match ? Number(match[1]) : NaN;
    const date = typeof row.range_start_date === "string" ? row.range_start_date : "";
    const waiting =
      (row.status === "failed" && row.last_error === SOURCE_REJECTION_PENDING) ||
      (row.status === "running" &&
        Date.parse(String(row.lease_expires_at)) <= now);
    if (!waiting || !Number.isSafeInteger(id) || !parseIsoCalendarDate(date)) continue;
    if (excludeGameIds.has(id)) continue;
    parked.push({ id, date });
    if (parked.length >= MAX_SOURCE_REJECTION_RETRIES) break;
  }
  return parked;
}

export function durableSourceRejectionCutoffDate(now = new Date()): string {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCDate(cutoff.getUTCDate() - DURABLE_SOURCE_REJECTION_GRACE_DAYS);
  return isoDateOnly(cutoff.toISOString());
}

function parseChunkDays(value: string | null): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.floor(n));
}

function buildDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const startDate = parseIsoCalendarDate(start);
  const endDate = parseIsoCalendarDate(end);
  if (!startDate || !endDate) return out;
  for (let d = startDate; d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(isoDateOnly(d.toISOString()));
  }
  return out;
}

function isUnavailableGamecenterFeedError(error: unknown): boolean {
  const message = (error as any)?.message ?? String(error);
  return (
    typeof message === "string" &&
    message.includes("HTTP 404 Not Found") &&
    message.includes("/gamecenter/")
  );
}

async function hasCompleteShiftTotals(
  gameId: number,
  expectedPlayerIds: Iterable<number>,
): Promise<boolean> {
  assertSupabase();
  return (
    (
      await classifyStoredShiftChartStrengthGame({
        gameId,
        expectedPlayerIds,
      })
    ).status === "complete"
  );
}

async function hasCompleteGamecenterNormalization(
  gameId: number,
): Promise<boolean> {
  assertSupabase();
  const { data, error } = await supabase
    .from("nhl_api_game_normalization_status")
    .select("status")
    .eq("game_id", gameId)
    .maybeSingle();
  if (error) throw error;
  return data?.status === "complete";
}

async function listGamesInRange(startDate: string, endDate: string) {
  assertSupabase();
  return fetchAllSupabasePages<{ id: number; date: string }>(({ from, to }) =>
    supabase
      .from("games")
      .select("id,date")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

export async function ingestProjectionInputsHandler(
  req: NextApiRequest,
  res: NextApiResponse<CronTimedResponse<Result>>,
) {
  const startedAt = Date.now();
  const dependencyContract = getRollingForgeStageDependencyContract(
    "projection_input_ingest",
  );
  const withTiming = (body: Result, endedAt = Date.now()) =>
    withCronJobTiming(body, startedAt, endedAt);
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json(
      withTiming({
        success: false,
        startDate: "",
        endDate: "",
        chunkDays: 0,
        resumeFromDate: null,
        nextStartDate: null,
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(0),
        gamesTotal: 0,
        gamesProcessed: 0,
        pbpGamesUpserted: 0,
        pbpPlaysUpserted: 0,
        shiftRowsUpserted: 0,
        rowsUpserted: 0,
        gamesVerified: 0,
        gamesIdempotent: 0,
        pbpPlaysVerified: 0,
        shiftRowsVerified: 0,
        rowsVerified: 0,
        pbpPlaysPruned: 0,
        shiftRowsPruned: 0,
        rowsPruned: 0,
        failedRows: 0,
        skipped: 0,
        skipReasons: {
          alreadyHadPbpAndShifts: 0,
          alreadyHadPbpOnly: 0,
          alreadyHadShiftTotalsOnly: 0,
          gamecenterFeedUnavailable: 0,
          sourceDataRejected: 0,
        },
        maxGames: null,
        nextGameId: null,
        lastCompletedGameId: null,
        errors: [
          {
            gameId: -1 as any,
            date: "",
            stage: "list_games",
            message: "Method not allowed",
          },
        ],
        dependencyContract,
      }),
    );
  }

  const requestedStartDate = getParam(req, "startDate");
  const requestedEndDate = getParam(req, "endDate");
  let startDate = requestedStartDate ?? previousUtcDate();
  let endDate = requestedEndDate ?? startDate;
  const fullRequestedRange = buildDateRange(startDate, endDate);
  if (fullRequestedRange.length === 0) {
    return res.status(400).json(
      withTiming({
        success: false,
        startDate,
        endDate,
        chunkDays: 0,
        resumeFromDate: null,
        nextStartDate: null,
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(0),
        gamesTotal: 0,
        gamesProcessed: 0,
        pbpGamesUpserted: 0,
        pbpPlaysUpserted: 0,
        shiftRowsUpserted: 0,
        rowsUpserted: 0,
        gamesVerified: 0,
        gamesIdempotent: 0,
        pbpPlaysVerified: 0,
        shiftRowsVerified: 0,
        rowsVerified: 0,
        pbpPlaysPruned: 0,
        shiftRowsPruned: 0,
        rowsPruned: 0,
        failedRows: 0,
        skipped: 0,
        skipReasons: {
          alreadyHadPbpAndShifts: 0,
          alreadyHadPbpOnly: 0,
          alreadyHadShiftTotalsOnly: 0,
          gamecenterFeedUnavailable: 0,
          sourceDataRejected: 0,
        },
        maxGames: null,
        nextGameId: null,
        lastCompletedGameId: null,
        errors: [
          {
            gameId: -1 as any,
            date: "",
            stage: "list_games",
            message: "Invalid startDate/endDate range",
          },
        ],
        dependencyContract,
      }),
    );
  }
  const chunkDays = parseChunkDays(getParam(req, "chunkDays") ?? null);
  const resumeFromDate = getParam(req, "resumeFromDate")?.slice(0, 10) ?? null;
  const force = parseQueryBoolean(getParam(req, "force")) ?? false;
  const debug = parseQueryBoolean(getParam(req, "debug")) ?? false;
  const debugLimit = Number(getParam(req, "debugLimit") ?? 50);
  const explicitMaxGames = parseQueryPositiveInt(getParam(req, "maxGames"));
  const maxGames = explicitMaxGames ?? null;
  const resumeFromGameId =
    parseQueryPositiveInt(getParam(req, "resumeFromGameId")) ?? null;
  const bypassMaxDuration = parseBooleanParam(
    getParam(req, "bypassMaxDuration") ?? null,
  );
  const maxDurationMs = Number(getParam(req, "maxDurationMs") ?? 270_000); // safety: 4.5 minutes
  const budgetMs =
    Number.isFinite(maxDurationMs) && maxDurationMs > 0
      ? maxDurationMs
      : 270_000;
  const deadlineMs = bypassMaxDuration
    ? Number.POSITIVE_INFINITY
    : startedAt + budgetMs;
  const sourceRejectionCutoffDate = durableSourceRejectionCutoffDate(
    new Date(startedAt),
  );

  const useDurableScheduledCursor =
    requestedStartDate == null &&
    requestedEndDate == null &&
    resumeFromDate == null &&
    resumeFromGameId == null &&
    chunkDays === 0 &&
    maxGames == null &&
    !force;
  let pipelineLease: ProjectionPipelineLease | null = null;
  let durableResumeFromDate = resumeFromDate;
  let durableResumeFromGameId = resumeFromGameId;
  if (useDurableScheduledCursor) {
    assertSupabase();
    const backlog = await readOldestProjectionPipelineBacklog({
      supabase,
      throughDate: endDate,
    });
    if (backlog) {
      startDate = backlog.rangeStartDate;
      endDate = backlog.rangeEndDate;
    }
    const operationKey =
      backlog?.operationKey ??
      buildProjectionPipelineOperationKey({
        startDate,
        endDate,
        force: false,
      });
    pipelineLease = await acquireProjectionPipelineLease({
      supabase,
      operationKey,
      rangeStartDate: startDate,
      rangeEndDate: endDate,
      initialCursorDate: startDate,
    });
    durableResumeFromDate = pipelineLease.cursorDate ?? startDate;
    durableResumeFromGameId = pipelineLease.cursorGameId;
  }

  const effectiveStartDate =
    durableResumeFromDate &&
    durableResumeFromDate >= startDate &&
    durableResumeFromDate <= endDate
      ? durableResumeFromDate
      : startDate;
  const fullRangeDates = buildDateRange(effectiveStartDate, endDate);
  const limitedRangeDates =
    chunkDays > 0 ? fullRangeDates.slice(0, chunkDays) : fullRangeDates;
  const effectiveEndDate =
    limitedRangeDates[limitedRangeDates.length - 1] ?? effectiveStartDate;
  const chunkNextStartDate =
    chunkDays > 0 && fullRangeDates.length > limitedRangeDates.length
      ? (fullRangeDates[limitedRangeDates.length] ?? null)
      : null;

  const allGames = await listGamesInRange(effectiveStartDate, effectiveEndDate);
  const resumeIndex =
    durableResumeFromGameId == null
      ? 0
      : allGames.findIndex((game) => game.id === durableResumeFromGameId);
  if (durableResumeFromGameId != null && resumeIndex < 0) {
    if (pipelineLease) {
      pipelineLease = await finishProjectionPipelineLease({
        supabase,
        lease: pipelineLease,
        outcome: "failed",
        failureCode: "cursor_game_not_in_range",
      });
    }
    return res.status(400).json(
      withTiming({
        success: false,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        chunkDays,
        resumeFromDate,
        nextStartDate: effectiveStartDate,
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        timedOut: false,
        maxDurationMs: bypassMaxDuration
          ? "bypassed"
          : formatDurationMsToMMSS(budgetMs),
        gamesTotal: allGames.length,
        gamesProcessed: 0,
        pbpGamesUpserted: 0,
        pbpPlaysUpserted: 0,
        shiftRowsUpserted: 0,
        rowsUpserted: 0,
        gamesVerified: 0,
        gamesIdempotent: 0,
        pbpPlaysVerified: 0,
        shiftRowsVerified: 0,
        rowsVerified: 0,
        pbpPlaysPruned: 0,
        shiftRowsPruned: 0,
        rowsPruned: 0,
        failedRows: 1,
        skipped: 0,
        skipReasons: {
          alreadyHadPbpAndShifts: 0,
          alreadyHadPbpOnly: 0,
          alreadyHadShiftTotalsOnly: 0,
          gamecenterFeedUnavailable: 0,
          sourceDataRejected: 0,
        },
        maxGames,
        nextGameId: resumeFromGameId,
        lastCompletedGameId: null,
        errors: [
          {
            gameId: durableResumeFromGameId,
            date: effectiveStartDate,
            stage: "list_games",
            message:
              "resumeFromGameId is not present in the selected date range",
          },
        ],
        dependencyContract,
      }),
    );
  }
  const cursorGames = allGames.slice(Math.max(0, resumeIndex));
  const nextCursorByGameId = new Map<number, { id: number; date: string }>();
  cursorGames.forEach((game, index) => {
    const next = cursorGames[index + 1];
    if (next) nextCursorByGameId.set(game.id, next);
  });
  const games =
    typeof maxGames === "number" && maxGames > 0
      ? cursorGames.slice(0, maxGames)
      : cursorGames;
  const nextGameId =
    typeof maxGames === "number" &&
    maxGames > 0 &&
    cursorGames.length > games.length
      ? (cursorGames[games.length]?.id ?? null)
      : null;

  const result: Result = {
    success: true,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    chunkDays,
    resumeFromDate: durableResumeFromDate,
    nextStartDate: chunkNextStartDate,
    durationMs: formatDurationMsToMMSS(0),
    timedOut: false,
    maxDurationMs: bypassMaxDuration
      ? "bypassed"
      : formatDurationMsToMMSS(budgetMs),
    gamesTotal: allGames.length,
    gamesProcessed: 0,
    pbpGamesUpserted: 0,
    pbpPlaysUpserted: 0,
    shiftRowsUpserted: 0,
    rowsUpserted: 0,
    gamesVerified: 0,
    gamesIdempotent: 0,
    pbpPlaysVerified: 0,
    shiftRowsVerified: 0,
    rowsVerified: 0,
    pbpPlaysPruned: 0,
    shiftRowsPruned: 0,
    rowsPruned: 0,
    failedRows: 0,
    skipped: 0,
    skipReasons: {
      alreadyHadPbpAndShifts: 0,
      alreadyHadPbpOnly: 0,
      alreadyHadShiftTotalsOnly: 0,
      gamecenterFeedUnavailable: 0,
      sourceDataRejected: 0,
    },
    maxGames,
    nextGameId,
    lastCompletedGameId: null,
    ...(debug
      ? {
          debug: {
            sampled: [],
          },
        }
      : {}),
    errors: [],
    dependencyContract,
  };

  // Parked source rejections are retried after the slate's own games, also
  // when the slate itself is already complete. They never hold the slate.
  let parkedGames: Array<{ id: number; date: string }> = [];
  if (useDurableScheduledCursor) {
    result.sourceRejectionRetries = { retried: 0, recovered: 0, pending: 0, final: 0 };
    try {
      parkedGames = await listParkedSourceRejections(
        new Set(cursorGames.map((game) => game.id)),
      );
    } catch (error) {
      result.success = false;
      result.errors.push({
        gameId: -1,
        date: effectiveStartDate,
        stage: "list_games",
        message: `Could not read parked source rejections: ${(error as any)?.message ?? String(error)}`,
        isolated: true,
      });
    }
  }
  const parkedGameIds = new Set(parkedGames.map((game) => game.id));
  const slateAlreadyComplete = pipelineLease?.status === "complete";

  if (slateAlreadyComplete && parkedGames.length === 0) {
    return res.status(200).json(
      withTiming({
        ...result,
        durableOperationAlreadyComplete: true,
      }),
    );
  }
  if (slateAlreadyComplete) result.durableOperationAlreadyComplete = true;

  for (const g of [...(slateAlreadyComplete ? [] : games), ...parkedGames]) {
    const isParked = parkedGameIds.has(g.id);
    if (isParked) result.sourceRejectionRetries!.retried += 1;
    if (Date.now() > deadlineMs) {
      if (isParked) {
        // Unreached retries wait for the next call; the slate is done.
        result.sourceRejectionRetries!.retried -= 1;
        break;
      }
      result.success = false;
      result.timedOut = true;
      result.nextStartDate = g.date;
      result.nextGameId = g.id;
      break;
    }
    let stage:
      | "precheck_pbp"
      | "precheck_shifts"
      | "fetch_pbp"
      | "fetch_shifts"
      | "capture_raw_sources"
      | "persist_inputs"
      | "verify_pbp"
      | "verify_shifts"
      | "normalize_gamecenter"
      | "advance_cursor" = "precheck_pbp";
    // Set only while validating the NHL shift payload itself: those failures
    // belong to this game's source data, not to the run or the database.
    let shiftSourceRejected = false;
    try {
      const gameId = g.id;
      stage = "precheck_pbp";
      const pbpExists = force ? false : await hasCompleteStoredPbpGame(gameId);
      stage = "fetch_pbp";
      const sharedPbp = await fetchPbpGame(gameId);
      if (sharedPbp.id !== gameId || !isCompleteFinalPbpPayload(sharedPbp)) {
        throw new Error(`PBP is not final and complete for game ${gameId}`);
      }
      stage = "fetch_shifts";
      const shiftSnapshot =
        await fetchAllNhleShiftChartsSnapshotForGame(gameId);
      const sourceShiftRows = shiftSnapshot.rows;
      const expectedPlayerIds = sourceShiftRows.map((row) => row.playerId);
      stage = "precheck_shifts";
      shiftSourceRejected = true;
      const shiftUpserts = buildShiftStrengthUpserts(
        gameId,
        sharedPbp,
        sourceShiftRows,
      );
      shiftSourceRejected = false;
      const shiftsExist = force
        ? false
        : await hasCompleteShiftTotals(gameId, expectedPlayerIds);

      // A structurally complete stored snapshot is not proof that it still
      // matches the authoritative NHL source. Reconcile the exact PBP scope on
      // every selected run, then rebuild shift-strength totals from that same
      // source payload so upstream corrections cannot leave derived rows stale.
      stage = "capture_raw_sources";
      const rawSnapshots = await captureProjectionRawSourceSnapshots({
        supabase,
        gameId,
        pbp: sharedPbp,
        shiftPayload: shiftSnapshot.rawPayload,
      });
      stage = "persist_inputs";
      const currentManifest = await readProjectionInputManifest({
        supabase,
        gameId,
      });
      const inputPayload = buildProjectionInputRpcPayload({
        gameId,
        pbp: sharedPbp,
        shiftSourceRows: sourceShiftRows,
        strengthRows: shiftUpserts,
        rawSnapshots,
        expectedCurrentInputFingerprint:
          currentManifest?.inputFingerprint ?? null,
      });
      const receipt = await persistProjectionGameInputs({
        supabase,
        payload: inputPayload,
      });
      result.gamesVerified += 1;
      result.pbpPlaysVerified += receipt.playCount;
      result.shiftRowsVerified += receipt.strengthCount;
      result.rowsVerified += 1 + receipt.playCount + receipt.strengthCount;
      result.pbpPlaysPruned += receipt.prunedPlayRows;
      result.shiftRowsPruned += receipt.prunedStrengthRows;
      result.rowsPruned += receipt.prunedPlayRows + receipt.prunedStrengthRows;
      if (receipt.idempotent) {
        result.gamesIdempotent += 1;
      } else {
        result.pbpGamesUpserted += 1;
        result.pbpPlaysUpserted += receipt.playCount;
        result.shiftRowsUpserted += receipt.strengthCount;
        result.rowsUpserted += 1 + receipt.playCount + receipt.strengthCount;
      }

      stage = "verify_pbp";
      if (
        !(await hasCompleteStoredPbpGame(
          gameId,
          buildExpectedPbpSourceEvidence(sharedPbp),
        ))
      ) {
        throw new Error(
          `PBP post-write verification failed for game ${gameId}`,
        );
      }

      stage = "verify_shifts";
      if (!(await hasCompleteShiftTotals(gameId, expectedPlayerIds))) {
        throw new Error(
          `Shift-strength post-write verification failed for game ${gameId}`,
        );
      }

      // A changed upstream payload advances the shared snapshot head, which
      // marks the Gamecenter normalization stale. Complete it from the same
      // captured payloads; no later job revisits the game otherwise.
      stage = "normalize_gamecenter";
      if (!(await hasCompleteGamecenterNormalization(gameId))) {
        await persistCapturedGameNormalization(supabase, {
          gameId,
          seasonId: Number(sharedPbp.season),
          gameDate: sharedPbp.gameDate,
          // Both are the unmodified provider JSON (`nhleFetchJson` and the raw
          // shift pages), which carry `rosterSpots` and shift `id`; the local
          // projection types only declare the fields their own readers use.
          pbp: sharedPbp as unknown as PlayByPlayPayload,
          pbpPayloadHash: rawSnapshots.pbp.payloadHash,
          shiftPayload: shiftSnapshot.rawPayload as unknown as ShiftChartsPayload,
          shiftPayloadHash: rawSnapshots.shifts.payloadHash,
        });
      }

      if (isParked) {
        // A parked game passed this time: close its retry row.
        result.sourceRejectionRetries!.recovered += 1;
        try {
          await clearSourceRejection(g);
        } catch (clearError) {
          result.success = false;
          result.errors.push({
            gameId,
            date: g.date,
            stage: "finish_cursor",
            message: `Ingested parked game ${gameId}, but its retry row was not closed: ${(clearError as any)?.message ?? String(clearError)}`,
            isolated: true,
          });
        }
        continue;
      }

      result.gamesProcessed += 1;
      result.lastCompletedGameId = gameId;

      const nextCursor = nextCursorByGameId.get(gameId);
      if (pipelineLease && nextCursor) {
        stage = "advance_cursor";
        pipelineLease = await advanceProjectionPipelineLease({
          supabase,
          lease: pipelineLease,
          nextCursorDate: nextCursor.date,
          nextCursorGameId: nextCursor.id,
        });
      }

      if (
        debug &&
        result.debug &&
        result.debug.sampled.length <
          (Number.isFinite(debugLimit) ? debugLimit : 50)
      ) {
        result.debug.sampled.push({
          gameId,
          date: g.date,
          pbpExists,
          shiftTotalsExist: shiftsExist,
          action: "ingested",
        });
      }
    } catch (e) {
      const message = (e as any)?.message ?? String(e);
      const insideRetryWindow = g.date > sourceRejectionCutoffDate;
      if (isParked) {
        // A parked game never holds the slate. It stays parked while inside
        // its retry window, whatever failed, and is closed as final after it.
        const code = insideRetryWindow
          ? SOURCE_REJECTION_PENDING
          : SOURCE_REJECTION_FINAL;
        await recordSourceRejection(g, code).catch(() => false);
        result.sourceRejectionRetries![insideRetryWindow ? "pending" : "final"] += 1;
        result.success = false;
        result.errors.push({
          gameId: g.id,
          date: g.date,
          stage,
          message,
          isolated: true,
          ...(insideRetryWindow ? { retryPending: true } : {}),
        });
        continue;
      }
      const feedUnavailable =
        !useDurableScheduledCursor &&
        (stage === "fetch_pbp" || stage === "fetch_shifts") &&
        isUnavailableGamecenterFeedError(e);
      const isolateSourceRejection =
        shiftSourceRejected &&
        (!useDurableScheduledCursor || !insideRetryWindow);
      // The durable cursor skips a fresh rejection only once it is parked.
      let parked = false;
      let parkError: string | null = null;
      if (shiftSourceRejected && useDurableScheduledCursor) {
        try {
          parked = await recordSourceRejection(
            g,
            insideRetryWindow ? SOURCE_REJECTION_PENDING : SOURCE_REJECTION_FINAL,
          );
        } catch (recordError) {
          parkError = (recordError as any)?.message ?? String(recordError);
        }
        if (!insideRetryWindow) parked = false;
      }
      if (feedUnavailable || isolateSourceRejection || parked) {
        result.skipped += 1;
        if (feedUnavailable) {
          result.skipReasons.gamecenterFeedUnavailable += 1;
          result.lastCompletedGameId = g.id;
        } else {
          // Visible as a failed game, but it does not stop later games.
          result.skipReasons.sourceDataRejected += 1;
          result.success = false;
          result.errors.push({
            gameId: g.id,
            date: g.date,
            stage,
            message,
            isolated: true,
            ...(parked ? { retryPending: true } : {}),
          });
          if (result.sourceRejectionRetries) {
            result.sourceRejectionRetries[parked ? "pending" : "final"] += 1;
          }
        }
        const nextCursor = nextCursorByGameId.get(g.id);
        if (pipelineLease && nextCursor) {
          try {
            pipelineLease = await advanceProjectionPipelineLease({
              supabase,
              lease: pipelineLease,
              nextCursorDate: nextCursor.date,
              nextCursorGameId: nextCursor.id,
            });
          } catch (cursorError) {
            result.success = false;
            result.errors.push({
              gameId: g.id,
              date: g.date,
              stage: "advance_cursor",
              message: (cursorError as any)?.message ?? String(cursorError),
            });
            result.failedRows = result.errors.length;
            result.nextStartDate = g.date;
            result.nextGameId = g.id;
            break;
          }
        }
        if (
          debug &&
          result.debug &&
          result.debug.sampled.length <
            (Number.isFinite(debugLimit) ? debugLimit : 50)
        ) {
          result.debug.sampled.push({
            gameId: g.id,
            date: g.date,
            pbpExists: false,
            shiftTotalsExist: false,
            action: "skipped",
          });
        }
        continue;
      }

      result.success = false;
      result.errors.push({
        gameId: g.id,
        date: g.date,
        stage,
        message:
          shiftSourceRejected && useDurableScheduledCursor
            ? `${message} (not parked for retry${parkError ? `: ${parkError}` : ""}; the cursor holds here)`
            : message,
      });
      result.failedRows = result.errors.length;
      result.nextStartDate = g.date;
      result.nextGameId = g.id;
      break;
    }
  }

  if (pipelineLease && !slateAlreadyComplete) {
    // Isolated games stay in `errors` and keep `success` false, but they do not
    // hold the durable slate open: parked ones are retried by later scheduled
    // calls, aged ones by an explicit-range run.
    const leaseComplete =
      !result.timedOut && result.errors.every((error) => error.isolated);
    try {
      pipelineLease = await finishProjectionPipelineLease({
        supabase,
        lease: pipelineLease,
        outcome: leaseComplete ? "complete" : "failed",
        ...(leaseComplete
          ? {}
          : {
              failureCode: result.timedOut
                ? "deadline_reached"
                : "projection_input_failed",
            }),
      });
    } catch (cursorError) {
      result.success = false;
      result.errors.push({
        gameId: result.nextGameId ?? result.lastCompletedGameId ?? -1,
        date: result.nextStartDate ?? effectiveStartDate,
        stage: "finish_cursor",
        message: (cursorError as any)?.message ?? String(cursorError),
      });
    }
  }

  result.failedRows = result.errors.length;
  result.durationMs = formatDurationMsToMMSS(Date.now() - startedAt);
  return res.status(200).json(withTiming(result));
}

export default adminOnly(withCronJobAudit(
  withNhlOffSeasonSkip(ingestProjectionInputsHandler as any),
  {
    jobName: "ingest-projection-inputs",
  },
));
