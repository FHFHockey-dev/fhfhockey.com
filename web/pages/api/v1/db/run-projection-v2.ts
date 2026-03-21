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
 *    - Defaults to `270000` (4.5 minutes) if not specified.
 *    - Example: `?maxDurationMs=120000`
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
 * - Errors during execution will result in a `500 Internal Server Error` with a descriptive error message.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { CronTimedResponse, withCronJobTiming } from "lib/cron/timingContract";
import {
  normalizeDependencyError,
  type NormalizedDependencyError
} from "lib/cron/normalizeDependencyError";
import { runProjectionV2ForDate } from "lib/projections/run-forge-projections";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { getGoalieForgePipelineSpec } from "lib/projections/goaliePipeline";
import supabase from "lib/supabase/server";

type PreflightGate = {
  gate_key: string;
  status: "PASS" | "FAIL";
  detail: string;
  action: string;
};

type PreflightSummary = {
  asOfDate: string;
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
  dataQualityWarnings: DataQualityWarning[];
};

type SeasonIdRow = {
  id: number | string | null;
};

type GoaliePlayerRow = {
  id: number;
  position: string | null;
};

type GoalieRosterRow = {
  playerId: number;
  teamId: number;
};

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
      gamesProcessed: number;
      playerRowsUpserted: number;
      teamRowsUpserted: number;
      goalieRowsUpserted: number;
      timedOut: false;
      maxDurationMs: string;
      durationMs: string;
      pipeline: ReturnType<typeof getGoalieForgePipelineSpec>;
      preflight: PreflightSummary;
      observability: GoalieObservability;
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
      timedOut: boolean;
      maxDurationMs: string;
      durationMs: string;
      pipeline: ReturnType<typeof getGoalieForgePipelineSpec>;
      preflight: PreflightSummary;
      observability: GoalieObservability;
      runId?: string;
      gamesProcessed?: number;
      playerRowsUpserted?: number;
      teamRowsUpserted?: number;
      goalieRowsUpserted?: number;
      error: string;
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
  return Math.max(1, Math.min(5, Math.floor(n)));
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

async function fetchSeasonIdForDate(asOfDate: string): Promise<number> {
  const asOfTimestamp = `${asOfDate}T23:59:59.999Z`;
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .lte("startDate", asOfTimestamp)
    .order("startDate", { ascending: false })
    .limit(1)
    .maybeSingle<SeasonIdRow>();
  if (error) throw error;
  const seasonId = Number(data?.id);
  if (!Number.isFinite(seasonId)) {
    throw new Error(`Unable to resolve season id for as_of_date=${asOfDate}`);
  }
  return seasonId;
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
    if (!Number.isFinite(row.playerId) || !Number.isFinite(row.teamId)) continue;
    const teamIds = rosterTeamsByPlayer.get(row.playerId) ?? new Set<number>();
    teamIds.add(row.teamId);
    rosterTeamsByPlayer.set(row.playerId, teamIds);
  }

  const goalieById = new Map(args.goaliePlayers.map((player) => [player.id, player]));
  const goalieCandidateIds = new Set(
    Array.from(args.latestGoaliesByTeam.values()).flat().filter((id) =>
      Number.isFinite(id)
    )
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
    nonGoaliePositionRows
  };
}

