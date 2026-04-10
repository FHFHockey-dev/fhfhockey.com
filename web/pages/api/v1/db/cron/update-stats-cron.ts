import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import adminOnly from "utils/adminOnlyMiddleware";
import { updateStats } from "../update-stats/[gameId]";

export default withCronJobAudit(adminOnly(async (req, res) => {
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
        message: "All game statistics have been successfully updated."
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
      ...setDifference(new Set(ids), new Set(updatedGameIds))
    ];
    if (failedGameIds.length !== 0) {
      console.log(results);
    }
    const staleCutoff = new Date();
    staleCutoff.setUTCDate(staleCutoff.getUTCDate() - 30);
    let quarantinedGameIds: number[] = [];
    if (failedGameIds.length > 0) {
      const { data: failedGameMeta, error: failedGameMetaError } = await supabase
        .from("games")
        .select("id,date")
        .in("id", failedGameIds);
      if (failedGameMetaError) {
        throw failedGameMetaError;
      }
      quarantinedGameIds = ((failedGameMeta ?? []) as Array<{
        id: number;
        date: string | null;
      }>)
        .filter((game) => {
          if (!game?.date) return false;
          const gameTime = Date.parse(`${game.date}T00:00:00.000Z`);
          return Number.isFinite(gameTime) && gameTime < staleCutoff.getTime();
        })
        .map((game) => game.id);

      if (quarantinedGameIds.length > 0) {
        const { error: quarantineError } = await supabase
          .from("statsUpdateStatus")
          .update({ updated: true })
          .in("gameId", quarantinedGameIds);
        if (quarantineError) {
          throw quarantineError;
        }
      }
    }
    const pendingRetryGameIds = failedGameIds.filter(
      (gameId) => !quarantinedGameIds.includes(gameId)
    );
    res.json({
      success: true,
      operationStatus:
        pendingRetryGameIds.length > 0 || quarantinedGameIds.length > 0
          ? "warning"
          : "success",
      message:
        pendingRetryGameIds.length > 0 || quarantinedGameIds.length > 0
          ? "Processed stats backlog; some games remain pending retry or were quarantined from automatic retry."
          : "Processed stats backlog successfully.",
      updatedGameIds,
      quarantinedGameIds,
      pendingRetryGameIds,
      rowsUpserted: updatedGameIds.length,
      attemptedGameIds: ids
    });
  } catch (e: any) {
    res.status(400).json({ message: e.message, success: false });
  }
}));

function setDifference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const difference = new Set<T>();

  setA.forEach((elem) => {
    if (!setB.has(elem)) {
      difference.add(elem);
    }
  });

  return difference;
}
