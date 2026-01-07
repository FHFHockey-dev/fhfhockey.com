import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { requireLatestSucceededRunId } from "pages/api/v1/projections/_helpers";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startedAt = Date.now();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabase) throw new Error("Supabase server client not available");

    const dateParam = req.query.date as string | undefined;
    const targetDate = dateParam || new Date().toISOString().split("T")[0];
    const runId = await requireLatestSucceededRunId(targetDate);

    const { data, error } = await supabase
      .from("forge_player_projections")
      .select(
        `
        player_id,
        players!player_id (
          fullName,
          position
        ),
        teams!team_id (
          name
        ),
        proj_goals_es,
        proj_goals_pp,
        proj_goals_pk,
        proj_assists_es,
        proj_assists_pp,
        proj_assists_pk,
        proj_shots_es,
        proj_shots_pp,
        proj_shots_pk,
        proj_hits,
        proj_blocks,
        uncertainty
      `
      )
      .eq("run_id", runId);

    if (error) throw error;

    const projections = (data ?? []).map((row: any) => {
      const g =
        (row.proj_goals_es ?? 0) +
        (row.proj_goals_pp ?? 0) +
        (row.proj_goals_pk ?? 0);
      const a =
        (row.proj_assists_es ?? 0) +
        (row.proj_assists_pp ?? 0) +
        (row.proj_assists_pk ?? 0);
      const sog =
        (row.proj_shots_es ?? 0) +
        (row.proj_shots_pp ?? 0) +
        (row.proj_shots_pk ?? 0);
      const ppp = (row.proj_goals_pp ?? 0) + (row.proj_assists_pp ?? 0);

      return {
        player_id: row.player_id,
        player_name: row.players?.fullName,
        team_name: row.teams?.name,
        position: row.players?.position,
        g,
        a,
        pts: g + a,
        ppp,
        sog,
        hit: row.proj_hits ?? 0,
        blk: row.proj_blocks ?? 0,
        fw: 0,
        fl: 0,
        uncertainty: row.uncertainty
      };
    });

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      runId,
      asOfDate: targetDate,
      data: projections
    });
  } catch (e) {
    const statusCode = (e as any)?.statusCode ?? 500;
    return res.status(statusCode).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      error: (e as any)?.message ?? String(e),
      details: (e as any)?.details
    });
  }
}
