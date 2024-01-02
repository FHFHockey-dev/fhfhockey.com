import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { getSeasons } from "lib/NHL/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const seasons = await getSeasons();
    const { error } = await supabase.from("seasons").upsert(
      seasons.map((season) => ({
        id: season.seasonId,
        startDate: season.regularSeasonStartDate,
        endDate: season.seasonEndDate,
        regularSeasonEndDate: season.regularSeasonEndDate,
        numberOfGames: season.numberOfGames,
      }))
    );
    if (error) throw error;

    res.status(200).end("successfully updated the seasons table");
  } catch (e: any) {
    res.status(400).end(e.message);
  }
}
