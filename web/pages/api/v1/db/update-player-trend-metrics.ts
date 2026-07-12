import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import { rebuildPlayerTrends } from "../trends/player-trends";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

export const PLAYER_TREND_REPAIR_WINDOW_DAYS = 7;

export function resolvePlayerTrendWriteFromDate(today: string): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - PLAYER_TREND_REPAIR_WINDOW_DAYS);
  return date.toISOString().slice(0, 10);
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const season = await fetchCurrentSeason();
    const today = new Date().toISOString().slice(0, 10);
    const writeFromDate = resolvePlayerTrendWriteFromDate(today);
    const result = await rebuildPlayerTrends({
      startDate: season.startDate.slice(0, 10),
      seasonId: season.id,
      writeFromDate,
    });

    return res.status(200).json({
      ...result,
      mode: "current_season_incremental_write",
      sourceWindow: {
        startDate: season.startDate.slice(0, 10),
        endDate: today,
      },
      writeWindow: {
        startDate: writeFromDate,
        endDate: today,
        repairDays: PLAYER_TREND_REPAIR_WINDOW_DAYS,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Failed to update player trend metrics",
    });
  }
}

export default withCronJobAudit(handler, {
  jobName: "update-player-trend-metrics",
});
