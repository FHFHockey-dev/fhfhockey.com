import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { TimeOption } from "components/TimeOptions/TimeOptions";
import getTimes from "lib/getTimes";
import supabase from "lib/supabase/public-client";
import useCurrentSeason from "./useCurrentSeason";
import { PercentileRank } from "lib/NHL/types";
import { calculateRankingResult } from "utils/calculatePercentiles";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

// Rank against skaters with a real sample; the selected player is always kept
// (C-28: 96 of 740 rows had under 5 games, 25 had one).
export const RADAR_MIN_GAMES = 5;

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
    // Ordered pages: a full season can pass the 1,000-row response cap (C-33).
    queryFn: () =>
      fetchAllSupabasePages<PlayerAvgStats>(({ from, to }) =>
        supabase
          .rpc("get_skaters_avg_stats", {
            start_date: StartTime!,
            end_date: EndTime!,
          })
          .order("id", { ascending: true })
          .range(from, to)
          .returns<PlayerAvgStats[]>()
      ),
    staleTime: 10 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  const data = useMemo(() => {
    if (!enabled) return undefined;
    const allRows = query.data ?? [];
    const playerStats = allRows.find((stats) => stats.id === playerId);
    if (!playerStats) return undefined;
    const rows = allRows.filter(
      (stats) => stats.id === playerId || stats.numgames >= RADAR_MIN_GAMES
    );
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

  // What the radar ranks: the player's own games and the cohort it uses.
  const sample = useMemo(() => {
    const rows = query.data ?? [];
    const playerStats = rows.find((stats) => stats.id === playerId);
    if (!enabled || !playerStats) return undefined;
    return {
      playerGames: Number(playerStats.numgames),
      cohortSize: rows.filter((stats) => stats.numgames >= RADAR_MIN_GAMES).length,
      minGames: RADAR_MIN_GAMES,
    };
  }, [enabled, query.data, playerId]);

  return {
    data,
    sample,
    loading: enabled && query.isPending,
    error: enabled ? query.error : null,
    retry: query.refetch,
    retrying: query.isFetching,
  };
}
