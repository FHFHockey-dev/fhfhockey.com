import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { getAllPlayers, getCurrentSeason } from "lib/NHL/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const season = await getCurrentSeason();
    const players = await getAllPlayers(season.seasonId);

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
