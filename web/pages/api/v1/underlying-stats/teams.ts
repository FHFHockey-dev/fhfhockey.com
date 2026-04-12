import type { NextApiRequest, NextApiResponse } from "next";

import {
  parseTeamLandingApiRequest,
  queryTeamStatsLanding,
} from "lib/underlying-stats/teamStatsQueries";
import type {
  TeamStatsLandingApiError,
  TeamStatsLandingApiResponse,
} from "lib/underlying-stats/teamStatsLandingApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error != null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  if (
    typeof error === "object" &&
    error != null &&
    "hint" in error &&
    typeof (error as { hint?: unknown }).hint === "string"
  ) {
    return (error as { hint: string }).hint;
  }

  return "Unable to build team underlying stats.";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TeamStatsLandingApiResponse | TeamStatsLandingApiError>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed.",
    });
  }

  const parsed = parseTeamLandingApiRequest(req.query);
  if (!parsed.ok) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(parsed.statusCode).json(parsed.error);
  }

  try {
    const aggregation = await queryTeamStatsLanding({
      state: parsed.state,
    });

    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return res.status(200).json(aggregation);
  } catch (error) {
    const message = getErrorMessage(error);

    const statusCode =
      message.includes("does not yet support") || message.includes("Unsupported")
        ? 400
        : 500;

    res.setHeader("Cache-Control", "no-store");
    return res.status(statusCode).json({
      error:
        statusCode === 400
          ? "Unsupported team stats filter combination."
          : "Unable to build team underlying stats.",
      issues: [message],
    });
  }
}