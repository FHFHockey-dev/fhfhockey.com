import { useEffect, useMemo, useState } from "react";

import publicSupabase from "lib/supabase/public-client";
import { TeamDataWithTotals } from "lib/NHL/types";

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
  date: string;
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

export type UseOpponentMetricsDataResult = {
  entries: { team: TeamDataWithTotals; averages: OpponentMetricAverages }[];
  metricsByTeamId: Record<number, OpponentMetricAverages>;
  leagueAverages: Record<keyof OpponentMetricAverages, number | null>;
  metricColumns: OpponentMetricColumn[];
  statsLoading: boolean;
  statsError: string | null;
};

export const OPPONENT_METRIC_COLUMNS: OpponentMetricColumn[] = [
  { label: "xGF", key: "avgXgf" },
  { label: "xGA", key: "avgXga" },
  { label: "SF", key: "avgSf" },
  { label: "SA", key: "avgSa" },
  { label: "GF", key: "avgGoalFor" },
  { label: "GA", key: "avgGoalAgainst" },
  { label: "W%", key: "avgWinPct" }
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

function computeOpponentAverages(
  team: TeamDataWithTotals,
  allTeamStats: Record<string, TeamStats>
): OpponentMetricAverages {
  const week1 = team.weeks.find((w) => w.weekNumber === 1);

  if (!week1 || week1.opponents.length === 0) {
    return EMPTY_AVERAGES;
  }

  const count = week1.opponents.length;
  const totals = week1.opponents.reduce(
    (acc, opp) => {
      const key = opp.abbreviation.toUpperCase();
      const stats = allTeamStats[key];

      if (!stats) {
        return acc;
      }

      const gp = stats.gp ?? 0;
      const denom = gp > 0 ? gp : 0;
      const perGame = (value: number | null | undefined) =>
        denom > 0 ? (value ?? 0) / denom : 0;

      acc.xgf += perGame(stats.xgf);
      acc.xga += perGame(stats.xga);
      acc.sf += perGame(stats.sf);
      acc.sa += perGame(stats.sa);
      acc.gf += perGame(stats.gf);
      acc.ga += perGame(stats.ga);

      const points = stats.points ?? 0;
      acc.winPct += denom > 0 ? points / (denom * 2) : 0;
      return acc;
    },
    { xgf: 0, xga: 0, sf: 0, sa: 0, gf: 0, ga: 0, winPct: 0 }
  );

  return {
    avgXgf: count > 0 ? totals.xgf / count : null,
    avgXga: count > 0 ? totals.xga / count : null,
    avgSf: count > 0 ? totals.sf / count : null,
    avgSa: count > 0 ? totals.sa / count : null,
    avgGoalFor: count > 0 ? totals.gf / count : null,
    avgGoalAgainst: count > 0 ? totals.ga / count : null,
    avgWinPct: count > 0 ? totals.winPct / count : null
  };
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
      if (typeof value === "number") {
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

export default function useOpponentMetricsData(
  teamData: TeamDataWithTotals[]
): UseOpponentMetricsDataResult {
  const [allTeamStats, setAllTeamStats] = useState<Record<string, TeamStats>>(
    {}
  );
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const fetchAndProcessAllStats = async () => {
      setStatsLoading(true);
      setStatsError(null);

      const { data, error } = await publicSupabase
        .from("nst_team_all")
        .select(
          [
            "team_abbreviation",
            "team_name",
            "gp",
            "sf",
            "sa",
            "gf",
            "ga",
            "xgf",
            "xga",
            "points",
            "date"
          ].join(",")
        )
        .order("date", { ascending: false });

      if (ignore) {
        return;
      }

      if (error) {
        console.error("Failed to fetch team stats:", error);
        setStatsError("Opponent metrics are temporarily unavailable.");
        setStatsLoading(false);
        return;
      }

      const rows: TeamStats[] = (data ?? []) as unknown as TeamStats[];

      const statsByAbbr = rows.reduce<Record<string, TeamStats>>((acc, stat) => {
        const abbr = stat.team_abbreviation?.toUpperCase();
        if (!abbr || acc[abbr]) {
          return acc;
        }

        acc[abbr] = stat;
        return acc;
      }, {});

      setAllTeamStats(statsByAbbr);
      setStatsLoading(false);
    };

    if (teamData.length > 0) {
      fetchAndProcessAllStats();
    } else {
      setAllTeamStats({});
      setStatsError(null);
      setStatsLoading(false);
    }

    return () => {
      ignore = true;
    };
  }, [teamData]);

  const entries = useMemo(
    () =>
      teamData.map((team) => ({
        team,
        averages: computeOpponentAverages(team, allTeamStats)
      })),
    [teamData, allTeamStats]
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

  const leagueAverages = useMemo(
    () => computeLeagueAverages(entries),
    [entries]
  );

  return {
    entries,
    metricsByTeamId,
    leagueAverages,
    metricColumns: OPPONENT_METRIC_COLUMNS,
    statsLoading,
    statsError
  };
}
