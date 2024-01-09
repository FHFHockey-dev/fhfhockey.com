import type { NextApiRequest, NextApiResponse } from "next";
import { getAllPlayers, getCurrentSeason } from "lib/NHL/server";
import { createClientWithToken, getRole } from "lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const supabase = createClientWithToken(req);
    const isAdmin = (await getRole(supabase)) === "admin";
    if (!isAdmin) throw new Error("You are not an Admin");

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
      }))
    );
    if (players_error) throw players_error;

    console.log(`Updating the 'rosters' table.`);
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
}
