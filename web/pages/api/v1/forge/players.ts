import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { buildRequestedDateServingState } from "lib/dashboard/freshness";
import { requireLatestSucceededRunId } from "pages/api/v1/projections/_helpers";

async function fetchCurrentSeasonIdForDate(asOfDate: string): Promise<number> {
  if (!supabase) throw new Error("Supabase server client not available");
  const asOfTimestamp = `${asOfDate}T23:59:59.999Z`;
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .lte("startDate", asOfTimestamp)
    .order("startDate", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const seasonId = Number((data as any)?.id);
  if (!Number.isFinite(seasonId)) {
    throw new Error(`Unable to resolve season id for date=${asOfDate}`);
  }
  return seasonId;
}

async function fetchActiveRosterPlayerIdSet(
  seasonId: number
): Promise<Set<number>> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await supabase
    .from("rosters")
    .select("playerId")
    .eq("seasonId", seasonId)
    .eq("is_current", true);
  if (error) throw error;
  return new Set(
    ((data ?? []) as Array<any>)
      .map((row) => Number(row?.playerId))
      .filter((id) => Number.isFinite(id))
  );
}

async function fetchFallbackRunWithPlayerData(
  targetDate: string,
  horizonGames: number
): Promise<{ runId: string; asOfDate: string } | null> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data: candidates, error: candidatesError } = await supabase
    .from("forge_runs")
    .select("run_id,as_of_date")
    .eq("status", "succeeded")
    .lte("as_of_date", targetDate)
    .order("as_of_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (candidatesError) throw candidatesError;

  const rows = (candidates ?? []) as Array<{
    run_id: string;
    as_of_date: string;
  }>;
  for (const row of rows) {
    const { count, error } = await supabase
      .from("forge_player_projections")
      .select("player_id", { count: "exact", head: true })
      .eq("run_id", row.run_id)
      .eq("horizon_games", horizonGames);
    if (error) throw error;
    if ((count ?? 0) > 0) {
      return { runId: row.run_id, asOfDate: row.as_of_date };
    }
  }
  return null;
}

function parseHorizonGames(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);
  if (!Number.isFinite(parsed)) return 1;
  const intValue = Math.floor(parsed);
  return Math.max(1, Math.min(5, intValue));
}

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
    const horizonGames = parseHorizonGames(req.query.horizon);
    let resolvedDate = targetDate;
    let runId: string | null = null;
    let fallbackApplied = false;
    let projectionsRaw: any[] = [];

    // 1. Try to find a run for the requested date
    try {
      runId = await requireLatestSucceededRunId(targetDate);
    } catch (e) {
      if ((e as any)?.statusCode !== 404) throw e;
    }

    const selectQuery = `
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
      `;

    // 2. If run found, fetch data
    if (runId) {
      const { data, error } = await supabase
        .from("forge_player_projections")
        .select(selectQuery)
        .eq("run_id", runId)
        .eq("horizon_games", horizonGames);

      if (error) throw error;
      projectionsRaw = data ?? [];
    }

    // 3. Fallback logic: If no run found OR run produced 0 players (e.g., no games), try finding the latest date with players
    if (!runId || projectionsRaw.length === 0) {
      const fallback = await fetchFallbackRunWithPlayerData(
        targetDate,
        horizonGames
      );

      // Only switch if we found a fallback request
      if (fallback) {
        // Optimization check: if fallback points to same run (unlikely if today has 0 rows), don't fetch again
        if (fallback.runId !== runId) {
          runId = fallback.runId;
          resolvedDate = fallback.asOfDate;
          fallbackApplied = resolvedDate !== targetDate;

          const { data, error } = await supabase
            .from("forge_player_projections")
            .select(selectQuery)
            .eq("run_id", runId)
            .eq("horizon_games", horizonGames);

          if (error) throw error;
          projectionsRaw = data ?? [];
        }
      } else {
        // No fallback found. If we never had a runId, throw 404.
        if (!runId) {
          const err = new Error(
            `No succeeded projection run found for date=${targetDate}`
          );
          (err as any).statusCode = 404;
          throw err;
        }
      }
    }

    const currentSeasonId = await fetchCurrentSeasonIdForDate(resolvedDate);
    const activeRosterPlayerIds = await fetchActiveRosterPlayerIdSet(
      currentSeasonId
    );
    if (activeRosterPlayerIds.size > 0) {
      projectionsRaw = projectionsRaw.filter((row: any) =>
        activeRosterPlayerIds.has(Number(row?.player_id))
      );
    }

    const projections = projectionsRaw.map((row: any) => {
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
    const serving = buildRequestedDateServingState({
      requestedDate: targetDate,
      resolvedDate,
      fallbackApplied,
      strategy: fallbackApplied
        ? "latest_available_with_data"
        : "requested_date"
    });

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      runId,
      asOfDate: resolvedDate,
      requestedDate: targetDate,
      horizonGames,
      fallbackApplied,
      serving,
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
