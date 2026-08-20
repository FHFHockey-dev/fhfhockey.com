import type { NextApiRequest, NextApiResponse } from "next";

import type { FantasyProjectionView } from "lib/fantasy-projections/contracts";
import {
  FantasyProjectionReleaseNotFoundError,
  loadFantasyProjectionPlayers,
} from "lib/fantasy-projections/queries";
import { playerForecastErrorMessage, playerForecastRuntimeBoundary } from "lib/player-forecasts/runtimeSafety";
import { getServiceRoleClient } from "lib/supabase/server";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export const config = {
  api: {
    // `summary` is the default UI payload (<1.5 MB). Keep the explicitly
    // requested compatibility payload bounded without Next's 4 MB warning.
    responseLimit: "8mb",
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const seasonId = Number(first(req.query.seasonId));
  const view = first(req.query.view) as FantasyProjectionView;
  const population = first(req.query.population);
  const format = first(req.query.format) || "full";
  if (
    !Number.isInteger(seasonId) ||
    seasonId <= 0 ||
    !["opening", "current", "ros"].includes(view) ||
    !["", "skater", "goalie"].includes(population) ||
    !["summary", "full"].includes(format)
  ) {
    return res.status(400).json({ success: false, message: "Invalid projection filters." });
  }
  const boundary = playerForecastRuntimeBoundary();
  if (!boundary.allowed) {
    return res.status(503).json({ success: false, message: boundary.message });
  }
  try {
    const payload = await loadFantasyProjectionPlayers({
      supabase: getServiceRoleClient(),
      seasonId,
      view,
      population: population ? (population as "skater" | "goalie") : null,
      format: format as "summary" | "full",
    });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return res.json({ success: true, ...payload });
  } catch (error) {
    if (error instanceof FantasyProjectionReleaseNotFoundError) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: playerForecastErrorMessage(error) });
  }
}
