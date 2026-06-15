import type { NextApiRequest } from "next";

import supabase from "lib/supabase/server";

import {
  formatGoalieDeploymentBucket,
  getGoalieDeploymentBucket,
  GOALIE_ROLE_FILTER_OPTIONS,
  isGoalieReallyBadStart,
  isGoalieStealGame,
  type GoalieDeploymentBucket,
  type GoalieRoleFilter,
} from "./goalieMethodology";
import { rankNormalizedMetricValues } from "./rankingCalculator";
import { ContextualRankingsQueryError } from "./rankingTypes";

export type GoalieMatrixMetricKey =
  | "save_percentage"
  | "gsax"
  | "gsaa_per_60"
  | "quality_start_pct"
  | "really_bad_start_rate"
  | "steal_rate"
  | "start_share";

export type GoalieMatrixWindow = "season" | "last5" | "last10" | "last20";
export type GoalieMatrixSortDirection = "asc" | "desc";
export type GoalieMatrixRoleFilter = GoalieRoleFilter;

export type GoalieMatrixRequest = {
  season: number;
  asOfDate: string | null;
  window: GoalieMatrixWindow;
  metric: GoalieMatrixMetricKey;
  sortDirection: GoalieMatrixSortDirection;
  role: GoalieMatrixRoleFilter;
  minStarts: number;
  minShots: number;
  team: string | null;
  search: string | null;
  page: number;
  pageSize: number;
};

type GoalieGameSourceRow = {
  player_id: number;
  date: string;
  season_id: number;
  team_id: number | null;
  player_name: string | null;
  games_played: number | null;
  games_started: number | null;
  wins: number | null;
  saves: number | null;
  goals_against: number | null;
  shots_against: number | null;
  time_on_ice: number | null;
  quality_start: number | null;
  nst_5v5_counts_toi: number | null;
  nst_5v5_counts_xg_against: number | null;
  nst_5v5_counts_goals_against: number | null;
  nst_5v5_counts_gsaa: number | null;
};

type GoalieStartProjectionRow = {
  player_id: number;
  team_id: number | null;
  game_date: string | null;
  start_probability: number | null;
  projected_gsaa_per_60: number | null;
  confirmed_status: boolean | null;
  l10_start_pct: number | null;
  season_start_pct: number | null;
};

type PlayerMeta = {
  id: number;
  fullName: string | null;
  image_url: string | null;
};

type TeamMeta = {
  id: number;
  abbreviation: string | null;
  name: string | null;
};

type GoalieAggregate = {
  playerId: number;
  playerName: string | null;
  teamId: number | null;
  latestGameDate: string | null;
  gamesPlayed: number;
  gamesStarted: number;
  saves: number;
  goalsAgainst: number;
  shotsAgainst: number;
  toiSeconds: number;
  qualityStarts: number;
  reallyBadStarts: number;
  stealGames: number;
  nst5v5ToiSeconds: number;
  nst5v5Gsaa: number | null;
  nst5v5Gsax: number | null;
  sourceWarnings: string[];
};

export type GoalieMatrixMetricCell = {
  metricKey: GoalieMatrixMetricKey;
  rawValue: number | null;
  formattedValue: string | null;
  rank: number | null;
  percentile: number | null;
  qualifiedPeerCount: number;
  lowerIsBetter: boolean;
};

export type GoalieMatrixRow = {
  entity: {
    id: number;
    name: string | null;
    position: "G";
    imageUrl: string | null;
  };
  team: {
    id: number | null;
    abbreviation: string | null;
    name: string | null;
  };
  sample: {
    gamesPlayed: number;
    gamesStarted: number;
    shotsAgainst: number;
    toiSeconds: number;
    minimumSampleMet: boolean;
    confidence: "low" | "medium" | "high";
  };
  role: {
    deploymentBucket: GoalieDeploymentBucket | null;
    deploymentLabel: string | null;
    deploymentSource:
      | "goalie_start_projections.season_start_pct"
      | "selected_window_team_start_share"
      | null;
    windowStartShare: number | null;
    startShareLast10: number | null;
    seasonStartShare: number | null;
    startProbability: number | null;
    projectedGsaaPer60: number | null;
    confirmedStatus: boolean | null;
  };
  sort: {
    metricKey: GoalieMatrixMetricKey;
    rank: number | null;
    percentile: number | null;
  };
  metrics: Record<GoalieMatrixMetricKey, GoalieMatrixMetricCell>;
  warnings: string[];
};

