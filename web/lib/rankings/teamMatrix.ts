import type { NextApiRequest } from "next";

import supabase from "lib/supabase/server";

import {
  TEAM_STYLE_SOURCE_CONTRACT,
  calculateRunAndGunProfile,
  calculateTeamExpectedGoalsForPercentage,
  calculateTeamLuckComponents,
  calculateTeamShotQuality,
} from "./teamStyleMethodology";
import { ContextualRankingsQueryError } from "./rankingTypes";

export type TeamMatrixMetricKey =
  | "off_rating"
  | "def_rating"
  | "xgf60"
  | "xga60"
  | "xgf_percentage"
  | "shot_quality"
  | "event_rate"
  | "finishing_luck"
  | "save_luck"
  | "net_luck"
  | "pace_rating"
  | "special_rating";

export type TeamMatrixRequest = {
  season: number;
  asOfDate: string | null;
  metric: TeamMatrixMetricKey;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
};

type TeamPowerRow = {
  team_abbreviation: string;
  date: string;
  off_rating: number | null;
  def_rating: number | null;
  pace_rating: number | null;
  xgf60: number | null;
  gf60: number | null;
  sf60: number | null;
  xga60: number | null;
  ga60: number | null;
  sa60: number | null;
  pace60: number | null;
  trend10: number | null;
  pp_tier: number | null;
  pk_tier: number | null;
  finishing_rating: number | null;
  goalie_rating: number | null;
  danger_rating: number | null;
  special_rating: number | null;
  discipline_rating: number | null;
  variance_flag: number | null;
};

type TeamUnderlyingRow = {
  game_date: string;
  team_id: number;
  xgf: number;
  xga: number;
  gf: number;
  ga: number;
  ff: number;
  fa: number;
  cf: number;
  ca: number;
};

type NstTeamRow = {
  team_abbreviation: string;
  team_name: string | null;
  gp: number | null;
  xgf: number | null;
  xga: number | null;
  gf: number | null;
  ga: number | null;
  ff: number | null;
  fa: number | null;
  cf: number | null;
  ca: number | null;
  pdo: number | null;
  situation: string | null;
};

type TeamMeta = {
  id: number;
  abbreviation: string | null;
  name: string | null;
};

type TeamStyleAggregate = {
  teamId: number | null;
  teamAbbreviation: string;
  gamesCount: number;
  latestDate: string | null;
  xgf: number | null;
  xga: number | null;
  gf: number | null;
  ga: number | null;
  ff: number | null;
  fa: number | null;
  cf: number | null;
  ca: number | null;
  source: "team_underlying_stats_summary" | "nst_team_stats" | "none";
};

type RankedMetric = {
  rawValue: number | null;
  formattedValue: string | null;
  rank: number | null;
  percentile: number | null;
  qualifiedPeerCount: number;
  lowerIsBetter: boolean;
};

export type TeamMatrixRow = {
  team: {
    id: number | null;
    abbreviation: string;
    name: string | null;
  };
  record: {
    latestPowerDate: string;
    styleSnapshotDate: string | null;
    styleGames: number;
    ppTier: number | null;
    pkTier: number | null;
    trend10: number | null;
  };
  style: {
    label: string;
    paceAxis: string | null;
    controlAxis: string | null;
    xgForPercentage: number | null;
    eventRate: number | null;
    shotQuality: number | null;
    source: string;
    adjusted: false;
  };
  luck: {
    finishingLuck: number | null;
    saveLuck: number | null;
    netGoalsAboveExpected: number | null;
  };
  sort: {
    metricKey: TeamMatrixMetricKey;
    rank: number | null;
    percentile: number | null;
  };
  metrics: Record<TeamMatrixMetricKey, RankedMetric>;
  warnings: string[];
};

