import { useEffect, useState } from "react";
import { format } from "date-fns";

import { TimeOption } from "components/TimeOptions/TimeOptions";
import getTimes from "lib/getTimes";
import supabase from "lib/supabase/public-client";
import useCurrentSeason from "./useCurrentSeason";
import { PercentileRank } from "lib/NHL/types";

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
  count: number;
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
  shots: "avgshots"
};

function getSinglePercentileRank(
  allStats: PlayerAvgStats[],
  playerStats: PlayerAvgStats,
  statType: Stat
) {
  const key = statMapping[statType];
  const sorted = allStats
    .map((stats) => stats[key])
    .sort((left, right) => left - right);
  const position = sorted.findIndex((item) => item === playerStats[key]);

  return Number(((position / sorted.length) * 100).toFixed(2));
}

function emptyPercentileRank(): PercentileRank {
  return {
    goals: 0,
    assists: 0,
    plusMinus: 0,
    pim: 0,
    hits: 0,
    blockedShots: 0,
    powerPlayPoints: 0,
    shots: 0
  };
}

/**
 * Calculate the percentile rankings of a player for the current season
 * @param playerId player id.
 */
export default function usePercentileRank(
  playerId: number | undefined,
  timeOption: TimeOption
) {
  const season = useCurrentSeason();
  const [data, setData] = useState<PercentileRank>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mount = true;
    if (!playerId || !season?.seasonId) return;
    (async () => {
      setLoading(true);
      let { StartTime, EndTime } = getTimes(timeOption);

      if (timeOption === "SEASON") {
        StartTime = season.regularSeasonStartDate;
        EndTime = format(
          new Date(
            Math.min(Date.now(), new Date(season.regularSeasonEndDate).getTime())
          ),
          "yyyy-MM-dd"
        );
      }

      if (!StartTime || !EndTime) {
        if (mount) {
          setLoading(false);
          setData(undefined);
        }
        return;
      }

      const { data: averages, error } = await supabase
        .rpc("get_skaters_avg_stats", {
          start_date: StartTime,
          end_date: EndTime
        })
        .returns<PlayerAvgStats[]>();

      if (mount) {
        setLoading(false);

        if (error) {
          setData(undefined);
          console.error(error.message);
          return;
        }

        const rows = averages ?? [];
        const playerStats = rows.find((stats) => stats.id === playerId);

        if (!playerStats) {
          setData(emptyPercentileRank());
          return;
        }

        setData({
          goals: getSinglePercentileRank(rows, playerStats, "goals"),
          assists: getSinglePercentileRank(rows, playerStats, "assists"),
          plusMinus: getSinglePercentileRank(rows, playerStats, "plusMinus"),
          pim: getSinglePercentileRank(rows, playerStats, "pim"),
          hits: getSinglePercentileRank(rows, playerStats, "hits"),
          blockedShots: getSinglePercentileRank(
            rows,
            playerStats,
            "blockedShots"
          ),
          powerPlayPoints: getSinglePercentileRank(
            rows,
            playerStats,
            "powerPlayPoints"
          ),
          shots: getSinglePercentileRank(rows, playerStats, "shots")
        });
      }
    })();

    return () => {
      mount = false;
    };
  }, [playerId, timeOption, season]);

  return { loading, data };
}
