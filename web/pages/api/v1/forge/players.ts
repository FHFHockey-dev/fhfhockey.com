import type { NextApiRequest, NextApiResponse } from "next";

import { buildEndpointScanSummary } from "lib/api/scanSummary";
import { resolveLatestStartedSeasonIdForDate } from "lib/NHL/server";
import { resolveProjectionTeamIdentity } from "lib/NHL/seasonAwareScheduleTeam";
import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { buildRequestedDateServingState } from "lib/dashboard/freshness";
import { buildCanonicalReaderCompatibility } from "lib/projections/compatibilityInventory";
import * as forgeSkaterContext from "lib/projections/forgeSkaterContext";
import {
  buildProjectionApiErrorResponse,
  requireLatestSucceededRunId,
} from "lib/projections/apiHelpers";

type LineComboRecencyClass = "FRESH" | "SOFT_STALE" | "HARD_STALE" | "MISSING";

type SkaterProjectionDegradedContext = {
  usedLineComboFallback: boolean;
  lineComboFallbackReason: "missing" | "hard_stale" | "empty" | null;
  lineComboRecencyClass: LineComboRecencyClass | null;
  lineComboDaysStale: number | null;
  skaterPoolRecoveryPath: string | null;
  isDegraded: boolean;
  summary: string | null;
};

type SkaterProjectionDegradedSummary = {
  degradedPlayerCount: number;
  lineComboFallbackPlayerCount: number;
  hardStaleLineComboPlayerCount: number;
  missingLineComboPlayerCount: number;
  softStaleLineComboPlayerCount: number;
  skaterPoolRecoveryPlayerCount: number;
  note: string | null;
};

type SkaterModelMetadata = {
  modelVersion: string | null;
  scenarioCount: number | null;
};

type SkaterCalibrationHints = {
  sourceDate: string | null;
  projectionDate: string | null;
  sampleCount30d: number | null;
  pointsMae30d: number | null;
  pointsRmse30d: number | null;
  pointsIntervalHitRate: number | null;
};

const SKATER_INTERVAL_DEFINITIONS =
  forgeSkaterContext.SKATER_INTERVAL_DEFINITIONS;

function parseFiniteNumber(value: unknown): number | null {
  return forgeSkaterContext.parseFiniteNumber(value);
}

function extractSkaterModelMetadata(uncertainty: unknown): SkaterModelMetadata {
  return forgeSkaterContext.extractSkaterModelMetadata(uncertainty);
}

function extractSkaterConfidenceDrivers(uncertainty: unknown) {
  return forgeSkaterContext.extractSkaterConfidenceDrivers(uncertainty);
}

function extractProjectionRange(uncertainty: unknown) {
  return forgeSkaterContext.extractProjectionRange(uncertainty);
}

async function fetchSkaterCalibrationHints(
  projectionDate: string,
): Promise<SkaterCalibrationHints | null> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await supabase
    .from("forge_projection_calibration_daily")
    .select("date,projection_date,metrics")
    .eq("scope", "skater_rolling_dashboard")
    .lte("projection_date", projectionDate)
    .order("projection_date", { ascending: false })
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const metrics = (data as any).metrics ?? {};
  const points = metrics?.stat_diagnostics?.pts?.rolling_30d ?? {};
  const interval = metrics?.interval_coverage_daily?.pts ?? {};
  return {
    sourceDate:
      typeof (data as any).date === "string" ? (data as any).date : null,
    projectionDate:
      typeof (data as any).projection_date === "string"
        ? (data as any).projection_date
        : null,
    sampleCount30d: parseFiniteNumber(points.player_count),
    pointsMae30d: parseFiniteNumber(points.mae),
    pointsRmse30d: parseFiniteNumber(points.rmse),
    pointsIntervalHitRate: parseFiniteNumber(interval.p10_p90_hit_rate),
  };
}

