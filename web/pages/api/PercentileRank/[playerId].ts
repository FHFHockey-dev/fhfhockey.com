import type { NextApiRequest, NextApiResponse } from "next";
import { isWithinInterval } from "date-fns";

import { fetchNHL } from "lib/NHL/NHL_API";
import { DateString, Input } from "../toi";

export type PercentileRank = {
  Goals: number | null;
  Assists: number | null;
  PPP: number | null;
  Hits: number | null;
  Blocks: number | null;
  PIM: number | null;
  Shots: number | null;
  PlusMinus: number | null;
};

type Response = {
  message: string;
  success: boolean;
  data?: PercentileRank;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  const playerId = req.query.playerId as string;
  const { Season, StartTime, EndTime } = req.body as Input;

  if (!playerId) {
    return res.json({
      message: "Player Id is required",
      success: false,
    });
  }

  try {
    const data = await calcPercentileRank(playerId, StartTime, EndTime, Season);

    res.json({
      success: true,
      message: "Successfully fetch the percentile rank for player: " + playerId,
      data,
    });
  } catch (e: any) {
    res.json({
      success: false,
      message: "Unable to fetch the data. " + e.message,
    });
  }
}

const MAPPING = {
  goals: "Goals",
  assists: "Assists",
  ppp: "PPP",
  hits: "Hits",
  blocks: "Blocks",
  pim: "PIM",
  shots: "Shots",
  plusminus: "PlusMinus",
} as const;

async function calcPercentileRank(
  playerId: string,
  startTime: string | null,
  endTime: string | null,
  season: string
): Promise<PercentileRank> {
  // fetch all players
  const teamIds = (
    (await fetchNHL("/teams").then((json) => json.teams)) as any[]
  ).map((team: any) => team.id);

  const playerIds = (
    await Promise.all(
      teamIds.map(async (id: string) => {
        const roster = (await fetchNHL(`/teams/${id}/roster`)).roster;
        return (
          (roster as any[])
            // not a goalie
            .filter((player) => player.position.abbreviation !== "G")
            .map((player) => `${player.person.id}`)
        );
      })
    )
  ).flat(1);

  const playersStats: Record<
    string,
    Record<
      | "goals"
      | "assists"
      | "ppp"
      | "hits"
      | "blocks"
      | "pim"
      | "shots"
      | "plusminus",
      number
    >
  > = {};

  const allStats = {
    goals: [],
    assists: [],
    ppp: [],
    hits: [],
    blocks: [],
    pim: [],
    shots: [],
    plusminus: [],
  } as Record<
    | "goals"
    | "assists"
    | "ppp"
    | "hits"
    | "blocks"
    | "pim"
    | "shots"
    | "plusminus",
    number[]
  >;

  await Promise.all(
    playerIds.map(async (playerId) => {
      const games = (
        await fetchNHL(
          `/people/${playerId}/stats?stats=gameLog&season=${season}`
        )
      ).stats[0].splits as {
        stat: any;
        date: DateString;
      }[];

      // filter dates
      let filteredGames;
      if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);

        filteredGames = games.filter((game) => {
          const date = new Date(game.date);
          return isWithinInterval(date, { start, end });
        });
      } else {
        filteredGames = games;
      }

      // for players played in at least one game
      if (filteredGames.length > 0) {
        const stats = {
          goals: [] as number[],
          assists: [] as number[],
          ppp: [] as number[],
          hits: [] as number[],
          blocks: [] as number[],
          pim: [] as number[],
          shots: [] as number[],
          plusminus: [] as number[],
        } as const;
        // get stats of each game
        for (let i = 0; i < filteredGames.length; i++) {
          stats.goals.push(filteredGames[i].stat.goals);
          stats.assists.push(filteredGames[i].stat.assists);
          stats.ppp.push(filteredGames[i].stat.powerPlayPoints);
          stats.hits.push(filteredGames[i].stat.hits);
          stats.blocks.push(filteredGames[i].stat.blocked);
          stats.pim.push(Number(filteredGames[i].stat.penaltyMinutes));
          stats.shots.push(filteredGames[i].stat.shots);
          stats.plusminus.push(filteredGames[i].stat.plusMinus);
        }

        // calculate averages
        const averages = {} as Record<keyof typeof stats, number>;
        for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
          averages[key] =
            stats[key].reduce((a, b) => a + b, 0) / filteredGames.length;
        }

        averages.plusminus = stats.plusminus.reduce((a, b) => a + b, 0);
        playersStats[playerId] = averages;

        for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
          allStats[key].push(averages[key]);
        }
      }
    })
  );

  const playerStats = playersStats[playerId];

  if (!playerStats) throw new Error("Player not found");

  const percentileRank = {} as PercentileRank;
  for (const key of Object.keys(playerStats) as (keyof typeof playerStats)[]) {
    const stat = playerStats[key];
    let count = 0;
    allStats[key].forEach((v) => {
      if (v <= stat) count++;
    });

    // percentile rank: the percernt of players with lower or the same score (the higher, the better)
    percentileRank[MAPPING[key]] = Math.round(
      (count / Object.keys(playersStats).length) * 100
    );
  }

  return percentileRank;
}
