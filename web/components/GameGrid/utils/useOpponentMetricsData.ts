import { useEffect, useMemo, useState } from "react";

import publicSupabase from "lib/supabase/public-client";
import { TeamDataWithTotals } from "lib/NHL/types";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

export interface TeamStats {
  team_abbreviation: string;
  team_name: string;
  gp: number | null;
  sf: number | null;
  sa: number | null;
  gf: number | null;
  ga: number | null;
  xgf: number | null;
  xga: number | null;
  points: number | null;
  date?: string;
  season?: number;
  situation?: string;
}

export type OpponentMetricAverages = {
  avgXgf: number | null;
  avgXga: number | null;
  avgSf: number | null;
  avgSa: number | null;
  avgGoalFor: number | null;
  avgGoalAgainst: number | null;
  avgWinPct: number | null;
};

export type OpponentMetricColumn = {
  label: string;
  key: keyof OpponentMetricAverages;
};

export type MetricCoverage = { known: number; expected: number };
export type OpponentMetricCoverage = Record<keyof OpponentMetricAverages, MetricCoverage>;

export type UseOpponentMetricsDataResult = {
  entries: { team: TeamDataWithTotals; averages: OpponentMetricAverages; coverage: OpponentMetricCoverage }[];
  metricsByTeamId: Record<number, OpponentMetricAverages>;
  coverageByTeamId: Record<number, OpponentMetricCoverage>;
  leagueAverages: Record<keyof OpponentMetricAverages, number | null>;
  leagueCoverage: OpponentMetricCoverage;
  metricColumns: OpponentMetricColumn[];
  statsLoading: boolean;
  statsError: string | null;
  sourceLabel: string;
};

export const OPPONENT_METRIC_COLUMNS: OpponentMetricColumn[] = [
  { label: "xGF", key: "avgXgf" },
  { label: "xGA", key: "avgXga" },
  { label: "GF", key: "avgGoalFor" },
  { label: "GA", key: "avgGoalAgainst" },
  { label: "SF", key: "avgSf" },
  { label: "SA", key: "avgSa" },
  { label: "PTS%", key: "avgWinPct" }
];

const EMPTY_AVERAGES: OpponentMetricAverages = {
  avgXgf: null,
  avgXga: null,
  avgSf: null,
  avgSa: null,
  avgGoalFor: null,
  avgGoalAgainst: null,
  avgWinPct: null
};

export function computeOpponentMetrics(
  team: TeamDataWithTotals,
  allTeamStats: Record<string, TeamStats>
): { averages: OpponentMetricAverages; coverage: OpponentMetricCoverage } {
  const week1 = team.weeks.find((w) => w.weekNumber === 1);
  const opponents = week1?.opponents ?? [];
  const averages = { ...EMPTY_AVERAGES };
  const coverage = {} as OpponentMetricCoverage;
  const fields: Record<keyof OpponentMetricAverages, keyof TeamStats> = {
    avgXgf: "xgf", avgXga: "xga", avgSf: "sf", avgSa: "sa",
    avgGoalFor: "gf", avgGoalAgainst: "ga", avgWinPct: "points"
  };

  OPPONENT_METRIC_COLUMNS.forEach(({ key }) => {
    let sum = 0;
    let known = 0;
    opponents.forEach((opponent) => {
      const stats = allTeamStats[opponent.abbreviation.toUpperCase()];
      const gp = stats?.gp;
      const value = stats?.[fields[key]];
      if (typeof gp !== "number" || !Number.isFinite(gp) || gp <= 0 ||
          typeof value !== "number" || !Number.isFinite(value)) return;
      const perGame = value / (key === "avgWinPct" ? 2 * gp : gp);
      if (!Number.isFinite(perGame)) return;
      sum += perGame;
      known++;
    });
    coverage[key] = { known, expected: opponents.length };
    // A partial observed subtotal must not look like a complete schedule mean.
    averages[key] = known > 0 && known === opponents.length ? sum / known : null;
  });
  return { averages, coverage };
}

