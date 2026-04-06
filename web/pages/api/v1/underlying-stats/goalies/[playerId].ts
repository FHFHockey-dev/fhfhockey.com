import type { NextApiRequest, NextApiResponse } from "next";

import {
  parseGoalieDetailApiRequest,
  type GoalieStatsDetailApiError,
  type GoalieStatsDetailApiResponse,
} from "lib/underlying-stats/goalieStatsQueries";
import { buildGoalieStatsDetailAggregationFromState } from "lib/underlying-stats/goalieStatsServer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GoalieStatsDetailApiResponse | GoalieStatsDetailApiError>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed.",
    });
  }

  const parsed = parseGoalieDetailApiRequest(req.query);
  if (!parsed.ok) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(parsed.statusCode).json(parsed.error);
  }

  try {
    const aggregation = await buildGoalieStatsDetailAggregationFromState(
      parsed.playerId,
      parsed.state
    );

    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return res.status(200).json({
      ...aggregation,
      placeholder: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to build goalie detail underlying stats.";

    const statusCode =
      message.includes("does not yet support") || message.includes("Unsupported")
        ? 400
        : 500;

    res.setHeader("Cache-Control", "no-store");
    return res.status(statusCode).json({
      error:
        statusCode === 400
          ? "Unsupported goalie stats filter combination."
          : "Unable to build goalie detail underlying stats.",
      issues: [message],
    });
  }
}