export type TeamMatrixResponse = {
  success: true;
  request: TeamMatrixRequest;
  rows: TeamMatrixRow[];
  meta: {
    generatedAt: string;
    rowCount: number;
    totalRankedRows: number;
    page: number;
    pageSize: number;
    pageCount: number;
    snapshotDate: string | null;
    latestAvailableSnapshotDate: string | null;
    styleSnapshotDate: string | null;
    sourceTables: string[];
    sourceWarnings: string[];
    teamStyleContract: typeof TEAM_STYLE_SOURCE_CONTRACT;
    metricColumns: Array<{
      metricKey: TeamMatrixMetricKey;
      label: string;
      description: string;
      lowerIsBetter: boolean;
      source: string;
    }>;
  };
};

const TEAM_QUERY_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const METRIC_COLUMNS: TeamMatrixResponse["meta"]["metricColumns"] = [
  {
    metricKey: "off_rating",
    label: "Off Rating",
    description: "Current offensive team power rating.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.off_rating",
  },
  {
    metricKey: "def_rating",
    label: "Def Rating",
    description: "Current defensive team power rating.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.def_rating",
  },
  {
    metricKey: "xgf60",
    label: "xGF/60",
    description: "Expected goals for per 60 from current team power ratings.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.xgf60",
  },
  {
    metricKey: "xga60",
    label: "xGA/60",
    description: "Expected goals against per 60. Lower raw values are better.",
    lowerIsBetter: true,
    source: "team_power_ratings_daily.xga60",
  },
  {
    metricKey: "xgf_percentage",
    label: "xGF%",
    description: "Raw five-on-five expected-goals control share.",
    lowerIsBetter: false,
    source: "team_underlying_stats_summary fiveOnFive allScores",
  },
  {
    metricKey: "shot_quality",
    label: "Shot Quality",
    description: "Raw xGF per Fenwick-for attempt.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateTeamShotQuality",
  },
  {
    metricKey: "event_rate",
    label: "Event Rate",
    description: "Raw five-on-five xG event rate per team game.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateRunAndGunProfile",
  },
  {
    metricKey: "finishing_luck",
    label: "Fin Luck",
    description: "Goals for above expected goals for.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateTeamLuckComponents",
  },
  {
    metricKey: "save_luck",
    label: "Save Luck",
    description: "Expected goals against minus goals against.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateTeamLuckComponents",
  },
  {
    metricKey: "net_luck",
    label: "Net Luck",
    description: "Finishing luck plus save luck.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateTeamLuckComponents",
  },
  {
    metricKey: "pace_rating",
    label: "Pace Rating",
    description: "Current team pace rating.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.pace_rating",
  },
  {
    metricKey: "special_rating",
    label: "Special",
    description: "Current special-teams rating component.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.special_rating",
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

export function parseTeamMatrixRequest(
  query: NextApiRequest["query"],
): TeamMatrixRequest {
  return {
    season:
      parseInteger(query.season, "season", {
        required: true,
        min: 19000000,
        max: 21000000,
      }) ?? 0,
    asOfDate: parseDate(query.as_of_date),
    metric: parseEnum(
      query.metric,
      "metric",
      METRIC_COLUMNS.map((column) => column.metricKey) as TeamMatrixMetricKey[],
      "off_rating",
    ),
    sortDirection: parseEnum(
      query.sort_direction,
      "sort_direction",
      ["asc", "desc"] as const,
      "desc",
    ),
    page:
      parseInteger(query.page, "page", {
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

function finite(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function round(value: number, decimals = 6) {
  return Number(value.toFixed(decimals));
}

function sum(values: Array<number | null | undefined>) {
  let total = 0;
  let count = 0;
  for (const value of values) {
    const number = finite(value);
    if (number == null) continue;
    total += number;
    count += 1;
  }
  return count > 0 ? round(total) : null;
}

function formatMetricValue(metricKey: TeamMatrixMetricKey, value: number | null) {
  if (value == null) return null;
  if (metricKey === "xgf_percentage") return `${value.toFixed(1)}%`;
  if (metricKey === "shot_quality") return value.toFixed(3);
  if (
    metricKey === "event_rate" ||
    metricKey === "finishing_luck" ||
    metricKey === "save_luck" ||
    metricKey === "net_luck" ||
    metricKey === "xgf60" ||
    metricKey === "xga60"
  ) {
    return value.toFixed(2);
  }
  return value.toFixed(1);
}

function deriveStyleBadge(args: {
  paceAxis: string | null;
  controlAxis: string | null;
}) {
  if (args.paceAxis === "high_event" && args.controlAxis === "controls_play") {
    return "High-event controller";
  }
  if (args.paceAxis === "high_event" && args.controlAxis === "chasing_play") {
    return "High-event chasing";
  }
  if (args.paceAxis === "low_event" && args.controlAxis === "controls_play") {
    return "Low-event controller";
  }
  if (args.paceAxis === "low_event" && args.controlAxis === "chasing_play") {
    return "Low-event chasing";
  }
  if (args.controlAxis === "controls_play") return "Controls play";
  if (args.controlAxis === "chasing_play") return "Chasing play";
  if (args.paceAxis === "high_event") return "High-event";
  if (args.paceAxis === "low_event") return "Low-event";
  return "Balanced raw profile";
}

function metricValue(args: {
  power: TeamPowerRow;
  style: ReturnType<typeof buildStylePayload>;
  metricKey: TeamMatrixMetricKey;
}) {
  const { power, style, metricKey } = args;
  if (metricKey === "off_rating") return finite(power.off_rating);
  if (metricKey === "def_rating") return finite(power.def_rating);
  if (metricKey === "xgf60") return finite(power.xgf60);
  if (metricKey === "xga60") return finite(power.xga60);
  if (metricKey === "pace_rating") return finite(power.pace_rating);
  if (metricKey === "special_rating") return finite(power.special_rating);
  if (metricKey === "xgf_percentage") return style.xgForPercentage;
  if (metricKey === "shot_quality") return style.shotQuality;
  if (metricKey === "event_rate") return style.eventRate;
  if (metricKey === "finishing_luck") return style.luck.finishingLuck;
  if (metricKey === "save_luck") return style.luck.saveLuck;
  if (metricKey === "net_luck") return style.luck.netGoalsAboveExpected;
  return null;
}

function rankValues<T extends { id: string; value: number | null }>(
  rows: T[],
  lowerIsBetter: boolean,
) {
  const qualified = rows
    .filter((row): row is T & { value: number } => row.value != null)
    .sort((a, b) => {
      const aValue = lowerIsBetter ? -a.value : a.value;
      const bValue = lowerIsBetter ? -b.value : b.value;
      if (bValue !== aValue) return bValue - aValue;
      return a.id.localeCompare(b.id);
    });
  const qualifiedPeerCount = qualified.length;
  const lowerPeerCountByValue = new Map<number, number>();
  for (let index = 0; index < qualified.length;) {
    const value = lowerIsBetter ? -qualified[index].value : qualified[index].value;
    let nextIndex = index + 1;
    while (
      nextIndex < qualified.length &&
      (lowerIsBetter ? -qualified[nextIndex].value : qualified[nextIndex].value) ===
        value
    ) {
      nextIndex += 1;
    }
    lowerPeerCountByValue.set(value, qualifiedPeerCount - nextIndex);
    index = nextIndex;
  }

  const ranks = new Map<string, { rank: number; percentile: number; qualifiedPeerCount: number }>();
  let priorValue: number | null = null;
  let rank = 0;
  for (const row of qualified) {
    const normalizedValue = lowerIsBetter ? -row.value : row.value;
    if (priorValue == null || normalizedValue !== priorValue) {
      rank += 1;
      priorValue = normalizedValue;
    }
    ranks.set(row.id, {
      rank,
      percentile: round(
        ((lowerPeerCountByValue.get(normalizedValue) ?? 0) / qualifiedPeerCount) *
          100,
        3,
      ),
      qualifiedPeerCount,
    });
  }
  return ranks;
}

export function aggregateTeamStyleRows(args: {
  rows: readonly TeamUnderlyingRow[];
  teamsById: Map<number, TeamMeta>;
}): Map<string, TeamStyleAggregate> {
  const rowsByTeam = new Map<number, TeamUnderlyingRow[]>();
  for (const row of args.rows) {
    const current = rowsByTeam.get(row.team_id) ?? [];
    current.push(row);
    rowsByTeam.set(row.team_id, current);
  }

  const aggregates = new Map<string, TeamStyleAggregate>();
  for (const [teamId, rows] of rowsByTeam.entries()) {
    const team = args.teamsById.get(teamId);
    if (!team?.abbreviation) continue;
    const uniqueGameIds = new Set(rows.map((row) => `${row.game_date}-${row.team_id}`));
    aggregates.set(team.abbreviation, {
      teamId,
      teamAbbreviation: team.abbreviation,
      gamesCount: uniqueGameIds.size,
      latestDate: rows.reduce<string | null>(
        (latest, row) =>
          latest == null || row.game_date > latest ? row.game_date : latest,
        null,
      ),
      xgf: sum(rows.map((row) => row.xgf)),
      xga: sum(rows.map((row) => row.xga)),
      gf: sum(rows.map((row) => row.gf)),
      ga: sum(rows.map((row) => row.ga)),
      ff: sum(rows.map((row) => row.ff)),
      fa: sum(rows.map((row) => row.fa)),
      cf: sum(rows.map((row) => row.cf)),
      ca: sum(rows.map((row) => row.ca)),
      source: "team_underlying_stats_summary",
    });
  }

  return aggregates;
}

function styleAggregateFromNst(row: NstTeamRow): TeamStyleAggregate {
  return {
    teamId: null,
    teamAbbreviation: row.team_abbreviation,
    gamesCount: finite(row.gp) ?? 0,
    latestDate: null,
    xgf: finite(row.xgf),
    xga: finite(row.xga),
    gf: finite(row.gf),
    ga: finite(row.ga),
    ff: finite(row.ff),
    fa: finite(row.fa),
    cf: finite(row.cf),
    ca: finite(row.ca),
    source: "nst_team_stats",
  };
}

function buildStylePayload(args: {
  aggregate: TeamStyleAggregate | null;
  leagueAverageEventRate: number | null;
}) {
  const aggregate = args.aggregate;
  const xgForPercentage = calculateTeamExpectedGoalsForPercentage({
    xgFor: aggregate?.xgf ?? null,
    xgAgainst: aggregate?.xga ?? null,
  });
  const shotQuality = calculateTeamShotQuality({
    xgFor: aggregate?.xgf ?? null,
    fenwickFor: aggregate?.ff ?? null,
  });
  const profile = calculateRunAndGunProfile({
    xgFor: aggregate?.xgf ?? null,
    xgAgainst: aggregate?.xga ?? null,
    gamesCount: aggregate?.gamesCount ?? null,
    leagueAverageEventRate: args.leagueAverageEventRate,
  });
  const luck = calculateTeamLuckComponents({
    goalsFor: aggregate?.gf ?? null,
    goalsAgainst: aggregate?.ga ?? null,
    xgFor: aggregate?.xgf ?? null,
    xgAgainst: aggregate?.xga ?? null,
  });
  return {
    label: deriveStyleBadge({
      paceAxis: profile.paceAxis,
      controlAxis: profile.controlAxis,
    }),
    paceAxis: profile.paceAxis,
    controlAxis: profile.controlAxis,
    xgForPercentage,
    eventRate: profile.eventRate,
    shotQuality,
    source: aggregate?.source ?? "none",
    adjusted: false as const,
    luck,
  };
}

async function fetchLatestPowerDate(asOfDate: string | null) {
  let query = supabase
    .from("team_power_ratings_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  if (asOfDate != null) query = query.lte("date", asOfDate);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Unable to load team power date: ${error.message}`);
  return data?.date ?? null;
}

async function fetchTeamPowerRows(date: string) {
  const { data, error } = await supabase
    .from("team_power_ratings_daily")
    .select(
      [
        "team_abbreviation",
        "date",
        "off_rating",
        "def_rating",
        "pace_rating",
        "xgf60",
        "gf60",
        "sf60",
        "xga60",
        "ga60",
        "sa60",
        "pace60",
        "trend10",
        "pp_tier",
        "pk_tier",
        "finishing_rating",
        "goalie_rating",
        "danger_rating",
        "special_rating",
        "discipline_rating",
        "variance_flag",
      ].join(","),
    )
    .eq("date", date)
    .order("off_rating", { ascending: false });
  if (error) throw new Error(`Unable to load team power rows: ${error.message}`);
  return (data ?? []) as unknown as TeamPowerRow[];
}

async function fetchTeamMeta() {
  const { data, error } = await supabase
    .from("teams")
    .select("id,abbreviation,name");
  if (error) throw new Error(`Unable to load team metadata: ${error.message}`);
  const rows = (data ?? []) as TeamMeta[];
  return {
    byId: new Map(rows.map((row) => [row.id, row])),
    byAbbreviation: new Map(
      rows
        .filter((row) => row.abbreviation != null)
        .map((row) => [row.abbreviation as string, row]),
    ),
  };
}

async function fetchUnderlyingStyleRows(request: TeamMatrixRequest) {
  const rows: TeamUnderlyingRow[] = [];
  for (let from = 0;; from += TEAM_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("team_underlying_stats_summary")
      .select("game_date,team_id,xgf,xga,gf,ga,ff,fa,cf,ca")
      .eq("season_id", request.season)
      .eq("strength", "fiveOnFive")
      .eq("score_state", "allScores")
      .order("game_date", { ascending: false })
      .range(from, from + TEAM_QUERY_PAGE_SIZE - 1);
    if (request.asOfDate != null) query = query.lte("game_date", request.asOfDate);
    const { data, error } = await query;
    if (error) {
      throw new Error(`Unable to load team style source rows: ${error.message}`);
    }
    rows.push(...((data ?? []) as unknown as TeamUnderlyingRow[]));
    if ((data ?? []).length < TEAM_QUERY_PAGE_SIZE) break;
  }
  return rows;
}

async function fetchNstTeamRows(season: number) {
  const { data, error } = await supabase
    .from("nst_team_stats")
    .select("team_abbreviation,team_name,gp,xgf,xga,gf,ga,ff,fa,cf,ca,pdo,situation")
    .eq("season", season)
    .eq("situation", "all");
  if (error) throw new Error(`Unable to load NST team rows: ${error.message}`);
  return (data ?? []) as unknown as NstTeamRow[];
}

function latestStyleDate(aggregates: Iterable<TeamStyleAggregate>) {
  let latest: string | null = null;
  for (const aggregate of aggregates) {
    if (aggregate.latestDate == null) continue;
    if (latest == null || aggregate.latestDate > latest) latest = aggregate.latestDate;
  }
  return latest;
}

export async function buildTeamMatrixSurface(
  request: TeamMatrixRequest,
): Promise<TeamMatrixResponse> {
  const latestPowerDate = await fetchLatestPowerDate(request.asOfDate);
  if (latestPowerDate == null) {
    throw new ContextualRankingsQueryError("No team power snapshot available");
  }
  const [powerRows, teamMeta, underlyingRows, nstRows] = await Promise.all([
    fetchTeamPowerRows(latestPowerDate),
    fetchTeamMeta(),
    fetchUnderlyingStyleRows(request),
    fetchNstTeamRows(request.season),
  ]);
  const styleByAbbreviation = aggregateTeamStyleRows({
    rows: underlyingRows,
    teamsById: teamMeta.byId,
  });
  for (const row of nstRows) {
    if (!styleByAbbreviation.has(row.team_abbreviation)) {
      styleByAbbreviation.set(row.team_abbreviation, styleAggregateFromNst(row));
    }
  }

  const eventRates = Array.from(styleByAbbreviation.values())
    .map((aggregate) => {
      if (
        aggregate.xgf == null ||
        aggregate.xga == null ||
        aggregate.gamesCount <= 0
      ) {
        return null;
      }
      return (aggregate.xgf + aggregate.xga) / aggregate.gamesCount;
    })
    .filter((value): value is number => value != null && Number.isFinite(value));
  const leagueAverageEventRate =
    eventRates.length > 0
      ? round(eventRates.reduce((total, value) => total + value, 0) / eventRates.length)
      : null;
  const styleSnapshotDate = latestStyleDate(styleByAbbreviation.values());
  const sourceWarnings = [
    ...(styleSnapshotDate != null && styleSnapshotDate !== latestPowerDate
      ? [
          `team style source snapshot ${styleSnapshotDate} differs from team power snapshot ${latestPowerDate}`,
        ]
      : []),
    "team style is raw/contextual, not score- or venue-adjusted",
  ];

  const baseRows = powerRows.map((power) => {
    const aggregate = styleByAbbreviation.get(power.team_abbreviation) ?? null;
    const style = buildStylePayload({ aggregate, leagueAverageEventRate });
    return { power, aggregate, style };
  });

  const rankMaps = new Map<TeamMatrixMetricKey, ReturnType<typeof rankValues>>();
  for (const column of METRIC_COLUMNS) {
    rankMaps.set(
      column.metricKey,
      rankValues(
        baseRows.map((row) => ({
          id: row.power.team_abbreviation,
          value: metricValue({
            power: row.power,
            style: row.style,
            metricKey: column.metricKey,
          }),
        })),
        column.lowerIsBetter,
      ),
    );
  }

  const rows = baseRows.map(({ power, aggregate, style }): TeamMatrixRow => {
    const team = teamMeta.byAbbreviation.get(power.team_abbreviation);
    const metrics = Object.fromEntries(
      METRIC_COLUMNS.map((column) => {
        const value = metricValue({
          power,
          style,
          metricKey: column.metricKey,
        });
        const rank = rankMaps.get(column.metricKey)?.get(power.team_abbreviation);
        return [
          column.metricKey,
          {
            rawValue: value,
            formattedValue: formatMetricValue(column.metricKey, value),
            rank: rank?.rank ?? null,
            percentile: rank?.percentile ?? null,
            qualifiedPeerCount: rank?.qualifiedPeerCount ?? 0,
            lowerIsBetter: column.lowerIsBetter,
          },
        ];
      }),
    ) as Record<TeamMatrixMetricKey, RankedMetric>;
    const sortCell = metrics[request.metric];
    return {
      team: {
        id: team?.id ?? aggregate?.teamId ?? null,
        abbreviation: power.team_abbreviation,
        name: team?.name ?? null,
      },
      record: {
        latestPowerDate,
        styleSnapshotDate: aggregate?.latestDate ?? null,
        styleGames: aggregate?.gamesCount ?? 0,
        ppTier: finite(power.pp_tier),
        pkTier: finite(power.pk_tier),
        trend10: finite(power.trend10),
      },
      style: {
        label: style.label,
        paceAxis: style.paceAxis,
        controlAxis: style.controlAxis,
        xgForPercentage: style.xgForPercentage,
        eventRate: style.eventRate,
        shotQuality: style.shotQuality,
        source: style.source,
        adjusted: false,
      },
      luck: style.luck,
      sort: {
        metricKey: request.metric,
        rank: sortCell.rank,
        percentile: sortCell.percentile,
      },
      metrics,
      warnings: [
        ...(aggregate == null ? ["team_style_source_missing"] : []),
        ...(aggregate?.source === "nst_team_stats"
          ? ["team_style_using_season_level_nst_fallback"]
          : []),
        "raw_contextual_team_style",
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
        ? bCell.rank - aCell.rank || a.team.abbreviation.localeCompare(b.team.abbreviation)
        : aCell.rank - bCell.rank || a.team.abbreviation.localeCompare(b.team.abbreviation);
    }
    return a.team.abbreviation.localeCompare(b.team.abbreviation);
  });

  const totalRankedRows = rows.length;
  const pageCount = Math.max(1, Math.ceil(totalRankedRows / request.pageSize));
  const start = (request.page - 1) * request.pageSize;
  const pageRows = rows.slice(start, start + request.pageSize);

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
      snapshotDate: latestPowerDate,
      latestAvailableSnapshotDate: latestPowerDate,
      styleSnapshotDate,
      sourceTables: [
        "team_power_ratings_daily",
        "team_underlying_stats_summary",
        "nst_team_stats",
      ],
      sourceWarnings,
      teamStyleContract: TEAM_STYLE_SOURCE_CONTRACT,
      metricColumns: METRIC_COLUMNS,
    },
  };
}
