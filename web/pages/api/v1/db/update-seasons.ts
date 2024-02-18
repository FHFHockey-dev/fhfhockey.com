import { Season } from "lib/NHL/types";
import { restGet } from "lib/NHL/base";
import adminOnly from "utils/adminOnlyMiddleware";

export default adminOnly(async function handler(req, res) {
  try {
    const { supabase } = req;
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

    res.status(200).json({
      message: "successfully updated the seasons table",
      success: true,
    });
  } catch (e: any) {
    res.status(400).json({ message: e.message, success: false });
  }
});

async function getSeasons(): Promise<Season[]> {
  const data = (await restGet(`/season`)).data.map((item) => ({
    seasonId: item.id,
    regularSeasonStartDate: item.startDate,
    regularSeasonEndDate: item.regularSeasonEndDate,
    seasonEndDate: item.endDate,
    numberOfGames: item.numberOfGames,
  }));
  return data;
}
