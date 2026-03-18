// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\pages\api\v1\db\update-line-combinations\index.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason } from "lib/NHL/server";
import adminOnly from "utils/adminOnlyMiddleware";
import { updateLineCombos } from "./[id]";

export default withCronJobAudit(adminOnly(async (req, res) => {
  const supabase = req.supabase;
  const count = req.query.count ? Number(req.query.count) : 5;

  try {
    const currentSeason = await getCurrentSeason();
    const candidateWindow = Math.max(count * 20, 100);

    const { data: recentGames } = await supabase
      .from("games")
      .select("id, startTime")
      .eq("seasonId", currentSeason.seasonId)
      .lte("startTime", new Date().toISOString())
      .order("startTime", { ascending: false })
      .limit(candidateWindow)
      .throwOnError();

    if (!recentGames || recentGames.length === 0) {
      return res.json({
        message: "No current-season games were eligible for line-combo updates.",
        success: true
      });
    }

    const candidateIds = recentGames.map((game) => game.id);
    const { data: existingLineCombos } = await supabase
      .from("lineCombinations")
      .select("gameId")
      .in("gameId", candidateIds)
      .throwOnError();

    const comboCounts = new Map<number, number>();
    existingLineCombos?.forEach((combo) => {
      comboCounts.set(combo.gameId, (comboCounts.get(combo.gameId) ?? 0) + 1);
    });

    const gameIds = candidateIds
      .filter((id) => (comboCounts.get(id) ?? 0) < 2)
      .slice(0, count)
      .map((id) => ({ id }));

    if (gameIds.length === 0) {
      return res.json({
        message: "Recent current-season line combination data are up to date.",
        success: true
      });
    }

    const results = await Promise.allSettled(
      gameIds.map((item) => updateLineCombos(item.id, supabase))
    );
    const updated = results.filter(
      (item) => item.status === "fulfilled"
    ) as PromiseFulfilledResult<any[]>[];
    const failed = results.filter(
      (item) => item.status === "rejected"
    ) as PromiseRejectedResult[];

    // Log the errors if any
    failed.forEach((item) => console.error(item.reason));

    const updatedGameIds = updated.map((item) => item.value[0].gameId);
    const failedMessages = failed.map((item) => item.reason.message);

    if (failed.length > 0) {
      return res.status(500).json({
        success: false,
        message:
          `Updated line combinations for games [${updatedGameIds}]. ` +
          `Failed games [${failedMessages}]`
      });
    }

    res.json({
      success: true,
      message: `Successfully updated the line combinations for these games [${updatedGameIds}]`
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ message: e.message, success: false });
  }
}));