export type GoalieMatrixResponse = {
  success: true;
  request: GoalieMatrixRequest;
  rows: GoalieMatrixRow[];
  meta: {
    generatedAt: string;
    rowCount: number;
    totalRankedRows: number;
    page: number;
    pageSize: number;
    pageCount: number;
    snapshotDate: string | null;
    latestAvailableSnapshotDate: string | null;
    sourceTables: string[];
    metricColumns: Array<{
      metricKey: GoalieMatrixMetricKey;
      label: string;
      description: string;
      lowerIsBetter: boolean;
      source: string;
    }>;
    sourceWarnings: string[];
  };
};

const GOALIE_QUERY_PAGE_SIZE = 1000;
const METADATA_QUERY_PAGE_SIZE = 1000;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;
const METRIC_COLUMNS: GoalieMatrixResponse["meta"]["metricColumns"] = [
  {
    metricKey: "save_percentage",
    label: "SV%",
    description: "Window save percentage from WGO goalie game logs.",
    lowerIsBetter: false,
    source: "goalie_stats_unified.saves / shots_against",
  },
  {
    metricKey: "gsax",
    label: "GSAx",
    description: "5v5 expected goals against minus 5v5 goals against.",
    lowerIsBetter: false,
    source:
      "goalie_stats_unified.nst_5v5_counts_xg_against - nst_5v5_counts_goals_against",
  },
  {
    metricKey: "gsaa_per_60",
    label: "GSAA/60",
    description: "5v5 goals saved above average per 60.",
    lowerIsBetter: false,
    source: "goalie_stats_unified.nst_5v5_counts_gsaa / nst_5v5_counts_toi",
  },
  {
    metricKey: "quality_start_pct",
    label: "QS%",
    description: "Quality starts divided by starts.",
    lowerIsBetter: false,
    source: "goalie_stats_unified.quality_start / games_started",
  },
  {
    metricKey: "really_bad_start_rate",
    label: "RBS%",
    description:
      "Really bad starts divided by starts; lower rates are better.",
    lowerIsBetter: true,
    source:
      "goalieMethodology.isGoalieReallyBadStart over goalie_stats_unified rows",
  },
  {
    metricKey: "steal_rate",
    label: "Steal Rate",
    description: "Starts won with modern GSAx at or above the steal threshold.",
    lowerIsBetter: false,
    source: "goalieMethodology.isGoalieStealGame over goalie_stats_unified rows",
  },
  {
    metricKey: "start_share",
    label: "Start Share",
    description: "Latest projected season start share from goalie_start_projections.",
    lowerIsBetter: false,
    source: "goalie_start_projections.season_start_pct",
  },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseInteger(
  value: string | string[] | undefined,
  key: string,
  options: { defaultValue?: number; required?: boolean; min?: number; max?: number },
) {
  const raw = first(value);
  if (!raw) {
    if (options.required) {
      throw new ContextualRankingsQueryError(`Missing required query param: ${key}`, {
        [key]: "required",
      });
    }
    return options.defaultValue ?? null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: "must be an integer",
    });
  }
  if (options.min != null && parsed < options.min) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must be >= ${options.min}`,
    });
  }
  if (options.max != null && parsed > options.max) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must be <= ${options.max}`,
    });
  }
  return parsed;
}

