import { getTeams } from "lib/NHL/server";
import { differenceInYears } from "date-fns";
import { get } from "lib/NHL/base";
import type { Database } from "lib/supabase/database-generated.types";

export type Player = {
  id: number;
  firstName: string;
  fullName: string;
  lastName: string;
  positionCode: Database["public"]["Enums"]["NHL_Position_Code"];
  sweaterNumber: number;
  age: number;
  birthDate: string;
  birthCity: string;
  birthCountry: string;
  weight: number;
  height: number;
  image: string;
  // Team info
  teamId: number;
  teamName: string;
  teamAbbreviation: string;
  teamLogo: string;
};

export async function fetchNhlRosterPreview(seasonId?: number) {
  const teams = await getTeams(seasonId, { mode: "current-canonical" });
  const tasks = teams.map((team) => async () => {
    try {
      const { forwards, defensemen, goalies } = await get(
        `/roster/${team.abbreviation}/${seasonId ?? "current"}`
      );
      // add current team id
      const array = [...forwards, ...defensemen, ...goalies].map((item) => ({
        ...item,
        teamId: team.id,
        teamName: team.name,
        teamAbbreviation: team.abbreviation,
        teamLogo: team.logo
      }));
      return array;
    } catch (e: any) {
      throw new Error(`Roster fetch failed for ${team.abbreviation}/${seasonId}: ${e.message}`);
    }
  });

  const result = (await Promise.all(tasks.map((task) => task()))).flat();
  const players: Player[] = result.map((item) => ({
    id: item.id,
    teamId: item.teamId,
    teamName: item.teamName,
    teamAbbreviation: item.teamAbbreviation,
    teamLogo: item.teamLogo,
    firstName: item.firstName?.default ?? item.firstName, // Use the default field, but fall back to the original if undefined
    lastName: item.lastName?.default ?? item.lastName, // Same as above
    fullName: `${item.firstName?.default ?? item.firstName} ${
      item.lastName?.default ?? item.lastName
    }`, // Handle potential undefineds
    positionCode: item.positionCode,
    sweaterNumber: item.sweaterNumber,
    birthDate: item.birthDate,
    birthCity: item.birthCity?.default ?? item.birthCity, // Handle birthCity safely
    birthCountry: item.birthCountry,
    age: differenceInYears(new Date(), new Date(item.birthDate)),
    height: item.heightInCentimeters,
    weight: item.weightInKilograms,
    image: item.headshot
  }));

  // remove duplicate players
  const playersMap: Record<number, Player> = {};
  players.forEach((player) => {
    if (playersMap[player.id] && playersMap[player.id]!.teamId !== player.teamId) throw new Error(`Conflicting NHL roster memberships for ${player.id}; review required before refresh`);
    playersMap[player.id] = player;
  });
  return Object.values(playersMap);
}
