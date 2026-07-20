/**
 * API Endpoint: /api/v1/db/build-projection-derived-v2
 *
 * Description:
 * This endpoint constructs derived projection data tables, specifically focusing on player, team, and goalie game-level strength metrics.
 * It processes game data within a specified date range to generate these analytics. The resulting tables are fundamental for more complex projection models.
 * This endpoint is designed for asynchronous execution, often triggered by a cron job, and includes safeguards against long execution times.
 *
 * ---
 *
 * URL Query Parameters:
 *
 * 1. `startDate` (optional)
 *    - Description: The start date for the data processing window, in `YYYY-MM-DD` format.
 *    - If omitted, the system defaults to the prior completed UTC slate.
 *    - Example: `?startDate=2025-10-05`
 *
 * 2. `endDate` (optional)
 *    - Description: The end date for the data processing window, in `YYYY-MM-DD` format.
 *    - If omitted, it defaults to the `startDate`, effectively processing a single day.
 *    - Example: `?startDate=2025-10-05&endDate=2025-10-12`
 *
 * 3. `maxDurationMs` (optional)
 *    - Description: The maximum allowed execution time for the job in milliseconds. This acts as a server-side timeout.
 *    - If the process exceeds this duration, it will halt and return a timeout error.
 *    - Defaults to `270000` (4.5 minutes) if not specified.
 *    - Example: `?maxDurationMs=60000`
 *
 * ---
 *
 * Usage Examples:
 *
 * - To build data for the prior completed UTC slate:
 *   `GET /api/v1/db/build-projection-derived-v2`
 *
 * - To build data for a specific day:
 *   `GET /api/v1/db/build-projection-derived-v2?startDate=2025-11-20`
 *
 * - To build data for a date range with a custom timeout:
 *   `POST /api/v1/db/build-projection-derived-v2?startDate=2025-11-01&endDate=2025-11-30&maxDurationMs=180000`
 *
 * ---
 *
 * Notes:
 *
 * - The endpoint supports both `GET` and `POST` methods. There is no difference in functionality between them.
 * - Each game is prepared in player, team, then goalie order and all three exact scopes are persisted by one version-checked transaction. A failed stage retains that date as the resume cursor.
 * - The response payload details the committed outcome of each part, separating exact rows verified from logical upserts and idempotent replays.
 * - A `207 Multi-Status` response will be returned if any part of the process encounters an error.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import adminOnly from "utils/adminOnlyMiddleware";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { getRollingForgeStageDependencyContract } from "lib/rollingForgePipeline";
import supabase from "lib/supabase/server";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

import {
  fetchProjectionDerivedGamesForDateRange,
  preparePlayerGameStrengthV2,
  prepareTeamGameStrengthV2,
  type ProjectionDerivedGame,
} from "lib/projections/derived/buildStrengthTablesV2";
import { prepareGoalieGameV2 } from "lib/projections/derived/buildGoalieGameV2";
import {
  persistProjectionGameDerivedV1,
  readProjectionGameInputManifest,
} from "lib/projections/derived/projectionDerivedPersistence";
import {
  selectPendingProjectionDerivedDates,
  type ProjectionDerivedQueueRow,
} from "lib/projections/derived/projectionDerivedQueue";

const SCHEDULED_DERIVED_MAX_DATES = 3;

type Result = {
  success: boolean;
  startDate: string;
  endDate: string;
  chunkDays: number;
  maxDays: number | null;
  resumeFromDate: string | null;
  nextStartDate: string | null;
  processedDates: string[];
  deferredDates: string[];
  durationMs: string;
  timedOut: boolean;
  maxDurationMs: string;
  rowsAffected: number;
  rowsVerified: number;
  rowsPruned: number;
  gamesVerified: number;
  gamesIdempotent: number;
  player: {
    gamesProcessed: number;
    rowsUpserted: number;
    rowsVerified: number;
  };
  team: {
    gamesProcessed: number;
    rowsUpserted: number;
    rowsVerified: number;
  };
  goalie: {
    gamesProcessed: number;
    rowsUpserted: number;
    rowsVerified: number;
    gamesNotObserved: number;
  };
  observability: {
    goalieRowsProcessed: number;
    dataQualityWarnings: Array<{
      code: string;
      message: string;
      detail?: string;
    }>;
  };
  errors: string[];
  failedRows: number;
  failedStages: number;
  failures: Array<{
    date: string;
    stage:
      | "request"
      | "input_manifest"
      | "player"
      | "team"
      | "goalie"
      | "persist";
    error: string;
  }>;
  dependencyContract?: ReturnType<
    typeof getRollingForgeStageDependencyContract
  >;
};

function getParam(req: NextApiRequest, key: string): string | undefined {
  const queryValue = req.query[key];
  if (typeof queryValue === "string" && queryValue.trim()) {
    return queryValue.trim();
  }

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

export function previousUtcDate(now = new Date()): string {
  const previous = new Date(now.getTime());
  previous.setUTCDate(previous.getUTCDate() - 1);
  return isoDateOnly(previous.toISOString());
}

function parseChunkDays(value: string | null): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.floor(n));
}

function parsePositiveInt(value: string | undefined): number | null {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(1, Math.floor(parsed));
}

function buildDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return out;
  for (let d = startDate; d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(isoDateOnly(d.toISOString()));
  }
  return out;
}

async function listPendingProjectionDerivedDates(maxDates: number) {
  if (!supabase) throw new Error("Supabase server client not available");
  const rows = await fetchAllSupabasePages<ProjectionDerivedQueueRow>(
    ({ from, to }) =>
      (supabase as any)
        .from("projection_game_materialization_status")
        .select(
          "game_id,input_status,input_fingerprint,relationship_status,relationship_input_fingerprint,relationship_algorithm_version,derived_status,derived_input_fingerprint,derived_algorithm_version,games!inner(id,date)",
        )
        .eq("input_status", "complete")
        .order("game_id", { ascending: true })
        .range(from, to),
  );
  return selectPendingProjectionDerivedDates({ rows, maxDates });
}

type DerivedStage = Exclude<Result["failures"][number]["stage"], "request">;

class DerivedStageError extends Error {
  readonly stage: DerivedStage;

  constructor(stage: DerivedStage, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "DerivedStageError";
    this.stage = stage;
  }
}

async function processProjectionDerivedGame(game: ProjectionDerivedGame) {
  let manifest;
  try {
    manifest = await readProjectionGameInputManifest({ gameId: game.id });
  } catch (error) {
    throw new DerivedStageError("input_manifest", error);
  }

  let playerPrepared;
  try {
    playerPrepared = await preparePlayerGameStrengthV2({ game });
  } catch (error) {
    throw new DerivedStageError("player", error);
  }

  let teamRows;
  try {
    teamRows = prepareTeamGameStrengthV2({
      game,
      playerRows: playerPrepared.rows,
    });
  } catch (error) {
    throw new DerivedStageError("team", error);
  }

  let goaliePrepared;
  try {
    goaliePrepared = prepareGoalieGameV2({
      game,
      plays: playerPrepared.plays,
    });
  } catch (error) {
    throw new DerivedStageError("goalie", error);
  }

  try {
    return await persistProjectionGameDerivedV1({
      gameId: game.id,
      manifest,
      playerRows: playerPrepared.rows,
      teamRows,
      goalie: goaliePrepared,
    });
  } catch (error) {
    throw new DerivedStageError("persist", error);
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse<Result>) {
  const startedAt = Date.now();
  const dependencyContract = getRollingForgeStageDependencyContract(
    "projection_derived_build",
  );
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      startDate: "",
      endDate: "",
      chunkDays: 0,
      maxDays: null,
      resumeFromDate: null,
      nextStartDate: null,
      processedDates: [],
      deferredDates: [],
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      timedOut: false,
      maxDurationMs: formatDurationMsToMMSS(0),
      rowsAffected: 0,
      rowsVerified: 0,
      rowsPruned: 0,
      gamesVerified: 0,
      gamesIdempotent: 0,
      player: { gamesProcessed: 0, rowsUpserted: 0, rowsVerified: 0 },
      team: { gamesProcessed: 0, rowsUpserted: 0, rowsVerified: 0 },
      goalie: {
        gamesProcessed: 0,
        rowsUpserted: 0,
        rowsVerified: 0,
        gamesNotObserved: 0,
      },
      observability: {
        goalieRowsProcessed: 0,
        dataQualityWarnings: [],
      },
      errors: ["Method not allowed"],
      failedRows: 0,
      failedStages: 1,
      failures: [{ date: "", stage: "request", error: "Method not allowed" }],
      dependencyContract,
    });
  }

  const requestedStartDate = getParam(req, "startDate");
  const requestedEndDate = getParam(req, "endDate");
  const chunkDays = parseChunkDays(getParam(req, "chunkDays") ?? null);
  const explicitMaxDays = parsePositiveInt(getParam(req, "maxDays"));
  const resumeFromDate = getParam(req, "resumeFromDate")?.slice(0, 10) ?? null;
  const useScheduledDerivedQueue =
    requestedStartDate == null &&
    requestedEndDate == null &&
    resumeFromDate == null &&
    chunkDays === 0 &&
    explicitMaxDays == null;
  const scheduledDates = useScheduledDerivedQueue
    ? await listPendingProjectionDerivedDates(SCHEDULED_DERIVED_MAX_DATES)
    : null;
  const fallbackDate = previousUtcDate();
  const startDate =
    scheduledDates && scheduledDates.length > 0
      ? scheduledDates[0]
      : (requestedStartDate ?? fallbackDate);
  const endDate =
    scheduledDates && scheduledDates.length > 0
      ? scheduledDates[scheduledDates.length - 1]
      : (requestedEndDate ?? startDate);
  const maxDays =
    explicitMaxDays ??
    (useScheduledDerivedQueue
      ? SCHEDULED_DERIVED_MAX_DATES
      : chunkDays === 0 && resumeFromDate == null
        ? 3
        : null);
  const bypassMaxDuration = parseBooleanParam(
    getParam(req, "bypassMaxDuration") ?? null,
  );
  const maxDurationMs = Number(getParam(req, "maxDurationMs") ?? 270_000);
  const budgetMs =
    Number.isFinite(maxDurationMs) && maxDurationMs > 0
      ? maxDurationMs
      : 270_000;
  const deadlineMs = bypassMaxDuration
    ? Number.POSITIVE_INFINITY
    : startedAt + budgetMs;
  const effectiveStartDate =
    resumeFromDate && resumeFromDate >= startDate && resumeFromDate <= endDate
      ? resumeFromDate
      : startDate;
  const fullRangeDates =
    scheduledDates ?? buildDateRange(effectiveStartDate, endDate);
  const chunkLimitedRangeDates =
    useScheduledDerivedQueue
      ? fullRangeDates
      : chunkDays > 0
        ? fullRangeDates.slice(0, chunkDays)
        : fullRangeDates;
  const limitedRangeDates =
    useScheduledDerivedQueue
      ? chunkLimitedRangeDates
      : maxDays != null
      ? chunkLimitedRangeDates.slice(0, maxDays)
      : chunkLimitedRangeDates;
  const effectiveEndDate =
    limitedRangeDates[limitedRangeDates.length - 1] ?? effectiveStartDate;
  const chunkNextStartDate =
    fullRangeDates.length > limitedRangeDates.length
      ? (fullRangeDates[limitedRangeDates.length] ?? null)
      : null;

  const errors: string[] = [];
  const failures: Result["failures"] = [];
  let rowsAffected = 0;
  let rowsVerified = 0;
  let rowsPruned = 0;
  let gamesVerified = 0;
  let gamesIdempotent = 0;
  let player = { gamesProcessed: 0, rowsUpserted: 0, rowsVerified: 0 };
  let team = { gamesProcessed: 0, rowsUpserted: 0, rowsVerified: 0 };
  let goalie = {
    gamesProcessed: 0,
    rowsUpserted: 0,
    rowsVerified: 0,
    gamesNotObserved: 0,
  };
  let timedOut = false;
  const processedDates: string[] = [];
  let nextStartDate = chunkNextStartDate;

  for (const date of limitedRangeDates) {
    if (Date.now() > deadlineMs) {
      timedOut = true;
      nextStartDate = date;
      break;
    }
    let games;
    try {
      games = await fetchProjectionDerivedGamesForDateRange({
        startDate: date,
        endDate: date,
      });
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      errors.push(`${date} request: ${error}`);
      failures.push({ date, stage: "request", error });
      nextStartDate = date;
      break;
    }
    let dateFailed = false;
    for (const game of games) {
      if (Date.now() > deadlineMs) {
        timedOut = true;
        nextStartDate = date;
        dateFailed = true;
        break;
      }
      try {
        const receipt = await processProjectionDerivedGame(game);
        gamesVerified += 1;
        rowsVerified += receipt.verifiedRows;
        rowsPruned += receipt.prunedRows;
        rowsAffected += receipt.affectedRows;
        if (receipt.idempotent) gamesIdempotent += 1;

        player.gamesProcessed += 1;
        player.rowsVerified += receipt.observedPlayerRows;
        team.gamesProcessed += 1;
        team.rowsVerified += receipt.observedTeamRows;
        goalie.gamesProcessed += 1;
        goalie.rowsVerified += receipt.observedGoalieRows;
        if (!receipt.idempotent) {
          player.rowsUpserted += receipt.observedPlayerRows;
          team.rowsUpserted += receipt.observedTeamRows;
          goalie.rowsUpserted += receipt.observedGoalieRows;
        }
        if (receipt.goalieOutcome === "not_observed") {
          goalie.gamesNotObserved += 1;
        }
      } catch (cause) {
        const stage =
          cause instanceof DerivedStageError ? cause.stage : "persist";
        const error = cause instanceof Error ? cause.message : String(cause);
        errors.push(`${date} ${stage}: ${error}`);
        failures.push({ date, stage, error });
        nextStartDate = date;
        dateFailed = true;
        break;
      }
    }
    if (dateFailed) break;
    processedDates.push(date);

    if (Date.now() > deadlineMs) {
      timedOut = true;
      nextStartDate =
        limitedRangeDates[processedDates.length] ?? chunkNextStartDate;
      break;
    }
  }

  const dataQualityWarnings: Array<{
    code: string;
    message: string;
    detail?: string;
  }> = [];
  if (failures.some((failure) => failure.stage === "goalie")) {
    dataQualityWarnings.push({
      code: "goalie_derived_failed",
      message: "Goalie derived build failed.",
      detail: failures
        .filter((failure) => failure.stage === "goalie")
        .map((failure) => `${failure.date}: ${failure.error}`)
        .join(" | "),
    });
  }
  if (goalie.gamesNotObserved > 0) {
    dataQualityWarnings.push({
      code: "goalie_not_observed",
      message:
        "Completed PBP justified an explicit empty goalie scope for one or more games.",
      detail: `${goalie.gamesNotObserved} game(s) committed with goalie_outcome=not_observed.`,
    });
  }

  return res.status(errors.length ? 207 : 200).json({
    success: errors.length === 0 && !timedOut,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    chunkDays,
    maxDays,
    resumeFromDate,
    nextStartDate,
    processedDates,
    deferredDates: nextStartDate
      ? fullRangeDates.slice(fullRangeDates.indexOf(nextStartDate))
      : [],
    durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
    timedOut,
    maxDurationMs: bypassMaxDuration
      ? "bypassed"
      : formatDurationMsToMMSS(budgetMs),
    rowsAffected,
    rowsVerified,
    rowsPruned,
    gamesVerified,
    gamesIdempotent,
    player,
    team,
    goalie,
    observability: {
      goalieRowsProcessed: goalie.rowsVerified,
      dataQualityWarnings,
    },
    errors,
    failedRows: 0,
    failedStages: failures.length,
    failures: failures.slice(0, 30),
    dependencyContract,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "build-projection-derived-v2",
});
