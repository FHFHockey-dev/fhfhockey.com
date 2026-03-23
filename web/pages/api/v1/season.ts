import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import { getCurrentSeason } from "lib/NHL/server";
import { Season } from "lib/NHL/types";

function inferSeasonFromNow(now: Date = new Date()): Season {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  const endYear = startYear + 1;
  const seasonId = Number(`${startYear}${endYear}`);
  const lastStartYear = startYear - 1;
  const lastEndYear = startYear;

  return {
    seasonId,
    regularSeasonStartDate: `${startYear}-10-01T00:00:00.000Z`,
    regularSeasonEndDate: `${endYear}-04-30T23:59:59.999Z`,
    seasonEndDate: `${endYear}-06-30T23:59:59.999Z`,
    numberOfGames: 82,
    lastSeasonId: Number(`${lastStartYear}${lastEndYear}`),
    lastRegularSeasonStartDate: `${lastStartYear}-10-01T00:00:00.000Z`,
    lastRegularSeasonEndDate: `${lastEndYear}-04-30T23:59:59.999Z`,
    lastSeasonEndDate: `${lastEndYear}-06-30T23:59:59.999Z`,
    lastNumberOfGames: 82,
    slice() {
      return "";
    }
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Season | { error: string; detail?: string }>
) {
  try {
    const data = await getCurrentSeason();
    res.setHeader("Cache-Control", "max-age=86400");
    return res.status(200).json(data);
  } catch (error: unknown) {
    const normalized = normalizeDependencyError(error);
    console.error("Error in /api/v1/season:", {
      message: normalized.message,
      detail: normalized.detail
    });

    const fallbackSeason = inferSeasonFromNow();
    res.setHeader("Cache-Control", "max-age=300");
    return res.status(200).json(fallbackSeason);
  }
}
