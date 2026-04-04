import type { NextApiRequest, NextApiResponse } from "next";

import { buildEndpointScanSummary } from "lib/api/scanSummary";
import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { buildRequestedDateServingState } from "lib/dashboard/freshness";
import { buildCanonicalReaderCompatibility } from "lib/projections/compatibilityInventory";
import { requireLatestSucceededRunId } from "pages/api/v1/projections/_helpers";

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

function parseFiniteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseLineComboRecencyClass(value: unknown): LineComboRecencyClass | null {
  if (
    value === "FRESH" ||
    value === "SOFT_STALE" ||
    value === "HARD_STALE" ||
    value === "MISSING"
  ) {
    return value;
  }
  return null;
}

function buildDegradedProjectionSummary(
  contexts: Array<SkaterProjectionDegradedContext | null>
): SkaterProjectionDegradedSummary {
  const formatCountLabel = (
    count: number,
    singularTail: string,
    pluralTail: string
  ) =>
    `${count} projected skater${count === 1 ? "" : "s"} ${
      count === 1 ? singularTail : pluralTail
    }`;
  const nonNullContexts = contexts.filter(
    (context): context is SkaterProjectionDegradedContext => Boolean(context)
  );
  const lineComboFallbackPlayerCount = nonNullContexts.filter(
    (context) => context.usedLineComboFallback
  ).length;
  const hardStaleLineComboPlayerCount = nonNullContexts.filter(
    (context) => context.lineComboRecencyClass === "HARD_STALE"
  ).length;
  const missingLineComboPlayerCount = nonNullContexts.filter(
    (context) => context.lineComboRecencyClass === "MISSING"
  ).length;
  const softStaleLineComboPlayerCount = nonNullContexts.filter(
    (context) => context.lineComboRecencyClass === "SOFT_STALE"
  ).length;
  const skaterPoolRecoveryPlayerCount = nonNullContexts.filter(
    (context) => context.skaterPoolRecoveryPath != null
  ).length;
  const degradedPlayerCount = nonNullContexts.filter(
    (context) => context.isDegraded
  ).length;

  let note: string | null = null;
  if (lineComboFallbackPlayerCount > 0) {
    note = formatCountLabel(
      lineComboFallbackPlayerCount,
      "is using fallback role context because line combinations were missing, empty, or hard stale.",
      "are using fallback role context because line combinations were missing, empty, or hard stale."
    );
  } else if (skaterPoolRecoveryPlayerCount > 0) {
    note = formatCountLabel(
      skaterPoolRecoveryPlayerCount,
      "required emergency pool recovery beyond the initial line-combo group.",
      "required emergency pool recovery beyond the initial line-combo group."
    );
  } else if (softStaleLineComboPlayerCount > 0) {
    note = formatCountLabel(
      softStaleLineComboPlayerCount,
      "is still tied to soft-stale line-combo context.",
      "are still tied to soft-stale line-combo context."
    );
  }

  return {
    degradedPlayerCount,
    lineComboFallbackPlayerCount,
    hardStaleLineComboPlayerCount,
    missingLineComboPlayerCount,
    softStaleLineComboPlayerCount,
    skaterPoolRecoveryPlayerCount,
    note
  };
}

