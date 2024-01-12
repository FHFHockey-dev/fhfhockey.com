import { SupabaseClient } from "@supabase/supabase-js";
import { getPlayer } from "lib/NHL/server";
import adminOnly from "utils/adminOnlyMiddleware";

export default adminOnly(async (req, res) => {
  const { supabase } = req;
  const playerId = Number(req.query.playerId);
  try {
    await updatePlayer(playerId, supabase);

    res.json({
      message: "Successfully updated the player " + playerId,
      success: true,
    });
  } catch (e: any) {
    res.status(400).json({
      message: "Failed to update the player" + e.message,
      success: false,
    });
  }
});

/**
 * Update the player in supabase db
 * @param playerId
 * @param supabase
 */
export async function updatePlayer(playerId: number, supabase: SupabaseClient) {
  const player = await getPlayer(playerId);
  if (player === null)
    throw new Error(`Player(${playerId}) does not exists on NHL.com`);

  await supabase
    .from("players")
    .upsert({
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
    })
    .throwOnError();
}