function computeLeagueAverages(
  entries: { team: TeamDataWithTotals; averages: OpponentMetricAverages }[]
) {
  const sums: Partial<Record<keyof OpponentMetricAverages, number>> = {};
  const counts: Partial<Record<keyof OpponentMetricAverages, number>> = {};

  OPPONENT_METRIC_COLUMNS.forEach(({ key }) => {
    sums[key] = 0;
    counts[key] = 0;
  });

  entries.forEach(({ averages }) => {
    OPPONENT_METRIC_COLUMNS.forEach(({ key }) => {
      const value = averages[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        sums[key] = (sums[key] ?? 0) + value;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    });
  });

  const result: Partial<Record<keyof OpponentMetricAverages, number | null>> =
    {};

  OPPONENT_METRIC_COLUMNS.forEach(({ key }) => {
    const count = counts[key] ?? 0;
    result[key] = count > 0 ? (sums[key] ?? 0) / count : null;
  });

  return result as Record<keyof OpponentMetricAverages, number | null>;
}

export async function loadCurrentSeasonStats(seasonId: number): Promise<Record<string, TeamStats>> {
  let expectedCount: number | null = null;
  const rows = await fetchAllSupabasePages<TeamStats>(async ({ from, to }) => {
    const { data, error, count } = await publicSupabase.from("nst_team_stats")
      .select("team_abbreviation,team_name,gp,sf,sa,gf,ga,xgf,xga,points,season,situation", { count: "exact" })
      .eq("season", seasonId).eq("situation", "all")
      .order("team_abbreviation", { ascending: true }).range(from, to);
    if (!error) {
      if (count == null || !Number.isFinite(count) || count < 0 ||
          (expectedCount != null && count !== expectedCount)) {
        throw new Error("Opponent source completeness changed or is unavailable.");
      }
      expectedCount = count;
    }
    return { data: data as unknown as TeamStats[] | null, error };
  }, { pageSize: 500 });
  if (rows.length !== expectedCount) throw new Error("Opponent source response was incomplete.");
  const stats: Record<string, TeamStats> = {};
  rows.forEach((row) => {
    const abbreviation = row.team_abbreviation?.trim().toUpperCase();
    if (!abbreviation || row.season !== seasonId || row.situation !== "all" || stats[abbreviation]) {
      throw new Error("Opponent source row identity was invalid or ambiguous.");
    }
    stats[abbreviation] = row;
  });
  return stats;
}

export default function useOpponentMetricsData(
  teamData: TeamDataWithTotals[],
  seasonId: number | null,
  refreshKey = 0
): UseOpponentMetricsDataResult {
  const [allTeamStats, setAllTeamStats] = useState<Record<string, TeamStats>>(
    {}
  );
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadedSourceKey, setLoadedSourceKey] = useState("");
  const enabled = teamData.length > 0 && seasonId != null && Number.isFinite(seasonId) && seasonId > 0;
  const sourceKey = `${seasonId}/${refreshKey}`;
  const sourceReady = loadedSourceKey === sourceKey;

  useEffect(() => {
    let ignore = false;

    const fetchAndProcessAllStats = async () => {
      setStatsLoading(true);
      setStatsError(null);

      try {
        const stats = await loadCurrentSeasonStats(seasonId!);
        if (ignore) return;
        setAllTeamStats(stats);
      } catch {
        if (ignore) return;
        setAllTeamStats({});
        setStatsError("Opponent metrics are temporarily unavailable.");
      }
      setLoadedSourceKey(sourceKey);
      setStatsLoading(false);
    };

    if (enabled) {
      fetchAndProcessAllStats();
    } else {
      setAllTeamStats({});
      setStatsError(null);
      setStatsLoading(false);
    }

    return () => {
      ignore = true;
    };
  }, [enabled, seasonId, refreshKey, sourceKey]);

  const entries = useMemo(
    () =>
      teamData.map((team) => ({
        team,
        ...computeOpponentMetrics(team, enabled && sourceReady && !statsLoading && !statsError ? allTeamStats : {})
      })),
    [teamData, allTeamStats, enabled, sourceReady, statsLoading, statsError]
  );

  const metricsByTeamId = useMemo(() => {
    return entries.reduce<Record<number, OpponentMetricAverages>>(
      (acc, entry) => {
        acc[entry.team.teamId] = entry.averages;
        return acc;
      },
      {}
    );
  }, [entries]);

  const coverageByTeamId = useMemo(() => Object.fromEntries(
    entries.map(({ team, coverage }) => [team.teamId, coverage])
  ), [entries]);

  const leagueAverages = useMemo(
    () => computeLeagueAverages(entries),
    [entries]
  );

  const leagueCoverage = useMemo(() => Object.fromEntries(
    OPPONENT_METRIC_COLUMNS.map(({ key }) => [key, {
      known: entries.filter(({ averages }) => averages[key] != null).length,
      expected: entries.length
    }])
  ) as OpponentMetricCoverage, [entries]);

  return {
    entries,
    metricsByTeamId,
    coverageByTeamId,
    leagueAverages,
    leagueCoverage,
    metricColumns: OPPONENT_METRIC_COLUMNS,
    statsLoading: enabled && (!sourceReady || statsLoading),
    statsError: sourceReady ? statsError : null,
    sourceLabel: seasonId == null ? "Current-season totals unavailable. Snapshot freshness unknown."
      : sourceReady && !statsLoading && !statsError && Object.keys(allTeamStats).length === 0
        ? `No ${String(seasonId).slice(0, 4)}–${String(seasonId).slice(-2)} regular-season team totals are available. Snapshot freshness unknown.`
        : `${String(seasonId).slice(0, 4)}–${String(seasonId).slice(-2)} regular-season totals. Snapshot freshness unknown.`
  };
}
