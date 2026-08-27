import type { NextApiRequest, NextApiResponse } from "next";

import { buildResolvedDataServingContract } from "lib/dashboard/freshness";
import { getLatestStartedSeasonForDate } from "lib/NHL/server";
import { teamsInfo } from "lib/teamsInfo";
import { evaluateForgeCalibrationEligibility } from "lib/projections/calibrationEligibility";
import { buildStartChartCompatibility } from "lib/projections/compatibilityInventory";
import {
  extractDegradedProjectionContext,
  extractProjectionRange,
  extractSkaterConfidenceDrivers,
  extractSkaterModelMetadata,
} from "lib/projections/forgeSkaterContext";
import { buildGoalieStarterMixtureRows } from "lib/projections/goalieStarterMixtures";
import {
  normalizeStartChartResponse,
  type StartChartPlayerContext,
  type StartChartSourceStatus,
} from "lib/projections/startChartContract";
import {
  addStartChartPositionRanks,
  computeStartChartFantasyPoints,
  START_CHART_FANTASY_SCORING_CONTRACT,
  START_CHART_RANKING_CONTRACT,
} from "lib/projections/startChartFantasyScoring";
import { requireLatestSucceededRunId } from "lib/projections/apiHelpers";
import supabase from "lib/supabase/server";
import {
  fetchTeamRatingsAsOf,
  type TeamRating as TeamPowerRating,
} from "lib/teamRatingsService";

type ProjectionRow = {
  run_id: string;
  as_of_date: string;
  horizon_games: number;
  player_id: number;
  team_id: number;
  game_id: number;
  opponent_team_id: number;
  proj_goals_es: number | null;
  proj_goals_pp: number | null;
  proj_goals_pk: number | null;
  proj_assists_es: number | null;
  proj_assists_pp: number | null;
  proj_assists_pk: number | null;
  proj_shots_es: number | null;
  proj_shots_pp: number | null;
  proj_shots_pk: number | null;
  proj_hits: number | null;
  proj_blocks: number | null;
  proj_pim: number | null;
  proj_toi_es_seconds: number | null;
  proj_toi_pp_seconds: number | null;
  proj_toi_pk_seconds: number | null;
  uncertainty: unknown;
  players?: { fullName?: string | null; position?: string | null } | null;
};

type GoalieRow = {
  game_id: number;
  team_id: number;
  player_id: number;
  game_date: string | null;
  start_probability: number | null;
  projected_gsaa_per_60: number | null;
  confirmed_status: boolean | null;
  l10_start_pct: number | null;
  season_start_pct: number | null;
  games_played: number | null;
  updated_at: string | null;
};

type GameRow = {
  id: number;
  date: string;
  startTime: string | null;
  homeTeamId: number;
  awayTeamId: number;
};

type YahooPlayerRow = {
  player_id: string | null;
  player_name: string | null;
  full_name: string | null;
  eligible_positions: string[] | null;
  percent_ownership: number | null;
  ownership_timeline: unknown;
  last_updated: string | null;
};

type CanonicalPlayerRow = {
  id: number;
  fullName: string;
  position: string;
};

type ForgeRunRow = {
  run_id: string;
  as_of_date: string;
  created_at: string;
  updated_at: string;
  git_sha: string | null;
  metrics: unknown;
};

type CtpiRow = {
  date: string;
  team: string;
  ctpi_0_to_100: number | null;
};

type StartChartRequest = {
  date: string;
  mode: "points";
  profile: string;
  position: string | null;
  modelVersion: "latest";
  page: number;
  pageSize: number;
  paginationRequested: boolean;
};

type QueryError = {
  status: number;
  code: "invalid_parameter" | "control_unavailable";
  field: string;
  message: string;
};

type SlateResult = {
  games: GameRow[];
  projections: ProjectionRow[];
  goalies: GoalieRow[];
  runId: string | null;
  projectionError: boolean;
  goalieError: boolean;
};

