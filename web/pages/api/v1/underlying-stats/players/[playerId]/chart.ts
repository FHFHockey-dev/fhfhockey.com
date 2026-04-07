import type { NextApiRequest, NextApiResponse } from "next";

import {
  parseLandingChartApiRequest,
  type PlayerStatsLandingChartError,
  type PlayerStatsLandingChartResponse,
} from "lib/underlying-stats/playerStatsQueries";
import { buildPlayerStatsLandingChartFromState } from "lib/underlying-stats/playerStatsLandingServer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlayerStatsLandingChartResponse | PlayerStatsLandingChartError>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed.",
    });
  }

  const parsed = parseLandingChartApiRequest(req.query);
  if (!parsed.ok) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(parsed.statusCode).json(parsed.error);
  }

  try {
    const chartData = await buildPlayerStatsLandingChartFromState({
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
        : "Unable to build player chart underlying stats.";

    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({
      error: "Unable to build player chart underlying stats.",
      issues: [message],
    });
  }
}
