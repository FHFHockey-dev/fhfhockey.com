import { SupabaseClient } from "@supabase/supabase-js";
import { differenceInYears } from "date-fns";
import { get } from "lib/NHL/base";
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
      team_id: player.teamId,
      sweater_number: player.sweaterNumber,
      image_url: player.image,
    })
    .throwOnError();
}

type Player = {
  id: number;
  firstName: string;
  fullName: string;
  lastName: string;
  positionCode: string;
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

async function getPlayer(id: number): Promise<Player | null> {
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
      birthDate: data.birthDate,
      birthCity: data.birthCity?.default ?? "",
      birthCountry: data.birthCountry ?? "US",
      age: differenceInYears(new Date(), new Date(data.birthDate)),
      height: data.heightInCentimeters ?? 0,
      weight: data.weightInKilograms ?? 0,
      teamId: data.currentTeamId ?? 0,
      teamAbbreviation: data.currentTeamAbbrev ?? "XXX",
      teamLogo: data.teamLogo,
      teamName: data.fullTeamName ? data.fullTeamName.default : "",
    };
  } catch (e: any) {
    console.error("Failed to get player: " + id, e);
    return null;
  }
}
