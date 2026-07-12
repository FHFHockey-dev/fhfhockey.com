import type { NextApiRequest } from "next";

import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import { buildContextualRankingsSurfaces } from "./rankingQueries";
import {
  ContextualRankingsQueryError,
  parseContextualRankingsRequest,
  type ContextualRankingApiRow,
  type ContextualRankingsRequest,
  type ContextualRankingsResponse,
} from "./rankingTypes";
import type { SkaterProductionWindow } from "./skaterWindowAggregation";

const DEFAULT_TRENDING_METRICS: ContextualRankingMetricKey[] = [
  "points_per_60",
  "goals_per_60",
  "ixg_per_60",
  "sog_per_60",
  "shot_attempts_per_60",
];

const TRENDING_WINDOWS = ["season", "last20", "last10", "last5"] as const;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type TrendingWindow = (typeof TRENDING_WINDOWS)[number];

export type TrendingMetricWindowValue = {
  value: number | null;
  formattedValue: string | null;
  percentile: number | null;
  rank: number | null;
};

export type TrendingMetricSummary = {
  metricKey: ContextualRankingMetricKey;
  label: string;
  shortLabel: string;
  season: TrendingMetricWindowValue | null;
  last20: TrendingMetricWindowValue | null;
  last10: TrendingMetricWindowValue | null;
  last5: TrendingMetricWindowValue | null;
  deltaLast5VsLast20: number | null;
  deltaLast5VsSeason: number | null;
};

export type TrendingToiSummary = {
  seasonSeconds: number | null;
  last20Seconds: number | null;
  last10Seconds: number | null;
  last5Seconds: number | null;
  deltaLast5VsLast20Seconds: number | null;
};

export type OpportunitySignalType =
  | "toi_up"
  | "pp1_promotion"
  | "pp2_to_pp1_threat"
  | "line_promotion"
  | "pair_promotion"
  | "shot_volume_spike"
  | "usage_drop"
  | "goalie_starter_share_rising"
  | "goalie_starter_share_falling"
  | "team_top_load_change"
  | "team_pp_unit_concentration_change";

export type OpportunitySignal = {
  type: OpportunitySignalType;
  label: string;
  severity: "low" | "medium" | "high";
  sourceState: "available" | "partial" | "source_pending";
  baselineWindow: "last20";
  currentWindow: "last5";
  baselineValue: number | null;
  currentValue: number | null;
  delta: number | null;
  evidence: string;
};

export type OpportunitySignalContract = {
  type: OpportunitySignalType;
  label: string;
  sourceState: "available" | "source_pending";
  requiredInputs: string[];
  description: string;
};

export type TrendingRow = {
  entity: ContextualRankingApiRow["entity"];
  team: ContextualRankingApiRow["team"];
  deployment: ContextualRankingApiRow["deployment"];
  sample: ContextualRankingApiRow["sample"];
  trendScore: number | null;
  primaryMetricKey: ContextualRankingMetricKey;
  primaryDeltaLast5VsLast20: number | null;
  toiTrend: TrendingToiSummary;
  metrics: TrendingMetricSummary[];
  opportunitySignals: OpportunitySignal[];
  sourceState: "available" | "partial" | "unavailable";
  message: string | null;
};

export type TrendingRequest = Pick<
  ContextualRankingsRequest,
  | "entity"
  | "season"
  | "asOfDate"
  | "position"
  | "deployment"
  | "strength"
  | "minGp"
  | "minToiSeconds"
  | "teamId"
  | "peerGroupType"
> & {
  metricKeys: ContextualRankingMetricKey[];
  sortDirection: "asc" | "desc";
  limit: number;
};

export type TrendingResponse = {
  success: boolean;
  request: TrendingRequest;
  rows: TrendingRow[];
  meta: {
    generatedAt: string;
    rowCount: number;
    sourceTable: "rolling_player_game_metrics";
    metricKeys: ContextualRankingMetricKey[];
    windows: TrendingWindow[];
    opportunitySignalContracts: OpportunitySignalContract[];
    snapshotDates: Partial<Record<TrendingWindow, string | null>>;
    latestAvailableSnapshotDate: string | null;
    message: string | null;
  };
};

