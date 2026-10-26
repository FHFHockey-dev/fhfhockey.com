/**
 * API Endpoint: /api/v1/db/run-projection-v2
 *
 * Description:
 * This endpoint executes the version 2 projection model for a specified "as of" date. It generates daily fantasy projections
 * for players, teams, and goalies based on the underlying data prepared by other systems. This is a core process for
 * generating the site's daily fantasy advice. The endpoint is designed to be run as a scheduled task (cron job) and
 * has built-in timeout handling to ensure it doesn't overrun its execution window.
 *
 * ---
 *
 * URL Query Parameters:
 *
 * 1. `date` (optional)
 *    - Description: The "as of" date for which to run the projections, in `YYYY-MM-DD` format. This determines the set
 *      of games and player statuses to consider.
 *    - If omitted, the system defaults to the current date.
 *    - Example: `?date=2025-10-05`
 *
 * 2. `startDate` / `endDate` (optional)
 *    - Description: Run projections for an inclusive date range in `YYYY-MM-DD` format.
 *    - If only one is provided, it will be treated as a single-date run.
 *    - Example: `?startDate=2025-10-07&endDate=2025-10-14`
 *
 * 3. `maxDurationMs` (optional)
 *    - Description: The maximum allowed execution time for the job in milliseconds.
 *    - Acts as a server-side timeout to prevent the process from running indefinitely.
 *    - Defaults to `210000` (3.5 minutes) if not specified, leaving 30 seconds for final audit persistence.
 *    - Capped at `210000`. The route answers within 15 seconds after this budget (by 225 s at most),
 *      even when a projection step is still running; that step keeps its run's lease until it stops.
 *    - Example: `?maxDurationMs=120000`
 *
 * 4. `gameIds` (optional)
 *    - Description: A comma-separated list of game ids for a bounded single-date
 *      batch. Use this to split a large slate into independently observable runs.
 *    - Example: `?date=2025-12-01&gameIds=2025020101,2025020102`
 *
 * ---
 *
 * Usage Examples:
 *
 * - To run projections for the current day:
 *   `GET /api/v1/db/run-projection-v2`
 *
 * - To run projections for a specific past or future date:
 *   `POST /api/v1/db/run-projection-v2?date=2025-11-20`
 *
 * - To run projections with a custom 2-minute timeout:
 *   `GET /api/v1/db/run-projection-v2?date=2025-12-01&maxDurationMs=120000`
 *
 * - To run projections for a date range:
 *   `POST /api/v1/db/run-projection-v2?startDate=2025-10-07&endDate=2025-10-14`
 *
 * ---
 *
 * Notes:
 *
 * - Supports both `GET` and `POST` methods. Functionality is identical.
 * - A successful run will return a `runId` that can be used to trace the specific projection outputs in the database.
 * - If the process exceeds `maxDurationMs`, it will return a `timedOut: true` status in the response, along with any
 *   partial results that were completed before the timeout.
 * - A single-date live run is resumable: on timeout it returns 207 with `operationStatus: "partial"` and
 *   `resume.request`, keeps its `forge_runs` row `running`, and the next call for the same date reuses that
 *   run_id and projects only the unfinished games. The run is marked `succeeded` once every game is done.
 *   When a step is still running at the forced answer, the 207 has `resume.runId: null` and null game
 *   counts; the next call usually gets `run_in_progress_elsewhere` until that step stops or its lease lapses.
 * - Errors during execution will result in a `500 Internal Server Error` with a descriptive error message.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  buildEndpointScanSummary,
  countFailingPreflightGates,
  type EndpointScanSummary,
} from "lib/api/scanSummary";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import { CronTimedResponse, withCronJobTiming } from "lib/cron/timingContract";
import {
  normalizeDependencyError,
  type NormalizedDependencyError,
} from "lib/cron/normalizeDependencyError";
import { resolveLatestStartedSeasonIdForDate } from "lib/NHL/server";
import { fetchRecentTeamLineCombinations } from "lib/projections/queries/line-combo-queries";
import { classifyStoredPbpGames } from "lib/projections/pbpCompletenessServer";
import { classifyStoredShiftChartStrengthGamesAgainstRawSource } from "lib/projections/shiftChartCompletenessServer";
import {
  runProjectionV2ForDate,
  type RunProjectionV2Result,
} from "lib/projections/run-forge-projections";
import {
  LINE_COMBO_STALE_HARD_DAYS,
  LINE_COMBO_STALE_SOFT_DAYS,
} from "lib/projections/constants/projection-weights";
import type {
  LineCombinationWithGameDateRow,
  RunProjectionResult,
} from "lib/projections/types/run-forge-projections.types";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { FORGE_COMPATIBILITY_INVENTORY } from "lib/projections/compatibilityInventory";
import { getGoalieForgePipelineSpec } from "lib/projections/goaliePipeline";
import { getRollingForgeStageDependencyContract } from "lib/rollingForgePipeline";
import { PROJECTION_ROUTE_DEFAULT_BUDGET_MS } from "lib/rollingPlayerOperationalPolicy";
import {
  buildResumableRunScopeKey,
  readRunResumeState,
} from "lib/projections/queries/run-lifecycle-queries";
import supabase from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";

// vercel.json kills pages/api functions at 240 s. The route answers by this
// point even when a projection step is stuck, leaving time for the response
// and the cron audit write.
const PROJECTION_ROUTE_HARD_LIMIT_MS = 225_000;
// Between the run deadline and that forced answer: a game started before the
// deadline finishes and the run checkpoints and releases its lease.
const PROJECTION_ROUTE_FINALIZATION_RESERVE_MS = 15_000;
const PROJECTION_ROUTE_MAX_BUDGET_MS =
  PROJECTION_ROUTE_HARD_LIMIT_MS - PROJECTION_ROUTE_FINALIZATION_RESERVE_MS;

/**
 * The work's result, or `null` when `limitAtMs` comes first. The work keeps
 * running; it holds its run's lease until it stops, so the next call waits for
 * it (`run_in_progress_elsewhere`) instead of overlapping it.
 */
async function settleBeforeLimit<T>(
  work: Promise<T>,
  limitAtMs: number,
): Promise<{ value: T } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), Math.max(0, limitAtMs - Date.now()));
  });
  try {
    const settled = await Promise.race([work.then((value) => ({ value })), limit]);
    if (settled === null) {
      work.catch((error) =>
        console.error(
          "run-projection-v2: projection work failed after the route answered",
          error,
        ),
      );
    }
    return settled;
  } finally {
    clearTimeout(timer);
  }
}

type PreflightGate = {
  gate_key: string;
  status: "PASS" | "FAIL";
  detail: string;
  action: string;
};

type PreflightSummary = {
  asOfDate: string;
  /** Where the backward-looking freshness windows end (see preflightFreshnessAnchorDate). */
  freshnessAnchorDate?: string;
  bypassed: boolean;
  status: "PASS" | "FAIL";
  gates: PreflightGate[];
};

type DataQualityWarning = {
  code: string;
  message: string;
  detail?: string;
};

type GoalieObservability = {
  goalieRowsProcessed: number;
  skaterRowsProcessed: number;
  skaterFreshnessFailureCount: number;
  dataQualityWarnings: DataQualityWarning[];
};

type GoaliePlayerRow = {
  id: number;
  position: string | null;
};

type GoalieRosterRow = {
  playerId: number;
  teamId: number;
};

