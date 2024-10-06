import adminOnly from "utils/adminOnlyMiddleware";
import { updateStats } from "../update-stats/[gameId]";
import { processGameIDs } from "lib/supabase/Upserts/fetchPbPData";

export default adminOnly(async (req, res) => {
  const { supabase } = req;
  const count = req.query.count ? Number(req.query.count) : 5;
  try {
    // todo: temporarily disable this as it takes a while to run.
    // this cause the function execution to timeout
    // await processGameIDs(); // updating pbp

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
      return id;
    });

    // Wait for all promises to resolve
    const results = await Promise.allSettled(updatePromises);

    const updatedGameIds = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        updatedGameIds.push(result.value);
      }
    }
    const failedGameIds = [
      ...setDifference(new Set(ids), new Set(updatedGameIds)),
    ];
    if (failedGameIds.length !== 0) {
      console.log(results);
    }
    res.json({
      success: true,
      message:
        `Successfully updated the stats for these games` +
        JSON.stringify(updatedGameIds) +
        `\n Failed games: ${JSON.stringify(failedGameIds)}`,
    });
  } catch (e: any) {
    res.status(400).json({ message: e.message, success: false });
  }
});

function setDifference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const difference = new Set<T>();

  setA.forEach((elem) => {
    if (!setB.has(elem)) {
      difference.add(elem);
    }
  });

  return difference;
}