const RESPONSE_TTL_MS = 60_000;
const MAX_RESPONSE_CACHE_ENTRIES = 64;
const SUPPORTED_POSITIONS = new Set(["C", "LW", "RW", "D", "G"]);
const responseCache = new Map<string, { expiresAt: number; payload: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const easternDate = (now = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
};

const singleQueryValue = (
  value: string | string[] | undefined,
): string | null => (typeof value === "string" ? value : null);

function parseStartChartRequest(
  query: NextApiRequest["query"],
  today: string,
): { value: StartChartRequest } | { error: QueryError } {
  for (const field of [
    "date",
    "mode",
    "profile",
    "position",
    "model_version",
    "page",
    "page_size",
    "tau",
    "risk",
  ] as const) {
    if (Array.isArray(query[field])) {
      return {
        error: {
          status: 400,
          code: "invalid_parameter",
          field,
          message: `${field} must be provided at most once`,
        },
      };
    }
  }

  const date = singleQueryValue(query.date) ?? today;
  if (!isCalendarDate(date)) {
    return {
      error: {
        status: 400,
        code: "invalid_parameter",
        field: "date",
        message: "date must be a real calendar date in YYYY-MM-DD format",
      },
    };
  }

  const mode = singleQueryValue(query.mode) ?? "points";
  if (mode !== "points") {
    return {
      error: {
        status: 422,
        code: "control_unavailable",
        field: "mode",
        message: "Only points mode is currently available",
      },
    };
  }

  const profile =
    singleQueryValue(query.profile) ??
    START_CHART_FANTASY_SCORING_CONTRACT.version;
  if (profile !== START_CHART_FANTASY_SCORING_CONTRACT.version) {
    return {
      error: {
        status: 422,
        code: "control_unavailable",
        field: "profile",
        message: `Only ${START_CHART_FANTASY_SCORING_CONTRACT.version} is currently available`,
      },
    };
  }

  for (const field of ["tau", "risk"] as const) {
    if (query[field] !== undefined) {
      return {
        error: {
          status: 422,
          code: "control_unavailable",
          field,
          message: `${field} is owned by the canonical FORGE model and is not a Start Chart override`,
        },
      };
    }
  }

  const modelVersion = singleQueryValue(query.model_version) ?? "latest";
  if (modelVersion !== "latest") {
    return {
      error: {
        status: 422,
        code: "control_unavailable",
        field: "model_version",
        message: "Start Chart serves the latest succeeded canonical FORGE run",
      },
    };
  }

  const position = singleQueryValue(query.position)?.toUpperCase() ?? null;
  if (position && !SUPPORTED_POSITIONS.has(position)) {
    return {
      error: {
        status: 400,
        code: "invalid_parameter",
        field: "position",
        message: "position must be one of C, LW, RW, D, or G",
      },
    };
  }

  const paginationRequested =
    query.page !== undefined || query.page_size !== undefined;
  const page = Number(singleQueryValue(query.page) ?? "1");
  const pageSize = Number(singleQueryValue(query.page_size) ?? "100");
  if (!Number.isInteger(page) || page < 1) {
    return {
      error: {
        status: 400,
        code: "invalid_parameter",
        field: "page",
        message: "page must be a positive integer",
      },
    };
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    return {
      error: {
        status: 400,
        code: "invalid_parameter",
        field: "page_size",
        message: "page_size must be an integer from 1 through 200",
      },
    };
  }

  return {
    value: {
      date,
      mode: "points",
      profile,
      position,
      modelVersion: "latest",
      page,
      pageSize,
      paginationRequested,
    },
  };
}

const shiftDate = (dateStr: string, days: number): string => {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === "object" ? (value as Record<string, any>) : {};

const finiteOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseOwnershipAsOf = (
  row: YahooPlayerRow,
  targetDate: string,
): { value: number | null; asOfDate: string | null } => {
  const timeline = Array.isArray(row.ownership_timeline)
    ? row.ownership_timeline
        .flatMap((point: any) => {
          const date =
            typeof point?.date === "string" ? point.date.slice(0, 10) : null;
          if (!date || !isCalendarDate(date) || date > targetDate) return [];
          for (const key of ["percent", "ownership", "value", "pct"]) {
            const numeric = Number(point?.[key]);
            if (point?.[key] !== null && Number.isFinite(numeric)) {
              return [{ date, value: numeric }];
            }
          }
          return [];
        })
        .sort((left: { date: string }, right: { date: string }) =>
          right.date.localeCompare(left.date),
        )
    : [];
  if (timeline[0]) {
    return { value: timeline[0].value, asOfDate: timeline[0].date };
  }

  const lastUpdatedDate = row.last_updated?.slice(0, 10) ?? null;
  if (
    lastUpdatedDate &&
    isCalendarDate(lastUpdatedDate) &&
    lastUpdatedDate <= targetDate &&
    Number.isFinite(Number(row.percent_ownership))
  ) {
    return { value: Number(row.percent_ownership), asOfDate: lastUpdatedDate };
  }
  return { value: null, asOfDate: null };
};

const parsePositions = (value: unknown): string[] => {
  const positions = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.split(",").map((position) => position.trim())
      : [];
  return Array.from(
    new Set(
      positions
        .map((position) => position.toUpperCase())
        .filter((position) => SUPPORTED_POSITIONS.has(position)),
    ),
  );
};

const canonicalPositions = (position: string | null | undefined): string[] => {
  const normalized = position?.toUpperCase();
  if (normalized === "L") return ["LW"];
  if (normalized === "R") return ["RW"];
  return normalized && SUPPORTED_POSITIONS.has(normalized) ? [normalized] : [];
};

const findAbbrev = (teamId: number): string | null => {
  const team = Object.values(teamsInfo).find((candidate) => candidate.id === teamId);
  return team?.abbrev ?? null;
};

export const computeDefenseEaseGrades = (
  ratings: TeamPowerRating[],
): Map<string, number> => {
  const rows = ratings
    .flatMap((rating) => {
      const xga60 = finiteOrNull(rating.components?.xga60);
      return xga60 != null
        ? [{ teamAbbr: rating.teamAbbr, xga60 }]
        : [];
    })
    .sort(
      (left, right) =>
        left.xga60 - right.xga60 || left.teamAbbr.localeCompare(right.teamAbbr),
    );
  if (rows.length === 0) return new Map();
  if (rows.length === 1) return new Map([[rows[0].teamAbbr, 50]]);

  const grades = new Map<string, number>();
  let index = 0;
  while (index < rows.length) {
    let end = index;
    while (end + 1 < rows.length && rows[end + 1].xga60 === rows[index].xga60) {
      end += 1;
    }
    const averageRank = (index + end) / 2;
    const grade = (averageRank / (rows.length - 1)) * 100;
    for (let cursor = index; cursor <= end; cursor += 1) {
      grades.set(rows[cursor].teamAbbr, Number(grade.toFixed(3)));
    }
    index = end + 1;
  }
  return grades;
};

// State rows use null for a non-participating state; only an all-null stat is unavailable.
export const sumProjectionParts = (
  ...values: Array<number | null>
): number | null =>
  values.every((value) => value == null)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);

const buildRowKey = (row: {
  run_id?: string | null;
  game_id: number;
  player_id: number;
  horizon_games?: number;
}): string =>
  [row.run_id ?? "goalie", row.game_id, row.player_id, row.horizon_games ?? 1].join(
    ":",
  );

const emptyPlayerContext = (): StartChartPlayerContext => ({
  es_role: null,
  unit_tier: null,
  pp_share: null,
  role_probability: null,
  role_continuity: null,
  opponent_defense_edge: null,
  goalie_goal_rate_multiplier: null,
  goalie_starter_certainty: null,
  rest_delta: null,
  trend_effect: null,
  projection_low: null,
  projection_high: null,
  flags: [],
});

const buildPlayerContext = (uncertainty: unknown): StartChartPlayerContext => {
  const drivers = extractSkaterConfidenceDrivers(uncertainty);
  const range = extractProjectionRange(uncertainty);
  const degraded = extractDegradedProjectionContext(uncertainty);
  return {
    es_role: drivers.role.evenStrength,
    unit_tier: drivers.role.unitTier,
    pp_share: drivers.powerPlay.allocatedShare,
    role_probability: drivers.role.topScenarioProbability,
    role_continuity: drivers.role.continuityShare,
    opponent_defense_edge: drivers.matchup.opponentDefenseEdge,
    goalie_goal_rate_multiplier:
      drivers.matchup.opponentGoalieGoalRateMultiplier,
    goalie_starter_certainty: drivers.matchup.opponentStarterCertainty,
    rest_delta: drivers.rest.restDelta,
    trend_effect: drivers.trend.effectState,
    projection_low: range.points.floor,
    projection_high: range.points.ceiling,
    flags: [
      degraded?.usedLineComboFallback ? "line_combo_fallback" : null,
      degraded?.lineComboRecencyClass === "HARD_STALE"
        ? "hard_stale_line_combo"
        : null,
      degraded?.lineComboRecencyClass === "SOFT_STALE"
        ? "soft_stale_line_combo"
        : null,
      degraded?.skaterPoolRecoveryPath ? "skater_pool_recovery" : null,
    ].filter((value): value is string => value != null),
  };
};

async function fetchSlate(
  targetDate: string,
  exactRunId?: string,
): Promise<SlateResult> {
  const gamesPromise = supabase
    .from("games")
    .select("id,date,startTime,homeTeamId,awayTeamId")
    .eq("date", targetDate)
    .order("id", { ascending: true });
  const runIdPromise = exactRunId
    ? Promise.resolve(exactRunId)
    : requireLatestSucceededRunId(targetDate).catch((error) => {
        if ((error as any)?.statusCode === 404) return null;
        throw error;
      });
  const [{ data: gamesData, error: gamesError }, runId] = await Promise.all([
    gamesPromise,
    runIdPromise,
  ]);
  if (gamesError) throw gamesError;
  const games = (gamesData ?? []) as GameRow[];
  if (games.length === 0) {
    return {
      games,
      projections: [],
      goalies: [],
      runId: null,
      projectionError: false,
      goalieError: false,
    };
  }

  const gameIds = games.map((game) => game.id);
  const endOfTargetDate = `${targetDate}T23:59:59.999Z`;
  const goaliePromise = supabase
    .from("goalie_start_projections")
    .select(
      "game_id,team_id,player_id,game_date,start_probability,projected_gsaa_per_60,confirmed_status,l10_start_pct,season_start_pct,games_played,updated_at",
    )
    .in("game_id", gameIds)
    .eq("game_date", targetDate)
    .lte("updated_at", endOfTargetDate);

  const projectionPromise = runId
    ? supabase
        .from("forge_player_projections")
        .select(
          `
          run_id,
          as_of_date,
          horizon_games,
          player_id,
          team_id,
          game_id,
          opponent_team_id,
          proj_goals_es,
          proj_goals_pp,
          proj_goals_pk,
          proj_assists_es,
          proj_assists_pp,
          proj_assists_pk,
          proj_shots_es,
          proj_shots_pp,
          proj_shots_pk,
          proj_hits,
          proj_blocks,
          proj_pim,
          proj_toi_es_seconds,
          proj_toi_pp_seconds,
          proj_toi_pk_seconds,
          uncertainty,
          players!player_id (fullName, position)
          `,
        )
        .eq("run_id", runId)
        .eq("horizon_games", 1)
        .in("game_id", gameIds)
    : Promise.resolve({ data: [], error: null });
  const [projectionResponse, goalieResponse] = await Promise.all([
    projectionPromise,
    goaliePromise,
  ]);
  const projectionError = Boolean(projectionResponse.error);
  const projections = projectionResponse.error
    ? []
    : ((projectionResponse.data ?? []) as unknown as ProjectionRow[]);

  return {
    games,
    projections,
    goalies: goalieResponse.error
      ? []
      : ((goalieResponse.data ?? []) as GoalieRow[]),
    runId,
    projectionError,
    goalieError: Boolean(goalieResponse.error),
  };
}

async function fetchFallbackRunWithPlayerData(
  targetDate: string,
  seasonStartDate: string,
): Promise<{ runId: string; asOfDate: string } | null> {
  const pageSize = 100;
  for (let from = 0; ; from += pageSize) {
    const { data: candidates, error: candidatesError } = await supabase
      .from("forge_runs")
      .select("run_id,as_of_date")
      .eq("status", "succeeded")
      .lte("as_of_date", targetDate)
      .gte("as_of_date", seasonStartDate)
      .order("as_of_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("run_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (candidatesError) throw candidatesError;
    const candidateRows = (candidates ?? []) as Array<{
      run_id: string;
      as_of_date: string;
    }>;

    const candidateDates = Array.from(
      new Set(candidateRows.map((row) => row.as_of_date)),
    );
    const gamesByDate = new Map<string, number[]>();
    if (candidateDates.length > 0) {
      const { data: games, error: gamesError } = await supabase
        .from("games")
        .select("id,date")
        .in("date", candidateDates)
        .order("date", { ascending: false })
        .order("id", { ascending: true });
      if (gamesError) throw gamesError;
      for (const game of games ?? []) {
        const date = String(game.date);
        const ids = gamesByDate.get(date) ?? [];
        ids.push(Number(game.id));
        gamesByDate.set(date, ids);
      }
    }

    for (const row of candidateRows) {
      const gameIds = gamesByDate.get(row.as_of_date) ?? [];
      if (gameIds.length === 0) continue;

      const { data: projections, error } = await supabase
        .from("forge_player_projections")
        .select("player_id,game_id")
        .eq("run_id", row.run_id)
        .eq("horizon_games", 1)
        .in("game_id", gameIds)
        .limit(1);
      if (error) throw error;
      if ((projections ?? []).length > 0) {
        return { runId: row.run_id, asOfDate: row.as_of_date };
      }
    }
    if (candidateRows.length < pageSize) break;
  }
  return null;
}

async function fetchForgeRun(runId: string | null): Promise<ForgeRunRow | null> {
  if (!runId) return null;
  const { data, error } = await supabase
    .from("forge_runs")
    .select("run_id,as_of_date,created_at,updated_at,git_sha,metrics")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw error;
  return (data as ForgeRunRow | null) ?? null;
}

async function fetchCtpiRows(
  startDate: string,
  endDate: string,
  teams: string[],
): Promise<CtpiRow[]> {
  if (teams.length === 0) return [];
  const pageSize = 500;
  const rows: CtpiRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("team_ctpi_daily")
      .select("date,team,ctpi_0_to_100")
      .gte("date", startDate)
      .lte("date", endDate)
      .in("team", teams)
      .order("date", { ascending: true })
      .order("team", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const pageRows = (data ?? []) as CtpiRow[];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return rows;
}

function cachePayload(key: string, payload: unknown): void {
  const now = Date.now();
  for (const [cachedKey, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(cachedKey);
  }
  while (responseCache.size >= MAX_RESPONSE_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (typeof oldest !== "string") break;
    responseCache.delete(oldest);
  }
  responseCache.set(key, { payload, expiresAt: now + RESPONSE_TTL_MS });
}

export function clearStartChartCache(): void {
  responseCache.clear();
  inFlight.clear();
}

export function getStartChartCacheDiagnostics(): {
  responseEntries: number;
  inFlightEntries: number;
  maxResponseEntries: number;
} {
  return {
    responseEntries: responseCache.size,
    inFlightEntries: inFlight.size,
    maxResponseEntries: MAX_RESPONSE_CACHE_ENTRIES,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsedRequest = parseStartChartRequest(req.query, easternDate());
  if ("error" in parsedRequest) {
    const { status, ...error } = parsedRequest.error;
    return res.status(status).json({ error });
  }

  const request = parsedRequest.value;
  const requestedDate = request.date;
  const cacheKey = [
    `date:${requestedDate}`,
    `position:${request.position ?? "all"}`,
    `page:${request.paginationRequested ? request.page : "all"}`,
    `pageSize:${request.paginationRequested ? request.pageSize : "all"}`,
  ].join("|");

  try {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
      return res.status(200).json(cached.payload);
    }

    const pending = inFlight.get(cacheKey);
    if (pending) {
      const payload = await pending;
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
      return res.status(200).json(payload);
    }

    const loadPromise = (async () => {
      const [season, requestedSlate] = await Promise.all([
        getLatestStartedSeasonForDate(requestedDate, supabase),
        fetchSlate(requestedDate),
      ]);
      const seasonId = Number(season?.id);
      if (!Number.isSafeInteger(seasonId) || seasonId <= 0) {
        throw new Error(`Unable to resolve season for Start Chart date=${requestedDate}`);
      }
      const yahooSeason = Number(String(seasonId).slice(0, 4));
      const seasonStartDate = String(season?.startDate ?? requestedDate).slice(0, 10);

      let slate = requestedSlate;
      let resolvedDate = requestedDate;
      let fallbackApplied = false;
      let fallbackStrategy:
        | "requested_date"
        | "previous_date_with_games"
        | "latest_available_with_data" = "requested_date";

      if (requestedSlate.games.length === 0) {
        const previousDate = shiftDate(requestedDate, -1);
        const previousSlate =
          previousDate >= seasonStartDate
            ? await fetchSlate(previousDate)
            : null;
        if (
          previousSlate &&
          previousSlate.games.length > 0 &&
          previousSlate.projections.length > 0
        ) {
          slate = previousSlate;
          resolvedDate = previousDate;
          fallbackApplied = true;
          fallbackStrategy = "previous_date_with_games";
        } else {
          const fallback = await fetchFallbackRunWithPlayerData(
            requestedDate,
            seasonStartDate,
          );
          if (fallback) {
            const fallbackSlate = await fetchSlate(
              fallback.asOfDate,
              fallback.runId,
            );
            if (
              fallbackSlate.games.length > 0 &&
              fallbackSlate.projections.length > 0
            ) {
              slate = fallbackSlate;
              resolvedDate = fallback.asOfDate;
              fallbackApplied = resolvedDate !== requestedDate;
              fallbackStrategy =
                shiftDate(requestedDate, -1) === resolvedDate
                  ? "previous_date_with_games"
                  : "latest_available_with_data";
            }
          }
        }
      }

      const servingMode =
        slate.games.length === 0
          ? "no_games"
          : fallbackApplied
            ? "fallback"
            : slate.projections.length === 0 || slate.projectionError
              ? "partial"
              : "exact";
      const baseServing = buildResolvedDataServingContract({
        requestedDate,
        resolvedDate,
        fallbackApplied,
        strategy: fallbackApplied ? fallbackStrategy : "requested_date",
        requestedScheduledGames: requestedSlate.games.length,
        resolvedScheduledGames: slate.games.length,
        sourceLabel: "Start-chart slate",
      });
      const servingReason =
        servingMode === "partial"
          ? "scheduled_games_missing_projections"
          : servingMode === "no_games"
            ? "no_scheduled_games_or_eligible_fallback"
            : fallbackApplied
              ? fallbackStrategy
              : null;
      const serving = {
        ...baseServing,
        mode: servingMode,
        reason: servingReason,
        ageDays: baseServing.gapDays,
        message:
          baseServing.message ??
          (servingMode === "partial"
            ? `Games are scheduled for ${resolvedDate}, but canonical one-game skater projections are unavailable.`
            : servingMode === "no_games"
              ? `No scheduled games or eligible same-season projection fallback is available for ${requestedDate}.`
              : null),
      };

      const gameMap = new Map(slate.games.map((game) => [game.id, game] as const));
      const slateTeamIds = Array.from(
        new Set(
          slate.games.flatMap((game) => [game.homeTeamId, game.awayTeamId]),
        ),
      );
      const slateTeamAbbrevs = slateTeamIds
        .map(findAbbrev)
        .filter((value): value is string => value != null);
      const weekStart = new Date(`${resolvedDate}T00:00:00Z`);
      const daysUntilSunday =
        weekStart.getUTCDay() === 0 ? 0 : 7 - weekStart.getUTCDay();
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + daysUntilSunday);
      const weekEndDate = weekEnd.toISOString().slice(0, 10);
      const ratingsPromise = fetchTeamRatingsAsOf(resolvedDate)
        .then((result) => ({ ...result, error: false as const }))
        .catch(() => ({
          requestedDate: resolvedDate,
          resolvedDate: null,
          ratings: [] as TeamPowerRating[],
          error: true as const,
        }));
      const ctpiPromise = fetchCtpiRows(
        shiftDate(resolvedDate, -30),
        resolvedDate,
        slateTeamAbbrevs,
      )
        .then((rows) => ({ rows, error: false as const }))
        .catch(() => ({ rows: [] as CtpiRow[], error: true as const }));
      const weekGamesPromise = supabase
        .from("games")
        .select("id,date,homeTeamId,awayTeamId")
        .gte("date", resolvedDate)
        .lte("date", weekEndDate);
      const forgeRunPromise = fetchForgeRun(slate.runId);

      const playerIds = Array.from(
        new Set([
          ...slate.projections.map((row) => row.player_id),
          ...slate.goalies.map((row) => row.player_id),
        ]),
      );
      const canonicalPlayersPromise =
        playerIds.length > 0
          ? supabase
              .from("players")
              .select("id,fullName,position")
              .in("id", playerIds)
          : Promise.resolve({ data: [], error: null });
      const mappingPromise =
        playerIds.length > 0
          ? supabase
              .from("yahoo_nhl_player_map_read")
              .select("nhl_player_id,yahoo_player_id")
              .in("nhl_player_id", playerIds.map(String))
          : Promise.resolve({ data: [], error: null });
      const [canonicalResponse, mappingResponse] = await Promise.all([
        canonicalPlayersPromise,
        mappingPromise,
      ]);
      if (canonicalResponse.error) throw canonicalResponse.error;
      const canonicalPlayers = (canonicalResponse.data ?? []) as CanonicalPlayerRow[];
      const canonicalPlayerMap = new Map(
        canonicalPlayers.map((player) => [player.id, player] as const),
      );

      const mappingFailed = Boolean(mappingResponse.error);
      let yahooFailed = false;
      const mappingRows = mappingResponse.error ? [] : (mappingResponse.data ?? []);
      const nhlToYahoo = new Map<number, number>();
      for (const row of mappingRows) {
        const nhl = Number(row.nhl_player_id);
        const yahoo = Number(row.yahoo_player_id);
        if (Number.isFinite(nhl) && Number.isFinite(yahoo)) {
          nhlToYahoo.set(nhl, yahoo);
        }
      }

      const yahooPlayerIds = Array.from(new Set(nhlToYahoo.values()));
      let yahooPlayers: YahooPlayerRow[] = [];
      if (yahooPlayerIds.length > 0) {
        const response = await supabase
          .from("yahoo_players_with_normalized_history")
          .select(
            "player_id,player_name,full_name,eligible_positions,percent_ownership,last_updated,ownership_timeline:normalized_ownership_timeline",
          )
          .eq("season", yahooSeason)
          .in("player_id", yahooPlayerIds.map(String));
        yahooFailed = Boolean(response.error);
        yahooPlayers = response.error
          ? []
          : ((response.data ?? []) as YahooPlayerRow[]);
      }
      const yahooMap = new Map(
        yahooPlayers.flatMap((row) => {
          const id = Number(row.player_id);
          return Number.isFinite(id) ? ([[id, row]] as const) : [];
        }),
      );

      const [ratingsResult, ctpiResult, weekGamesResponse, forgeRun] =
        await Promise.all([
          ratingsPromise,
          ctpiPromise,
          weekGamesPromise,
          forgeRunPromise,
        ]);
      const ratings = ratingsResult.ratings;
      const ratingsResolvedDate = ratingsResult.resolvedDate;
      const ratingsError = ratingsResult.error;
      const ratingsByAbbrev = new Map(
        ratings.map((rating) => [rating.teamAbbr, rating] as const),
      );
      const defenseEaseGrades = computeDefenseEaseGrades(
        ratings.filter((rating) => slateTeamAbbrevs.includes(rating.teamAbbr)),
      );

      const targetEndMs = Date.parse(`${resolvedDate}T23:59:59.999Z`);
      const goalieAsOfTimestamp = new Date(
        Math.min(Date.now(), Number.isFinite(targetEndMs) ? targetEndMs : Date.now()),
      ).toISOString();
      const goalieMixtures = buildGoalieStarterMixtureRows({
        projections: slate.goalies,
        asOfTimestamp: goalieAsOfTimestamp,
      });
      const goalieMixtureMap = new Map(
        goalieMixtures.map((row) => [
          `${row.game_id}:${row.team_id}:${row.goalie_id}`,
          row,
        ]),
      );
      const normalizedGoalies = slate.goalies.map((goalie) => {
        const mixture = goalieMixtureMap.get(
          `${goalie.game_id}:${goalie.team_id}:${goalie.player_id}`,
        );
        return {
          ...goalie,
          start_probability:
            mixture?.normalized_start_probability ?? goalie.start_probability,
          source_updated_at: mixture?.source_updated_at ?? goalie.updated_at,
          source_confidence: mixture?.source_confidence ?? null,
          is_stale: mixture?.is_stale ?? false,
          is_hard_stale: mixture?.is_hard_stale ?? false,
        };
      });

      const ownershipDates: string[] = [];
      const mappedNhlPlayerIds = new Set<number>();
      const ownershipPlayerIdsWithAsOf = new Set<number>();
      const ownershipFor = (playerId: number) => {
        const yahooId = nhlToYahoo.get(playerId);
        const yahooPlayer = yahooId ? yahooMap.get(yahooId) : undefined;
        if (yahooPlayer) mappedNhlPlayerIds.add(playerId);
        const ownership = yahooPlayer
          ? parseOwnershipAsOf(yahooPlayer, resolvedDate)
          : { value: null, asOfDate: null };
        if (ownership.asOfDate) {
          ownershipDates.push(ownership.asOfDate);
          ownershipPlayerIdsWithAsOf.add(playerId);
        }
        return { yahooPlayer, ownership };
      };

      const players: Array<any> = [];
      for (const projection of slate.projections) {
        if (!gameMap.has(projection.game_id)) continue;
        const canonical =
          canonicalPlayerMap.get(projection.player_id) ?? projection.players ?? null;
        const { yahooPlayer, ownership } = ownershipFor(projection.player_id);
        const yahooPositions = parsePositions(yahooPlayer?.eligible_positions);
        const positions =
          yahooPositions.length > 0
            ? yahooPositions
            : canonicalPositions(canonical?.position);
        const goals = sumProjectionParts(
          projection.proj_goals_es,
          projection.proj_goals_pp,
          projection.proj_goals_pk,
        );
        const assists = sumProjectionParts(
          projection.proj_assists_es,
          projection.proj_assists_pp,
          projection.proj_assists_pk,
        );
        const shots = sumProjectionParts(
          projection.proj_shots_es,
          projection.proj_shots_pp,
          projection.proj_shots_pk,
        );
        const ppPoints = sumProjectionParts(
          projection.proj_goals_pp,
          projection.proj_assists_pp,
        );
        const toiSeconds = sumProjectionParts(
          projection.proj_toi_es_seconds,
          projection.proj_toi_pp_seconds,
          projection.proj_toi_pk_seconds,
        );
        const hasCompleteScoringLine =
          goals != null &&
          assists != null &&
          ppPoints != null &&
          shots != null &&
          projection.proj_hits != null &&
          projection.proj_blocks != null;
        const hits = projection.proj_hits;
        const blocks = projection.proj_blocks;
        const opponentAbbrev = findAbbrev(projection.opponent_team_id);
        const context = buildPlayerContext(projection.uncertainty);
        if (!yahooPlayer) context.flags.push("ownership_unavailable");
        if (positions.length === 0) context.flags.push("position_unavailable");

        players.push({
          row_key: buildRowKey(projection),
          game_id: projection.game_id,
          player_id: projection.player_id,
          name:
            canonical?.fullName ??
            yahooPlayer?.full_name ??
            yahooPlayer?.player_name ??
            `Player ${projection.player_id}`,
          positions,
          ownership: ownership.value,
          percent_ownership: ownership.value,
          ownership_as_of_date: ownership.asOfDate,
          opponent_team_id: projection.opponent_team_id,
          opponent_abbrev: opponentAbbrev,
          team_id: projection.team_id,
          team_abbrev: findAbbrev(projection.team_id),
          proj_fantasy_points: hasCompleteScoringLine
            ? computeStartChartFantasyPoints({
                goals,
                assists,
                powerPlayPoints: ppPoints,
                shotsOnGoal: shots,
                hits: hits as number,
                blockedShots: blocks as number,
              })
            : null,
          proj_goals: goals,
          proj_assists: assists,
          proj_shots: shots,
          proj_pp_points: ppPoints,
          proj_hits: projection.proj_hits,
          proj_blocks: projection.proj_blocks,
          proj_pim: projection.proj_pim,
          proj_toi_minutes:
            toiSeconds == null ? null : Number((toiSeconds / 60).toFixed(2)),
          matchup_grade: opponentAbbrev
            ? (defenseEaseGrades.get(opponentAbbrev) ?? null)
            : null,
          start_probability: null,
          projected_gsaa: null,
          confirmed_status: null,
          context,
        });
      }

      for (const goalie of normalizedGoalies) {
        const game = gameMap.get(goalie.game_id);
        if (!game) continue;
        const canonical = canonicalPlayerMap.get(goalie.player_id);
        const { yahooPlayer, ownership } = ownershipFor(goalie.player_id);
        const opponentId =
          goalie.team_id === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
        const context = emptyPlayerContext();
        if (goalie.is_stale) context.flags.push("stale_goalie_source");
        if (goalie.is_hard_stale) context.flags.push("hard_stale_goalie_source");
        if (!yahooPlayer) context.flags.push("ownership_unavailable");
        players.push({
          row_key: buildRowKey(goalie),
          game_id: goalie.game_id,
          player_id: goalie.player_id,
          name:
            canonical?.fullName ??
            yahooPlayer?.full_name ??
            yahooPlayer?.player_name ??
            `Goalie ${goalie.player_id}`,
          positions: ["G"],
          ownership: ownership.value,
          percent_ownership: ownership.value,
          ownership_as_of_date: ownership.asOfDate,
          opponent_team_id: opponentId,
          opponent_abbrev: findAbbrev(opponentId),
          team_id: goalie.team_id,
          team_abbrev: findAbbrev(goalie.team_id),
          proj_fantasy_points: null,
          proj_goals: null,
          proj_assists: null,
          proj_shots: null,
          proj_pp_points: null,
          proj_hits: null,
          proj_blocks: null,
          proj_pim: null,
          proj_toi_minutes: null,
          matchup_grade: null,
          start_probability: goalie.start_probability,
          projected_gsaa: goalie.projected_gsaa_per_60,
          confirmed_status: goalie.confirmed_status,
          context,
        });
      }

      const gamesRemainingError = Boolean(weekGamesResponse.error);
      const gamesRemaining = new Map<number, number>();
      if (!gamesRemainingError) {
        for (const game of weekGamesResponse.data ?? []) {
          gamesRemaining.set(
            game.homeTeamId,
            (gamesRemaining.get(game.homeTeamId) ?? 0) + 1,
          );
          gamesRemaining.set(
            game.awayTeamId,
            (gamesRemaining.get(game.awayTeamId) ?? 0) + 1,
          );
        }
      }

      const rankedPlayers = addStartChartPositionRanks(
        players.map((player) => ({
          ...player,
          games_remaining_week: gamesRemainingError
            ? null
            : (gamesRemaining.get(player.team_id) ?? 0),
        })),
      );
      const eligiblePlayers = rankedPlayers
        .filter(
          (player) =>
            !request.position || player.positions.includes(request.position),
        )
        .sort((left, right) => {
          if (request.position) {
            const rankDelta =
              (left.position_ranks[request.position] ?? Number.MAX_SAFE_INTEGER) -
              (right.position_ranks[request.position] ?? Number.MAX_SAFE_INTEGER);
            if (rankDelta !== 0) return rankDelta;
          }
          return (
            left.player_id - right.player_id ||
            left.game_id - right.game_id ||
            (left.team_id ?? 0) - (right.team_id ?? 0) ||
            left.row_key.localeCompare(right.row_key)
          );
        });
      const totalPlayers = eligiblePlayers.length;
      const totalPages = request.paginationRequested
        ? Math.ceil(totalPlayers / request.pageSize)
        : totalPlayers > 0
          ? 1
          : 0;
      const responsePlayers = request.paginationRequested
        ? eligiblePlayers.slice(
            (request.page - 1) * request.pageSize,
            request.page * request.pageSize,
          )
        : eligiblePlayers;

      const ctpiRows = ctpiResult.rows;
      const ctpiError = ctpiResult.error;
      const ctpiMap = new Map<string, Record<string, number>>();
      for (const row of ctpiRows) {
        if (!row.date || !row.team || !Number.isFinite(row.ctpi_0_to_100)) continue;
        const dateRow = ctpiMap.get(row.date) ?? {};
        dateRow[row.team] = Number(row.ctpi_0_to_100);
        ctpiMap.set(row.date, dateRow);
      }
      const ctpi = Array.from(ctpiMap.entries()).map(([date, values]) => ({
        date,
        ...values,
      }));

      const goalieByGame = new Map<number, typeof normalizedGoalies>();
      for (const goalie of normalizedGoalies) {
        const rows = goalieByGame.get(goalie.game_id) ?? [];
        rows.push(goalie);
        goalieByGame.set(goalie.game_id, rows);
      }
      const enrichedGames = slate.games.map((game) => {
        const homeAbbrev = findAbbrev(game.homeTeamId);
        const awayAbbrev = findAbbrev(game.awayTeamId);
        const processGoalie = (goalie: (typeof normalizedGoalies)[number]) => {
          const canonical = canonicalPlayerMap.get(goalie.player_id);
          const yahooId = nhlToYahoo.get(goalie.player_id);
          const yahooPlayer = yahooId ? yahooMap.get(yahooId) : undefined;
          const ownership = yahooPlayer
            ? parseOwnershipAsOf(yahooPlayer, resolvedDate)
            : { value: null, asOfDate: null };
          return {
            player_id: goalie.player_id,
            name:
              canonical?.fullName ??
              yahooPlayer?.full_name ??
              yahooPlayer?.player_name ??
              `Goalie ${goalie.player_id}`,
            start_probability: goalie.start_probability,
            projected_gsaa_per_60: goalie.projected_gsaa_per_60,
            confirmed_status: goalie.confirmed_status,
            percent_ownership: ownership.value,
            source_updated_at: goalie.source_updated_at,
            source_confidence: goalie.source_confidence,
            is_stale: goalie.is_stale,
          };
        };
        const gameGoalies = goalieByGame.get(game.id) ?? [];
        return {
          ...game,
          homeAbbrev,
          awayAbbrev,
          homeRating: homeAbbrev ? ratingsByAbbrev.get(homeAbbrev) : undefined,
          awayRating: awayAbbrev ? ratingsByAbbrev.get(awayAbbrev) : undefined,
          homeGoalies: gameGoalies
            .filter((goalie) => goalie.team_id === game.homeTeamId)
            .map(processGoalie)
            .sort(
              (left, right) =>
                (right.start_probability ?? -1) - (left.start_probability ?? -1),
            ),
          awayGoalies: gameGoalies
            .filter((goalie) => goalie.team_id === game.awayTeamId)
            .map(processGoalie)
            .sort(
              (left, right) =>
                (right.start_probability ?? -1) - (left.start_probability ?? -1),
            ),
        };
      });

      const runMetrics = asRecord(forgeRun?.metrics);
      const rollout = asRecord(runMetrics.skater_rollout);
      const firstModelVersion = slate.projections
        .map((row) => extractSkaterModelMetadata(row.uncertainty).modelVersion)
        .find((value): value is string => Boolean(value));
      const provenanceEligibility = evaluateForgeCalibrationEligibility(
        forgeRun?.metrics,
      );
      const modelVersion =
        (typeof rollout.modelVersion === "string" ? rollout.modelVersion : null) ??
        firstModelVersion ??
        null;

      const goalieTeamIds = new Set(
        normalizedGoalies.map((goalie) => goalie.team_id),
      );
      const goalieTeamsCovered = goalieTeamIds.size;
      const goalieFreshTeamIds = new Set(
        normalizedGoalies
          .filter((goalie) => !goalie.is_stale)
          .map((goalie) => goalie.team_id),
      );
      const goalieStaleTeams = Array.from(goalieTeamIds).filter(
        (teamId) => !goalieFreshTeamIds.has(teamId),
      ).length;
      const latestGoalieUpdate = normalizedGoalies
        .map((goalie) => goalie.source_updated_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
      const sortedOwnershipDates = ownershipDates.sort();
      const ownershipOldestAsOfDate = sortedOwnershipDates[0] ?? null;
      const ownershipAsOfDate = sortedOwnershipDates.at(-1) ?? null;
      const yahooMappedPlayers = mappedNhlPlayerIds.size;
      const yahooUnmappedPlayers = Math.max(0, playerIds.length - yahooMappedPlayers);
      const ratingTeamsCovered = new Set(
        ratings
          .filter((rating) => slateTeamAbbrevs.includes(rating.teamAbbr))
          .map((rating) => rating.teamAbbr),
      ).size;

      const degradedReasons: string[] = [];
      const projectionState = slate.projectionError
        ? "error"
        : slate.projections.length === 0
          ? "missing"
          : provenanceEligibility.eligible
            ? "ready"
            : "partial";
      if (slate.games.length > 0 && projectionState !== "ready") {
        degradedReasons.push(
          slate.projectionError
            ? "projection_query_error"
            : slate.projections.length === 0
              ? "missing_projection"
              : "quarantined_or_missing_provenance",
        );
      }
      const goalieState = slate.goalieError
        ? "error"
        : slateTeamIds.length === 0
          ? "missing"
          : goalieTeamsCovered === slateTeamIds.length && goalieStaleTeams === 0
            ? "ready"
            : goalieTeamsCovered > 0
              ? "partial"
              : "missing";
      if (slate.games.length > 0 && goalieState !== "ready") {
        degradedReasons.push(
          goalieState === "error" ? "goalie_query_error" : "missing_goalie_coverage",
        );
      }
      const teamRatingState = ratingsError
        ? "error"
        : ratingTeamsCovered === slateTeamAbbrevs.length && slateTeamAbbrevs.length > 0
          ? "ready"
          : ratingTeamsCovered > 0
            ? "partial"
            : "missing";
      if (slate.games.length > 0 && teamRatingState !== "ready") {
        degradedReasons.push("missing_team_rating_coverage");
      }
      const ownershipState = mappingFailed || yahooFailed
        ? "error"
        : playerIds.length === 0
          ? "missing"
          : ownershipPlayerIdsWithAsOf.size === playerIds.length
            ? "ready"
            : ownershipPlayerIdsWithAsOf.size > 0
              ? "partial"
              : "missing";
      if (playerIds.length > 0 && ownershipState !== "ready") {
        degradedReasons.push("ownership_overlay_incomplete");
      }
      const ctpiThroughDate = ctpiRows
        .map((row) => row.date)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
      const ctpiState = ctpiError
        ? "error"
        : ctpiRows.length > 0
          ? "ready"
          : "missing";
      const gamesRemainingState = gamesRemainingError ? "error" : "ready";
      if (gamesRemainingError) degradedReasons.push("games_remaining_unavailable");

      const sourceStatus: StartChartSourceStatus = {
        overall:
          slate.games.length > 0 &&
          (projectionState !== "ready" || goalieState !== "ready")
            ? "degraded"
            : "ready",
        projection: {
          state: projectionState,
          affectsRanking: true,
          date: resolvedDate,
          updatedAt: forgeRun?.updated_at ?? null,
          runId: slate.runId,
          modelVersion,
          inputVersion: provenanceEligibility.observedContract,
          message:
            projectionState === "partial"
              ? "Projection rows are visible, but their repaired rolling-history provenance is missing or quarantined."
              : projectionState === "missing"
                ? "No canonical one-game skater rows are available for this slate."
                : projectionState === "error"
                  ? "The canonical projection query failed."
                  : null,
        },
        teamRatings: {
          state: teamRatingState,
          affectsRanking: false,
          date: ratingsResolvedDate,
          requestedDate: resolvedDate,
          resolvedDate: ratingsResolvedDate,
          message:
            teamRatingState === "ready"
              ? null
              : "Defense-ease context is incomplete; canonical fantasy ranks are unchanged.",
        },
        ctpi: {
          state: ctpiState,
          affectsRanking: false,
          date: ctpiThroughDate,
          throughDate: ctpiThroughDate,
          message:
            ctpiState === "ready"
              ? null
              : "CTPI trend context is unavailable; canonical fantasy ranks are unchanged.",
        },
        goalies: {
          state: goalieState,
          affectsRanking: true,
          date: resolvedDate,
          updatedAt: latestGoalieUpdate,
          expectedTeams: slateTeamIds.length,
          coveredTeams: goalieTeamsCovered,
          freshTeams: goalieFreshTeamIds.size,
          staleTeams: goalieStaleTeams,
          message:
            goalieState === "ready"
              ? null
              : `${goalieTeamsCovered} of ${slateTeamIds.length} slate teams have goalie coverage; ${goalieStaleTeams} covered teams are stale.`,
        },
        ownership: {
          state: ownershipState,
          affectsRanking: false,
          date: ownershipAsOfDate,
          mappedPlayers: yahooMappedPlayers,
          unmappedPlayers: yahooUnmappedPlayers,
          playersWithAsOf: ownershipPlayerIdsWithAsOf.size,
          playersMissingAsOf: Math.max(
            0,
            playerIds.length - ownershipPlayerIdsWithAsOf.size,
          ),
          oldestAsOfDate: ownershipOldestAsOfDate,
          latestAsOfDate: ownershipAsOfDate,
          message:
            ownershipState === "ready"
              ? null
              : "Yahoo ownership is an optional dated overlay and is incomplete for this slate.",
        },
        gamesRemaining: {
          state: gamesRemainingState,
          affectsRanking: false,
          date: gamesRemainingError ? null : resolvedDate,
          message: gamesRemainingError
            ? "Weekly game volume is unavailable and does not affect ranking."
            : null,
        },
        degradedReasons: Array.from(new Set(degradedReasons)),
      };

      return {
        dateUsed: resolvedDate,
        date: resolvedDate,
        resolvedDate,
        requestedDate,
        fallbackApplied,
        serving,
        compatibilityInventory: buildStartChartCompatibility(),
        skaterSourceDate: resolvedDate,
        projectionRunId: slate.runId,
        projectionRun: forgeRun
          ? {
              runId: forgeRun.run_id,
              asOfDate: forgeRun.as_of_date,
              createdAt: forgeRun.created_at,
              updatedAt: forgeRun.updated_at,
              gitSha: forgeRun.git_sha,
              modelVersion,
              inputVersion: provenanceEligibility.observedContract,
              provenanceEligible: provenanceEligibility.eligible,
            }
          : null,
        skaterSource: "forge_player_projections",
        goalieSource: "goalie_start_projections",
        legacyPlayerProjectionsUsed: false,
        fantasyScoringContract: START_CHART_FANTASY_SCORING_CONTRACT,
        rankingContract: START_CHART_RANKING_CONTRACT,
        request: {
          mode: request.mode,
          profile: request.profile,
          position: request.position,
          modelVersion: request.modelVersion,
        },
        pagination: {
          page: request.page,
          pageSize: request.paginationRequested ? request.pageSize : totalPlayers,
          totalPlayers,
          totalPages,
        },
        sourceStatus,
        coverage: {
          slateGames: slate.games.length,
          slateTeams: slateTeamIds.length,
          projectionRows: slate.projections.length + slate.goalies.length,
          renderedRows: rankedPlayers.length,
          goalieTeamsExpected: slateTeamIds.length,
          goalieTeamsCovered,
          yahooMappedPlayers,
          yahooUnmappedPlayers,
        },
        projections: responsePlayers.length,
        players: responsePlayers,
        ctpi,
        games: enrichedGames,
      };
    })();

    inFlight.set(cacheKey, loadPromise);
    let payload: unknown;
    try {
      payload = await loadPromise;
    } finally {
      inFlight.delete(cacheKey);
    }
    // Validate the shared core while retaining enriched legacy fields verbatim.
    normalizeStartChartResponse(payload);
    cachePayload(cacheKey, payload);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (error) {
    inFlight.delete(cacheKey);
    console.error("start-chart API error", error);
    return res.status(500).json({ error: "START_CHART_UNAVAILABLE" });
  }
}
