import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import { getCurrentSeason, getSeasonById } from "lib/NHL/server";
import { Season } from "lib/NHL/types";

type SeasonDetailsResponse = {
  id: number;
  startDate: string;
  regularSeasonEndDate: string;
  endDate: string;
  numberOfGames: number;
};

const SEASON_ID_PATTERN = /^(\d{4})(\d{4})$/;

function parseSeasonId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = SEASON_ID_PATTERN.exec(value);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;
  return Number(value);
}

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
    },
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    Season | SeasonDetailsResponse | { error: string; detail?: string }
  >,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (req.query.season !== undefined) {
      const seasonId = parseSeasonId(req.query.season);
      if (seasonId == null) {
        return res.status(400).json({ error: "Invalid season ID" });
      }
      const season = await getSeasonById(seasonId);
      if (!season) {
        return res.status(404).json({ error: "Season not found" });
      }
      res.setHeader("Cache-Control", "max-age=86400");
      return res.status(200).json(season);
    }

    const data = await getCurrentSeason();
    res.setHeader("Cache-Control", "max-age=86400");
    return res.status(200).json(data);
  } catch (error: unknown) {
    const normalized = normalizeDependencyError(error);
    console.error("Error in /api/v1/season:", {
      message: normalized.message,
      detail: normalized.detail,
    });

    if (req.query.season !== undefined) {
      return res.status(503).json({ error: "Unable to resolve season" });
    }

    const fallbackSeason = inferSeasonFromNow();
    res.setHeader("Cache-Control", "max-age=300");
    return res.status(200).json(fallbackSeason);
  }
}
