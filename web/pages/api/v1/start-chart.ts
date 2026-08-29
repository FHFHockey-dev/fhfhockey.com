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
import { isTrustedRecentTeamFormPayload } from "lib/trends/ctpi";
import {
  addStartChartPositionRanks,
  computeStartChartFantasyPoints,
  START_CHART_FANTASY_SCORING_CONTRACT,
  START_CHART_RANKING_CONTRACT,
} from "lib/projections/startChartFantasyScoring";
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

type YahooBasePlayerRow = Omit<YahooPlayerRow, "ownership_timeline"> & {
  player_key: string;
};

type YahooOwnershipHistoryRow = {
  player_key: string;
  ownership_date: string;
  ownership_pct: number | null;
};

type YahooMappingRow = {
  nhl_player_id: string | number | null;
  yahoo_player_id: string | number | null;
  nhl_team_abbreviation?: string | null;
  yahoo_team?: string | null;
};

type YahooOverlayRpcRow = YahooMappingRow & {
  player_name: string | null;
  full_name: string | null;
  eligible_positions: string[] | null;
  percent_ownership: number | null;
  ownership_as_of_date: string | null;
  last_updated: string | null;
};

type YahooOverlayRpcResult = {
  ready: boolean;
  missing: boolean;
  rows: YahooOverlayRpcRow[];
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
  formula_version: string | null;
  input_version: string | null;
  source_game_count: string | number | null;
  publication_status: string | null;
};

type FallbackRunRow = {
  run_id: string;
  as_of_date: string;
  forge_player_projections?: Array<{
    as_of_date: string;
    game_id: number;
    games?: { date?: string | null } | null;
  }> | null;
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
  forgeRun: ForgeRunRow | null;
  projectionError: boolean;
  goalieError: boolean;
};

type ForgeRunWithProjectionsRow = ForgeRunRow & {
  forge_player_projections?: ProjectionRow[] | null;
};

const RESPONSE_TTL_MS = 60_000;
const MAX_RESPONSE_CACHE_ENTRIES = 64;
const YAHOO_RPC_MISSING_RETRY_MS = 5 * 60_000;
const YAHOO_HISTORY_PAGE_SIZE = 1000;
const SUPPORTED_POSITIONS = new Set(["C", "LW", "RW", "D", "G"]);
const responseCache = new Map<
  string,
  { expiresAt: number; payload: unknown }
>();
const inFlight = new Map<string, Promise<unknown>>();
let yahooOverlayRpcKnownReady = false;
let yahooOverlayRpcMissingUntil = 0;

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

