import type { NextApiRequest, NextApiResponse } from "next";

import type { FantasyProjectionView } from "lib/fantasy-projections/contracts";
import {
  FantasyProjectionReleaseNotFoundError,
  loadFantasyProjectionPlayerDetail,
} from "lib/fantasy-projections/queries";
import {
  playerForecastErrorMessage,
  playerForecastRuntimeBoundary,
} from "lib/player-forecasts/runtimeSafety";
import { getServiceRoleClient } from "lib/supabase/server";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const fhfhPlayerId = Number(first(req.query.fhfhPlayerId));
  const seasonId = Number(first(req.query.seasonId));
  const view = first(req.query.view) as FantasyProjectionView;
  if (
    !Number.isInteger(fhfhPlayerId) ||
    fhfhPlayerId <= 0 ||
    !Number.isInteger(seasonId) ||
    seasonId <= 0 ||
    !["opening", "current", "ros"].includes(view)
  ) {
    return res.status(400).json({ success: false, message: "Invalid projection filters." });
  }
  const boundary = playerForecastRuntimeBoundary();
  if (!boundary.allowed) {
    return res.status(503).json({ success: false, message: boundary.message });
  }
  try {
    const payload = await loadFantasyProjectionPlayerDetail({
      supabase: getServiceRoleClient(),
      seasonId,
      view,
      fhfhPlayerId,
    });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return res.json({ success: true, ...payload });
  } catch (error) {
    if (error instanceof FantasyProjectionReleaseNotFoundError) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: playerForecastErrorMessage(error),
    });
  }
}
