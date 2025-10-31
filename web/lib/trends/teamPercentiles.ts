import {
  MetricDefinition,
  MetricSource,
  TEAM_TREND_CATEGORIES
} from "./teamMetricConfig";

export interface TeamSnapshot {
  date: string;
  gp: number;
  as?: Record<string, number | null>;
  pp?: Record<string, number | null>;
  pk?: Record<string, number | null>;
  wgo?: Record<string, number | null>;
}

export type TeamGameMap = Map<string, Map<string, TeamSnapshot>>;

export interface CategorySeriesPoint {
  gp: number;
  percentile: number;
}

export interface CategorySeries {
  [team: string]: CategorySeriesPoint[];
}

export interface RankingEntry {
  team: string;
  percentile: number;
  gp: number;
  rank: number;
  previousRank: number | null;
  delta: number;
}

export interface CategoryComputationResult {
  series: CategorySeries;
  rankings: RankingEntry[];
}

function getSourceKey(metricSource: MetricSource): keyof TeamSnapshot {
  switch (metricSource) {
    case "as":
      return "as";
    case "pp":
      return "pp";
    case "pk":
      return "pk";
    case "wgo":
    default:
      return "wgo";
  }
}

function extractMetric(
  snapshot: TeamSnapshot,
  metric: MetricDefinition
): number | null {
  const sourceKey = getSourceKey(metric.source);
  const sourceBlock = snapshot[sourceKey] as
    | Record<string, number | null>
    | undefined;
  if (!sourceBlock) return null;
  const value = sourceBlock[metric.key];
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function computeMetricPercentiles(
  values: Array<{ team: string; value: number }>,
  higherIsBetter: boolean
): Map<string, number> {
  const result = new Map<string, number>();
  if (values.length === 0) return result;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  if (sorted.length === 1) {
    result.set(sorted[0].team, 50);
    return result;
  }
  const denom = sorted.length - 1;
  sorted.forEach((entry, idx) => {
    let percentile = (idx / denom) * 100;
    if (!higherIsBetter) {
      percentile = 100 - percentile;
    }
    result.set(entry.team, percentile);
  });
  return result;
}

function buildTeamSeries(
  teamGameMap: TeamGameMap
): Map<string, TeamSnapshot[]> {
  const result = new Map<string, TeamSnapshot[]>();
  teamGameMap.forEach((dateMap, team) => {
    const snapshots = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    snapshots.forEach((snap, idx) => {
      snap.gp = idx + 1;
    });
    result.set(team, snapshots);
  });
  return result;
}

function getMaxGames(teamSeries: Map<string, TeamSnapshot[]>): number {
  let max = 0;
  teamSeries.forEach((games) => {
    if (games.length > max) max = games.length;
  });
  return max;
}

function ensureSeriesEntry(
  map: CategorySeries,
  team: string
): CategorySeriesPoint[] {
  if (!map[team]) {
    map[team] = [];
  }
  return map[team];
}

function buildRankingsFromSeries(series: CategorySeries): RankingEntry[] {
  const latestEntries: Array<{
    team: string;
    percentile: number;
    gp: number;
    previousPercentile: number | null;
  }> = [];

  Object.entries(series).forEach(([team, points]) => {
    if (!points.length) return;
    const latest = points[points.length - 1];
    const previous = points.length > 1 ? points[points.length - 2] : undefined;
    latestEntries.push({
      team,
      percentile: latest.percentile,
      gp: latest.gp,
      previousPercentile: previous ? previous.percentile : null
    });
  });

  latestEntries.sort((a, b) => b.percentile - a.percentile);
  const rankings: RankingEntry[] = [];

  const prevSorted = latestEntries
    .filter((entry) => entry.previousPercentile !== null)
    .sort((a, b) => b.previousPercentile! - a.previousPercentile!);
  const prevRankMap = new Map(
    prevSorted.map((entry, idx) => [entry.team, idx + 1])
  );

  latestEntries.forEach((entry, idx) => {
    const currentRank = idx + 1;
    const prevRank = prevRankMap.get(entry.team) ?? null;
    const delta = prevRank === null ? 0 : prevRank - currentRank; // positive = moved up
    rankings.push({
      team: entry.team,
      percentile: entry.percentile,
      gp: entry.gp,
      rank: currentRank,
      previousRank: prevRank,
      delta
    });
  });

  return rankings;
}

export function computeCategoryResults(
  teamGameMap: TeamGameMap
): Record<string, CategoryComputationResult> {
  const teamSeries = buildTeamSeries(teamGameMap);
  const maxGames = getMaxGames(teamSeries);
  const categoryResults: Record<string, CategoryComputationResult> = {};

  TEAM_TREND_CATEGORIES.forEach((category) => {
    const series: CategorySeries = {};

    if (maxGames === 0) {
      categoryResults[category.id] = { series, rankings: [] };
      return;
    }

    for (let gp = 1; gp <= maxGames; gp += 1) {
      const metricValueBuckets: Record<
        string,
        Array<{ team: string; value: number }>
      > = {};

      teamSeries.forEach((games, team) => {
        const snapshot = games[gp - 1];
        if (!snapshot) return;
        category.metrics.forEach((metric) => {
          const value = extractMetric(snapshot, metric);
          if (value === null) return;
          if (!metricValueBuckets[metric.key]) {
            metricValueBuckets[metric.key] = [];
          }
          metricValueBuckets[metric.key].push({ team, value });
        });
      });

      const teamsWithData = new Set<string>();
      Object.values(metricValueBuckets).forEach((entries) =>
        entries.forEach((entry) => teamsWithData.add(entry.team))
      );
      if (teamsWithData.size === 0) continue;

      const teamScores = new Map<
        string,
        { weightedSum: number; weightTotal: number }
      >();

      category.metrics.forEach((metric) => {
        const entries = metricValueBuckets[metric.key] ?? [];
        if (entries.length === 0) return;
        const percentileMap = computeMetricPercentiles(
          entries,
          metric.higherIsBetter
        );
        percentileMap.forEach((percentile, team) => {
          const current = teamScores.get(team) ?? {
            weightedSum: 0,
            weightTotal: 0
          };
          current.weightedSum += percentile * metric.weight;
          current.weightTotal += metric.weight;
          teamScores.set(team, current);
        });
      });

      teamScores.forEach((score, team) => {
        if (score.weightTotal === 0) return;
        const percentile = score.weightedSum / score.weightTotal;
        ensureSeriesEntry(series, team).push({ gp, percentile });
      });
    }

    categoryResults[category.id] = {
      series,
      rankings: buildRankingsFromSeries(series)
    };
  });

  return categoryResults;
}
