import type { NextApiRequest, NextApiResponse } from "next";

import {
  parseRosterScheduleReadFilter,
  readRosterSchedule,
  ROSTER_SCHEDULE_CACHE_VERSION,
  type ScheduleReadClient,
} from "lib/rosterScheduleData";
import serviceRoleClient from "lib/supabase/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: `Method ${req.method ?? "UNKNOWN"} Not Allowed`,
      },
    });
  }

  try {
    const filter = parseRosterScheduleReadFilter(req.query);
    const games = await readRosterSchedule(
      serviceRoleClient as unknown as ScheduleReadClient,
      filter,
    );
    const fetchedAtValues = games
      .map((game) => game.fetched_at)
      .filter((value): value is string => Boolean(value))
      .sort();

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({
      success: true,
      data: {
        gameKey: filter.gameKey,
        startWeek: filter.startWeek,
        endWeek: filter.endWeek,
        version: ROSTER_SCHEDULE_CACHE_VERSION,
        freshness: {
          latestFetchedAt: fetchedAtValues.at(-1) ?? null,
          oldestFetchedAt: fetchedAtValues[0] ?? null,
          rowCount: games.length,
        },
        games,
      },
    });
  } catch (error: unknown) {
    const isInputError =
      error instanceof Error &&
      /gameKey|startWeek|endWeek|matchup-week range/.test(error.message);
    return res.status(isInputError ? 400 : 500).json({
      success: false,
      error: {
        code: isInputError ? "INVALID_QUERY" : "SCHEDULE_READ_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load the roster optimizer schedule.",
        ...(typeof error === "object" &&
        error != null &&
        "details" in error &&
        error.details
          ? { details: String(error.details) }
          : {}),
      },
    });
  }
}
