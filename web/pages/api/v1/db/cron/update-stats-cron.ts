import adminOnly from "utils/adminOnlyMiddleware";
import { updateStats } from "../update-stats/[gameId]";

export default adminOnly(async (req, res) => {
  const { supabase } = req;
  try {
    //
    const { data } = await supabase
      .rpc("get_unupdated_games")
      .limit(10)
      .throwOnError();
    const ids = data.map((game: any) => game.gameid);
    console.log(ids);
    for (const id of ids) {
      console.log("updating the stats for game with id " + id);
      await updateStats(id, supabase);
      await supabase
        .from("statsUpdateStatus")
        .update({ updated: true })
        .eq("gameId", id)
        .throwOnError();
    }

    res.json({
      success: true,
      message:
        `Successfully updated the stats for these games` + JSON.stringify(ids),
    });
  } catch (e: any) {
    res.status(400).json({ message: e.message, success: false });
  }
});