function extractDegradedProjectionContext(
  uncertainty: unknown
): SkaterProjectionDegradedContext | null {
  if (!uncertainty || typeof uncertainty !== "object") return null;
  const model = (uncertainty as Record<string, unknown>).model;
  if (!model || typeof model !== "object") return null;
  const skaterSelection = (model as Record<string, unknown>).skater_selection;
  if (!skaterSelection || typeof skaterSelection !== "object") return null;

  const fallbackPath =
    (skaterSelection as Record<string, unknown>).fallback_path ?? null;
  const lineComboRecency =
    (skaterSelection as Record<string, unknown>).line_combo_recency ?? null;
  const activePool = (skaterSelection as Record<string, unknown>).active_pool ?? null;
  const fallbackRecovery =
    activePool && typeof activePool === "object"
      ? (activePool as Record<string, unknown>).fallback_recovery ?? null
      : null;

  const usedLineComboFallback =
    fallbackPath && typeof fallbackPath === "object"
      ? Boolean((fallbackPath as Record<string, unknown>).used)
      : false;
  const lineComboFallbackReason =
    fallbackPath && typeof fallbackPath === "object"
      ? ((fallbackPath as Record<string, unknown>).reason as
          | "missing"
          | "hard_stale"
          | "empty"
          | null) ?? null
      : null;
  const lineComboRecencyClass =
    lineComboRecency && typeof lineComboRecency === "object"
      ? parseLineComboRecencyClass(
          (lineComboRecency as Record<string, unknown>).class
        )
      : null;
  const lineComboDaysStale =
    lineComboRecency && typeof lineComboRecency === "object"
      ? parseFiniteNumber((lineComboRecency as Record<string, unknown>).days_stale)
      : null;
  const skaterPoolRecoveryPath =
    fallbackRecovery && typeof fallbackRecovery === "object"
      ? (typeof (fallbackRecovery as Record<string, unknown>).path === "string"
          ? ((fallbackRecovery as Record<string, unknown>).path as string)
          : null)
      : null;

  const isDegraded = usedLineComboFallback || skaterPoolRecoveryPath != null;
  const staleSuffix =
    lineComboDaysStale != null ? ` (${lineComboDaysStale}d stale)` : "";

  let summary: string | null = null;
  if (usedLineComboFallback) {
    const reasonLabel =
      lineComboFallbackReason === "missing"
        ? "line combos were missing"
        : lineComboFallbackReason === "hard_stale"
          ? "line combos were hard stale"
          : lineComboFallbackReason === "empty"
            ? "the line-combo group was empty"
            : "line-combo context was unavailable";
    summary = `Fallback role context used because ${reasonLabel}${staleSuffix}.`;
  } else if (skaterPoolRecoveryPath != null) {
    summary = `Projected skater pool required ${skaterPoolRecoveryPath.replaceAll("_", " ")} recovery${staleSuffix}.`;
  } else if (lineComboRecencyClass === "SOFT_STALE") {
    summary = `Line-combo context is soft stale${staleSuffix}.`;
  }

  if (
    !usedLineComboFallback &&
    !skaterPoolRecoveryPath &&
    lineComboRecencyClass == null
  ) {
    return null;
  }

  return {
    usedLineComboFallback,
    lineComboFallbackReason,
    lineComboRecencyClass,
    lineComboDaysStale,
    skaterPoolRecoveryPath,
    isDegraded,
    summary
  };
}

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
      const degradedProjectionContext = extractDegradedProjectionContext(
        row.uncertainty
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
        degradedProjectionContext
      };
    });
    const degradedProjectionSummary = buildDegradedProjectionSummary(
      projections.map((row) => row.degradedProjectionContext)
    );
    const serving = buildRequestedDateServingState({
      requestedDate: targetDate,
      resolvedDate,
      fallbackApplied,
      strategy: fallbackApplied
        ? "latest_available_with_data"
        : "requested_date"
    });
    const scanSummary = buildEndpointScanSummary({
      surface: "forge_players_reader",
      requestedDate: targetDate,
      activeDataDate: resolvedDate,
      fallbackApplied,
      status: projections.length > 0 ? "ready" : "empty",
      rowCounts: {
        returned: projections.length,
        degraded_projection_rows: degradedProjectionSummary.degradedPlayerCount,
        line_combo_fallback_rows:
          degradedProjectionSummary.lineComboFallbackPlayerCount,
        skater_pool_recovery_rows:
          degradedProjectionSummary.skaterPoolRecoveryPlayerCount
      },
      notes: fallbackApplied
        ? [
            `Serving fallback skater projections from ${resolvedDate}.`,
            degradedProjectionSummary.note
          ]
        : [degradedProjectionSummary.note]
    });

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      runId,
      asOfDate: resolvedDate,
      requestedDate: targetDate,
      horizonGames,
      fallbackApplied,
      degradedProjectionSummary,
      serving,
      scanSummary,
      compatibilityInventory: buildCanonicalReaderCompatibility({
        canonicalRoute: "/api/v1/forge/players",
        legacyRoute: "/api/v1/projections/players"
      }),
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
