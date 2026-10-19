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
// The durable scheduled cursor holds on such a game until it is this many UTC
// days old, then records it as an isolated failure and moves on, so one poison
// game cannot hold every later slate.
export const DURABLE_SOURCE_REJECTION_GRACE_DAYS = 2;

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

  if (pipelineLease?.status === "complete") {
    return res.status(200).json(
      withTiming({
        ...result,
        durableOperationAlreadyComplete: true,
      }),
    );
  }

  for (const g of games) {
    if (Date.now() > deadlineMs) {
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
      const feedUnavailable =
        !useDurableScheduledCursor &&
        (stage === "fetch_pbp" || stage === "fetch_shifts") &&
        isUnavailableGamecenterFeedError(e);
      const isolateSourceRejection =
        shiftSourceRejected &&
        (!useDurableScheduledCursor || g.date <= sourceRejectionCutoffDate);
      if (feedUnavailable || isolateSourceRejection) {
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
            message: (e as any)?.message ?? String(e),
            isolated: true,
          });
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
        message: (e as any)?.message ?? String(e),
      });
      result.failedRows = result.errors.length;
      result.nextStartDate = g.date;
      result.nextGameId = g.id;
      break;
    }
  }

  if (pipelineLease) {
    // Isolated games stay in `errors` and keep `success` false, but they do not
    // hold the durable slate open: retrying them is an explicit-range run.
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

export default withCronJobAudit(
  adminOnly(withNhlOffSeasonSkip(ingestProjectionInputsHandler as any)),
  {
    jobName: "ingest-projection-inputs",
  },
);
