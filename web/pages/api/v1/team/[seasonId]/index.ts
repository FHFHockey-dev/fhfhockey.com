import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import { Team } from "lib/NHL/types";
import { getTeams, isValidNhlSeasonId } from "lib/NHL/server";

type TeamRouteError = {
  success: false;
  message: string;
};

function parseSeasonId(
  value: string | string[] | undefined,
): number | "current" | null {
  if (value === "current") return value;
  if (typeof value !== "string" || !/^\d{8}$/.test(value)) return null;

  const seasonId = Number(value);
  return isValidNhlSeasonId(seasonId) ? seasonId : null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Team[] | TeamRouteError>,
) {
  const seasonId = parseSeasonId(req.query.seasonId);
  if (seasonId === null) {
    return res.status(400).json({
      success: false,
      message: "A valid season id or 'current' is required",
    });
  }

  try {
    const data = await getTeams(seasonId === "current" ? undefined : seasonId);

    res.setHeader("Cache-Control", "max-age=86400");
    return res.status(200).json(data);
  } catch (error: unknown) {
    const normalized = normalizeDependencyError(error);
    console.error("team route failed", {
      seasonId,
      message: normalized.message,
      detail: normalized.detail,
    });
    return res.status(503).json([]);
  }
}
