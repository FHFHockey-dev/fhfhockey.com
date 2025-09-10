// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\lib\NHL\server\index.ts

import { differenceInYears } from "date-fns";
import { get, restGet } from "lib/NHL/base";
import {
  Boxscore,
  DAYS,
  DAY_ABBREVIATION,
  Player,
  PlayerGameLog,
  ScheduleData,
  Season,
  Team,
  GameData
} from "lib/NHL/types";
import supabase from "lib/supabase";
import supabaseServer from "lib/supabase/server";
import { Tables } from "lib/supabase/database-generated.types";
import { updatePlayer } from "pages/api/v1/db/update-player/[playerId]";

export async function getPlayerGameLog(
  id: number | string,
  seasonId: number | string,
  gameType: number | string = 2
): Promise<PlayerGameLog[]> {
  try {
    const data =
      (await get(`/player/${id}/game-log/${seasonId}/${gameType}`)).gameLog ??
      [];
    return data;
  } catch (e: any) {
    console.error("Cannot find the game log for player " + id);
    return [];
  }
}

/**
 * Server only
 * @param id
 * @returns
 */
export async function getPlayer(id: number): Promise<Player> {
  const { data } = await supabase
    .from("rosters")
    .select("teamId, sweaterNumber, players(*), teams(name,abbreviation)")
    .eq("playerId", id)
    .order("seasonId", { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  if (data === null) {
    await updatePlayer(id, supabaseServer);
    throw new Error("Unable to find the player. " + id);
  }
  return {
    sweaterNumber: data.sweaterNumber,
    teamId: data.teamId,
    teamName: data.teams?.name,
    teamAbbreviation: data.teams?.abbreviation,
    age: differenceInYears(new Date(), new Date(data.players?.birthDate ?? "")),
    ...data.players
  } as Player;
}

/**
 * Server only
 * @returns
 */
export async function getTeams(seasonId?: number): Promise<Team[]> {
  if (seasonId === undefined) {
    seasonId = (await getCurrentSeason()).seasonId;
  }

  const { data: teams } = (await supabase
    .from("teams")
    .select("id, name, abbreviation, team_season!inner()")
    .eq("team_season.seasonId", seasonId)) as unknown as {
    data: Tables<"teams">[];
  };
  // Deduplicate by abbreviation: keep the entry with the highest team ID
  const byAbbr = new Map<string, Tables<"teams">>();
  for (const t of teams) {
    const prev = byAbbr.get(t.abbreviation);
    if (!prev || t.id > prev.id) byAbbr.set(t.abbreviation, t);
  }
  const deduped = Array.from(byAbbr.values());
  return deduped.map((team) => ({
    ...team,
    logo: getTeamLogo(team.abbreviation)
  }));
}

export function getTeamLogo(teamAbbreviation: string | undefined) {
  return teamAbbreviation
    ? `/teamLogos/${teamAbbreviation}.png`
    : "/pictures/circle.png";
}

/**
 * Server only
 * @returns
 */
export async function getCurrentSeason(): Promise<Season> {
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .lte("startDate", new Date().toISOString()) // ensure season has started
    .order("startDate", { ascending: false })
    .limit(2);
  if (data === null) throw Error("Cannot find the current season");

  const currentSeason = data[0];
  const lastSeason = data[1];

  return {
    seasonId: currentSeason.id,
    regularSeasonStartDate: currentSeason.startDate,
    regularSeasonEndDate: currentSeason.regularSeasonEndDate,
    seasonEndDate: currentSeason.endDate,
    numberOfGames: currentSeason.numberOfGames,
    lastSeasonId: lastSeason.id,
    lastRegularSeasonStartDate: lastSeason.startDate,
    lastRegularSeasonEndDate: lastSeason.regularSeasonEndDate,
    lastSeasonEndDate: lastSeason.endDate,
    lastNumberOfGames: lastSeason.numberOfGames,
    slice: function (arg0: number, arg1: number): string {
      return "";
    }
  };
}

export async function getSeasons(): Promise<Season[]> {
  const data = (await restGet(`/season`)).data.map((item) => ({
    seasonId: item.id,
    regularSeasonStartDate: item.startDate,
    regularSeasonEndDate: item.regularSeasonEndDate,
    seasonEndDate: item.endDate,
    numberOfGames: item.numberOfGames,
    lastSeasonId: item.id,
    lastRegularSeasonStartDate: item.startDate,
    lastRegularSeasonEndDate: item.regularSeasonEndDate,
    lastSeasonEndDate: item.endDate,
    lastNumberOfGames: item.numberOfGames,

    slice: function (arg0: number, arg1: number): string {
      return "";
    }
  }));
  return data;
}

export async function getAllPlayers(seasonId?: number): Promise<Player[]> {
  if (!seasonId) {
    seasonId = (await getCurrentSeason()).seasonId;
  }
  const { data } = await supabase
    .from("rosters")
    .select("sweaterNumber, players(*), teams(id, name,abbreviation)")
    .eq("seasonId", seasonId);

  // ADDED "ANY" TYPE TO player
  // 02/19/2024 10:23AM EST
  return data!.map((player: any) => ({
    ...player.players!,
    age: differenceInYears(
      new Date(),
      new Date(player.players?.birthDate ?? "")
    ),
    sweaterNumber: player.sweaterNumber,
    teamId: player.teams?.id,
    teamAbbreviation: player.teams?.abbreviation,
    teamName: player.teams?.name
  }));
}

async function getTeamsMap(): Promise<Record<number, Team>> {
  const teams = await getTeams();
  const map: any = {};
  teams.forEach((team) => {
    map[team.id] = team;
  });
  return map;
}

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

/**
 *
 * @param startDate e.g., 2023-11-06
 * @returns
 */
export async function getSchedule(startDate: string) {
  const { gameWeek } = await get<{ gameWeek: GameWeek }>(
    `/schedule/${startDate}`
  );
  const teams = await getTeamsMap();
  const TEAM_DAY_DATA: ScheduleData["data"] = {};
  const numGamesPerDay: number[] = [];
  const result = {
    data: TEAM_DAY_DATA,
    numGamesPerDay
  };

  // Get number of games per day
  DAYS.forEach((item) => {
    numGamesPerDay.push(
      gameWeek.find((day) => day.dayAbbrev === item)?.numberOfGames ?? 0
    );
  });

  // Collect all game IDs
  const gameIds: number[] = [];
  gameWeek.forEach((day) => {
    day.games.forEach((game) => {
      gameIds.push(game.id);
    });
  });

  // Fetch win odds from 'expected_goals' table
  const { data: oddsData, error } = await supabase
    .from("expected_goals")
    .select(
      "game_id, home_win_odds, away_win_odds, home_api_win_odds, away_api_win_odds"
    )
    .in("game_id", gameIds);

  if (error) {
    console.error("Error fetching win odds data:", error);
  }

  // Map odds data by game_id
  const oddsByGameId = (oddsData || []).reduce(
    (acc, item) => {
      acc[item.game_id] = item;
      return acc;
    },
    {} as Record<number, any>
  );

  const tasksForOneWeek = gameWeek.map((day) => async () => {
    const tasksForOneDay = day.games.map((game) => async () => {
      const { homeTeam, awayTeam } = game;
      if (
        teams[homeTeam.id] === undefined ||
        teams[awayTeam.id] === undefined
      ) {
        console.error("skip for ", homeTeam.id, teams[awayTeam.id]);
        return;
      }

      // Fetch win odds from the oddsByGameId
      const odds = oddsByGameId[game.id];
      let homeWinOdds = null;
      let awayWinOdds = null;
      let homeApiWinOdds = null;
      let awayApiWinOdds = null;

      if (odds) {
        homeWinOdds = odds.home_win_odds;
        awayWinOdds = odds.away_win_odds;
        homeApiWinOdds = odds.home_api_win_odds;
        awayApiWinOdds = odds.away_api_win_odds;
      }

      const derivedGameType = Math.floor(game.id / 10000) % 100;
      const gameData: GameData = {
        id: game.id,
        season: game.season,
        gameType: derivedGameType,
        homeTeam: {
          id: homeTeam.id,
          score: homeTeam.score,
          winOdds: homeWinOdds,
          apiWinOdds: homeApiWinOdds
        },
        awayTeam: {
          id: awayTeam.id,
          score: awayTeam.score,
          winOdds: awayWinOdds,
          apiWinOdds: awayApiWinOdds
        }
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

export async function getBoxscore(id: number): Promise<Boxscore> {
  const data = await get(`/gamecenter/${id}/boxscore`);
  return data;
}
