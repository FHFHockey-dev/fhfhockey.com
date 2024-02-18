import { getPlayer } from "lib/NHL/server";
import { PercentileRank } from "lib/NHL/types";
import supabase from "lib/supabase";
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
      data,
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ message: e.message, success: false });
  }
}
async function getPercentileRank(
  playerId: number,
  StartTime: string,
  EndTime: string
): Promise<PercentileRank> {
  const player = await getPlayer(playerId);
  const { data } = await supabase
    .rpc("get_skaters_avg_stats", {
      start_date: StartTime,
      end_date: EndTime,
    })
    .returns<PlayerAvgStats[]>()
    .throwOnError();
  if (data === null) throw new Error("No avg data found");
  const playerStats = data.find((stats) => stats.id === player.id);
  if (!playerStats) {
    console.log("player did not play any game during these period.");
    return {
      goals: 0,
      assists: 0,
      plusMinus: 0,
      pim: 0,
      hits: 0,
      blockedShots: 0,
      powerPlayPoints: 0,
      shots: 0,
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
    shots: getSinglePercentileRank(data, playerStats, "shots"),
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
  shots: "avgshots",
};

function getSinglePercentileRank(
  allStats: PlayerAvgStats[],
  playerStats: PlayerAvgStats,
  statType: Stat
) {
  const key = statMapping[statType];
  const sorted = allStats.map((stats) => stats[key]).sort();
  const position = sorted.findIndex((item) => item === playerStats[key]);

  return Number(((position / sorted.length) * 100).toFixed(2));
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