function parseEnum<T extends readonly string[]>(
  value: string | string[] | undefined,
  key: string,
  allowed: T,
  defaultValue: T[number],
): T[number] {
  const raw = (first(value) ?? defaultValue).toLowerCase();
  const match = allowed.find((entry) => entry.toLowerCase() === raw);
  if (!match) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must be one of ${allowed.join(", ")}`,
    });
  }
  return match;
}

function parseDate(value: string | string[] | undefined) {
  const raw = first(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ContextualRankingsQueryError("Invalid query param: as_of_date", {
      as_of_date: "must be YYYY-MM-DD",
    });
  }
  return raw;
}

function parseSearch(value: string | string[] | undefined) {
  const raw = first(value)?.trim();
  return raw ? raw.slice(0, 80) : null;
}

function parseGoalieRole(value: string | string[] | undefined): GoalieMatrixRoleFilter {
  const raw = first(value)?.trim().toLowerCase() ?? "all";
  return GOALIE_ROLE_FILTER_OPTIONS.some((option) => option.value === raw)
    ? (raw as GoalieMatrixRoleFilter)
    : "all";
}

export function parseGoalieMatrixRequest(
  query: NextApiRequest["query"],
): GoalieMatrixRequest {
  return {
    season:
      parseInteger(query.season, "season", {
        required: true,
        min: 19000000,
        max: 21000000,
      }) ?? 0,
    asOfDate: parseDate(query.as_of_date),
    window: parseEnum(
      query.window,
      "window",
      ["season", "last5", "last10", "last20"] as const,
      "season",
    ),
    metric: parseEnum(
      query.metric,
      "metric",
      METRIC_COLUMNS.map((column) => column.metricKey) as GoalieMatrixMetricKey[],
      "save_percentage",
    ),
    sortDirection: parseEnum(
      query.sort_direction,
      "sort_direction",
      ["asc", "desc"] as const,
      "desc",
    ),
    role: parseGoalieRole(query.role ?? query.goalie_role),
    minStarts: parseInteger(query.min_starts, "min_starts", {
      defaultValue: 3,
      min: 0,
    }) ?? 3,
    minShots: parseInteger(query.min_shots, "min_shots", {
      defaultValue: 100,
      min: 0,
    }) ?? 100,
    team: parseSearch(query.team),
    search: parseSearch(query.search),
    page: parseInteger(query.page, "page", {
      defaultValue: 1,
      min: 1,
      max: 100,
    }) ?? 1,
    pageSize:
      parseInteger(query.page_size, "page_size", {
        defaultValue: DEFAULT_PAGE_SIZE,
        min: 1,
        max: MAX_PAGE_SIZE,
      }) ?? DEFAULT_PAGE_SIZE,
  };
}

function goalieRowMatchesSearch(row: GoalieMatrixRow, search: string | null) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return [
    row.entity.name,
    String(row.entity.id),
    row.team.abbreviation,
    row.team.name,
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(needle));
}

function finite(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function round(value: number, decimals = 6) {
  return Number(value.toFixed(decimals));
}

function windowLimit(window: GoalieMatrixWindow) {
  if (window === "last5") return 5;
  if (window === "last10") return 10;
  if (window === "last20") return 20;
  return null;
}

function formatMetricValue(metricKey: GoalieMatrixMetricKey, value: number | null) {
  if (value == null) return null;
  if (
    metricKey === "save_percentage" ||
    metricKey === "quality_start_pct" ||
    metricKey === "really_bad_start_rate" ||
    metricKey === "steal_rate" ||
    metricKey === "start_share"
  ) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (metricKey === "gsaa_per_60") return value.toFixed(2);
  return value.toFixed(1);
}

function metricValue(
  aggregate: GoalieAggregate,
  projection: GoalieStartProjectionRow | null,
  metricKey: GoalieMatrixMetricKey,
) {
  if (metricKey === "save_percentage") {
    return aggregate.shotsAgainst > 0
      ? round(aggregate.saves / aggregate.shotsAgainst)
      : null;
  }
  if (metricKey === "quality_start_pct") {
    return aggregate.gamesStarted > 0
      ? round(aggregate.qualityStarts / aggregate.gamesStarted)
      : null;
  }
  if (metricKey === "steal_rate") {
    return aggregate.gamesStarted > 0
      ? round(aggregate.stealGames / aggregate.gamesStarted)
      : null;
  }
  if (metricKey === "really_bad_start_rate") {
    return aggregate.gamesStarted > 0
      ? round(aggregate.reallyBadStarts / aggregate.gamesStarted)
      : null;
  }
  if (metricKey === "gsax") return aggregate.nst5v5Gsax;
  if (metricKey === "gsaa_per_60") {
    return aggregate.nst5v5Gsaa != null && aggregate.nst5v5ToiSeconds > 0
      ? round((aggregate.nst5v5Gsaa / aggregate.nst5v5ToiSeconds) * 3600)
      : null;
  }
  if (metricKey === "start_share") return finite(projection?.season_start_pct);
  return null;
}

function sampleConfidence(args: {
  starts: number;
  shots: number;
  minStarts: number;
  minShots: number;
}) {
  if (args.starts < args.minStarts || args.shots < args.minShots) return "low";
  const startMultiple = args.minStarts > 0 ? args.starts / args.minStarts : 2;
  const shotMultiple = args.minShots > 0 ? args.shots / args.minShots : 2;
  const sampleMultiple = Math.min(startMultiple, shotMultiple);
  if (sampleMultiple >= 2) return "high";
  return "medium";
}

function roleMatchesFilter(
  bucket: GoalieDeploymentBucket | null,
  filter: GoalieMatrixRoleFilter,
) {
  return filter === "all" || bucket === filter;
}

export function aggregateGoalieGameRows(
  rows: readonly GoalieGameSourceRow[],
  window: GoalieMatrixWindow,
): GoalieAggregate[] {
  const rowsByGoalie = new Map<number, GoalieGameSourceRow[]>();
  for (const row of rows) {
    const current = rowsByGoalie.get(row.player_id) ?? [];
    current.push(row);
    rowsByGoalie.set(row.player_id, current);
  }

  const limit = windowLimit(window);
  const aggregates: GoalieAggregate[] = [];
  for (const [playerId, goalieRows] of rowsByGoalie.entries()) {
    const selectedRows = [...goalieRows]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit ?? undefined);
    const latestRow = selectedRows[0] ?? null;
    let gamesPlayed = 0;
    let gamesStarted = 0;
    let saves = 0;
    let goalsAgainst = 0;
    let shotsAgainst = 0;
    let toiSeconds = 0;
    let qualityStarts = 0;
    let reallyBadStarts = 0;
    let stealGames = 0;
    let nst5v5ToiSeconds = 0;
    let nst5v5Gsaa = 0;
    let nst5v5GsaaRows = 0;
    let nst5v5Gsax = 0;
    let nst5v5GsaxRows = 0;
    const warnings = new Set<string>();

    for (const row of selectedRows) {
      gamesPlayed += finite(row.games_played) ?? 0;
      gamesStarted += finite(row.games_started) ?? 0;
      saves += finite(row.saves) ?? 0;
      goalsAgainst += finite(row.goals_against) ?? 0;
      shotsAgainst += finite(row.shots_against) ?? 0;
      toiSeconds += finite(row.time_on_ice) ?? 0;
      qualityStarts += finite(row.quality_start) ?? 0;
      nst5v5ToiSeconds += finite(row.nst_5v5_counts_toi) ?? 0;

      const gsaa = finite(row.nst_5v5_counts_gsaa);
      if (gsaa != null) {
        nst5v5Gsaa += gsaa;
        nst5v5GsaaRows += 1;
      }

      const xgAgainst = finite(row.nst_5v5_counts_xg_against);
      const nstGoalsAgainst = finite(row.nst_5v5_counts_goals_against);
      if (xgAgainst != null && nstGoalsAgainst != null) {
        const gsax = xgAgainst - nstGoalsAgainst;
        nst5v5Gsax += gsax;
        nst5v5GsaxRows += 1;
        const methodologyGame = {
          goalieId: row.player_id,
          date: row.date,
          started: (finite(row.games_started) ?? 0) > 0,
          shotsAgainst: finite(row.shots_against),
          saves: finite(row.saves),
          goalsAgainst: nstGoalsAgainst,
          goalsSavedAboveExpected: gsax,
          won: (finite(row.wins) ?? 0) > 0,
        };
        if (isGoalieReallyBadStart(methodologyGame)) {
          reallyBadStarts += 1;
        }
        if (
          isGoalieStealGame(methodologyGame)
        ) {
          stealGames += 1;
        }
      }
    }

    if (nst5v5GsaaRows < selectedRows.length) {
      warnings.add("partial_nst_5v5_gsaa_source");
    }
    if (nst5v5GsaxRows < selectedRows.length) {
      warnings.add("partial_nst_5v5_gsax_source");
    }

    aggregates.push({
      playerId,
      playerName: latestRow?.player_name ?? null,
      teamId: latestRow?.team_id ?? null,
      latestGameDate: latestRow?.date ?? null,
      gamesPlayed,
      gamesStarted,
      saves,
      goalsAgainst,
      shotsAgainst,
      toiSeconds,
      qualityStarts,
      reallyBadStarts,
      stealGames,
      nst5v5ToiSeconds,
      nst5v5Gsaa: nst5v5GsaaRows > 0 ? round(nst5v5Gsaa) : null,
      nst5v5Gsax: nst5v5GsaxRows > 0 ? round(nst5v5Gsax) : null,
      sourceWarnings: [...warnings],
    });
  }

  return aggregates;
}

function buildTeamStartTotals(aggregates: readonly GoalieAggregate[]) {
  const startsByTeamId = new Map<number, number>();
  for (const aggregate of aggregates) {
    if (aggregate.teamId == null) continue;
    startsByTeamId.set(
      aggregate.teamId,
      (startsByTeamId.get(aggregate.teamId) ?? 0) + aggregate.gamesStarted,
    );
  }
  return startsByTeamId;
}

function buildGoalieRoleContext(args: {
  aggregate: GoalieAggregate;
  projection: GoalieStartProjectionRow | null;
  teamStartTotals: Map<number, number>;
}) {
  const teamStarts =
    args.aggregate.teamId == null
      ? null
      : args.teamStartTotals.get(args.aggregate.teamId) ?? null;
  const windowStartShare =
    teamStarts != null && teamStarts > 0
      ? round(args.aggregate.gamesStarted / teamStarts)
      : null;
  const projectedSeasonShare = finite(args.projection?.season_start_pct);
  const roleShare = projectedSeasonShare ?? windowStartShare;
  const deploymentBucket = getGoalieDeploymentBucket(roleShare);

  return {
    deploymentBucket,
    deploymentLabel: formatGoalieDeploymentBucket(deploymentBucket),
    deploymentSource:
      projectedSeasonShare != null
        ? "goalie_start_projections.season_start_pct" as const
        : windowStartShare != null
          ? "selected_window_team_start_share" as const
          : null,
    windowStartShare,
  };
}

export function rankGoalieMetricValues<T extends { id: number; value: number | null }>(
  rows: T[],
  lowerIsBetter = false,
) {
  return rankNormalizedMetricValues(
    rows.map((row) => ({
      id: row.id,
      normalizedValue:
        row.value == null ? null : lowerIsBetter ? -row.value : row.value,
    })),
  );
}

function latestDate(rows: readonly GoalieGameSourceRow[]) {
  return rows.reduce<string | null>(
    (latest, row) => (latest == null || row.date > latest ? row.date : latest),
    null,
  );
}

async function fetchAllGoalieGameRows(request: GoalieMatrixRequest) {
  const rows: GoalieGameSourceRow[] = [];
  const teamIds = await resolveGoalieTeamFilterIds(request.team);
  if (teamIds != null && teamIds.length === 0) return rows;

  for (let from = 0;; from += GOALIE_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("goalie_stats_unified" as any)
      .select(
        [
          "player_id",
          "date",
          "season_id",
          "team_id",
          "player_name",
          "games_played",
          "games_started",
          "wins",
          "saves",
          "goals_against",
          "shots_against",
          "time_on_ice",
          "quality_start",
          "nst_5v5_counts_toi",
          "nst_5v5_counts_xg_against",
          "nst_5v5_counts_goals_against",
          "nst_5v5_counts_gsaa",
        ].join(","),
      )
      .eq("season_id", request.season)
      .order("date", { ascending: false })
      .range(from, from + GOALIE_QUERY_PAGE_SIZE - 1);
    if (request.asOfDate != null) {
      query = query.lte("date", request.asOfDate);
    }
    if (teamIds != null) {
      query = query.in("team_id", teamIds);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Unable to load goalie ranking source rows: ${error.message}`);
    }
    rows.push(...((data ?? []) as unknown as GoalieGameSourceRow[]));
    if ((data ?? []).length < GOALIE_QUERY_PAGE_SIZE) break;
  }
  return rows;
}