function buildDegradedProjectionSummary(
  contexts: Array<SkaterProjectionDegradedContext | null>,
): SkaterProjectionDegradedSummary {
  return forgeSkaterContext.buildDegradedProjectionSummary(contexts);
}

function extractDegradedProjectionContext(
  uncertainty: unknown,
): SkaterProjectionDegradedContext | null {
  return forgeSkaterContext.extractDegradedProjectionContext(uncertainty);
}

async function fetchActiveRosterPlayerIdSet(
  seasonId: number,
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
      .filter((id) => Number.isFinite(id)),
  );
}

async function fetchFallbackRunWithPlayerData(
  targetDate: string,
  horizonGames: number,
): Promise<{ runId: string; asOfDate: string } | null> {
  if (!supabase) throw new Error("Supabase server client not available");

  const scanCandidates = async (includeFutureDates: boolean) => {
    let query = supabase
      .from("forge_runs")
      .select("run_id,as_of_date")
      .eq("status", "succeeded")
      .order("as_of_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);

    if (!includeFutureDates) {
      query = query.lte("as_of_date", targetDate);
    }

    const { data: candidates, error: candidatesError } = await query;
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
  };

  return (await scanCandidates(false)) ?? scanCandidates(true);
}

function parseHorizonGames(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);
  if (!Number.isFinite(parsed)) return 1;
  const intValue = Math.floor(parsed);
  return Math.max(1, Math.min(10, intValue));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
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
    let missingRequestedHorizon = false;

    // 1. Try to find a run for the requested date
    try {
      runId = await requireLatestSucceededRunId(targetDate);
    } catch (e) {
      if ((e as any)?.statusCode !== 404) throw e;
    }

    const selectQuery = `
        player_id,
        team_id,
        players!player_id (
          fullName,
          position
        ),
        teams!team_id (
          id,
          abbreviation,
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
        horizonGames,
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
            `No succeeded projection run found for date=${targetDate}`,
          );
          (err as any).statusCode = 404;
          throw err;
        }
      }
    }

    if (projectionsRaw.length === 0 && runId && horizonGames !== 1) {
      const { count, error } = await supabase
        .from("forge_player_projections")
        .select("player_id", { count: "exact", head: true })
        .eq("run_id", runId)
        .eq("horizon_games", 1);
      if (error) throw error;
      missingRequestedHorizon = (count ?? 0) > 0;
    }

    const resolvedSeasonId = await resolveLatestStartedSeasonIdForDate(
      resolvedDate,
      supabase,
    );
    const requestedSeasonId =
      resolvedDate === targetDate
        ? resolvedSeasonId
        : await resolveLatestStartedSeasonIdForDate(targetDate, supabase);
    const activeRosterPlayerIds =
      await fetchActiveRosterPlayerIdSet(resolvedSeasonId);
    if (activeRosterPlayerIds.size > 0) {
      projectionsRaw = projectionsRaw.filter((row: any) =>
        activeRosterPlayerIds.has(Number(row?.player_id)),
      );
    }

    const projections = projectionsRaw.map((row: any) => {
      const teamIdentity = resolveProjectionTeamIdentity(
        row.team_id,
        row.teams,
        resolvedSeasonId,
      );
      if (!teamIdentity) {
        throw new Error(
          "Projection team identity is invalid for the resolved season.",
        );
      }
      const degradedProjectionContext = extractDegradedProjectionContext(
        row.uncertainty,
      );
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
        teamIdentity,
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
        uncertainty: row.uncertainty,
        degradedProjectionContext,
        modelMetadata: extractSkaterModelMetadata(row.uncertainty),
        confidenceDrivers: extractSkaterConfidenceDrivers(row.uncertainty),
        projectionRange: extractProjectionRange(row.uncertainty),
      };
    });
    const calibrationHints = await fetchSkaterCalibrationHints(resolvedDate);
    const modelVersions = projections
      .map((row) => row.modelMetadata.modelVersion)
      .filter((value): value is string => value != null);
    const scenarioCounts = projections
      .map((row) => row.modelMetadata.scenarioCount)
      .filter((value): value is number => value != null);
    const modelMetadata = {
      modelVersion: modelVersions[0] ?? null,
      scenarioCount:
        scenarioCounts.length > 0 ? Math.max(...scenarioCounts) : null,
      calibrationHints,
    };
    const degradedProjectionSummary = buildDegradedProjectionSummary(
      projections.map((row) => row.degradedProjectionContext),
    );
    const responseState = missingRequestedHorizon
      ? "blocked"
      : projections.length > 0
        ? "ready"
        : "empty";
    const missingHorizonMessage = missingRequestedHorizon
      ? `No genuine ${horizonGames}-game projection output is available for ${resolvedDate}; one-game output exists but is not relabeled or scaled.`
      : null;
    const serving = buildRequestedDateServingState({
      requestedDate: targetDate,
      resolvedDate,
      fallbackApplied,
      strategy: fallbackApplied
        ? "latest_available_with_data"
        : "requested_date",
    });
    const scanSummary = buildEndpointScanSummary({
      surface: "forge_players_reader",
      requestedDate: targetDate,
      activeDataDate: resolvedDate,
      fallbackApplied,
      status: responseState,
      rowCounts: {
        returned: projections.length,
        degraded_projection_rows: degradedProjectionSummary.degradedPlayerCount,
        missing_requested_horizon: missingRequestedHorizon ? 1 : 0,
        line_combo_fallback_rows:
          degradedProjectionSummary.lineComboFallbackPlayerCount,
        skater_pool_recovery_rows:
          degradedProjectionSummary.skaterPoolRecoveryPlayerCount,
      },
      notes: fallbackApplied
        ? [
            `Serving fallback skater projections from ${resolvedDate}.`,
            missingHorizonMessage,
            degradedProjectionSummary.note,
          ]
        : [missingHorizonMessage, degradedProjectionSummary.note],
      blockingIssueCount: missingRequestedHorizon ? 1 : 0,
    });

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      runId,
      asOfDate: resolvedDate,
      requestedDate: targetDate,
      requestedSeasonId,
      resolvedSeasonId,
      horizonGames,
      fallbackApplied,
      degradedProjectionSummary,
      serving,
      scanSummary,
      diagnostics: {
        state: responseState,
        returnedRows: projections.length,
        requestedDate: targetDate,
        resolvedDate,
        fallbackApplied,
        fallbackReason: missingRequestedHorizon
          ? "requested horizon has no genuine output while one-game output exists"
          : fallbackApplied
            ? "requested date had no usable skater rows"
            : null,
        missingRequestedHorizon,
        message: missingHorizonMessage,
        degradedProjectionSummary,
      },
      modelMetadata,
      intervalDefinitions: SKATER_INTERVAL_DEFINITIONS,
      disclosures: [
        "Role, power-play share, matchup, and rest inputs can change after the projection run.",
        "Floor, typical, and ceiling are P10/P50/P90 model outcomes, not guaranteed bounds.",
        "Fallback or stale lineup context is reported per player and in the response diagnostics.",
      ],
      compatibilityInventory: buildCanonicalReaderCompatibility({
        canonicalRoute: "/api/v1/forge/players",
        legacyRoute: "/api/v1/projections/players",
      }),
      data: projections,
    });
  } catch (e) {
    const failure = buildProjectionApiErrorResponse(
      e,
      "FORGE_PLAYERS_UNAVAILABLE",
    );
    return res.status(failure.statusCode).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      scanSummary: buildEndpointScanSummary({
        surface: "forge_players_reader",
        requestedDate:
          (req.query.date as string | undefined) ??
          new Date().toISOString().split("T")[0],
        activeDataDate: null,
        fallbackApplied: false,
        status: "blocked",
        rowCounts: { returned: 0 },
        blockingIssueCount: 1,
        notes: ["Unable to resolve a usable FORGE skater projection response."],
      }),
      error: failure.error,
      details: failure.details,
    });
  }
}
