import { NextApiRequest, NextApiResponse } from "next";
import { differenceInYears } from "date-fns";
import { get } from "lib/NHL/base";
import { getTeams } from "../team/[seasonId]";
import type { Player } from "./[id]";

async function getAllPlayers() {
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const players = await getAllPlayers();
  // cache for 7 days
  res.setHeader("Cache-Control", "max-age=604800");
  res.status(200).json(players);
}
