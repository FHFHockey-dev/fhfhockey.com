import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { TimeOption } from "components/TimeOptions/TimeOptions";
import getTimes from "lib/getTimes";
import supabase from "lib/supabase/public-client";
import useCurrentSeason from "./useCurrentSeason";
import { PercentileRank } from "lib/NHL/types";
import { calculateRankingResult } from "utils/calculatePercentiles";

type PlayerAvgStats = {
  id: number;
  avggoals: number;
  avgassists: number;
  avgplusminus: number;
  avgpim: number;
  avghits: number;
  avgblockedshots: number;
  avgpowerplaypoints: number;
  avgshots: number;
  numgames: number;
};

type Stat =
  | "goals"
  | "assists"
  | "plusMinus"
  | "pim"
  | "hits"
  | "blockedShots"
  | "powerPlayPoints"
  | "shots";

const statMapping: Record<Stat, keyof PlayerAvgStats> = {
  goals: "avggoals",
  assists: "avgassists",
  plusMinus: "avgplusminus",
  pim: "avgpim",
  hits: "avghits",
  blockedShots: "avgblockedshots",
  powerPlayPoints: "avgpowerplaypoints",
  shots: "avgshots",
};

function getSinglePercentileRank(
  allStats: PlayerAvgStats[],
  playerStats: PlayerAvgStats,
  statType: Stat,
) {
  const key = statMapping[statType];
  const rows = allStats
    .filter((stats) => typeof stats[key] === "number" && Number.isFinite(stats[key]))
    .map((stats) => ({ player_id: stats.id, value: stats[key] }));
  const result = calculateRankingResult(rows, playerStats.id, true);
  return result === null ? null : result.percentile * 100;
}

/**
 * Calculate the percentile rankings of a player for the current season
 * @param playerId player id.
 */
export default function usePercentileRank(
  playerId: number | undefined,
  timeOption: TimeOption,
) {
  const season = useCurrentSeason();
  let { StartTime, EndTime } = getTimes(timeOption);
  if (timeOption === "SEASON") {
    StartTime = season?.regularSeasonStartDate ?? null;
    const today = format(new Date(Date.now()), "yyyy-MM-dd");
    // Season boundaries are calendar dates, not UTC instants.
    EndTime = season?.regularSeasonEndDate
      ? today < season.regularSeasonEndDate
        ? today
        : season.regularSeasonEndDate
      : null;
  }

  const enabled = Boolean(
    playerId && season?.seasonId && StartTime && EndTime && StartTime <= EndTime
  );
  const query = useQuery({
    // Every player uses the same cohort. Share and cache that expensive request.
    queryKey: ["skaterPercentileCohort", StartTime, EndTime],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_skaters_avg_stats", {
          start_date: StartTime!,
          end_date: EndTime!,
        })
        .returns<PlayerAvgStats[]>();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  const data = useMemo(() => {
    if (!enabled) return undefined;
    const rows = query.data ?? [];
    const playerStats = rows.find((stats) => stats.id === playerId);
    if (!playerStats) return undefined;
    const percentiles = {
      goals: getSinglePercentileRank(rows, playerStats, "goals"),
      assists: getSinglePercentileRank(rows, playerStats, "assists"),
      plusMinus: getSinglePercentileRank(rows, playerStats, "plusMinus"),
      pim: getSinglePercentileRank(rows, playerStats, "pim"),
      hits: getSinglePercentileRank(rows, playerStats, "hits"),
      blockedShots: getSinglePercentileRank(rows, playerStats, "blockedShots"),
      powerPlayPoints: getSinglePercentileRank(
        rows,
        playerStats,
        "powerPlayPoints",
      ),
      shots: getSinglePercentileRank(rows, playerStats, "shots"),
    };
    // A missing category cannot be drawn as zero performance on a closed radar.
    return Object.values(percentiles).some((value) => value === null)
      ? undefined
      : percentiles as PercentileRank;
  }, [enabled, query.data, playerId]);

  return {
    data,
    loading: enabled && query.isPending,
    error: enabled ? query.error : null,
    retry: query.refetch,
    retrying: query.isFetching,
  };
}
