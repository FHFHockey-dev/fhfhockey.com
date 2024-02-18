import adminOnly from "utils/adminOnlyMiddleware";
import { updateStats } from "../update-stats/[gameId]";

export default adminOnly(async (req, res) => {
  const { supabase } = req;
  const count = req.query.count ? Number(req.query.count) : 5;
  try {
    //
    const { data } = await supabase
      .rpc("get_unupdated_games")
      .limit(count)
      .throwOnError();
    const ids: number[] = data.map((game: any) => game.gameid);
    if (ids.length === 0) {
      return res.json({
        success: true,
        message: "All game statistics have been successfully updated.",
      });
    }
    console.log(ids);

    // Create an array of promises
    const updatePromises = ids.map(async (id) => {
      console.log("updating the stats for game with id " + id);
      await updateStats(id, supabase);
      const { error } = await supabase
        .from("statsUpdateStatus")
        .update({ updated: true })
        .eq("gameId", id);
      if (error) {
        console.error("Failed to update the stats for game: " + id);
        throw error;
      }
    });

    // Wait for all promises to resolve
    await Promise.all(updatePromises);

    res.json({
      success: true,
      message:
        `Successfully updated the stats for these games` + JSON.stringify(ids),
    });
  } catch (e: any) {
    res.status(400).json({ message: e.message, success: false });
  }
});
