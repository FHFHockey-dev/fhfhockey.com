import { differenceInYears } from "date-fns";
import { get, restGet } from "lib/NHL/base";
import type { Player, PlayerGameLog, Season, Team } from "lib/NHL/types";

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

export async function getAllPlayers() {
  const teams = await getTeams();
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