async function resolveGoalieTeamFilterIds(team: string | null) {
  if (team == null || team.trim() === "") return null;
  const normalized = team.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) return [Number(normalized)];

  const { data, error } = await supabase.from("teams").select("id,abbreviation,name");
  if (error) throw new Error(`Unable to resolve goalie team filter: ${error.message}`);

  return ((data ?? []) as TeamMeta[])
    .filter((row) => {
      const abbreviation = row.abbreviation?.toLowerCase() ?? "";
      const name = row.name?.toLowerCase() ?? "";
      return abbreviation === normalized || name === normalized;
    })
    .map((row) => row.id);
}

async function fetchLatestStartProjections(args: {
  season: number;
  asOfDate: string | null;
}) {
  const rows: GoalieStartProjectionRow[] = [];
  for (let from = 0;; from += GOALIE_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("goalie_start_projections" as any)
      .select(
        [
          "player_id",
          "team_id",
          "game_date",
          "start_probability",
          "projected_gsaa_per_60",
          "confirmed_status",
          "l10_start_pct",
          "season_start_pct",
        ].join(","),
      )
      .gte("game_date", `${String(args.season).slice(0, 4)}-07-01`)
      .order("game_date", { ascending: false })
      .range(from, from + GOALIE_QUERY_PAGE_SIZE - 1);
    if (args.asOfDate != null) {
      query = query.lte("game_date", args.asOfDate);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Unable to load goalie start projections: ${error.message}`);
    }
    rows.push(...((data ?? []) as unknown as GoalieStartProjectionRow[]));
    if ((data ?? []).length < GOALIE_QUERY_PAGE_SIZE) break;
  }

  const latestByPlayer = new Map<number, GoalieStartProjectionRow>();
  for (const row of rows) {
    if (!latestByPlayer.has(row.player_id)) latestByPlayer.set(row.player_id, row);
  }
  return latestByPlayer;
}

async function fetchPlayerMeta(playerIds: number[]) {
  if (playerIds.length === 0) return new Map<number, PlayerMeta>();
  const rows: PlayerMeta[] = [];
  for (let from = 0; from < playerIds.length; from += METADATA_QUERY_PAGE_SIZE) {
    const chunk = playerIds.slice(from, from + METADATA_QUERY_PAGE_SIZE);
    const { data, error } = await supabase
      .from("players")
      .select("id,fullName,image_url")
      .in("id", chunk);
    if (error) throw new Error(`Unable to load goalie metadata: ${error.message}`);
    rows.push(...((data ?? []) as PlayerMeta[]));
  }
  return new Map(rows.map((row) => [row.id, row]));
}

async function fetchTeamMeta(teamIds: number[]) {
  if (teamIds.length === 0) return new Map<number, TeamMeta>();
  const { data, error } = await supabase
    .from("teams")
    .select("id,abbreviation,name")
    .in("id", Array.from(new Set(teamIds)));
  if (error) throw new Error(`Unable to load goalie team metadata: ${error.message}`);
  return new Map(((data ?? []) as TeamMeta[]).map((row) => [row.id, row]));
}

export async function buildGoalieMatrixSurface(
  request: GoalieMatrixRequest,
): Promise<GoalieMatrixResponse> {
  const gameRows = await fetchAllGoalieGameRows(request);
  const latestAvailableSnapshotDate = latestDate(gameRows);
  const aggregates = aggregateGoalieGameRows(gameRows, request.window);
  const teamStartTotals = buildTeamStartTotals(aggregates);
  const playerIds = aggregates.map((aggregate) => aggregate.playerId);
  const teamIds = aggregates
    .map((aggregate) => aggregate.teamId)
    .filter((id): id is number => id != null);
  const [projectionByPlayerId, playersById, teamsById] = await Promise.all([
    fetchLatestStartProjections({
      season: request.season,
      asOfDate: request.asOfDate ?? latestAvailableSnapshotDate,
    }),
    fetchPlayerMeta(playerIds),
    fetchTeamMeta(teamIds),
  ]);

  const valuesByMetric = new Map<
    GoalieMatrixMetricKey,
    Map<number, { value: number | null; ranks: ReturnType<typeof rankGoalieMetricValues> }>
  >();
  for (const column of METRIC_COLUMNS) {
    const values = new Map<number, { value: number | null; ranks: ReturnType<typeof rankGoalieMetricValues> }>();
    const rankInput = aggregates
      .filter(
        (aggregate) => {
          const projection = projectionByPlayerId.get(aggregate.playerId) ?? null;
          const roleContext = buildGoalieRoleContext({
            aggregate,
            projection,
            teamStartTotals,
          });
          return (
            aggregate.gamesStarted >= request.minStarts &&
            aggregate.shotsAgainst >= request.minShots &&
            roleMatchesFilter(roleContext.deploymentBucket, request.role)
          );
        },
      )
      .map((aggregate) => {
        const projection = projectionByPlayerId.get(aggregate.playerId) ?? null;
        return {
          id: aggregate.playerId,
          value: metricValue(aggregate, projection, column.metricKey),
        };
      });
    const ranks = rankGoalieMetricValues(rankInput, column.lowerIsBetter);
    for (const aggregate of aggregates) {
      const projection = projectionByPlayerId.get(aggregate.playerId) ?? null;
      values.set(aggregate.playerId, {
        value: metricValue(aggregate, projection, column.metricKey),
        ranks,
      });
    }
    valuesByMetric.set(column.metricKey, values);
  }

  const rows = aggregates.map((aggregate): GoalieMatrixRow => {
    const player = playersById.get(aggregate.playerId);
    const projection = projectionByPlayerId.get(aggregate.playerId) ?? null;
    const roleContext = buildGoalieRoleContext({
      aggregate,
      projection,
      teamStartTotals,
    });
    const teamId = aggregate.teamId ?? projection?.team_id ?? null;
    const team = teamId == null ? null : teamsById.get(teamId) ?? null;
    const minimumSampleMet =
      aggregate.gamesStarted >= request.minStarts &&
      aggregate.shotsAgainst >= request.minShots;
    const metrics = Object.fromEntries(
      METRIC_COLUMNS.map((column) => {
        const value = valuesByMetric.get(column.metricKey)?.get(aggregate.playerId);
        const rank = value?.ranks.get(aggregate.playerId) ?? null;
        return [
          column.metricKey,
          {
            metricKey: column.metricKey,
            rawValue: value?.value ?? null,
            formattedValue: formatMetricValue(column.metricKey, value?.value ?? null),
            rank: rank?.rank ?? null,
            percentile: rank?.percentile ?? null,
            qualifiedPeerCount: rank?.qualifiedPeerCount ?? 0,
            lowerIsBetter: column.lowerIsBetter,
          },
        ];
      }),
    ) as Record<GoalieMatrixMetricKey, GoalieMatrixMetricCell>;
    const sortCell = metrics[request.metric];
    return {
      entity: {
        id: aggregate.playerId,
        name: player?.fullName ?? aggregate.playerName,
        position: "G",
        imageUrl: player?.image_url ?? null,
      },
      team: {
        id: teamId,
        abbreviation: team?.abbreviation ?? null,
        name: team?.name ?? null,
      },
      sample: {
        gamesPlayed: aggregate.gamesPlayed,
        gamesStarted: aggregate.gamesStarted,
        shotsAgainst: aggregate.shotsAgainst,
        toiSeconds: aggregate.toiSeconds,
        minimumSampleMet,
        confidence: sampleConfidence({
          starts: aggregate.gamesStarted,
          shots: aggregate.shotsAgainst,
          minStarts: request.minStarts,
          minShots: request.minShots,
        }),
      },
      role: {
        deploymentBucket: roleContext.deploymentBucket,
        deploymentLabel: roleContext.deploymentLabel,
        deploymentSource: roleContext.deploymentSource,
        windowStartShare: roleContext.windowStartShare,
        startShareLast10: finite(projection?.l10_start_pct),
        seasonStartShare: finite(projection?.season_start_pct),
        startProbability: finite(projection?.start_probability),
        projectedGsaaPer60: finite(projection?.projected_gsaa_per_60),
        confirmedStatus: projection?.confirmed_status ?? null,
      },
      sort: {
        metricKey: request.metric,
        rank: sortCell.rank,
        percentile: sortCell.percentile,
      },
      metrics,
      warnings: [
        ...aggregate.sourceWarnings,
        ...(minimumSampleMet ? [] : ["sample_below_minimum"]),
      ],
    };
  });

  rows.sort((a, b) => {
    const aCell = a.metrics[request.metric];
    const bCell = b.metrics[request.metric];
    if (aCell.rank != null && bCell.rank == null) return -1;
    if (aCell.rank == null && bCell.rank != null) return 1;
    if (aCell.rank != null && bCell.rank != null) {
      return request.sortDirection === "asc"
        ? bCell.rank - aCell.rank || a.entity.id - b.entity.id
        : aCell.rank - bCell.rank || a.entity.id - b.entity.id;
    }
    const aValue = aCell.rawValue;
    const bValue = bCell.rawValue;
    if (aValue == null && bValue == null) return a.entity.id - b.entity.id;
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    return request.sortDirection === "asc"
      ? aValue - bValue || a.entity.id - b.entity.id
      : bValue - aValue || a.entity.id - b.entity.id;
  });

  const filteredRows = rows.filter(
    (row) =>
      roleMatchesFilter(row.role.deploymentBucket, request.role) &&
      goalieRowMatchesSearch(row, request.search),
  );
  const totalRankedRows = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRankedRows / request.pageSize));
  const start = (request.page - 1) * request.pageSize;
  const pageRows = filteredRows.slice(start, start + request.pageSize);
  const sourceWarnings = Array.from(
    new Set(rows.flatMap((row) => row.warnings).filter((warning) => warning.startsWith("partial_"))),
  );

  return {
    success: true,
    request,
    rows: pageRows,
    meta: {
      generatedAt: new Date().toISOString(),
      rowCount: pageRows.length,
      totalRankedRows,
      page: request.page,
      pageSize: request.pageSize,
      pageCount,
      snapshotDate: request.asOfDate ?? latestAvailableSnapshotDate,
      latestAvailableSnapshotDate,
      sourceTables: [
        "goalie_stats_unified",
        "wgo_goalie_stats",
        "nst_gamelog_goalie_*",
        "goalie_start_projections",
      ],
      metricColumns: METRIC_COLUMNS,
      sourceWarnings,
    },
  };
}
