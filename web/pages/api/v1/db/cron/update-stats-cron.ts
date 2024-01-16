import adminOnly from "utils/adminOnlyMiddleware";
import { updateStats } from "../update-stats/[gameId]";

export default adminOnly(async (req, res) => {
  const { supabase } = req;
  try {
    //
    const { data } = await supabase
      .rpc("get_unupdated_games")
      .limit(5)
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
      await supabase
        .from("statsUpdateStatus")
        .update({ updated: true })
        .eq("gameId", id)
        .throwOnError();
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