async function runProjectionPreflightChecks(
  asOfDate: string,
  bypassed: boolean
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
          action: "Remove bypassPreflight=true to enforce freshness checks."
        }
      ]
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
          action: "Ensure server-side Supabase credentials are configured."
        }
      ]
    };
  }

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
    new Set(scheduledGames.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
  );

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
      "Run /api/v1/db/update-games, /api/v1/db/update-teams, and /api/v1/db/update-players."
  });

  if (scheduledTeamIds.length > 0) {
    let missingLineComboTeams = 0;
    for (const teamId of scheduledTeamIds) {
      const { data, error } = await supabase
        .from("lineCombinations")
        .select("teamId,games!inner(date)")
        .eq("teamId", teamId)
        .lt("games.date", asOfDate)
        .order("date", { foreignTable: "games", ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) missingLineComboTeams += 1;
    }
    gates.push({
      gate_key: "line_combinations",
      status: missingLineComboTeams === 0 ? "PASS" : "FAIL",
      detail: `teams_checked=${scheduledTeamIds.length}, missing_recent_line_combos=${missingLineComboTeams}`,
      action: "Run /api/v1/db/update-line-combinations before projection execution."
    });
  } else {
    gates.push({
      gate_key: "line_combinations",
      status: "PASS",
      detail: "No scheduled games on requested date; skipping line combination coverage check.",
      action: "None."
    });
  }

  const recentWindowStart = addDays(asOfDate, -14);
  const { data: recentGames, error: recentGamesErr } = await supabase
    .from("games")
    .select("id")
    .gte("date", recentWindowStart)
    .lt("date", asOfDate);
  if (recentGamesErr) throw recentGamesErr;
  const recentGameIds = ((recentGames ?? []) as Array<{ id: number }>).map((g) => g.id);

  if (recentGameIds.length > 0) {
    const { count: pbpCount, error: pbpErr } = await supabase
      .from("pbp_games")
      .select("id", { count: "exact", head: true })
      .in("id", recentGameIds);
    if (pbpErr) throw pbpErr;
    const { count: shiftRows, error: shiftErr } = await supabase
      .from("shift_charts")
      .select("id", { count: "exact", head: true })
      .in("game_id", recentGameIds);
    if (shiftErr) throw shiftErr;
    const pbpCoverage = recentGameIds.length > 0 ? (pbpCount ?? 0) / recentGameIds.length : 0;
    gates.push({
      gate_key: "projection_input_ingest",
      status: pbpCoverage >= 0.8 && (shiftRows ?? 0) > 0 ? "PASS" : "FAIL",
      detail: `recent_games_14d=${recentGameIds.length}, pbp_games=${pbpCount ?? 0}, pbp_coverage=${pbpCoverage.toFixed(2)}, shift_rows=${shiftRows ?? 0}`,
      action: "Run /api/v1/db/ingest-projection-inputs for recent dates."
    });
  } else {
    gates.push({
      gate_key: "projection_input_ingest",
      status: "PASS",
      detail: "No prior 14-day games before requested date; ingest freshness not applicable.",
      action: "None."
    });
  }

  const derivedFreshnessStart = addDays(asOfDate, -7);
  const [playerDerived, teamDerived, goalieDerived] = await Promise.all([
    supabase
      .from("forge_player_game_strength")
      .select("game_date")
      .lt("game_date", asOfDate)
      .gte("game_date", derivedFreshnessStart)
      .order("game_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("forge_team_game_strength")
      .select("game_date")
      .lt("game_date", asOfDate)
      .gte("game_date", derivedFreshnessStart)
      .order("game_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("forge_goalie_game")
      .select("game_date")
      .lt("game_date", asOfDate)
      .gte("game_date", derivedFreshnessStart)
      .order("game_date", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  if (playerDerived.error) throw playerDerived.error;
  if (teamDerived.error) throw teamDerived.error;
  if (goalieDerived.error) throw goalieDerived.error;
  const derivedPass =
    Boolean((playerDerived.data as any)?.game_date) &&
    Boolean((teamDerived.data as any)?.game_date) &&
    Boolean((goalieDerived.data as any)?.game_date);
  gates.push({
    gate_key: "projection_derived_v2",
    status: derivedPass ? "PASS" : "FAIL",
    detail: `player_latest=${(playerDerived.data as any)?.game_date ?? "none"}, team_latest=${(teamDerived.data as any)?.game_date ?? "none"}, goalie_latest=${(goalieDerived.data as any)?.game_date ?? "none"}`,
    action: "Run /api/v1/db/build-projection-derived-v2 for recent dates."
  });

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
      action: `Run /api/v1/db/update-goalie-projections-v2?date=${asOfDate}.`
    });
  } else {
    gates.push({
      gate_key: "goalie_start_priors_v2",
      status: "PASS",
      detail: "No scheduled games on requested date; goalie start priors not required.",
      action: "None."
    });
  }

  // Stale-data detectors:
  // 1) Missing recent goalie-game rows for teams on the target slate.
  // 2) Outdated players.team_id mappings for likely goalie candidates from latest line combos.
  if (scheduledTeamIds.length > 0) {
    const seasonId = await fetchSeasonIdForDate(asOfDate);
    const staleWindowStart = addDays(asOfDate, -30);
    const { data: recentGoalieRows, error: recentGoalieErr } = await supabase
      .from("forge_goalie_game")
      .select("team_id,game_date")
      .in("team_id", scheduledTeamIds)
      .gte("game_date", staleWindowStart)
      .lt("game_date", asOfDate);
    if (recentGoalieErr) throw recentGoalieErr;
    const teamsWithRecentGoalieRows = new Set(
      ((recentGoalieRows ?? []) as Array<{ team_id: number | null }>)
        .map((r) => r.team_id)
        .filter((id): id is number => Number.isFinite(id))
    );
    const missingRecentGoalieTeams = scheduledTeamIds.filter(
      (teamId) => !teamsWithRecentGoalieRows.has(teamId)
    );
    gates.push({
      gate_key: "stale_goalie_game_rows",
      status: missingRecentGoalieTeams.length === 0 ? "PASS" : "FAIL",
      detail: `teams_checked=${scheduledTeamIds.length}, teams_missing_recent_goalie_rows=${missingRecentGoalieTeams.length}, stale_window_days=30`,
      action:
        "Run /api/v1/db/build-projection-derived-v2 for recent dates and verify source goalie game ingestion."
    });

    const recentGoalieCandidateIds = new Set<number>();
    const latestGoaliesByTeam = new Map<number, number[]>();
    for (const teamId of scheduledTeamIds) {
      const { data, error } = await supabase
        .from("lineCombinations")
        .select("goalies,games!inner(date)")
        .eq("teamId", teamId)
        .lt("games.date", asOfDate)
        .order("date", { foreignTable: "games", ascending: false })
        .limit(3);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ goalies: number[] | null }>;
      rows.forEach((row, index) => {
        const goalieIds = (row.goalies ?? []).filter((goalieId) =>
          Number.isFinite(goalieId)
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
        goalieRosters: (goalieRosters ?? []) as GoalieRosterRow[]
      });
      const rosterAssignmentDrift =
        assignmentSummary.mismatchedAssignments > 0;
      gates.push({
        gate_key: "outdated_player_team_assignments",
        status:
          assignmentSummary.nonGoaliePositionRows === 0 ? "PASS" : "FAIL",
        detail: `goalie_candidates_checked=${assignmentSummary.goalieCandidatesChecked}, mismatched_team_assignments=${assignmentSummary.mismatchedAssignments}, non_goalie_positions=${assignmentSummary.nonGoaliePositionRows}, season_id=${seasonId}`,
        action:
          "Refresh players/rosters and line combinations; verify current-season goalie roster assignments are present in rosters."
      });
      if (rosterAssignmentDrift) {
        gates.push({
          gate_key: "outdated_player_team_assignments_warning",
          status: "PASS",
          detail: `Roster drift warning only: ${assignmentSummary.mismatchedAssignments} latest line-combination goalie assignments are not present on current-season rosters.`,
          action:
            "Review recalled, reassigned, or traded goalie history if projection inputs look suspicious; this warning does not block the run."
        });
      }
    } else {
      gates.push({
        gate_key: "outdated_player_team_assignments",
        status: "PASS",
        detail: "No recent line-combination goalie candidates available for assignment validation.",
        action: "None."
      });
    }
  } else {
    gates.push({
      gate_key: "stale_goalie_game_rows",
      status: "PASS",
      detail: "No scheduled teams on requested date; stale goalie-row detector skipped.",
      action: "None."
    });
    gates.push({
      gate_key: "outdated_player_team_assignments",
      status: "PASS",
      detail: "No scheduled teams on requested date; team-assignment detector skipped.",
      action: "None."
    });
  }

  const failed = gates.some((g) => g.status === "FAIL");
  return {
    asOfDate,
    bypassed: false,
    status: failed ? "FAIL" : "PASS",
    gates
  };
}

function buildGoalieObservability(args: {
  preflight: PreflightSummary;
  gamesProcessed: number;
  goalieRowsProcessed: number;
  zeroGoalieRowDates?: string[];
}): GoalieObservability {
  const warnings: DataQualityWarning[] = [];
  const failedGates = args.preflight.gates.filter((g) => g.status === "FAIL");
  for (const gate of failedGates) {
    warnings.push({
      code: `preflight_${gate.gate_key}`,
      message: "Preflight dependency check failed.",
      detail: gate.detail
    });
  }
  const warningOnlyGates = args.preflight.gates.filter((g) =>
    g.gate_key.endsWith("_warning")
  );
  for (const gate of warningOnlyGates) {
    warnings.push({
      code: `preflight_${gate.gate_key}`,
      message: "Preflight data-quality warning.",
      detail: gate.detail
    });
  }

  if (args.gamesProcessed > 0 && args.goalieRowsProcessed === 0) {
    warnings.push({
      code: "goalie_rows_zero",
      message: "Projection run processed games but wrote zero goalie rows."
    });
  }

  if ((args.zeroGoalieRowDates?.length ?? 0) > 0) {
    warnings.push({
      code: "goalie_rows_zero_dates",
      message:
        "One or more processed dates wrote zero goalie rows in range execution.",
      detail: args.zeroGoalieRowDates!.slice(0, 5).join(", ")
    });
  }

  return {
    goalieRowsProcessed: args.goalieRowsProcessed,
    dataQualityWarnings: warnings
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronTimedResponse<Result>>
) {
  const startedAt = Date.now();
  const withTiming = (body: Result, endedAt = Date.now()) =>
    withCronJobTiming(body, startedAt, endedAt);
  const horizonGames = parseHorizonGames(getParam(req, "horizonGames"));
  const chunkDays = parseChunkDays(getParam(req, "chunkDays"));
  const resumeFromDate = parseDateParam(getParam(req, "resumeFromDate"));
  const pipeline = getGoalieForgePipelineSpec();
  const bypassPreflight = parseBooleanParam(getParam(req, "bypassPreflight"));
  const defaultPreflight: PreflightSummary = {
    asOfDate: "",
    bypassed: bypassPreflight,
    status: "PASS",
    gates: []
  };
  const defaultObservability: GoalieObservability = {
    goalieRowsProcessed: 0,
    dataQualityWarnings: []
  };
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .json(withTiming({
        success: false,
        asOfDate: "",
        startDate: "",
        endDate: "",
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: null,
        pipeline,
        preflight: defaultPreflight,
        observability: defaultObservability,
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(0),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        error: "Method not allowed"
      }));
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
    return res.status(400).json(withTiming({
      success: false,
      asOfDate: "",
      startDate: startDateParam ?? "",
      endDate: endDateParam ?? "",
      horizonGames,
      chunkDays,
      resumeFromDate,
      nextStartDate: null,
      pipeline,
      preflight: defaultPreflight,
      observability: defaultObservability,
      timedOut: false,
      maxDurationMs: formatDurationMsToMMSS(0),
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      error: "Invalid startDate/endDate range"
    }));
  }
  const asOfDate = dateParam ?? isoDateOnly(new Date().toISOString());
  const startDate = startDateParam ?? asOfDate;
  const endDate = endDateParam ?? asOfDate;
  const maxDurationMs = Number(getParam(req, "maxDurationMs") ?? 270_000);
  const budgetMs = Number.isFinite(maxDurationMs) ? maxDurationMs : 270_000;
  const deadlineMs = startedAt + budgetMs;
  let preflight = defaultPreflight;

  try {
    preflight = await runProjectionPreflightChecks(asOfDate, bypassPreflight);

    if (rangeDates.length > 0) {
      const effectiveRangeStart =
        resumeFromDate && resumeFromDate >= startDate && resumeFromDate <= endDate
          ? resumeFromDate
          : startDate;
      const fullRangeDates = buildDateRange(effectiveRangeStart, endDate);
      const limitedRangeDates =
        chunkDays > 0 ? fullRangeDates.slice(0, chunkDays) : fullRangeDates;
      const chunkNextStartDate =
        chunkDays > 0 && fullRangeDates.length > limitedRangeDates.length
          ? fullRangeDates[limitedRangeDates.length] ?? null
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
      for (const date of limitedRangeDates) {
        const rangePreflight = await runProjectionPreflightChecks(
          date,
          bypassPreflight
        );
        const failedRangePreflightObservability = buildGoalieObservability({
          preflight: rangePreflight,
          gamesProcessed: results.reduce((sum, r) => sum + r.gamesProcessed, 0),
          goalieRowsProcessed: results.reduce(
            (sum, r) => sum + r.goalieRowsUpserted,
            0
          )
        });
        if (rangePreflight.status === "FAIL") {
          return res.status(422).json(withTiming({
            success: false,
            asOfDate: date,
            startDate: effectiveRangeStart,
            endDate,
            horizonGames,
            chunkDays,
            resumeFromDate,
            nextStartDate: date,
            pipeline,
            preflight: rangePreflight,
            observability: failedRangePreflightObservability,
            timedOut: false,
            maxDurationMs: formatDurationMsToMMSS(budgetMs),
            durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
            error:
              "Preflight freshness checks failed for range date. Resolve upstream dependencies or use bypassPreflight=true."
          }));
        }
        if (Date.now() > deadlineMs) {
          const timedOutObservability = buildGoalieObservability({
            preflight: rangePreflight,
            gamesProcessed: results.reduce((sum, r) => sum + r.gamesProcessed, 0),
            goalieRowsProcessed: results.reduce(
              (sum, r) => sum + r.goalieRowsUpserted,
              0
            ),
            zeroGoalieRowDates: results
              .filter((r) => r.goalieRowsUpserted === 0)
              .map((r) => r.asOfDate)
          });
          return res.status(200).json(withTiming({
            success: false,
            asOfDate: date,
            startDate: effectiveRangeStart,
            endDate,
            horizonGames,
            chunkDays,
            resumeFromDate,
            nextStartDate: date,
            pipeline,
            preflight: rangePreflight,
            observability: timedOutObservability,
            timedOut: true,
            maxDurationMs: formatDurationMsToMMSS(budgetMs),
            durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
            error: "Timed out",
            results,
            processedDates: results.map((r) => r.asOfDate)
          }));
        }
        const out = await runProjectionV2ForDate(date, {
          deadlineMs,
          horizonGames
        });
        results.push({
          asOfDate: date,
          runId: out.runId,
          gamesProcessed: out.gamesProcessed,
          playerRowsUpserted: out.playerRowsUpserted,
          teamRowsUpserted: out.teamRowsUpserted,
          goalieRowsUpserted: out.goalieRowsUpserted,
          timedOut: out.timedOut
        });
      }
      const last = results[results.length - 1];
      const rangeObservability = buildGoalieObservability({
        preflight,
        gamesProcessed: results.reduce((sum, r) => sum + r.gamesProcessed, 0),
        goalieRowsProcessed: results.reduce(
          (sum, r) => sum + r.goalieRowsUpserted,
          0
        ),
        zeroGoalieRowDates: results
          .filter((r) => r.goalieRowsUpserted === 0)
          .map((r) => r.asOfDate)
      });
      return res.status(200).json(withTiming({
        success: true,
        asOfDate: last?.asOfDate ?? asOfDate,
        startDate: effectiveRangeStart,
        endDate,
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: chunkNextStartDate,
        pipeline,
        preflight,
        observability: rangeObservability,
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        runId: last?.runId ?? "",
        gamesProcessed: last?.gamesProcessed ?? 0,
        playerRowsUpserted: last?.playerRowsUpserted ?? 0,
        teamRowsUpserted: last?.teamRowsUpserted ?? 0,
        goalieRowsUpserted: last?.goalieRowsUpserted ?? 0,
        results,
        processedDates: results.map((r) => r.asOfDate)
      }));
    }

    if (preflight.status === "FAIL") {
      const failedPreflightObservability = buildGoalieObservability({
        preflight,
        gamesProcessed: 0,
        goalieRowsProcessed: 0
      });
      return res.status(422).json(withTiming({
        success: false,
        asOfDate,
        startDate,
        endDate,
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: asOfDate,
        pipeline,
        preflight,
        observability: failedPreflightObservability,
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(0),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        error:
          "Preflight freshness checks failed. Resolve upstream dependencies or use bypassPreflight=true to override."
      }));
    }

    const out = await runProjectionV2ForDate(asOfDate, {
      deadlineMs,
      horizonGames
    });
    const singleRunObservability = buildGoalieObservability({
      preflight,
      gamesProcessed: out.gamesProcessed,
      goalieRowsProcessed: out.goalieRowsUpserted
    });
    if (out.timedOut) {
      return res.status(200).json(withTiming({
        success: false,
        asOfDate,
        startDate,
        endDate,
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: asOfDate,
        pipeline,
        preflight,
        observability: singleRunObservability,
        timedOut: true,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        runId: out.runId,
        gamesProcessed: out.gamesProcessed,
        playerRowsUpserted: out.playerRowsUpserted,
        teamRowsUpserted: out.teamRowsUpserted,
        goalieRowsUpserted: out.goalieRowsUpserted,
        error: "Timed out"
      }));
    }
    return res
      .status(200)
      .json(withTiming({
        success: true,
        asOfDate,
        startDate,
        endDate,
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: null,
        pipeline,
        preflight,
        observability: singleRunObservability,
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        runId: out.runId,
        gamesProcessed: out.gamesProcessed,
        playerRowsUpserted: out.playerRowsUpserted,
        teamRowsUpserted: out.teamRowsUpserted,
        goalieRowsUpserted: out.goalieRowsUpserted
      }));
  } catch (e) {
    const dependencyError = normalizeDependencyError(e);
    const baseObservability = buildGoalieObservability({
      preflight,
      gamesProcessed: 0,
      goalieRowsProcessed: 0
    });
    return res
      .status(500)
      .json(withTiming({
        success: false,
        asOfDate,
        startDate,
        endDate,
        horizonGames,
        chunkDays,
        resumeFromDate,
        nextStartDate: null,
        pipeline,
        preflight,
        observability: {
          ...baseObservability,
          dataQualityWarnings: [
            ...baseObservability.dataQualityWarnings,
            {
              code: "dependency_error",
              message: dependencyError.message,
              detail: dependencyError.detail ?? undefined
            }
          ]
        },
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        error: dependencyError.message,
        dependencyError
      }));
  }
}

export default withCronJobAudit(handler, { jobName: "run-projection-v2" });
