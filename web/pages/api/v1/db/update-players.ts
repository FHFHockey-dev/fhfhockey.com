import { getCurrentSeason, getTeams } from "lib/NHL/server";
import { differenceInYears } from "date-fns";
import { get } from "lib/NHL/base";
import adminOnly from "utils/adminOnlyMiddleware";
import { Database } from "lib/supabase/database-generated.types";

export default adminOnly(async function handler(req, res) {
  try {
    const { supabase } = req;
    const season = await getCurrentSeason();
    const players = await getAllPlayers(season.seasonId);
    console.log(`${players.length} players fetched from NHL.com `);
    console.log(`Updating the 'players' table.`);
    const { error: players_error } = await supabase.from("players").upsert(
      players.map((player) => ({
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        fullName: player.fullName,
        position: player.positionCode,
        birthDate: player.birthDate,
        birthCity: player.birthCity,
        birthCountry: player.birthCountry,
        heightInCentimeters: player.height,
        weightInKilograms: player.weight,
        team_id: player.teamId,
        sweater_number: player.sweaterNumber,
        image_url: player.image,
      }))
    );
    if (players_error) throw players_error;

    console.log(`Updating the 'rosters' table.`);
    // remove the players who play for multiple teams in a given season. aka. exists in multiple rosters.
    await supabase.rpc("delete_duplicate_players_in_rosters", {
      _seasonid: season.seasonId,
    });
    const { error: rosters_error } = await supabase.from("rosters").upsert(
      players.map((player) => ({
        playerId: player.id,
        seasonId: season.seasonId,
        teamId: player.teamId,
        sweaterNumber: player.sweaterNumber ?? 0,
      }))
    );
    if (rosters_error) throw rosters_error;

    res.json({
      message: "Successfully updated the players & rosters tables.",
      success: true,
    });
  } catch (e: any) {
    res.status(400).json({
      message: "Failed to update " + e.message,
      success: false,
    });

    console.table(e);
  }
});

type Player = {
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

async function getAllPlayers(seasonId?: number) {
  const teams = await getTeams(seasonId);
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
    image: item.headshot,
  }));

  // remove duplicate players
  const playersMap: Record<number, Player> = {};
  players.forEach((player) => {
    playersMap[player.id] = player;
  });
  return Object.values(playersMap);
}
