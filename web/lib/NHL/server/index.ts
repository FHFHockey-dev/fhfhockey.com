import calcWinOdds from "components/GameGrid/utils/calcWinOdds";
import { differenceInYears } from "date-fns";
import { get, restGet } from "lib/NHL/base";
import {
  DAYS,
  DAY_ABBREVIATION,
  Player,
  PlayerGameLog,
  ScheduleData,
  Season,
  Team,
} from "lib/NHL/types";

export async function getPlayerGameLog(
  id: number | string,
  seasonId: number | string,
  gameType: number | string = 2
): Promise<PlayerGameLog[]> {
  const data =
    (await get(`/player/${id}/game-log/${seasonId}/${gameType}`)).gameLog ?? [];
  return data;
}

/**
 * Server only
 * @param id
 * @returns
 */
export async function getPlayer(id: number): Promise<Player | null> {
  try {
    const data = await get(`/player/${id}/landing`);
    return {
      id: data.playerId,
      firstName: data.firstName.default,
      lastName: data.lastName.default,
      fullName: `${data.firstName.default} ${data.lastName.default}`,
      sweaterNumber: data.sweaterNumber,
      positionCode: data.position,
      image: data.headshot,
      age: differenceInYears(new Date(), new Date(data.birthDate)),
      height: data.heightInCentimeters,
      weight: data.weightInKilograms,
      teamId: data.currentTeamId,
      teamAbbreviation: data.currentTeamAbbrev,
      teamLogo: data.teamLogo,
      teamName: data.fullTeamName?.default,
    };
  } catch (e: any) {
    console.error(e);
    return null;
  }
}

/**
 * Server only
 * @returns
 */
export async function getTeams(seasonId?: number): Promise<Team[]> {
  if (seasonId === undefined) {
    seasonId = (await getCurrentSeason()).seasonId;
  }
  const { data: allTeams } = await restGet("/team");
  const { data: currentSeasonTeams } = await restGet(
    `/team/summary?cayenneExp=seasonId=${seasonId}`
  );
  const currentSeasonTeamIds = new Set(
    currentSeasonTeams.map((team) => team.teamId)
  );

  return allTeams
    .filter((team) => currentSeasonTeamIds.has(team.id))
    .map((item) => ({
      id: item.id,
      name: item.fullName,
      abbreviation: item.triCode,
      logo: getTeamLogo(item.fullName),
    }));
}

export function getTeamLogo(teamName: string) {
  return `/teamLogos/${teamName}.png`;
}

/**
 * Server only
 * @returns
 */
export async function getCurrentSeason(): Promise<Season> {
  const data = (
    await restGet(
      `/season?sort=${encodeURIComponent(
        '[{"property": "id", "direction":"DESC"}]'
      )}&limit=1`
    )
  ).data[0];

  return {
    seasonId: data.id,
    regularSeasonStartDate: data.startDate,
    regularSeasonEndDate: data.regularSeasonEndDate,
    seasonEndDate: data.endDate,
    numberOfGames: data.numberOfGames,
  };
}

export async function getAllPlayers(seasonId?: number) {
  const teams = await getTeams(seasonId);
  const tasks = teams.map((team) => async () => {
    try {
      const { forwards, defensemen, goalies } = await get(
        `/roster/${team.abbreviation}/current`
      );
      // add current team id
      const array = [...forwards, ...defensemen, ...goalies].map((item) => ({
        ...item,
        teamId: team.id,
        teamName: team.name,
        teamAbbreviation: team.abbreviation,
        teamLogo: team.logo,
      }));
      return array;
    } catch (e: any) {
      // console.error(`/roster/${team.abbreviation}/current`, "is missing");
      return [];
    }
  });

  const result = (await Promise.all(tasks.map((task) => task()))).flat();
  const players: Player[] = result.map((item) => ({
    id: item.id,
    teamId: item.teamId,
    teamName: item.teamName,
    teamAbbreviation: item.teamAbbreviation,
    teamLogo: item.teamLogo,
    firstName: item.firstName.default,
    lastName: item.lastName.default,
    fullName: `${item.firstName.default} ${item.lastName.default}`,
    positionCode: item.positionCode,
    sweaterNumber: item.sweaterNumber,
    age: differenceInYears(new Date(), new Date(item.birthDate)),
    height: item.heightInCentimeters,
    weight: item.weightInKilograms,
    image: item.headshot,
  }));

  return players;
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

export async function getPlayerPercentileRank() {}
