import type { NextApiRequest, NextApiResponse } from "next";

import supabaseServer from "../../../lib/supabase/server";
import { fetchDistinctUnderlyingStatsSnapshotDates } from "../../../lib/underlying-stats/availableSnapshotDates";
import {
  resolveUnderlyingStatsLandingSnapshot,
  type UnderlyingStatsLandingSnapshot
} from "../../../lib/underlying-stats/teamLandingRatings";
import { fetchUlsRouteStatus, type UlsRouteStatus } from "../../../lib/underlying-stats/ulsRouteStatus";

type LandingResponse = {
  availableDates: string[];
  initialSnapshot: UnderlyingStatsLandingSnapshot;
  routeStatus: UlsRouteStatus | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LandingResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const requestedDate =
      typeof req.query.date === "string" ? req.query.date : undefined;
    const [availableDates, routeStatus] = await Promise.all([
      fetchDistinctUnderlyingStatsSnapshotDates(90, supabaseServer),
      fetchUlsRouteStatus(supabaseServer)
    ]);
    const initialSnapshot = await resolveUnderlyingStatsLandingSnapshot({
      requestedDate,
      availableDates
    });

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ availableDates, initialSnapshot, routeStatus });
  } catch (error) {
    console.error("Failed to load Underlying Stats landing", error);
    res.status(500).json({ error: "Failed to load Underlying Stats landing" });
  }
}
