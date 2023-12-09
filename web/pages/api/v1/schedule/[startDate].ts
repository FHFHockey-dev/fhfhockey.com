import type { NextApiRequest, NextApiResponse } from "next";
import { get } from "lib/NHL/base";
import calcWinOdds from "components/GameGrid/utils/calcWinOdds";
import { Team } from "lib/NHL/types";
import { getTeams } from "lib/NHL/server";

type GameWeek = {
  date: string;
  dayAbbrev: DAY_ABBREVIATION;
  numberOfGames: number;
  games: {
    id: number;
    season: number;
    awayTeam: {
      id: number;
      abbrev: string;
      score: number;
    };
    homeTeam: {
      id: number;
      abbrev: string;
      score: number;
    };
  }[];
}[];

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const EXTENDED_DAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
  "nMON",
  "nTUE",
  "nWED",
] as const;
export type DAY_ABBREVIATION = typeof DAYS[number];

export type GameData = {
  id: number;
  season: number;
  homeTeam: { id: number; score: number; winOdds: number };
  awayTeam: { id: number; score: number; winOdds: number };
};

export type WeekData = {
  MON?: GameData;
  TUE?: GameData;
  WED?: GameData;
  THU?: GameData;
  FRI?: GameData;
  SAT?: GameData;
  SUN?: GameData;
  nMON?: GameData;
  nTUE?: GameData;
  nWED?: GameData;
};

export type ScheduleData = {
  data: Record<number, WeekData>;
  numGamesPerDay: number[];
};

async function getTeamsMap(): Promise<Record<number, Team>> {
  const teams = await getTeams();
  const map: any = {};
  teams.forEach((team) => {
    map[team.id] = team;
  });
  return map;
}

/**
 *
 * @param startDate e.g., 2023-11-06
 * @returns
 */
async function getSchedule(startDate: string) {
  const { gameWeek } = await get<{ gameWeek: GameWeek }>(
    `/schedule/${startDate}`
  );
  const teams = await getTeamsMap();
  const TEAM_DAY_DATA: ScheduleData["data"] = {};
  const numGamesPerDay: number[] = [];
  const result = {
    data: TEAM_DAY_DATA,
    numGamesPerDay,
  };

  // Get number of games per day
  DAYS.forEach((item) => {
    numGamesPerDay.push(
      gameWeek.find((day) => day.dayAbbrev === item)?.numberOfGames ?? 0
    );
  });

  const tasksForOneWeek = gameWeek.map((day) => async () => {
    const tasksForOneDay = day.games.map((game) => async () => {
      const { homeTeam, awayTeam } = game;
      const gameData = {
        id: game.id,
        season: game.season,
        homeTeam: {
          id: homeTeam.id,
          score: homeTeam.score,
          winOdds: await calcWinOdds(
            teams[homeTeam.id].name,
            teams[awayTeam.id].name,
            game.season
          ),
        },
        awayTeam: {
          id: awayTeam.id,
          score: awayTeam.score,
          winOdds: await calcWinOdds(
            teams[awayTeam.id].name,
            teams[homeTeam.id].name,
            game.season
          ),
        },
      };

      if (!TEAM_DAY_DATA[homeTeam.id]) TEAM_DAY_DATA[homeTeam.id] = {};
      TEAM_DAY_DATA[homeTeam.id][day.dayAbbrev] = gameData;

      if (!TEAM_DAY_DATA[awayTeam.id]) TEAM_DAY_DATA[awayTeam.id] = {};
      TEAM_DAY_DATA[awayTeam.id][day.dayAbbrev] = gameData;
    });
    await Promise.all(tasksForOneDay.map((task) => task()));
  });

  await Promise.all(tasksForOneWeek.map((task) => task()));

  return result;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { startDate } = req.query;
  const data = await getSchedule(startDate as string);
  res.setHeader("Cache-Control", "max-age=600");
  res.status(200).json(data);
}
