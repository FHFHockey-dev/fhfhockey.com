import type { NextApiRequest, NextApiResponse } from "next";
import {
  resolveUnderlyingStatsLandingSnapshot,
  type UnderlyingStatsLandingSnapshot
} from "../../../lib/underlying-stats/teamLandingRatings";
import { fetchDistinctUnderlyingStatsSnapshotDates } from "../../../lib/underlying-stats/availableSnapshotDates";
import { isValidIsoDate } from "../../../lib/teamRatingsService";

const CACHE_CONTROL_HEADER = "public, max-age=60";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UnderlyingStatsLandingSnapshot | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { date } = req.query;

  if (typeof date !== "string" || !isValidIsoDate(date)) {
    res
      .status(400)
      .json({ error: 'Query parameter "date" must be YYYY-MM-DD.' });
    return;
  }

  try {
    const availableDates = await fetchDistinctUnderlyingStatsSnapshotDates();
    const payload = await resolveUnderlyingStatsLandingSnapshot({
      requestedDate: date,
      availableDates
    });
    res.setHeader("Cache-Control", CACHE_CONTROL_HEADER);
    res.status(200).json(payload);
  } catch (error) {
    console.error("Failed to load underlying stats landing ratings", error);
    res.status(500).json({
      error: "Failed to load underlying stats landing ratings"
    });
  }
}