type QueryValue = string | string[] | undefined;
type WindowSurfaceMap = Map<ContextualRankingMetricKey, ContextualRankingsResponse>;

export const OPPORTUNITY_SIGNAL_CONTRACTS: OpportunitySignalContract[] = [
  {
    type: "toi_up",
    label: "TOI Up",
    sourceState: "available",
    requiredInputs: ["last5 toi per game", "last20 toi per game"],
    description: "Flags players whose selected-window TOI/G is materially up.",
  },
  {
    type: "usage_drop",
    label: "Usage Drop",
    sourceState: "available",
    requiredInputs: ["last5 toi per game", "last20 toi per game"],
    description: "Flags players whose selected-window TOI/G is materially down.",
  },
  {
    type: "shot_volume_spike",
    label: "Shot Volume Spike",
    sourceState: "available",
    requiredInputs: [
      "last5 shot_attempts_per_60 or sog_per_60 percentile",
      "last20 shot_attempts_per_60 or sog_per_60 percentile",
    ],
    description: "Flags players with a material recent shot-volume percentile jump.",
  },
  {
    type: "pp1_promotion",
    label: "PP1 Promotion",
    sourceState: "source_pending",
    requiredInputs: ["current PP unit", "prior PP unit", "PP TOI share by game"],
    description: "Requires deployment history rather than only current PP bucket.",
  },
  {
    type: "pp2_to_pp1_threat",
    label: "PP2-to-PP1 Threat",
    sourceState: "source_pending",
    requiredInputs: ["PP2 current role", "PP1 role trend", "PP production and PP TOI share"],
    description: "Requires unit-level PP history and teammate context.",
  },
  {
    type: "line_promotion",
    label: "Line Promotion",
    sourceState: "source_pending",
    requiredInputs: ["current EV line", "prior EV line", "EV TOI share by game"],
    description: "Requires historical line-assignment comparison.",
  },
  {
    type: "pair_promotion",
    label: "Pair Promotion",
    sourceState: "source_pending",
    requiredInputs: ["current defense pair", "prior defense pair", "defense TOI share by game"],
    description: "Requires historical pair-assignment comparison.",
  },
  {
    type: "goalie_starter_share_rising",
    label: "Starter Share Rising",
    sourceState: "source_pending",
    requiredInputs: ["current goalie start share", "baseline goalie start share"],
    description: "Requires goalie role trend rows beyond the current matrix snapshot.",
  },
  {
    type: "goalie_starter_share_falling",
    label: "Starter Share Falling",
    sourceState: "source_pending",
    requiredInputs: ["current goalie start share", "baseline goalie start share"],
    description: "Requires goalie role trend rows beyond the current matrix snapshot.",
  },
  {
    type: "team_top_load_change",
    label: "Team Top-Load Change",
    sourceState: "source_pending",
    requiredInputs: ["current team_unit_toi top-load", "baseline team_unit_toi top-load"],
    description: "Requires historical team unit-usage comparison.",
  },
  {
    type: "team_pp_unit_concentration_change",
    label: "PP Unit Concentration Change",
    sourceState: "source_pending",
    requiredInputs: ["current PP1/PP2 usage share", "baseline PP1/PP2 usage share"],
    description: "Requires historical team PP unit concentration comparison.",
  },
];

function first(value: QueryValue) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePositiveInt(value: QueryValue, key: string, fallback: number) {
  const raw = first(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: "must be a positive integer",
    });
  }
  return Math.min(parsed, MAX_LIMIT);
}