export function parseProjectionGameIds(input: string | null): number[] {
  if (!input) return [];
  return Array.from(
    new Set(
      input
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
}

export function summarizeSkaterFreshnessCoverage(args: {
  asOfDate: string;
  scheduledTeamIds: number[];
  recentLineCombosByTeam: Map<number, LineCombinationWithGameDateRow[]>;
  teamsWithRecentDerivedRows: Set<number>;
}) {
  let missingLineComboTeams = 0;
  let softStaleLineComboTeams = 0;
  let hardStaleLineComboTeams = 0;
  let insufficientRoleCoverageTeams = 0;
  for (const teamId of args.scheduledTeamIds) {
    const latest = args.recentLineCombosByTeam.get(teamId)?.[0];
    if (!latest) {
      missingLineComboTeams += 1;
      insufficientRoleCoverageTeams += 1;
      continue;
    }
    const sourceDate = latest.games?.date ?? null;
    const ageDays =
      sourceDate == null
        ? null
        : Math.max(
            0,
            Math.floor(
              (Date.parse(`${args.asOfDate}T00:00:00.000Z`) -
                Date.parse(`${sourceDate}T00:00:00.000Z`)) /
                86_400_000,
            ),
          );
    if (ageDays == null || ageDays > LINE_COMBO_STALE_HARD_DAYS) {
      hardStaleLineComboTeams += 1;
    } else if (ageDays > LINE_COMBO_STALE_SOFT_DAYS) {
      softStaleLineComboTeams += 1;
    }
    const rolePlayerIds = new Set(
      [...(latest.forwards ?? []), ...(latest.defensemen ?? [])]
        .map(Number)
        .filter(Number.isFinite),
    );
    if (rolePlayerIds.size < 12) insufficientRoleCoverageTeams += 1;
  }
  const missingRecentDerivedTeams = args.scheduledTeamIds.filter(
    (teamId) => !args.teamsWithRecentDerivedRows.has(teamId),
  ).length;
  return {
    missingLineComboTeams,
    softStaleLineComboTeams,
    hardStaleLineComboTeams,
    insufficientRoleCoverageTeams,
    missingRecentDerivedTeams,
  };
}

export function buildProjectionInputIngestGate(args: {
  scheduledRecentGames: number;
  actualPbpGames: number;
  shiftedActualGames: number;
  invalidShiftGames: number;
  shiftRows: number;
}): PreflightGate {
  if (args.actualPbpGames === 0) {
    return {
      gate_key: "projection_input_ingest",
      status: args.scheduledRecentGames === 0 ? "PASS" : "FAIL",
      detail: `scheduled_recent_games=${args.scheduledRecentGames}, actual_pbp_games=0, shifted_actual_games=0, invalid_shift_games=0, shift_coverage=1.00, shift_rows=${args.shiftRows}`,
      action:
        args.scheduledRecentGames === 0
          ? "No recent scheduled games were found; ingest freshness is not applicable."
          : "No recent scheduled game has complete terminal PBP evidence; run projection-input ingestion and reconcile any canceled/non-realized games.",
    };
  }

  const shiftCoverage = args.shiftedActualGames / args.actualPbpGames;
  const pass =
    args.shiftedActualGames === args.actualPbpGames &&
    args.invalidShiftGames === 0;

  return {
    gate_key: "projection_input_ingest",
    status: pass ? "PASS" : "FAIL",
    detail: `scheduled_recent_games=${args.scheduledRecentGames}, actual_pbp_games=${args.actualPbpGames}, shifted_actual_games=${args.shiftedActualGames}, invalid_shift_games=${args.invalidShiftGames}, shift_coverage=${shiftCoverage.toFixed(2)}, shift_rows=${args.shiftRows}`,
    action: pass
      ? "Every recent actual game with terminal PBP has complete shift coverage; scheduled playoff placeholders without PBP are excluded from the denominator."
      : "Run /api/v1/db/ingest-projection-inputs for recent actual game dates.",
  };
}

export function buildProjectionDerivedGate(args: {
  scheduledGameCount: number;
  playerLatest: string | null;
  teamLatest: string | null;
  goalieLatest: string | null;
}): PreflightGate {
  if (args.scheduledGameCount === 0) {
    return {
      gate_key: "projection_derived_v2",
      status: "PASS",
      detail:
        "No scheduled games on requested date; projection-derived freshness is not applicable.",
      action: "None.",
    };
  }

  const pass = Boolean(
    args.playerLatest && args.teamLatest && args.goalieLatest,
  );
  return {
    gate_key: "projection_derived_v2",
    status: pass ? "PASS" : "FAIL",
    detail: `player_latest=${args.playerLatest ?? "none"}, team_latest=${args.teamLatest ?? "none"}, goalie_latest=${args.goalieLatest ?? "none"}`,
    action: "Run /api/v1/db/build-projection-derived-v2 for recent dates.",
  };
}

type Result =
  | {
      success: true;
      runId: string;
      asOfDate: string;
      startDate: string;
      endDate: string;
      horizonGames: number;
      chunkDays: number;
      resumeFromDate: string | null;
      nextStartDate: string | null;
      termination: TerminationReceipt;
      gamesProcessed: number;
      playerRowsUpserted: number;
      teamRowsUpserted: number;
      goalieRowsUpserted: number;
      timedOut: false;
      maxDurationMs: string;
      durationMs: string;
      pipeline: ReturnType<typeof getGoalieForgePipelineSpec>;
      dependencyContract: ReturnType<
        typeof getRollingForgeStageDependencyContract
      >;
      compatibilityInventory: typeof FORGE_COMPATIBILITY_INVENTORY;
      preflight: PreflightSummary;
      observability: GoalieObservability;
      scanSummary: EndpointScanSummary;
      postRun?: {
        step: PostRunFailure["step"];
        status: "failed";
        blocking: false;
        dependencyError: ReturnType<typeof normalizeDependencyError>;
      };
      results?: Array<{
        asOfDate: string;
        runId: string;
        gamesProcessed: number;
        playerRowsUpserted: number;
        teamRowsUpserted: number;
        goalieRowsUpserted: number;
        timedOut: boolean;
      }>;
      processedDates?: string[];
      preflightSkipped?: "resumed_run";
    }
  | {
      success: false;
      asOfDate: string;
      startDate: string;
      endDate: string;
      horizonGames: number;
      chunkDays: number;
      resumeFromDate: string | null;
      nextStartDate: string | null;
      termination: TerminationReceipt;
      timedOut: boolean;
      maxDurationMs: string;
      durationMs: string;
      pipeline: ReturnType<typeof getGoalieForgePipelineSpec>;
      dependencyContract: ReturnType<
        typeof getRollingForgeStageDependencyContract
      >;
      compatibilityInventory: typeof FORGE_COMPATIBILITY_INVENTORY;
      preflight: PreflightSummary;
      observability: GoalieObservability;
      scanSummary: EndpointScanSummary;
      runId?: string;
      gamesProcessed?: number;
      playerRowsUpserted?: number;
      teamRowsUpserted?: number;
      goalieRowsUpserted?: number;
      dependencyError?: NormalizedDependencyError;
      results?: Array<{
        asOfDate: string;
        runId: string;
        gamesProcessed: number;
        playerRowsUpserted: number;
        teamRowsUpserted: number;
        goalieRowsUpserted: number;
        timedOut: boolean;
      }>;
      processedDates?: string[];
      preflightSkipped?: "resumed_run";
    } & (
      | { error: string }
      // Unfinished, not failed: the resumable run continues on the next call.
      | { operationStatus: "partial"; resume: ProjectionResumeReceipt; error?: never }
    );

type TerminationReceipt = {
  state: "not_started" | "blocked" | "resume_required" | "completed";
  resumeRequired: boolean;
  nextStartDate: string | null;
};

type ProjectionResumeReceipt = {
  required: true;
  reason: "runtime_budget" | "run_in_progress_elsewhere";
  runId: string | null;
  completedGames: number | null;
  totalGames: number | null;
  pendingGames: number | null;
  request: Record<string, string>;
};

function getParam(req: NextApiRequest, key: string): string | null {
  const v = req.query[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function isoDateOnly(d: string): string {
  return d.slice(0, 10);
}

function parseDateParam(value: string | null): string | null {
  return value && value.trim() ? value.trim().slice(0, 10) : null;
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

function parseHorizonGames(value: string | null): number {
  const n = Number(value ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.floor(n)));
}

function parseChunkDays(value: string | null): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.floor(n));
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDateOnly(d.toISOString());
}

/**
 * The date the preflight's backward-looking freshness windows end at: the
 * as-of date, or today (UTC, the route's default as-of date) when the as-of
 * date is later. A days-ahead run can't read inputs newer than today's, so it
 * checks the same windows today's run does instead of failing by
 * construction. Today's and past runs are unchanged.
 */
export function preflightFreshnessAnchorDate(
  asOfDate: string,
  now: Date = new Date(),
): string {
  const today = isoDateOnly(now.toISOString());
  return asOfDate < today ? asOfDate : today;
}

export function summarizeGoalieRosterAssignments(args: {
  latestGoaliesByTeam: Map<number, number[]>;
  goaliePlayers: GoaliePlayerRow[];
  goalieRosters: GoalieRosterRow[];
}): {
  goalieCandidatesChecked: number;
  mismatchedAssignments: number;
  nonGoaliePositionRows: number;
} {
  const rosterTeamsByPlayer = new Map<number, Set<number>>();
  for (const row of args.goalieRosters) {
    if (!Number.isFinite(row.playerId) || !Number.isFinite(row.teamId))
      continue;
    const teamIds = rosterTeamsByPlayer.get(row.playerId) ?? new Set<number>();
    teamIds.add(row.teamId);
    rosterTeamsByPlayer.set(row.playerId, teamIds);
  }

  const goalieById = new Map(
    args.goaliePlayers.map((player) => [player.id, player]),
  );
  const goalieCandidateIds = new Set(
    Array.from(args.latestGoaliesByTeam.values())
      .flat()
      .filter((id) => Number.isFinite(id)),
  );

  let mismatchedAssignments = 0;
  let nonGoaliePositionRows = 0;

  for (const [teamId, goalieIds] of args.latestGoaliesByTeam.entries()) {
    for (const goalieId of goalieIds) {
      const player = goalieById.get(goalieId);
      if (!player) continue;
      if (player.position !== "G") nonGoaliePositionRows += 1;
      const rosterTeams = rosterTeamsByPlayer.get(goalieId);
      if (rosterTeams && rosterTeams.has(teamId)) continue;
      mismatchedAssignments += 1;
    }
  }

  return {
    goalieCandidatesChecked: goalieCandidateIds.size,
    mismatchedAssignments,
    nonGoaliePositionRows,
  };
}

// True when a running resumable run of this date and scope exists, i.e. the
// next call resumes it instead of starting a new run. Read-only; a failed read
// falls back to the full preflight.
async function hasPausedResumableRun(
  asOfDate: string,
  horizonGames: number,
  gameIds: readonly number[],
): Promise<boolean> {
  if (!supabase) return false;
  const scopeKey = buildResumableRunScopeKey(horizonGames, gameIds);
  const { data, error } = await supabase
    .from("forge_runs")
    .select("metrics")
    .eq("as_of_date", asOfDate)
    .eq("status", "running")
    .limit(20);
  if (error) return false;
  return (data ?? []).some(
    (row) => readRunResumeState(row.metrics)?.scope_key === scopeKey,
  );
}

export async function runProjectionPreflightChecks(
  asOfDate: string,
  bypassed: boolean,
): Promise<PreflightSummary> {
  const gates: PreflightGate[] = [];
  if (bypassed) {
    return {
      asOfDate,
      bypassed: true,
      status: "PASS",
      gates: [
        {
          gate_key: "preflight_bypass",
          status: "PASS",
          detail: "Preflight checks bypassed by request parameter.",
          action: "Remove bypassPreflight=true to enforce freshness checks.",
        },
      ],
    };
  }

  if (!supabase) {
    return {
      asOfDate,
      bypassed: false,
      status: "FAIL",
      gates: [
        {
          gate_key: "supabase_client_available",
          status: "FAIL",
          detail: "Supabase server client is not available.",
          action: "Ensure server-side Supabase credentials are configured.",
        },
      ],
    };
  }

  // Scheduled games, teams and goalie start priors stay on asOfDate; only the
  // backward-looking freshness windows end at the anchor.
  const freshnessAnchorDate = preflightFreshnessAnchorDate(asOfDate);
  const { data: games, error: gamesErr } = await supabase
    .from("games")
    .select("id,homeTeamId,awayTeamId")
    .eq("date", asOfDate);
  if (gamesErr) throw gamesErr;
  const scheduledGames = (games ?? []) as Array<{
    id: number;
    homeTeamId: number;
    awayTeamId: number;
  }>;
  const scheduledGameIds = scheduledGames.map((g) => g.id);
  const scheduledTeamIds = Array.from(
    new Set(scheduledGames.flatMap((g) => [g.homeTeamId, g.awayTeamId])),
  );
  const recentLineCombosByTeam = new Map<
    number,
    LineCombinationWithGameDateRow[]
  >();

  const { count: teamCount, error: teamsErr } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true });
  if (teamsErr) throw teamsErr;
  const { count: playerCount, error: playersErr } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true });
  if (playersErr) throw playersErr;
  gates.push({
    gate_key: "core_roster_schedule",
    status: (teamCount ?? 0) > 0 && (playerCount ?? 0) > 0 ? "PASS" : "FAIL",
    detail: `teams=${teamCount ?? 0}, players=${playerCount ?? 0}, scheduled_games=${scheduledGames.length}`,
    action:
      "Run /api/v1/db/update-games, /api/v1/db/update-teams, and /api/v1/db/update-players.",
  });

  if (scheduledTeamIds.length > 0) {
    for (const teamId of scheduledTeamIds) {
      const rows = await fetchRecentTeamLineCombinations({
        teamId,
        asOfDate: freshnessAnchorDate,
        limit: 3,
      });
      recentLineCombosByTeam.set(teamId, rows);
    }
    const derivedFreshnessStart = addDays(freshnessAnchorDate, -7);
    const derivedCounts = await Promise.all(
      scheduledTeamIds.map(async (teamId) => {
        const { count, error } = await supabase
          .from("forge_player_game_strength")
          .select("player_id", { count: "exact", head: true })
          .eq("team_id", teamId)
          .lt("game_date", freshnessAnchorDate)
          .gte("game_date", derivedFreshnessStart);
        if (error) throw error;
        return { teamId, count: count ?? 0 };
      }),
    );
    const freshness = summarizeSkaterFreshnessCoverage({
      // Line-combination age is measured from the anchor too.
      asOfDate: freshnessAnchorDate,
      scheduledTeamIds,
      recentLineCombosByTeam,
      teamsWithRecentDerivedRows: new Set(
        derivedCounts.filter((row) => row.count > 0).map((row) => row.teamId),
      ),
    });
    gates.push({
      gate_key: "line_combinations",
      status: freshness.missingLineComboTeams === 0 ? "PASS" : "FAIL",
      detail: `teams_checked=${scheduledTeamIds.length}, missing_recent_line_combos=${freshness.missingLineComboTeams}`,
      action:
        "Run /api/v1/db/update-line-combinations before projection execution.",
    });
    gates.push({
      gate_key: "skater_line_freshness",
      status: freshness.hardStaleLineComboTeams === 0 ? "PASS" : "FAIL",
      detail: `teams_checked=${scheduledTeamIds.length}, soft_stale_teams=${freshness.softStaleLineComboTeams}, hard_stale_teams=${freshness.hardStaleLineComboTeams}, soft_days=${LINE_COMBO_STALE_SOFT_DAYS}, hard_days=${LINE_COMBO_STALE_HARD_DAYS}`,
      action:
        "Refresh line combinations; soft-stale rows remain visible but hard-stale role priors block projection execution.",
    });
    gates.push({
      gate_key: "skater_role_coverage",
      status: freshness.insufficientRoleCoverageTeams === 0 ? "PASS" : "FAIL",
      detail: `teams_checked=${scheduledTeamIds.length}, teams_below_12_role_players=${freshness.insufficientRoleCoverageTeams}`,
      action:
        "Refresh line combinations and verify at least 12 distinct forward/defense role assignments per scheduled team.",
    });
    gates.push({
      gate_key: "skater_derived_freshness",
      status: freshness.missingRecentDerivedTeams === 0 ? "PASS" : "FAIL",
      detail: `teams_checked=${scheduledTeamIds.length}, teams_missing_recent_skater_derived_rows=${freshness.missingRecentDerivedTeams}, stale_window_days=7`,
      action:
        "Run /api/v1/db/build-projection-derived-v2 for recent dates and verify scheduled-team skater coverage.",
    });
  } else {
    gates.push({
      gate_key: "line_combinations",
      status: "PASS",
      detail:
        "No scheduled games on requested date; skipping line combination coverage check.",
      action: "None.",
    });
    for (const gate_key of [
      "skater_line_freshness",
      "skater_role_coverage",
      "skater_derived_freshness",
    ]) {
      gates.push({
        gate_key,
        status: "PASS",
        detail:
          "No scheduled teams on requested date; skater freshness check skipped.",
        action: "None.",
      });
    }
  }

  const recentWindowStart = addDays(freshnessAnchorDate, -14);
  const { data: recentGames, error: recentGamesErr } = await supabase
    .from("games")
    .select("id")
    .gte("date", recentWindowStart)
    .lt("date", freshnessAnchorDate);
  if (recentGamesErr) throw recentGamesErr;
  const recentGameIds = ((recentGames ?? []) as Array<{ id: number }>).map(
    (g) => g.id,
  );

  if (recentGameIds.length > 0) {
    const pbpClassifications = await classifyStoredPbpGames(recentGameIds);
    const pbpGameIds = recentGameIds.filter(
      (gameId) => pbpClassifications.get(gameId) === true,
    );
    const shiftClassifications =
      await classifyStoredShiftChartStrengthGamesAgainstRawSource(pbpGameIds);
    const shiftedActualGames = Array.from(shiftClassifications.values()).filter(
      (classification) => classification.status === "complete",
    ).length;
    const invalidShiftGames = Array.from(shiftClassifications.values()).filter(
      (classification) => classification.status === "invalid",
    ).length;
    const shiftRows = Array.from(shiftClassifications.values()).reduce(
      (total, classification) => total + classification.rowCount,
      0,
    );
    gates.push(
      buildProjectionInputIngestGate({
        scheduledRecentGames: recentGameIds.length,
        actualPbpGames: pbpGameIds.length,
        shiftedActualGames,
        invalidShiftGames,
        shiftRows,
      }),
    );
  } else {
    gates.push({
      gate_key: "projection_input_ingest",
      status: "PASS",
      detail:
        "No prior 14-day games before requested date; ingest freshness not applicable.",
      action: "None.",
    });
  }

  if (scheduledGameIds.length === 0) {
    gates.push(
      buildProjectionDerivedGate({
        scheduledGameCount: 0,
        playerLatest: null,
        teamLatest: null,
        goalieLatest: null,
      }),
    );
  } else {
    const derivedFreshnessStart = addDays(freshnessAnchorDate, -7);
    const [playerDerived, teamDerived, goalieDerived] = await Promise.all([
      supabase
        .from("forge_player_game_strength")
        .select("game_date")
        .lt("game_date", freshnessAnchorDate)
        .gte("game_date", derivedFreshnessStart)
        .order("game_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("forge_team_game_strength")
        .select("game_date")
        .lt("game_date", freshnessAnchorDate)
        .gte("game_date", derivedFreshnessStart)
        .order("game_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("forge_goalie_game")
        .select("game_date")
        .lt("game_date", freshnessAnchorDate)
        .gte("game_date", derivedFreshnessStart)
        .order("game_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (playerDerived.error) throw playerDerived.error;
    if (teamDerived.error) throw teamDerived.error;
    if (goalieDerived.error) throw goalieDerived.error;
    gates.push(
      buildProjectionDerivedGate({
        scheduledGameCount: scheduledGameIds.length,
        playerLatest: (playerDerived.data as any)?.game_date ?? null,
        teamLatest: (teamDerived.data as any)?.game_date ?? null,
        goalieLatest: (goalieDerived.data as any)?.game_date ?? null,
      }),
    );
  }

  if (scheduledGameIds.length > 0) {
    const { count: goalieStartRows, error: goalieStartErr } = await supabase
      .from("goalie_start_projections")
      .select("game_id", { count: "exact", head: true })
      .in("game_id", scheduledGameIds);
    if (goalieStartErr) throw goalieStartErr;
    gates.push({
      gate_key: "goalie_start_priors_v2",
      status: (goalieStartRows ?? 0) > 0 ? "PASS" : "FAIL",
      detail: `scheduled_games=${scheduledGameIds.length}, goalie_start_rows=${goalieStartRows ?? 0}`,
      action: `Run /api/v1/db/update-goalie-projections-v2?date=${asOfDate}.`,
    });
  } else {
    gates.push({
      gate_key: "goalie_start_priors_v2",
      status: "PASS",
      detail:
        "No scheduled games on requested date; goalie start priors not required.",
      action: "None.",
    });
  }

  // Stale-data detectors:
  // 1) Missing recent goalie-game rows for teams on the target slate.
  // 2) Outdated players.team_id mappings for likely goalie candidates from latest line combos.
  if (scheduledTeamIds.length > 0) {
    const seasonId = await resolveLatestStartedSeasonIdForDate(
      asOfDate,
      supabase,
    );
    const staleWindowStart = addDays(freshnessAnchorDate, -30);
    const { data: recentGoalieRows, error: recentGoalieErr } = await supabase
      .from("forge_goalie_game")
      .select("team_id,game_date")
      .in("team_id", scheduledTeamIds)
      .gte("game_date", staleWindowStart)
      .lt("game_date", freshnessAnchorDate);
    if (recentGoalieErr) throw recentGoalieErr;
    const teamsWithRecentGoalieRows = new Set(
      ((recentGoalieRows ?? []) as Array<{ team_id: number | null }>)
        .map((r) => r.team_id)
        .filter((id): id is number => Number.isFinite(id)),
    );
    const missingRecentGoalieTeams = scheduledTeamIds.filter(
      (teamId) => !teamsWithRecentGoalieRows.has(teamId),
    );
    gates.push({
      gate_key: "stale_goalie_game_rows",
      status: missingRecentGoalieTeams.length === 0 ? "PASS" : "FAIL",
      detail: `teams_checked=${scheduledTeamIds.length}, teams_missing_recent_goalie_rows=${missingRecentGoalieTeams.length}, stale_window_days=30`,
      action:
        "Run /api/v1/db/build-projection-derived-v2 for recent dates and verify source goalie game ingestion.",
    });

    const recentGoalieCandidateIds = new Set<number>();
    const latestGoaliesByTeam = new Map<number, number[]>();
    for (const teamId of scheduledTeamIds) {
      const rows = recentLineCombosByTeam.get(teamId) ?? [];
      rows.forEach((row, index) => {
        const goalieIds = (row.goalies ?? []).filter((goalieId) =>
          Number.isFinite(goalieId),
        );
        goalieIds.forEach((goalieId) => recentGoalieCandidateIds.add(goalieId));
        if (index === 0 && goalieIds.length > 0) {
          latestGoaliesByTeam.set(teamId, goalieIds);
        }
      });
    }
    const likelyGoalieIds = recentGoalieCandidateIds;
    if (likelyGoalieIds.size > 0) {
      const { data: goaliePlayers, error: goaliePlayersErr } = await supabase
        .from("players")
        .select("id,position")
        .in("id", Array.from(likelyGoalieIds));
      if (goaliePlayersErr) throw goaliePlayersErr;
      const { data: goalieRosters, error: goalieRostersErr } = await supabase
        .from("rosters")
        .select("playerId,teamId")
        .eq("seasonId", seasonId)
        .in("playerId", Array.from(likelyGoalieIds));
      if (goalieRostersErr) throw goalieRostersErr;
      const assignmentSummary = summarizeGoalieRosterAssignments({
        latestGoaliesByTeam,
        goaliePlayers: (goaliePlayers ?? []) as GoaliePlayerRow[],
        goalieRosters: (goalieRosters ?? []) as GoalieRosterRow[],
      });
      const rosterAssignmentDrift = assignmentSummary.mismatchedAssignments > 0;
      gates.push({
        gate_key: "outdated_player_team_assignments",
        status: assignmentSummary.nonGoaliePositionRows === 0 ? "PASS" : "FAIL",
        detail: `goalie_candidates_checked=${assignmentSummary.goalieCandidatesChecked}, mismatched_team_assignments=${assignmentSummary.mismatchedAssignments}, non_goalie_positions=${assignmentSummary.nonGoaliePositionRows}, season_id=${seasonId}`,
        action:
          "Refresh players/rosters and line combinations; verify current-season goalie roster assignments are present in rosters.",
      });
      if (rosterAssignmentDrift) {
        gates.push({
          gate_key: "outdated_player_team_assignments_warning",
          status: "PASS",
          detail: `Roster drift warning only: ${assignmentSummary.mismatchedAssignments} latest line-combination goalie assignments are not present on current-season rosters.`,
          action:
            "Review recalled, reassigned, or traded goalie history if projection inputs look suspicious; this warning does not block the run.",
        });
      }
    } else {
      gates.push({
        gate_key: "outdated_player_team_assignments",
        status: "PASS",
        detail:
          "No recent line-combination goalie candidates available for assignment validation.",
        action: "None.",
      });
    }
  } else {
    gates.push({
      gate_key: "stale_goalie_game_rows",
      status: "PASS",
      detail:
        "No scheduled teams on requested date; stale goalie-row detector skipped.",
      action: "None.",
    });
    gates.push({
      gate_key: "outdated_player_team_assignments",
      status: "PASS",
      detail:
        "No scheduled teams on requested date; team-assignment detector skipped.",
      action: "None.",
    });
  }

  const failed = gates.some((g) => g.status === "FAIL");
  return {
    asOfDate,
    freshnessAnchorDate,
    bypassed: false,
    status: failed ? "FAIL" : "PASS",
    gates,
  };
}

function buildGoalieObservability(args: {
  preflight: PreflightSummary;
  gamesProcessed: number;
  goalieRowsProcessed: number;
  skaterRowsProcessed?: number;
  zeroGoalieRowDates?: string[];
}): GoalieObservability {
  const warnings: DataQualityWarning[] = [];
  const failedGates = args.preflight.gates.filter((g) => g.status === "FAIL");
  for (const gate of failedGates) {
    warnings.push({
      code: `preflight_${gate.gate_key}`,
      message: "Preflight dependency check failed.",
      detail: gate.detail,
    });
  }
  const warningOnlyGates = args.preflight.gates.filter((g) =>
    g.gate_key.endsWith("_warning"),
  );
  for (const gate of warningOnlyGates) {
    warnings.push({
      code: `preflight_${gate.gate_key}`,
      message: "Preflight data-quality warning.",
      detail: gate.detail,
    });
  }

  if (args.gamesProcessed > 0 && args.goalieRowsProcessed === 0) {
    warnings.push({
      code: "goalie_rows_zero",
      message: "Projection run processed games but wrote zero goalie rows.",
    });
  }

  if ((args.zeroGoalieRowDates?.length ?? 0) > 0) {
    warnings.push({
      code: "goalie_rows_zero_dates",
      message:
        "One or more processed dates wrote zero goalie rows in range execution.",
      detail: args.zeroGoalieRowDates!.slice(0, 5).join(", "),
    });
  }

  const skaterFreshnessFailureCount = failedGates.filter((gate) =>
    [
      "line_combinations",
      "skater_line_freshness",
      "skater_role_coverage",
      "skater_derived_freshness",
    ].includes(gate.gate_key),
  ).length;
  if (args.gamesProcessed > 0 && (args.skaterRowsProcessed ?? 0) === 0) {
    warnings.push({
      code: "skater_rows_zero",
      message: "Projection run processed games but wrote zero skater rows.",
    });
  }

  return {
    goalieRowsProcessed: args.goalieRowsProcessed,
    skaterRowsProcessed: args.skaterRowsProcessed ?? 0,
    skaterFreshnessFailureCount,
    dataQualityWarnings: warnings,
  };
}

type PostRunFailure = NonNullable<RunProjectionV2Result["postRunFailure"]>;

/**
 * A run that finalized succeeded keeps that outcome when a later step its rows
 * do not depend on fails; the failure is reported as a non-blocking warning.
 */
function postRunFailureWarnings(
  failures: Array<{ asOfDate: string; failure: PostRunFailure }>,
): DataQualityWarning[] {
  return failures.map(({ asOfDate, failure }) => ({
    code: "post_run_step_failed",
    message: `Run for ${asOfDate} succeeded; post-run step ${failure.step} failed (non-blocking): ${normalizeDependencyError(failure.message).message}`,
    detail: normalizeDependencyError(failure.message).detail ?? undefined,
  }));
}

function buildProjectionRunScanSummary(args: {
  status: EndpointScanSummary["status"];
  requestedDate: string;
  activeDataDate: string;
  blockingIssueCount: number;
  notes?: string[];
  rowCounts?: Record<string, unknown>;
}) {
  return buildEndpointScanSummary({
    surface: "projection_run_operator",
    requestedDate: args.requestedDate,
    activeDataDate: args.activeDataDate,
    fallbackApplied: false,
    status: args.status,
    rowCounts: args.rowCounts,
    blockingIssueCount: args.blockingIssueCount,
    notes: args.notes,
  });
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronTimedResponse<Result>>,
) {
  const startedAt = Date.now();
  let preflightSkipped: "resumed_run" | null = null;
  const withTiming = (body: Result, endedAt = Date.now()) =>
    withCronJobTiming(
      preflightSkipped ? { ...body, preflightSkipped } : body,
      startedAt,
      endedAt,
    );
  const horizonGames = parseHorizonGames(getParam(req, "horizonGames"));
  const gameIds = parseProjectionGameIds(getParam(req, "gameIds"));
  const chunkDays = parseChunkDays(getParam(req, "chunkDays"));
  const resumeFromDate = parseDateParam(getParam(req, "resumeFromDate"));
  const pipeline = getGoalieForgePipelineSpec();
  const dependencyContract = getRollingForgeStageDependencyContract(
    "projection_execution",
  );
  const bypassPreflight = parseBooleanParam(getParam(req, "bypassPreflight"));
  const defaultPreflight: PreflightSummary = {
    asOfDate: "",
    bypassed: bypassPreflight,
    status: "PASS",
    gates: [],
  };
  const defaultObservability: GoalieObservability = {
    goalieRowsProcessed: 0,
    skaterRowsProcessed: 0,
    skaterFreshnessFailureCount: 0,
    dataQualityWarnings: [],
  };
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json(
      withTiming({
        success: false,
        asOfDate: "",
        startDate: "",
        endDate: "",
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: null,
        termination: {
          state: "not_started",
          resumeRequired: false,
          nextStartDate: null,
        },
        pipeline,
        dependencyContract,
        compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
        preflight: defaultPreflight,
        observability: defaultObservability,
        scanSummary: buildProjectionRunScanSummary({
          status: "blocked",
          requestedDate: "",
          activeDataDate: "",
          blockingIssueCount: 1,
          notes: ["Method not allowed."],
          rowCounts: {},
        }),
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(0),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        error: "Method not allowed",
      }),
    );
  }

  const dateParam = parseDateParam(getParam(req, "date"));
  const startDateParam =
    parseDateParam(getParam(req, "startDate")) ??
    parseDateParam(getParam(req, "endDate")) ??
    parseDateParam(getParam(req, "endPoint"));
  const endDateParam =
    parseDateParam(getParam(req, "endDate")) ??
    parseDateParam(getParam(req, "endPoint")) ??
    parseDateParam(getParam(req, "startDate"));
  const rangeDates =
    startDateParam && endDateParam
      ? buildDateRange(startDateParam, endDateParam)
      : [];
  if (
    (startDateParam || endDateParam) &&
    (rangeDates.length === 0 ||
      (startDateParam && endDateParam && startDateParam > endDateParam))
  ) {
    return res.status(400).json(
      withTiming({
        success: false,
        asOfDate: "",
        startDate: startDateParam ?? "",
        endDate: endDateParam ?? "",
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: null,
        termination: {
          state: "blocked",
          resumeRequired: true,
          nextStartDate: startDateParam ?? endDateParam ?? null,
        },
        pipeline,
        dependencyContract,
        compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
        preflight: defaultPreflight,
        observability: defaultObservability,
        scanSummary: buildProjectionRunScanSummary({
          status: "blocked",
          requestedDate: startDateParam ?? "",
          activeDataDate: endDateParam ?? "",
          blockingIssueCount: 1,
          notes: ["Invalid startDate/endDate range."],
          rowCounts: {},
        }),
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(0),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        error: "Invalid startDate/endDate range",
      }),
    );
  }
  const asOfDate = dateParam ?? isoDateOnly(new Date().toISOString());
  const startDate = startDateParam ?? asOfDate;
  const endDate = endDateParam ?? asOfDate;
  const maxDurationMs = Number(
    getParam(req, "maxDurationMs") ?? PROJECTION_ROUTE_DEFAULT_BUDGET_MS,
  );
  const budgetMs = Math.min(
    Number.isFinite(maxDurationMs)
      ? maxDurationMs
      : PROJECTION_ROUTE_DEFAULT_BUDGET_MS,
    PROJECTION_ROUTE_MAX_BUDGET_MS,
  );
  const deadlineMs = startedAt + budgetMs;
  // An in-process caller (the rolling pipeline) passes its own remaining time,
  // so the forced answer follows the budget, never past the platform limit.
  const answerByMs =
    startedAt +
    Math.min(
      Math.max(0, budgetMs) + PROJECTION_ROUTE_FINALIZATION_RESERVE_MS,
      PROJECTION_ROUTE_HARD_LIMIT_MS,
    );
  let preflight = defaultPreflight;
  // No `error` field: the pipeline and the cron audit read this as unfinished.
  const buildResumablePartialBody = (args: {
    reason: ProjectionResumeReceipt["reason"];
    runId: string | null;
    resume: RunProjectionResult["resume"] | null;
    observability: GoalieObservability;
    rowCounts: Record<string, number>;
  }): Result => ({
    success: false,
    operationStatus: "partial",
    resume: {
      required: true,
      reason: args.reason,
      runId: args.runId,
      completedGames: args.resume?.completedGames ?? null,
      totalGames: args.resume?.totalGames ?? null,
      pendingGames: args.resume?.pendingGames ?? null,
      request: {
        date: asOfDate,
        horizonGames: String(horizonGames),
        ...(gameIds.length ? { gameIds: gameIds.join(",") } : {}),
        ...(bypassPreflight ? { bypassPreflight: "true" } : {}),
      },
    },
    asOfDate,
    startDate,
    endDate,
    horizonGames,
    chunkDays,
    resumeFromDate,
    nextStartDate: asOfDate,
    termination: {
      state: "resume_required",
      resumeRequired: true,
      nextStartDate: asOfDate,
    },
    pipeline,
    dependencyContract,
    compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
    preflight,
    observability: args.observability,
    scanSummary: buildProjectionRunScanSummary({
      status: "partial",
      requestedDate: asOfDate,
      activeDataDate: asOfDate,
      blockingIssueCount: 0,
      notes: [
        args.reason === "runtime_budget"
          ? "Stopped at the runtime budget; the next call for this date projects the remaining games."
          : "Another call is projecting this date; the next call continues the same run.",
      ],
      rowCounts: args.rowCounts,
    }),
    timedOut: args.reason === "runtime_budget",
    maxDurationMs: formatDurationMsToMMSS(budgetMs),
    durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
    ...(args.runId ? { runId: args.runId } : {}),
    ...(args.rowCounts.gamesProcessed != null
      ? {
          gamesProcessed: args.rowCounts.gamesProcessed,
          playerRowsUpserted: args.rowCounts.playerRowsUpserted,
          teamRowsUpserted: args.rowCounts.teamRowsUpserted,
          goalieRowsUpserted: args.rowCounts.goalieRowsUpserted,
        }
      : {}),
  });

  try {
    // A call resuming this scope's paused run already passed the route
    // preflight on its first call; the run's stage preflight still applies.
    if (
      !bypassPreflight &&
      rangeDates.length === 0 &&
      (await hasPausedResumableRun(asOfDate, horizonGames, gameIds))
    ) {
      preflightSkipped = "resumed_run";
      preflight = { ...defaultPreflight, asOfDate };
    } else {
      preflight = await runProjectionPreflightChecks(asOfDate, bypassPreflight);
    }

    if (rangeDates.length > 0) {
      const effectiveRangeStart =
        resumeFromDate &&
        resumeFromDate >= startDate &&
        resumeFromDate <= endDate
          ? resumeFromDate
          : startDate;
      const fullRangeDates = buildDateRange(effectiveRangeStart, endDate);
      const limitedRangeDates =
        chunkDays > 0 ? fullRangeDates.slice(0, chunkDays) : fullRangeDates;
      const chunkNextStartDate =
        chunkDays > 0 && fullRangeDates.length > limitedRangeDates.length
          ? (fullRangeDates[limitedRangeDates.length] ?? null)
          : null;
      const results: Array<{
        asOfDate: string;
        runId: string;
        gamesProcessed: number;
        playerRowsUpserted: number;
        teamRowsUpserted: number;
        goalieRowsUpserted: number;
        timedOut: boolean;
      }> = [];
      const rangePostRunFailures: Array<{ asOfDate: string; failure: PostRunFailure }> = [];
      for (const date of limitedRangeDates) {
        const rangePreflight = await runProjectionPreflightChecks(
          date,
          bypassPreflight,
        );
        const failedRangePreflightObservability = buildGoalieObservability({
          preflight: rangePreflight,
          gamesProcessed: results.reduce((sum, r) => sum + r.gamesProcessed, 0),
          goalieRowsProcessed: results.reduce(
            (sum, r) => sum + r.goalieRowsUpserted,
            0,
          ),
          skaterRowsProcessed: results.reduce(
            (sum, r) => sum + r.playerRowsUpserted,
            0,
          ),
        });
        if (rangePreflight.status === "FAIL") {
          const failedGateCount = countFailingPreflightGates(rangePreflight);
          return res.status(422).json(
            withTiming({
              success: false,
              error:
                "Preflight freshness checks failed for range date. Resolve upstream dependencies or use bypassPreflight=true.",
              preflight: rangePreflight,
              asOfDate: date,
              startDate: effectiveRangeStart,
              endDate,
              horizonGames,
              chunkDays,
              resumeFromDate,
              nextStartDate: date,
              termination: {
                state: "blocked",
                resumeRequired: true,
                nextStartDate: date,
              },
              pipeline,
              dependencyContract,
              compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
              observability: failedRangePreflightObservability,
              scanSummary: buildProjectionRunScanSummary({
                status: "blocked",
                requestedDate: date,
                activeDataDate: date,
                blockingIssueCount: failedGateCount,
                notes: [
                  "Projection run blocked by preflight freshness gates for requested range date.",
                ],
                rowCounts: {
                  gamesProcessed: results.reduce(
                    (sum, r) => sum + r.gamesProcessed,
                    0,
                  ),
                  playerRowsUpserted: results.reduce(
                    (sum, r) => sum + r.playerRowsUpserted,
                    0,
                  ),
                  teamRowsUpserted: results.reduce(
                    (sum, r) => sum + r.teamRowsUpserted,
                    0,
                  ),
                  goalieRowsUpserted: results.reduce(
                    (sum, r) => sum + r.goalieRowsUpserted,
                    0,
                  ),
                  processedDates: results.length,
                },
              }),
              timedOut: false,
              maxDurationMs: formatDurationMsToMMSS(budgetMs),
              durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
            }),
          );
        }
        const respondRangeTimedOut = () => {
          const timedOutObservability = buildGoalieObservability({
            preflight: rangePreflight,
            gamesProcessed: results.reduce(
              (sum, r) => sum + r.gamesProcessed,
              0,
            ),
            goalieRowsProcessed: results.reduce(
              (sum, r) => sum + r.goalieRowsUpserted,
              0,
            ),
            skaterRowsProcessed: results.reduce(
              (sum, r) => sum + r.playerRowsUpserted,
              0,
            ),
            zeroGoalieRowDates: results
              .filter((r) => r.goalieRowsUpserted === 0)
              .map((r) => r.asOfDate),
          });
          return res.status(200).json(
            withTiming({
              success: false,
              asOfDate: date,
              startDate: effectiveRangeStart,
              endDate,
              horizonGames,
              chunkDays,
              resumeFromDate,
              nextStartDate: date,
              termination: {
                state: "resume_required",
                resumeRequired: true,
                nextStartDate: date,
              },
              pipeline,
              dependencyContract,
              compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
              preflight: rangePreflight,
              observability: timedOutObservability,
              scanSummary: buildProjectionRunScanSummary({
                status: "partial",
                requestedDate: endDate,
                activeDataDate:
                  results[results.length - 1]?.asOfDate ?? effectiveRangeStart,
                blockingIssueCount: 0,
                notes: [
                  "Timed out before completing the requested projection range.",
                ],
                rowCounts: {
                  gamesProcessed: results.reduce(
                    (sum, r) => sum + r.gamesProcessed,
                    0,
                  ),
                  playerRowsUpserted: results.reduce(
                    (sum, r) => sum + r.playerRowsUpserted,
                    0,
                  ),
                  teamRowsUpserted: results.reduce(
                    (sum, r) => sum + r.teamRowsUpserted,
                    0,
                  ),
                  goalieRowsUpserted: results.reduce(
                    (sum, r) => sum + r.goalieRowsUpserted,
                    0,
                  ),
                  processedDates: results.length,
                },
              }),
              timedOut: true,
              maxDurationMs: formatDurationMsToMMSS(budgetMs),
              durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
              error: "Timed out",
              results,
              processedDates: results.map((r) => r.asOfDate),
            }),
          );
        };
        if (Date.now() > deadlineMs) return respondRangeTimedOut();
        const settled = await settleBeforeLimit(
          runProjectionV2ForDate(date, {
            deadlineMs,
            horizonGames,
          }),
          answerByMs,
        );
        if (!settled) return respondRangeTimedOut();
        const out = settled.value;
        if (out.postRunFailure) {
          rangePostRunFailures.push({ asOfDate: date, failure: out.postRunFailure });
        }
        results.push({
          asOfDate: date,
          runId: out.runId,
          gamesProcessed: out.gamesProcessed,
          playerRowsUpserted: out.playerRowsUpserted,
          teamRowsUpserted: out.teamRowsUpserted,
          goalieRowsUpserted: out.goalieRowsUpserted,
          timedOut: out.timedOut,
        });
      }
      const last = results[results.length - 1];
      const rangeObservability = buildGoalieObservability({
        preflight,
        gamesProcessed: results.reduce((sum, r) => sum + r.gamesProcessed, 0),
        goalieRowsProcessed: results.reduce(
          (sum, r) => sum + r.goalieRowsUpserted,
          0,
        ),
        skaterRowsProcessed: results.reduce(
          (sum, r) => sum + r.playerRowsUpserted,
          0,
        ),
        zeroGoalieRowDates: results
          .filter((r) => r.goalieRowsUpserted === 0)
          .map((r) => r.asOfDate),
      });
      return res.status(200).json(
        withTiming({
          success: true,
          asOfDate: last?.asOfDate ?? asOfDate,
          startDate: effectiveRangeStart,
          endDate,
          horizonGames,
          chunkDays,
          resumeFromDate,
          nextStartDate: chunkNextStartDate,
          termination: {
            state: chunkNextStartDate ? "resume_required" : "completed",
            resumeRequired: Boolean(chunkNextStartDate),
            nextStartDate: chunkNextStartDate,
          },
          pipeline,
          dependencyContract,
          compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
          preflight,
          observability: {
            ...rangeObservability,
            dataQualityWarnings: [
              ...rangeObservability.dataQualityWarnings,
              ...postRunFailureWarnings(rangePostRunFailures),
            ],
          },
          scanSummary: buildProjectionRunScanSummary({
            status: chunkNextStartDate ? "partial" : "ready",
            requestedDate: endDate,
            activeDataDate: last?.asOfDate ?? asOfDate,
            blockingIssueCount: 0,
            notes: [
              ...(chunkNextStartDate
                ? [
                    "Chunked range execution stopped before the requested end date.",
                  ]
                : []),
              ...postRunFailureWarnings(rangePostRunFailures).map(
                (warning) => warning.message,
              ),
            ],
            rowCounts: {
              gamesProcessed: results.reduce(
                (sum, r) => sum + r.gamesProcessed,
                0,
              ),
              playerRowsUpserted: results.reduce(
                (sum, r) => sum + r.playerRowsUpserted,
                0,
              ),
              teamRowsUpserted: results.reduce(
                (sum, r) => sum + r.teamRowsUpserted,
                0,
              ),
              goalieRowsUpserted: results.reduce(
                (sum, r) => sum + r.goalieRowsUpserted,
                0,
              ),
              processedDates: results.length,
            },
          }),
          timedOut: false,
          maxDurationMs: formatDurationMsToMMSS(budgetMs),
          durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
          runId: last?.runId ?? "",
          gamesProcessed: last?.gamesProcessed ?? 0,
          playerRowsUpserted: last?.playerRowsUpserted ?? 0,
          teamRowsUpserted: last?.teamRowsUpserted ?? 0,
          goalieRowsUpserted: last?.goalieRowsUpserted ?? 0,
          results,
          processedDates: results.map((r) => r.asOfDate),
        }),
      );
    }

    if (preflight.status === "FAIL") {
      const failedPreflightObservability = buildGoalieObservability({
        preflight,
        gamesProcessed: 0,
        goalieRowsProcessed: 0,
      });
      const failedGateCount = countFailingPreflightGates(preflight);
      return res.status(422).json(
        withTiming({
          success: false,
          error:
            "Preflight freshness checks failed. Resolve upstream dependencies or use bypassPreflight=true to override.",
          preflight,
          asOfDate,
          startDate,
          endDate,
          horizonGames,
          chunkDays,
          resumeFromDate,
          nextStartDate: asOfDate,
          termination: {
            state: "blocked",
            resumeRequired: true,
            nextStartDate: asOfDate,
          },
          pipeline,
          dependencyContract,
          compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
          observability: failedPreflightObservability,
          scanSummary: buildProjectionRunScanSummary({
            status: "blocked",
            requestedDate: asOfDate,
            activeDataDate: asOfDate,
            blockingIssueCount: failedGateCount,
            notes: ["Projection run blocked by preflight freshness gates."],
            rowCounts: {
              gamesProcessed: 0,
              playerRowsUpserted: 0,
              teamRowsUpserted: 0,
              goalieRowsUpserted: 0,
            },
          }),
          timedOut: false,
          maxDurationMs: formatDurationMsToMMSS(0),
          durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        }),
      );
    }

    const settled = await settleBeforeLimit(
      runProjectionV2ForDate(asOfDate, {
        deadlineMs,
        horizonGames,
        gameIds,
      }),
      answerByMs,
    );
    if (!settled) {
      // A step overran the deadline: answer before the platform kills the
      // function. Progress so far is checkpointed on the run.
      return res.status(207).json(
        withTiming(
          buildResumablePartialBody({
            reason: "runtime_budget",
            runId: null,
            resume: null,
            observability: buildGoalieObservability({
              preflight,
              gamesProcessed: 0,
              goalieRowsProcessed: 0,
            }),
            rowCounts: {},
          }),
        ),
      );
    }
    const out = settled.value;
    const singleRunObservability = buildGoalieObservability({
      preflight,
      gamesProcessed: out.gamesProcessed,
      goalieRowsProcessed: out.goalieRowsUpserted,
      skaterRowsProcessed: out.playerRowsUpserted,
    });
    if (out.timedOut && out.resume) {
      return res.status(207).json(
        withTiming(
          buildResumablePartialBody({
            reason: "runtime_budget",
            runId: out.runId,
            resume: out.resume,
            observability: singleRunObservability,
            rowCounts: {
              gamesProcessed: out.gamesProcessed,
              playerRowsUpserted: out.playerRowsUpserted,
              teamRowsUpserted: out.teamRowsUpserted,
              goalieRowsUpserted: out.goalieRowsUpserted,
            },
          }),
        ),
      );
    }
    if (out.timedOut) {
      return res.status(200).json(
        withTiming({
          success: false,
          asOfDate,
          startDate,
          endDate,
          horizonGames,
          chunkDays,
          resumeFromDate,
          nextStartDate: asOfDate,
          termination: {
            state: "resume_required",
            resumeRequired: true,
            nextStartDate: asOfDate,
          },
          pipeline,
          dependencyContract,
          compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
          preflight,
          observability: singleRunObservability,
          scanSummary: buildProjectionRunScanSummary({
            status: "partial",
            requestedDate: asOfDate,
            activeDataDate: asOfDate,
            blockingIssueCount: 0,
            notes: ["Timed out before the projection run completed."],
            rowCounts: {
              gamesProcessed: out.gamesProcessed,
              playerRowsUpserted: out.playerRowsUpserted,
              teamRowsUpserted: out.teamRowsUpserted,
              goalieRowsUpserted: out.goalieRowsUpserted,
            },
          }),
          timedOut: true,
          maxDurationMs: formatDurationMsToMMSS(budgetMs),
          durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
          runId: out.runId,
          gamesProcessed: out.gamesProcessed,
          playerRowsUpserted: out.playerRowsUpserted,
          teamRowsUpserted: out.teamRowsUpserted,
          goalieRowsUpserted: out.goalieRowsUpserted,
          error: "Timed out",
        }),
      );
    }
    const postRunWarnings = out.postRunFailure
      ? postRunFailureWarnings([{ asOfDate, failure: out.postRunFailure }])
      : [];
    return res.status(200).json(
      withTiming({
        success: true,
        asOfDate,
        startDate,
        endDate,
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: null,
        termination: {
          state: "completed",
          resumeRequired: false,
          nextStartDate: null,
        },
        pipeline,
        dependencyContract,
        compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
        preflight,
        observability: {
          ...singleRunObservability,
          dataQualityWarnings: [
            ...singleRunObservability.dataQualityWarnings,
            ...postRunWarnings,
          ],
        },
        ...(out.postRunFailure
          ? {
              postRun: {
                step: out.postRunFailure.step,
                status: "failed" as const,
                blocking: false as const,
                dependencyError: normalizeDependencyError(
                  out.postRunFailure.message,
                ),
              },
            }
          : {}),
        scanSummary: buildProjectionRunScanSummary({
          status: "ready",
          requestedDate: asOfDate,
          activeDataDate: asOfDate,
          blockingIssueCount: 0,
          notes: postRunWarnings.length
            ? postRunWarnings.map((warning) => warning.message)
            : undefined,
          rowCounts: {
            gamesProcessed: out.gamesProcessed,
            playerRowsUpserted: out.playerRowsUpserted,
            teamRowsUpserted: out.teamRowsUpserted,
            goalieRowsUpserted: out.goalieRowsUpserted,
          },
        }),
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        runId: out.runId,
        gamesProcessed: out.gamesProcessed,
        playerRowsUpserted: out.playerRowsUpserted,
        teamRowsUpserted: out.teamRowsUpserted,
        goalieRowsUpserted: out.goalieRowsUpserted,
      }),
    );
  } catch (e) {
    const baseObservability = buildGoalieObservability({
      preflight,
      gamesProcessed: 0,
      goalieRowsProcessed: 0,
    });
    if (
      rangeDates.length === 0 &&
      (e as { resumeInProgress?: unknown })?.resumeInProgress === true
    ) {
      // Another call holds this date's resumable run; try again after it stops.
      return res.status(207).json(
        withTiming(
          buildResumablePartialBody({
            reason: "run_in_progress_elsewhere",
            runId: null,
            resume: null,
            observability: baseObservability,
            rowCounts: {},
          }),
        ),
      );
    }
    const dependencyError = normalizeDependencyError(e);
    const statusCode =
      typeof (e as { statusCode?: unknown })?.statusCode === "number"
        ? Number((e as { statusCode?: number }).statusCode)
        : 500;
    return res.status(statusCode).json(
      withTiming({
        success: false,
        error: dependencyError.message,
        dependencyError,
        preflight,
        asOfDate,
        startDate,
        endDate,
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: null,
        termination: {
          state: "blocked",
          resumeRequired: true,
          nextStartDate: asOfDate,
        },
        pipeline,
        dependencyContract,
        compatibilityInventory: FORGE_COMPATIBILITY_INVENTORY,
        observability: {
          ...baseObservability,
          dataQualityWarnings: [
            ...baseObservability.dataQualityWarnings,
            {
              code: "dependency_error",
              message: dependencyError.message,
              detail: dependencyError.detail ?? undefined,
            },
          ],
        },
        scanSummary: buildProjectionRunScanSummary({
          status: "blocked",
          requestedDate: asOfDate,
          activeDataDate: asOfDate,
          blockingIssueCount: 1,
          notes: [dependencyError.message],
          rowCounts: {
            gamesProcessed: 0,
            playerRowsUpserted: 0,
            teamRowsUpserted: 0,
            goalieRowsUpserted: 0,
          },
        }),
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      }),
    );
  }
}

export default withCronJobAudit(adminOnly(withNhlOffSeasonSkip(handler as any)), {
  jobName: "run-projection-v2",
  includeFinalAuditReceipt: true,
});
