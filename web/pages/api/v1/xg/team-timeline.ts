import type { NextApiRequest, NextApiResponse } from "next";

import { getServiceRoleClient } from "lib/supabase/server";
import { fetchActiveXgModel, type XgActiveModelSelection } from "lib/xg/modelRegistry";

export const XG_TEAM_TIMELINE_COLUMNS =
  "game_date,game_id,model_version,feature_version,xg_for,xg_against,source_model_approved,source_prediction_type";

export type XgTeamTimelineResponse = {
  model: XgActiveModelSelection["model"];
  reason: XgActiveModelSelection["reason"];
  rows: Array<Record<string, unknown>>;
};

function positiveInteger(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Team per-game in-house xG for the Metrics Timeline, pinned to the
 * registry's single active approved model (model_version + feature_version).
 * Rows from any other model or feature version are never returned. The
 * registry has no anon SELECT policy, so the pin is resolved here.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<XgTeamTimelineResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  const teamId = positiveInteger(req.query.teamId);
  const seasonId = positiveInteger(req.query.seasonId);
  if (teamId == null || seasonId == null) {
    return res.status(400).json({ error: "Provide integer teamId and seasonId." });
  }

  try {
    const supabase = getServiceRoleClient();
    const selection = await fetchActiveXgModel({ supabase, predictionType: "shot_goal" });
    let rows: Array<Record<string, unknown>> = [];
    if (selection.model) {
      const { data, error } = await supabase
        .from("nhl_xg_team_game_aggregates")
        .select(XG_TEAM_TIMELINE_COLUMNS)
        .eq("team_id", teamId)
        .eq("season_id", seasonId)
        .eq("model_version", selection.model.modelVersion)
        .eq("feature_version", selection.model.featureVersion)
        .eq("source_model_approved", true)
        .eq("source_prediction_type", "shot_goal")
        .order("game_date", { ascending: true })
        .order("game_id", { ascending: true });
      if (error) throw error;
      rows = (data ?? []) as Array<Record<string, unknown>>;
    }
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({ model: selection.model, reason: selection.reason, rows });
  } catch (error) {
    console.error("xG team timeline unavailable", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ error: "Expected goals could not be loaded." });
  }
}