function parseMetricList(value: QueryValue) {
  const parts = (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_TRENDING_METRICS;

  const metricKeys: ContextualRankingMetricKey[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    const definition = getContextualRankingMetricDefinition(part);
    if (!definition) {
      invalid.push(part);
      continue;
    }
    const metricKey = definition.metricKey as ContextualRankingMetricKey;
    if (!metricKeys.includes(metricKey)) metricKeys.push(metricKey);
  }
  if (invalid.length > 0) {
    throw new ContextualRankingsQueryError("Invalid query param: metrics", {
      metrics: `unknown metric keys: ${invalid.join(", ")}`,
    });
  }
  return metricKeys.length > 0 ? metricKeys : DEFAULT_TRENDING_METRICS;
}

function round(value: number | null, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: Array<number | null>) {
  const finiteValues = values.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function delta(left: number | null | undefined, right: number | null | undefined) {
  if (left == null || right == null) return null;
  return round(left - right);
}

function latestDate(current: string | null, next: string | null) {
  if (current == null) return next;
  if (next == null) return current;
  return next > current ? next : current;
}

function windowRequest(args: {
  base: TrendingRequest;
  metric: ContextualRankingMetricKey;
  window: SkaterProductionWindow;
}): ContextualRankingsRequest {
  return {
    entity: "skaters",
    season: args.base.season,
    asOfDate: args.base.asOfDate,
    window: args.window,
    position: args.base.position,
    deployment: args.base.deployment,
    strength: args.base.strength,
    metric: args.metric,
    minGp: args.base.minGp,
    minToiSeconds: args.base.minToiSeconds,
    teamId: args.base.teamId,
    peerGroupType: args.base.peerGroupType,
    sort: "percentile",
    direction: "desc",
    limit: null,
    entityIds: null,
  };
}

function metricValue(row: ContextualRankingApiRow | null): TrendingMetricWindowValue | null {
  if (!row) return null;
  return {
    value: row.metric.value,
    formattedValue: row.metric.formattedValue,
    percentile: row.metric.percentile,
    rank: row.metric.rawRank,
  };
}

function toiPerGame(row: ContextualRankingApiRow | null) {
  return row?.sample.toiPerGameSeconds ?? null;
}

function rowByEntityId(
  surfaces: Record<TrendingWindow, WindowSurfaceMap>,
  window: TrendingWindow,
  metricKey: ContextualRankingMetricKey,
) {
  const rows = surfaces[window].get(metricKey)?.rankings ?? [];
  return new Map(rows.map((row) => [row.entity.id, row]));
}

function rowSourceState(metrics: TrendingMetricSummary[]) {
  const deltas = metrics.map((metric) => metric.deltaLast5VsLast20);
  if (deltas.some((value) => value != null)) return "available" as const;
  if (
    metrics.some((metric) =>
      [metric.season, metric.last20, metric.last10, metric.last5].some(Boolean),
    )
  ) {
    return "partial" as const;
  }
  return "unavailable" as const;
}

function severityFromMagnitude(
  magnitude: number,
  thresholds: { low: number; medium: number; high: number },
) {
  if (magnitude >= thresholds.high) return "high" as const;
  if (magnitude >= thresholds.medium) return "medium" as const;
  return "low" as const;
}

function buildToiOpportunitySignal(
  toiTrend: TrendingToiSummary,
): OpportunitySignal | null {
  const deltaSeconds = toiTrend.deltaLast5VsLast20Seconds;
  if (deltaSeconds == null || Math.abs(deltaSeconds) < 30) return null;
  const positive = deltaSeconds > 0;
  return {
    type: positive ? "toi_up" : "usage_drop",
    label: positive ? "TOI Up" : "Usage Drop",
    severity: severityFromMagnitude(Math.abs(deltaSeconds), {
      low: 30,
      medium: 60,
      high: 120,
    }),
    sourceState: "available",
    baselineWindow: "last20",
    currentWindow: "last5",
    baselineValue: toiTrend.last20Seconds,
    currentValue: toiTrend.last5Seconds,
    delta: deltaSeconds,
    evidence: `TOI/G ${positive ? "up" : "down"} ${formatSecondsDelta(deltaSeconds)} from last 20 to last 5.`,
  };
}

function formatSecondsDelta(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value)}s`;
}

function buildShotVolumeOpportunitySignal(
  metrics: TrendingMetricSummary[],
): OpportunitySignal | null {
  const metric =
    metrics.find((entry) => entry.metricKey === "shot_attempts_per_60") ??
    metrics.find((entry) => entry.metricKey === "sog_per_60") ??
    null;
  if (!metric || metric.deltaLast5VsLast20 == null || metric.deltaLast5VsLast20 < 8) {
    return null;
  }
  return {
    type: "shot_volume_spike",
    label: "Shot Volume Spike",
    severity: severityFromMagnitude(metric.deltaLast5VsLast20, {
      low: 8,
      medium: 15,
      high: 25,
    }),
    sourceState: "available",
    baselineWindow: "last20",
    currentWindow: "last5",
    baselineValue: metric.last20?.percentile ?? null,
    currentValue: metric.last5?.percentile ?? null,
    delta: metric.deltaLast5VsLast20,
    evidence: `${metric.shortLabel} percentile ${formatSigned(metric.deltaLast5VsLast20)} from last 20 to last 5.`,
  };
}

function formatSigned(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

export function buildOpportunitySignals(args: {
  toiTrend: TrendingToiSummary;
  metrics: TrendingMetricSummary[];
}) {
  return [
    buildToiOpportunitySignal(args.toiTrend),
    buildShotVolumeOpportunitySignal(args.metrics),
  ].filter((signal): signal is OpportunitySignal => signal != null);
}

export function parseTrendingRequest(
  query: NextApiRequest["query"],
): TrendingRequest {
  const metricKeys = parseMetricList(query.metrics);
  const primaryMetric = metricKeys[0] ?? "points_per_60";
  const base = parseContextualRankingsRequest({
    ...query,
    metric: first(query.metric) ?? primaryMetric,
    window: "season",
    sort: "percentile",
    direction: "desc",
    limit: "1",
  });

  return {
    entity: base.entity,
    season: base.season,
    asOfDate: base.asOfDate,
    position: base.position,
    deployment: base.deployment,
    strength: base.strength,
    minGp: base.minGp,
    minToiSeconds: base.minToiSeconds,
    teamId: base.teamId,
    peerGroupType: base.peerGroupType,
    metricKeys,
    sortDirection: first(query.sort_direction) === "asc" ? "asc" : "desc",
    limit: parsePositiveInt(query.limit, "limit", DEFAULT_LIMIT),
  };
}

export async function buildTrendingSurface(
  request: TrendingRequest,
): Promise<TrendingResponse> {
  const generatedAt = new Date().toISOString();
  const metricKeys = Array.from(new Set(request.metricKeys));
  const primaryMetric = metricKeys[0] ?? "points_per_60";
  const windowEntries = await Promise.all(
    TRENDING_WINDOWS.map(async (window) => {
      const surfaces = await buildContextualRankingsSurfaces(
        windowRequest({ base: request, metric: primaryMetric, window }),
        metricKeys,
      );
      return [window, surfaces] as const;
    }),
  );
  const surfaces = Object.fromEntries(windowEntries) as Record<
    TrendingWindow,
    WindowSurfaceMap
  >;

  const snapshotDates: Partial<Record<TrendingWindow, string | null>> = {};
  let latestAvailableSnapshotDate: string | null = null;
  for (const window of TRENDING_WINDOWS) {
    const surface = surfaces[window].get(primaryMetric);
    snapshotDates[window] = surface?.meta.snapshotDate ?? null;
    latestAvailableSnapshotDate = latestDate(
      latestAvailableSnapshotDate,
      surface?.meta.latestAvailableSnapshotDate ?? null,
    );
  }

  const rowMapsByWindowMetric = new Map<string, Map<number, ContextualRankingApiRow>>();
  for (const window of TRENDING_WINDOWS) {
    for (const metricKey of metricKeys) {
      rowMapsByWindowMetric.set(
        `${window}:${metricKey}`,
        rowByEntityId(surfaces, window, metricKey),
      );
    }
  }

  const entityIds = new Set<number>();
  for (const map of rowMapsByWindowMetric.values()) {
    for (const id of map.keys()) entityIds.add(id);
  }

  const rows = Array.from(entityIds).map((entityId) => {
    const primaryRows = {
      season: rowMapsByWindowMetric.get(`season:${primaryMetric}`)?.get(entityId) ?? null,
      last20: rowMapsByWindowMetric.get(`last20:${primaryMetric}`)?.get(entityId) ?? null,
      last10: rowMapsByWindowMetric.get(`last10:${primaryMetric}`)?.get(entityId) ?? null,
      last5: rowMapsByWindowMetric.get(`last5:${primaryMetric}`)?.get(entityId) ?? null,
    };
    const contextRow =
      primaryRows.last5 ??
      primaryRows.last10 ??
      primaryRows.last20 ??
      primaryRows.season ??
      null;

    const metrics = metricKeys.map((metricKey) => {
      const definition = getContextualRankingMetricDefinition(metricKey);
      const windowRows = {
        season: rowMapsByWindowMetric.get(`season:${metricKey}`)?.get(entityId) ?? null,
        last20: rowMapsByWindowMetric.get(`last20:${metricKey}`)?.get(entityId) ?? null,
        last10: rowMapsByWindowMetric.get(`last10:${metricKey}`)?.get(entityId) ?? null,
        last5: rowMapsByWindowMetric.get(`last5:${metricKey}`)?.get(entityId) ?? null,
      };
      const season = metricValue(windowRows.season);
      const last20 = metricValue(windowRows.last20);
      const last10 = metricValue(windowRows.last10);
      const last5 = metricValue(windowRows.last5);
      return {
        metricKey,
        label: definition?.displayName ?? metricKey,
        shortLabel: definition?.displayName ?? metricKey,
        season,
        last20,
        last10,
        last5,
        deltaLast5VsLast20: delta(last5?.percentile, last20?.percentile),
        deltaLast5VsSeason: delta(last5?.percentile, season?.percentile),
      };
    });

    const sourceState = rowSourceState(metrics);
    const toiTrend = {
      seasonSeconds: toiPerGame(primaryRows.season),
      last20Seconds: toiPerGame(primaryRows.last20),
      last10Seconds: toiPerGame(primaryRows.last10),
      last5Seconds: toiPerGame(primaryRows.last5),
      deltaLast5VsLast20Seconds: delta(
        toiPerGame(primaryRows.last5),
        toiPerGame(primaryRows.last20),
      ),
    };
    const trendScore = round(
      average(metrics.map((metric) => metric.deltaLast5VsLast20)),
    );
    const primaryMetricSummary =
      metrics.find((metric) => metric.metricKey === primaryMetric) ?? null;
    const opportunitySignals = buildOpportunitySignals({ toiTrend, metrics });

    return {
      entity: contextRow?.entity ?? {
        id: entityId,
        name: null,
        position: null,
        positionGroup: null,
        imageUrl: null,
      },
      team: contextRow?.team ?? { id: null, abbreviation: null, name: null },
      deployment: contextRow?.deployment ?? {
        ev: null,
        pp: null,
        pk: null,
        confidence: "low" as const,
      },
      sample: contextRow?.sample ?? {
        gamesPlayed: null,
        toiSeconds: null,
        toiPerGameSeconds: null,
        confidence: "low" as const,
        minimumSampleMet: false,
      },
      trendScore,
      primaryMetricKey: primaryMetric,
      primaryDeltaLast5VsLast20:
        primaryMetricSummary?.deltaLast5VsLast20 ?? null,
      toiTrend,
      metrics,
      opportunitySignals,
      sourceState,
      message:
        sourceState === "unavailable"
          ? "No comparable last-5 and last-20 trend values are available."
          : sourceState === "partial"
            ? "Some windows or metrics are unavailable for this player/context."
            : null,
    } satisfies TrendingRow;
  });

  const sortedRows = rows
    .filter((row) => row.sourceState !== "unavailable")
    .sort((left, right) => {
      const leftScore = left.trendScore ?? Number.NEGATIVE_INFINITY;
      const rightScore = right.trendScore ?? Number.NEGATIVE_INFINITY;
      if (leftScore !== rightScore) {
        return request.sortDirection === "asc"
          ? leftScore - rightScore
          : rightScore - leftScore;
      }
      return left.entity.id - right.entity.id;
    })
    .slice(0, request.limit);

  return {
    success: true,
    request,
    rows: sortedRows,
    meta: {
      generatedAt,
      rowCount: sortedRows.length,
      sourceTable: "rolling_player_game_metrics",
      metricKeys,
      windows: [...TRENDING_WINDOWS],
      opportunitySignalContracts: OPPORTUNITY_SIGNAL_CONTRACTS,
      snapshotDates,
      latestAvailableSnapshotDate,
      message:
        sortedRows.length === 0
          ? "No trend rows matched the current filters."
          : null,
    },
  };
}
