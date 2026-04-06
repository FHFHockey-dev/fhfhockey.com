import type { NextApiRequest, NextApiResponse } from "next";

import {
  parseGoalieLandingChartApiRequest,
  type GoalieStatsLandingChartError,
  type GoalieStatsLandingChartResponse,
} from "lib/underlying-stats/goalieStatsQueries";
import { buildGoalieStatsLandingChartFromState } from "lib/underlying-stats/goalieStatsServer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GoalieStatsLandingChartResponse | GoalieStatsLandingChartError>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed.",
    });
  }

  const parsed = parseGoalieLandingChartApiRequest(req.query);
  if (!parsed.ok) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(parsed.statusCode).json(parsed.error);
  }

  try {
    const chartData = await buildGoalieStatsLandingChartFromState({
      playerId: parsed.playerId,
      splitTeamId: parsed.splitTeamId,
      state: parsed.state,
    });

    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return res.status(200).json({
      ...chartData,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to build goalie chart underlying stats.";

    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({
      error: "Unable to build goalie chart underlying stats.",
      issues: [message],
    });
  }
}
