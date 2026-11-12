import { getPlayer } from "lib/NHL/server";
import { calculateRankingResult } from "utils/calculatePercentiles";
import supabase from "lib/supabase/public-client";
import { NextApiRequest, NextApiResponse } from "next";
import { getInterval } from "pages/api/toi";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const playerId = Number(req.query.id);
  let { Season, StartTime, EndTime } = req.body;

  try {
    [StartTime, EndTime] = await getInterval(Season, StartTime, EndTime);
    const data = await getPercentileRank(playerId, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Success!",
      data
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ message: e.message, success: false });
  }
}
// A stat is null when unknown: no games in the window or no finite value (rule 5).
type PercentileRankOrUnknown = Record<Stat, number | null>;

async function getPercentileRank(
  playerId: number,
  StartTime: string,
  EndTime: string
): Promise<PercentileRankOrUnknown> {
  const player = await getPlayer(playerId);
  const { data } = await supabase
    .rpc("get_skaters_avg_stats", {
      start_date: StartTime,
      end_date: EndTime
    })
    .returns<PlayerAvgStats[]>()
    .throwOnError();
  if (data === null) throw new Error("No avg data found");
  const playerStats = data.find((stats) => stats.id === player.id);
  if (!playerStats) {
    // No games in the window: every percentile is unknown, never 0 (rule 5).
    return {
      goals: null,
      assists: null,
      plusMinus: null,
      pim: null,
      hits: null,
      blockedShots: null,
      powerPlayPoints: null,
      shots: null
    };
  }

  return {
    goals: getSinglePercentileRank(data, playerStats, "goals"),
    assists: getSinglePercentileRank(data, playerStats, "assists"),
    plusMinus: getSinglePercentileRank(data, playerStats, "plusMinus"),
    pim: getSinglePercentileRank(data, playerStats, "pim"),
    hits: getSinglePercentileRank(data, playerStats, "hits"),
    blockedShots: getSinglePercentileRank(data, playerStats, "blockedShots"),
    powerPlayPoints: getSinglePercentileRank(
      data,
      playerStats,
      "powerPlayPoints"
    ),
    shots: getSinglePercentileRank(data, playerStats, "shots")
  };
}

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

// Mid-rank percentile (decision 90) over the finite values: ties share one value.
// The old version sorted numbers as text and counted only strictly lower rows.
function getSinglePercentileRank(
  allStats: PlayerAvgStats[],
  playerStats: PlayerAvgStats,
  statType: Stat
): number | null {
  const key = statMapping[statType];
  const rows = allStats
    .filter((stats) => typeof stats[key] === "number" && Number.isFinite(stats[key]))
    .map((stats) => ({ player_id: stats.id, value: stats[key] }));
  const result = calculateRankingResult(rows, playerStats.id, true);
  return result === null ? null : Number((result.percentile * 100).toFixed(2));
}

type Stat =
  | "goals"
  | "assists"
  | "plusMinus"
  | "pim"
  | "hits"
  | "blockedShots"
  | "powerPlayPoints"
  | "shots";

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