export const getPregameTeamFormThroughDate = (slateDate: string): string =>
  shiftDate(slateDate, -1);

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
            const numeric = finiteOrNull(point?.[key]);
            if (numeric != null) {
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
  const latestOwnership = finiteOrNull(row.percent_ownership);
  if (
    lastUpdatedDate &&
    isCalendarDate(lastUpdatedDate) &&
    lastUpdatedDate <= targetDate &&
    latestOwnership != null
  ) {
    return { value: latestOwnership, asOfDate: lastUpdatedDate };
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
  const team = Object.values(teamsInfo).find(
    (candidate) => candidate.id === teamId,
  );
  return team?.abbrev ?? null;
};

export function resolveYahooPlayerMappings(
  rows: YahooMappingRow[],
  targetTeamByNhlPlayer: Map<number, string | null>,
): { mapped: Map<number, number>; ambiguousPlayerIds: Set<number> } {
  const candidatesByPlayer = new Map<
    number,
    Array<{ yahooId: number; teamMatch: boolean }>
  >();
  for (const row of rows) {
    const nhlId = finiteOrNull(row.nhl_player_id);
    const yahooId = finiteOrNull(row.yahoo_player_id);
    if (nhlId == null || nhlId <= 0 || yahooId == null || yahooId <= 0) {
      continue;
    }
    const targetTeam = targetTeamByNhlPlayer.get(nhlId)?.toUpperCase() ?? null;
    const candidateTeams = [row.nhl_team_abbreviation, row.yahoo_team].flatMap(
      (value) =>
        typeof value === "string" && value.trim()
          ? [value.trim().toUpperCase()]
          : [],
    );
    const candidates = candidatesByPlayer.get(nhlId) ?? [];
    candidates.push({
      yahooId,
      teamMatch: targetTeam != null && candidateTeams.includes(targetTeam),
    });
    candidatesByPlayer.set(nhlId, candidates);
  }

  const mapped = new Map<number, number>();
  const ambiguousPlayerIds = new Set<number>();
  for (const [nhlId, candidates] of candidatesByPlayer) {
    const matchByYahooId = new Map<number, boolean>();
    for (const candidate of candidates) {
      matchByYahooId.set(
        candidate.yahooId,
        (matchByYahooId.get(candidate.yahooId) ?? false) || candidate.teamMatch,
      );
    }
    const unique = Array.from(matchByYahooId, ([yahooId, teamMatch]) => ({
      yahooId,
      teamMatch,
    })).sort(
      (left, right) =>
        Number(right.teamMatch) - Number(left.teamMatch) ||
        left.yahooId - right.yahooId,
    );
    const matched = unique.filter((candidate) => candidate.teamMatch);
    if (matched.length === 1) {
      mapped.set(nhlId, matched[0].yahooId);
    } else if (matched.length > 1 || unique.length > 1) {
      ambiguousPlayerIds.add(nhlId);
    } else if (unique[0]) {
      mapped.set(nhlId, unique[0].yahooId);
    }
  }
  return { mapped, ambiguousPlayerIds };
}

async function fetchYahooOverlayRpc(
  playerIds: number[],
  season: number,
  asOfDate: string,
): Promise<YahooOverlayRpcResult> {
  if (playerIds.length === 0 || typeof (supabase as any).rpc !== "function") {
    return {
      ready: playerIds.length === 0,
      missing: playerIds.length > 0,
      rows: [],
    };
  }
  try {
    const { data, error } = await (supabase as any).rpc(
      "read_yahoo_player_overlay_as_of",
      {
        p_nhl_player_ids: playerIds,
        p_season: season,
        p_as_of_date: asOfDate,
      },
    );
    if (error) {
      return {
        ready: false,
        missing: error.code === "PGRST202",
        rows: [],
      };
    }
    return {
      ready: true,
      missing: false,
      rows: Array.isArray(data) ? (data as YahooOverlayRpcRow[]) : [],
    };
  } catch {
    return { ready: false, missing: false, rows: [] };
  }
}

async function fetchYahooMappingRows(
  playerIds: number[],
): Promise<{ rows: YahooMappingRow[]; error: boolean }> {
  if (playerIds.length === 0) return { rows: [], error: false };
  const response = await supabase
    .from("yahoo_nhl_player_map_read")
    .select("nhl_player_id,yahoo_player_id,nhl_team_abbreviation,yahoo_team")
    .in("nhl_player_id", playerIds.map(String));
  return {
    rows: response.error ? [] : ((response.data ?? []) as YahooMappingRow[]),
    error: Boolean(response.error),
  };
}

async function fetchYahooOwnershipHistory(
  playerKeys: string[],
  asOfDate: string,
): Promise<{ rows: YahooOwnershipHistoryRow[]; error: boolean }> {
  if (playerKeys.length === 0) return { rows: [], error: false };
  const exactResponse = await supabase
    .from("yahoo_player_ownership_history")
    .select("player_key,ownership_date,ownership_pct")
    .in("player_key", playerKeys)
    .eq("ownership_date", asOfDate)
    .order("player_key", { ascending: true });
  if (exactResponse.error) return { rows: [], error: true };

  const latestByKey = new Map<string, YahooOwnershipHistoryRow>();
  for (const row of (exactResponse.data ?? []) as YahooOwnershipHistoryRow[]) {
    if (finiteOrNull(row.ownership_pct) != null) {
      latestByKey.set(row.player_key, row);
    }
  }
  const missingKeys = playerKeys.filter((key) => !latestByKey.has(key));
  if (missingKeys.length === 0) {
    return { rows: Array.from(latestByKey.values()), error: false };
  }

  for (let from = 0; ; from += YAHOO_HISTORY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("yahoo_player_ownership_history")
      .select("player_key,ownership_date,ownership_pct")
      .in("player_key", missingKeys)
      .lte("ownership_date", asOfDate)
      .order("ownership_date", { ascending: false })
      .order("player_key", { ascending: true })
      .range(from, from + YAHOO_HISTORY_PAGE_SIZE - 1);
    if (error) return { rows: [], error: true };
    const page = (data ?? []) as YahooOwnershipHistoryRow[];
    for (const row of page.sort(
      (left, right) =>
        right.ownership_date.localeCompare(left.ownership_date) ||
        left.player_key.localeCompare(right.player_key),
    )) {
      if (
        finiteOrNull(row.ownership_pct) != null &&
        !latestByKey.has(row.player_key)
      ) {
        latestByKey.set(row.player_key, row);
      }
    }
    if (
      missingKeys.every((key) => latestByKey.has(key)) ||
      page.length < YAHOO_HISTORY_PAGE_SIZE
    ) {
      break;
    }
  }
  return { rows: Array.from(latestByKey.values()), error: false };
}

async function fetchYahooPlayersFallback(
  yahooPlayerIds: number[],
  season: number,
  asOfDate: string,
): Promise<{ rows: YahooPlayerRow[]; error: boolean }> {
  if (yahooPlayerIds.length === 0) return { rows: [], error: false };
  const response = await supabase
    .from("yahoo_players")
    .select(
      "player_id,player_key,player_name,full_name,eligible_positions,percent_ownership,last_updated",
    )
    .eq("season", season)
    .in("player_id", yahooPlayerIds.map(String));
  if (response.error) return { rows: [], error: true };

  const baseRows = ((response.data ?? []) as YahooBasePlayerRow[]).sort(
    (left, right) => {
      const leftUpdated = Date.parse(left.last_updated ?? "");
      const rightUpdated = Date.parse(right.last_updated ?? "");
      return (
        (Number.isFinite(rightUpdated) ? rightUpdated : -Infinity) -
          (Number.isFinite(leftUpdated) ? leftUpdated : -Infinity) ||
        left.player_key.localeCompare(right.player_key)
      );
    },
  );
  const selectedById = new Map<number, YahooBasePlayerRow>();
  for (const row of baseRows) {
    const playerId = finiteOrNull(row.player_id);
    if (playerId != null && playerId > 0 && !selectedById.has(playerId)) {
      selectedById.set(playerId, row);
    }
  }
  const selectedRows = Array.from(selectedById.values());
  const history = await fetchYahooOwnershipHistory(
    selectedRows.map((row) => row.player_key),
    asOfDate,
  );
  const latestHistoryByKey = new Map<string, { date: string; value: number }>();
  for (const row of history.rows.sort(
    (left, right) =>
      right.ownership_date.localeCompare(left.ownership_date) ||
      left.player_key.localeCompare(right.player_key),
  )) {
    const ownership = finiteOrNull(row.ownership_pct);
    if (ownership == null || latestHistoryByKey.has(row.player_key)) continue;
    latestHistoryByKey.set(row.player_key, {
      date: row.ownership_date,
      value: ownership,
    });
  }

  return {
    rows: selectedRows.map((row) => {
      const ownership = latestHistoryByKey.get(row.player_key);
      return {
        player_id: row.player_id,
        player_name: row.player_name,
        full_name: row.full_name,
        eligible_positions: row.eligible_positions,
        percent_ownership: row.percent_ownership,
        ownership_timeline: ownership ? [ownership] : [],
        last_updated: row.last_updated,
      };
    }),
    error: history.error,
  };
}

export const computeDefenseEaseGrades = (
  ratings: TeamPowerRating[],
): Map<string, number> => {
  const rows = ratings
    .flatMap((rating) => {
      const xga60 = finiteOrNull(rating.components?.xga60);
      return xga60 != null ? [{ teamAbbr: rating.teamAbbr, xga60 }] : [];
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

const MAX_ONE_GAME_SKATER_TOI_SECONDS = 65 * 60;

export const normalizeProjectedToiMinutes = (
  ...values: Array<number | null>
): number | null => {
  if (values.every((value) => value == null)) return null;
  if (
    values.some(
      (value) => value != null && (!Number.isFinite(value) || value < 0),
    )
  ) {
    return null;
  }
  const totalSeconds = values.reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  if (totalSeconds > MAX_ONE_GAME_SKATER_TOI_SECONDS) return null;
  return Number((totalSeconds / 60).toFixed(2));
};

const buildRowKey = (row: {
  run_id?: string | null;
  game_id: number;
  player_id: number;
  horizon_games?: number;
}): string =>
  [
    row.run_id ?? "goalie",
    row.game_id,
    row.player_id,
    row.horizon_games ?? 1,
  ].join(":");

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
  const endOfTargetDate = `${targetDate}T23:59:59.999Z`;
  const goaliePromise = supabase
    .from("goalie_start_projections")
    .select(
      "game_id,team_id,player_id,game_date,start_probability,projected_gsaa_per_60,confirmed_status,l10_start_pct,season_start_pct,games_played,updated_at",
    )
    .eq("game_date", targetDate)
    .lte("updated_at", endOfTargetDate);

  let runQuery = supabase
    .from("forge_runs")
    .select(
      `
          run_id,
          as_of_date,
          created_at,
          updated_at,
          git_sha,
          metrics,
          forge_player_projections (
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
          )
          `,
    )
    .eq("status", "succeeded")
    .eq("as_of_date", targetDate)
    .eq("forge_player_projections.as_of_date", targetDate)
    .eq("forge_player_projections.horizon_games", 1);
  if (exactRunId) {
    runQuery = runQuery.eq("run_id", exactRunId);
  }
  const runPromise = runQuery
    .order("created_at", { ascending: false })
    .order("run_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const [gamesResponse, runResponse, goalieResponse] = await Promise.all([
    gamesPromise,
    runPromise,
    goaliePromise,
  ]);
  if (gamesResponse.error) throw gamesResponse.error;
  const games = (gamesResponse.data ?? []) as GameRow[];
  const gameIds = new Set(games.map((game) => game.id));
  const forgeRun = runResponse.error
    ? null
    : ((runResponse.data as unknown as ForgeRunWithProjectionsRow | null) ??
      null);
  const projections = (forgeRun?.forge_player_projections ?? []).filter(
    (row) =>
      row.as_of_date === targetDate &&
      row.horizon_games === 1 &&
      gameIds.has(row.game_id),
  );
  const goalies = goalieResponse.error
    ? []
    : ((goalieResponse.data ?? []) as GoalieRow[]).filter((row) =>
        gameIds.has(row.game_id),
      );

  return {
    games,
    projections,
    goalies,
    runId: forgeRun?.run_id ?? null,
    forgeRun,
    projectionError: Boolean(runResponse.error),
    goalieError: Boolean(goalieResponse.error),
  };
}

async function fetchFallbackRunWithPlayerData(
  targetDate: string,
  seasonStartDate: string,
): Promise<{ runId: string; asOfDate: string } | null> {
  // The inner projection/game relationship excludes succeeded runs that cannot
  // actually serve a one-game slate. This avoids one existence query per run,
  // which is especially expensive across long no-game/offseason stretches.
  for (let offset = 0; ; offset += 1) {
    const { data: candidates, error: candidatesError } = await supabase
      .from("forge_runs")
      .select(
        "run_id,as_of_date,forge_player_projections!inner(as_of_date,game_id,horizon_games,games!inner(date))",
      )
      .eq("status", "succeeded")
      .lte("as_of_date", targetDate)
      .gte("as_of_date", seasonStartDate)
      .eq("forge_player_projections.horizon_games", 1)
      .order("as_of_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("run_id", { ascending: true })
      .range(offset, offset);
    if (candidatesError) throw candidatesError;
    const row = ((candidates ?? []) as unknown as FallbackRunRow[])[0];
    if (!row) break;
    const hasMatchingSchedule = (row.forge_player_projections ?? []).some(
      (projection) =>
        projection.as_of_date === row.as_of_date &&
        projection.games?.date === row.as_of_date,
    );
    if (hasMatchingSchedule) {
      return { runId: row.run_id, asOfDate: row.as_of_date };
    }
  }
  return null;
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
      .select(
        "date,team,ctpi_0_to_100,formula_version:payload->>formulaVersion,input_version:payload->>inputVersion,source_game_count:payload->>sourceGameCount,publication_status:payload->>publicationStatus",
      )
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
        throw new Error(
          `Unable to resolve season for Start Chart date=${requestedDate}`,
        );
      }
      const yahooSeason = Number(String(seasonId).slice(0, 4));
      const seasonStartDate = String(season?.startDate ?? requestedDate).slice(
        0,
        10,
      );

      let slate = requestedSlate;
      let resolvedDate = requestedDate;
      let fallbackApplied = false;
      let fallbackStrategy:
        | "requested_date"
        | "previous_date_with_games"
        | "latest_available_with_data" = "requested_date";

      if (requestedSlate.games.length === 0) {
        // One joined lookup already resolves the latest earlier run that owns
        // usable one-game rows and a matching schedule. A separate probe of
        // yesterday duplicated the same work and added two cold network rounds.
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

      const gameMap = new Map(
        slate.games.map((game) => [game.id, game] as const),
      );
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
      // Daily team-form rows can include games completed on their own date.
      // A pregame Starter Board must therefore stop strictly before the slate.
      const teamFormThroughDate = getPregameTeamFormThroughDate(resolvedDate);
      const ctpiPromise = fetchCtpiRows(
        shiftDate(teamFormThroughDate, -29),
        teamFormThroughDate,
        slateTeamAbbrevs,
      )
        .then((rows) => ({ rows, error: false as const }))
        .catch(() => ({ rows: [] as CtpiRow[], error: true as const }));
      const weekGamesPromise = supabase
        .from("games")
        .select("id,date,homeTeamId,awayTeamId")
        .gte("date", resolvedDate)
        .lte("date", weekEndDate);
      const forgeRun = slate.forgeRun;

      const playerIds = Array.from(
        new Set([
          ...slate.projections.map((row) => row.player_id),
          ...slate.goalies.map((row) => row.player_id),
        ]),
      );
      const embeddedCanonicalPlayerMap = new Map<number, CanonicalPlayerRow>();
      for (const projection of slate.projections) {
        const fullName = projection.players?.fullName;
        const position = projection.players?.position;
        if (
          !embeddedCanonicalPlayerMap.has(projection.player_id) &&
          typeof fullName === "string" &&
          fullName.trim() &&
          typeof position === "string" &&
          position.trim()
        ) {
          embeddedCanonicalPlayerMap.set(projection.player_id, {
            id: projection.player_id,
            fullName,
            position,
          });
        }
      }
      const missingCanonicalPlayerIds = playerIds.filter(
        (playerId) => !embeddedCanonicalPlayerMap.has(playerId),
      );
      const canonicalPlayersPromise =
        missingCanonicalPlayerIds.length > 0
          ? supabase
              .from("players")
              .select("id,fullName,position")
              .in("id", missingCanonicalPlayerIds)
          : Promise.resolve({ data: [], error: null });
      const rpcProbeAllowed = Date.now() >= yahooOverlayRpcMissingUntil;
      const yahooOverlayRpcPromise: Promise<YahooOverlayRpcResult> =
        rpcProbeAllowed
          ? fetchYahooOverlayRpc(playerIds, yahooSeason, resolvedDate)
          : Promise.resolve({ ready: false, missing: true, rows: [] });
      // Until the RPC is confirmed, overlap its capability probe with the
      // compatibility mapping read. A missing function must not add a full
      // network round before the fallback can begin.
      const yahooMappingPromise = !yahooOverlayRpcKnownReady
        ? fetchYahooMappingRows(playerIds)
        : null;
      const [canonicalResponse, yahooOverlayRpc] = await Promise.all([
        canonicalPlayersPromise,
        yahooOverlayRpcPromise,
      ]);
      if (yahooOverlayRpc.ready) {
        yahooOverlayRpcKnownReady = true;
        yahooOverlayRpcMissingUntil = 0;
      } else if (rpcProbeAllowed && yahooOverlayRpc.missing) {
        yahooOverlayRpcKnownReady = false;
        yahooOverlayRpcMissingUntil = Date.now() + YAHOO_RPC_MISSING_RETRY_MS;
      } else if (rpcProbeAllowed) {
        yahooOverlayRpcKnownReady = false;
      }
      if (canonicalResponse.error) throw canonicalResponse.error;
      const canonicalPlayers = (canonicalResponse.data ??
        []) as CanonicalPlayerRow[];
      const canonicalPlayerMap = new Map([
        ...embeddedCanonicalPlayerMap.entries(),
        ...canonicalPlayers.map((player) => [player.id, player] as const),
      ]);

      let mappingFailed = false;
      let yahooFailed = false;
      let mappingRows: YahooMappingRow[] = yahooOverlayRpc.rows;
      if (!yahooOverlayRpc.ready) {
        const mappingResponse =
          (await yahooMappingPromise) ??
          (await fetchYahooMappingRows(playerIds));
        mappingFailed = mappingResponse.error;
        mappingRows = mappingResponse.rows;
      }
      const targetTeamByNhlPlayer = new Map<number, string | null>();
      for (const row of [...slate.projections, ...slate.goalies]) {
        const team = findAbbrev(row.team_id);
        if (!targetTeamByNhlPlayer.has(row.player_id)) {
          targetTeamByNhlPlayer.set(row.player_id, team);
        } else if (targetTeamByNhlPlayer.get(row.player_id) !== team) {
          targetTeamByNhlPlayer.set(row.player_id, null);
        }
      }
      const { mapped: nhlToYahoo, ambiguousPlayerIds: ambiguousYahooMappings } =
        resolveYahooPlayerMappings(mappingRows, targetTeamByNhlPlayer);

      const yahooPlayerIds = Array.from(new Set(nhlToYahoo.values()));
      let yahooPlayers: YahooPlayerRow[] = yahooOverlayRpc.ready
        ? yahooOverlayRpc.rows.flatMap((row) => {
            const yahooId = finiteOrNull(row.yahoo_player_id);
            if (yahooId == null || yahooId <= 0) return [];
            const ownership = finiteOrNull(row.percent_ownership);
            return [
              {
                player_id: String(yahooId),
                player_name: row.player_name,
                full_name: row.full_name,
                eligible_positions: row.eligible_positions,
                percent_ownership: ownership,
                ownership_timeline:
                  row.ownership_as_of_date && ownership != null
                    ? [
                        {
                          date: row.ownership_as_of_date,
                          value: ownership,
                        },
                      ]
                    : [],
                last_updated: row.last_updated,
              },
            ];
          })
        : [];
      if (!yahooOverlayRpc.ready && yahooPlayerIds.length > 0) {
        const response = await fetchYahooPlayersFallback(
          yahooPlayerIds,
          yahooSeason,
          resolvedDate,
        );
        yahooFailed = response.error;
        yahooPlayers = response.rows;
      }
      const yahooMap = new Map(
        yahooPlayers.flatMap((row) => {
          const id = finiteOrNull(row.player_id);
          return id != null && id > 0 ? ([[id, row]] as const) : [];
        }),
      );

      const [ratingsResult, ctpiResult, weekGamesResponse] = await Promise.all([
        ratingsPromise,
        ctpiPromise,
        weekGamesPromise,
      ]);
      const runMetrics = asRecord(forgeRun?.metrics);
      const rollout = asRecord(runMetrics.skater_rollout);
      const firstModelVersion = slate.projections
        .map((row) => extractSkaterModelMetadata(row.uncertainty).modelVersion)
        .find((value): value is string => Boolean(value));
      const provenanceEligibility = evaluateForgeCalibrationEligibility(
        forgeRun?.metrics,
      );
      const modelVersion =
        (typeof rollout.modelVersion === "string"
          ? rollout.modelVersion
          : null) ??
        firstModelVersion ??
        null;
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
        Math.min(
          Date.now(),
          Number.isFinite(targetEndMs) ? targetEndMs : Date.now(),
        ),
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
          canonicalPlayerMap.get(projection.player_id) ??
          projection.players ??
          null;
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
        const projectedToiMinutes = normalizeProjectedToiMinutes(
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
        if (ambiguousYahooMappings.has(projection.player_id)) {
          context.flags.push("ambiguous_yahoo_mapping");
        }
        if (positions.length === 0) context.flags.push("position_unavailable");
        if (!provenanceEligibility.eligible) {
          context.flags.push("unverified_projection_provenance");
        }
        if (
          projectedToiMinutes == null &&
          [
            projection.proj_toi_es_seconds,
            projection.proj_toi_pp_seconds,
            projection.proj_toi_pk_seconds,
          ].some((value) => value != null)
        ) {
          context.flags.push("invalid_projected_toi");
        }

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
          proj_toi_minutes: projectedToiMinutes,
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
          goalie.team_id === game.homeTeamId
            ? game.awayTeamId
            : game.homeTeamId;
        const context = emptyPlayerContext();
        if (goalie.is_stale) context.flags.push("stale_goalie_source");
        if (goalie.is_hard_stale)
          context.flags.push("hard_stale_goalie_source");
        if (!yahooPlayer) context.flags.push("ownership_unavailable");
        if (ambiguousYahooMappings.has(goalie.player_id)) {
          context.flags.push("ambiguous_yahoo_mapping");
        }
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
            : (gamesRemaining.get(player.team_id) ?? null),
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
              (left.position_ranks[request.position] ??
                Number.MAX_SAFE_INTEGER) -
              (right.position_ranks[request.position] ??
                Number.MAX_SAFE_INTEGER);
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

      const allCtpiRows = ctpiResult.rows;
      const ctpiRows = allCtpiRows.filter((row) =>
        isTrustedRecentTeamFormPayload({
          publicationStatus: row.publication_status,
          formulaVersion: row.formula_version,
          inputVersion: row.input_version,
          sourceGameCount: row.source_game_count,
        }),
      );
      const untrustedCtpiRows = allCtpiRows.length - ctpiRows.length;
      const ctpiError = ctpiResult.error;
      const ctpiMap = new Map<string, Record<string, number>>();
      for (const row of ctpiRows) {
        if (!row.date || !row.team || !Number.isFinite(row.ctpi_0_to_100))
          continue;
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
                (right.start_probability ?? -1) -
                (left.start_probability ?? -1),
            ),
          awayGoalies: gameGoalies
            .filter((goalie) => goalie.team_id === game.awayTeamId)
            .map(processGoalie)
            .sort(
              (left, right) =>
                (right.start_probability ?? -1) -
                (left.start_probability ?? -1),
            ),
        };
      });

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
      const latestGoalieUpdate =
        normalizedGoalies
          .map((goalie) => goalie.source_updated_at)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null;
      const sortedOwnershipDates = ownershipDates.sort();
      const ownershipOldestAsOfDate = sortedOwnershipDates[0] ?? null;
      const ownershipAsOfDate = sortedOwnershipDates.at(-1) ?? null;
      const yahooMappedPlayers = mappedNhlPlayerIds.size;
      const yahooUnmappedPlayers = Math.max(
        0,
        playerIds.length - yahooMappedPlayers,
      );
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
          goalieState === "error"
            ? "goalie_query_error"
            : goalieTeamsCovered === slateTeamIds.length && goalieStaleTeams > 0
              ? "stale_goalie_coverage"
              : "missing_goalie_coverage",
        );
      }
      const teamRatingState = ratingsError
        ? "error"
        : ratingTeamsCovered === slateTeamAbbrevs.length &&
            slateTeamAbbrevs.length > 0
          ? "ready"
          : ratingTeamsCovered > 0
            ? "partial"
            : "missing";
      if (slate.games.length > 0 && teamRatingState !== "ready") {
        degradedReasons.push("missing_team_rating_coverage");
      }
      const ownershipState =
        mappingFailed || yahooFailed
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
      const ctpiThroughDate =
        ctpiRows
          .map((row) => row.date)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null;
      const ctpiTeamsCovered = new Set(
        ctpiRows
          .map((row) => row.team)
          .filter((team) => slateTeamAbbrevs.includes(team)),
      ).size;
      const ctpiState = ctpiError
        ? "error"
        : slateTeamAbbrevs.length === 0
          ? "missing"
          : ctpiTeamsCovered === slateTeamAbbrevs.length &&
              untrustedCtpiRows === 0
            ? "ready"
            : ctpiTeamsCovered > 0
              ? "partial"
              : "missing";
      if (slate.games.length > 0 && ctpiState !== "ready") {
        degradedReasons.push(
          untrustedCtpiRows > 0
            ? "untrusted_team_form_history"
            : "missing_ctpi_coverage",
        );
      }
      const gamesRemainingTeamsCovered = slateTeamIds.filter((teamId) =>
        gamesRemaining.has(teamId),
      ).length;
      const gamesRemainingState = gamesRemainingError
        ? "error"
        : slateTeamIds.length === 0
          ? "missing"
          : gamesRemainingTeamsCovered === slateTeamIds.length
            ? "ready"
            : gamesRemainingTeamsCovered > 0
              ? "partial"
              : "missing";
      if (gamesRemainingState !== "ready") {
        degradedReasons.push("games_remaining_unavailable");
      }

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
              ? "Player projections are shown, but their historical input checks are incomplete. Treat these rankings as provisional."
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
          formulaVersion: ctpiRows[0]?.formula_version ?? null,
          inputVersion: ctpiRows[0]?.input_version ?? null,
          trustedRows: ctpiRows.length,
          untrustedRows: untrustedCtpiRows,
          message:
            ctpiState === "ready"
              ? null
              : untrustedCtpiRows > 0 && ctpiRows.length === 0
                ? "Recent team form is temporarily unavailable while its historical game data is being verified. It is hidden rather than show a misleading score."
                : untrustedCtpiRows > 0
                  ? `Recent team form leaves out ${untrustedCtpiRows} unapproved or unverifiable data points. Fantasy ranks are unaffected.`
                  : ctpiState === "partial"
                    ? `Recent team form is available for ${ctpiTeamsCovered} of ${slateTeamAbbrevs.length} teams using only games completed before this slate. Fantasy ranks are unaffected.`
                    : "There is not enough verified team-form history before this slate. Fantasy ranks are unaffected.",
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
              : goalieTeamsCovered === 0
                ? "Starting-goalie information is unavailable for this slate, so goalie rankings are not shown."
                : `Starting-goalie information is available for ${goalieTeamsCovered} of ${slateTeamIds.length} teams; ${goalieStaleTeams} team records are out of date.`,
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
          date: gamesRemainingState === "ready" ? resolvedDate : null,
          message:
            gamesRemainingState === "ready"
              ? null
              : gamesRemainingState === "partial"
                ? `Weekly game volume covers ${gamesRemainingTeamsCovered} of ${slateTeamIds.length} slate teams and does not affect ranking.`
                : "Weekly game volume is unavailable and does not affect ranking.",
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
          pageSize: request.paginationRequested
            ? request.pageSize
            : totalPlayers,
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
