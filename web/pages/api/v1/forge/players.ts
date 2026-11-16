import type { NextApiRequest, NextApiResponse } from "next";

import { buildEndpointScanSummary } from "lib/api/scanSummary";
import { resolveLatestStartedSeasonIdForDate } from "lib/NHL/server";
import { resolveProjectionTeamIdentity } from "lib/NHL/seasonAwareScheduleTeam";
import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { buildResolvedDataServingContract } from "lib/dashboard/freshness";
import { buildCanonicalReaderCompatibility } from "lib/projections/compatibilityInventory";
import { buildSkaterModeledHeadTotals } from "lib/projections/modeledHeadTotals";
import * as forgeSkaterContext from "lib/projections/forgeSkaterContext";
import { keepRowsOfServingRun, provenRunIdsByGame, requireLatestExternalInputProvenRun, runProofDiagnostics,
  type ExternalInputProof, type ProvenRunsByGame } from "lib/projections/externalInputProof";
import { pages } from "lib/rosterScheduleData/planningInputs";
import { goalieNewYorkDate } from "components/GameGrid/utils/goalieWorkloadView";
import {
  buildProjectionApiErrorResponse,
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

/** Time allowed for each paged read (`pages` reads 1,000 rows per request: PostgREST's row cap). */
const READ_DEADLINE_MS = 8000;
/** More current roster rows than this for one season means the read is wrong, not that the league grew (H5). */
const ROSTER_ROWS_MAXIMUM = 5000;
const PROJECTION_ROWS_MAXIMUM = 15000;

/** Every current roster player of the season, read in pages: one request is capped at 1,000 rows and the table holds
 * more, so an unpaged read silently dropped about a third of projected skaters (H5, audit 2026-11-16). */
async function fetchActiveRosterPlayerIdSet(
  seasonId: number,
): Promise<Set<number>> {
  if (!supabase) throw new Error("Supabase server client not available");
  const db = supabase;
  const rows = await pages(() => db
    .from("rosters")
    .select("playerId,teamId", { count: "exact" })
    .eq("seasonId", seasonId)
    .eq("is_current", true)
    .order("playerId")
    .order("teamId"), Date.now() + READ_DEADLINE_MS, ROSTER_ROWS_MAXIMUM, (row) => [row.playerId, row.teamId]);
  return new Set(
    rows
      .map((row) => Number(row?.playerId))
      .filter((id) => Number.isFinite(id)),
  );
}

/** The served runs' rows for the horizon, in pages, each kept only from the run that serves its game (H3). */
async function fetchServedProjectionRows(
  selectQuery: string,
  runsByGame: ProvenRunsByGame,
  horizonGames: number,
): Promise<any[]> {
  if (!supabase) throw new Error("Supabase server client not available");
  const db = supabase;
  const rows = await pages(() => db
    .from("forge_player_projections")
    .select(selectQuery, { count: "exact" })
    .in("run_id", provenRunIdsByGame(runsByGame))
    .eq("horizon_games", horizonGames)
    .order("run_id")
    .order("game_id")
    .order("player_id"), Date.now() + READ_DEADLINE_MS, PROJECTION_ROWS_MAXIMUM,
  (row) => [row.run_id, row.game_id, row.player_id]);
  return runsByGame.overlays.length ? keepRowsOfServingRun(rows, runsByGame) : rows;
}

/** Games stored for the date when the stored schedule reaches past it, so zero is a verified off-day; null when the
 * schedule cannot say (a failed read, or nothing stored after the date). */
async function fetchVerifiedScheduledGames(date: string): Promise<number | null> {
  if (!supabase) throw new Error("Supabase server client not available");
  try {
    const [onDate, later] = await Promise.all([
      supabase.from("games").select("id", { count: "exact", head: true }).eq("date", date),
      supabase.from("games").select("id", { count: "exact", head: true }).gt("date", date),
    ]);
    if (onDate.error || later.error || !Number.isSafeInteger(onDate.count)) return null;
    if (onDate.count! > 0) return onDate.count!;
    return Number(later.count) > 0 ? 0 : null;
  } catch {
    return null;
  }
}

/** Why a requested date serves no skater rows. No other date's run stands in for it (H6, TJ 2026-11-16). */
type EmptyDateReason = "no_games" | "no_proven_run_for_date" | "proven_run_has_no_rows";
function emptyDateReason(scheduledGames: number | null, provenRun: boolean): EmptyDateReason {
  if (scheduledGames === 0) return "no_games";
  return provenRun ? "proven_run_has_no_rows" : "no_proven_run_for_date";
}

function parseHorizonGames(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);
  if (!Number.isFinite(parsed)) return 1;
  const intValue = Math.floor(parsed);
  return Math.max(1, Math.min(10, intValue));
}

/**
 * L9c (decision 132): every skater line is the line IF HE PLAYS. Availability
 * (projected_lineup | confirmed_out | uncertain | unknown, participation
 * probability not qualified) and time away travel beside it; rows that are not
 * a projected lineup are labelled. Old runs without availability serve null.
 */
function extractAvailabilityContext(uncertainty: unknown) {
  const record =
    uncertainty && typeof uncertainty === "object"
      ? (uncertainty as Record<string, any>)
      : null;
  const availability =
    record?.availability && typeof record.availability === "object"
      ? record.availability
      : null;
  const state = typeof availability?.state === "string" ? availability.state : null;
  return {
    availability: availability
      ? {
          state,
          game_id: availability.game_id ?? null,
          expected_for_game:
            availability.expected_for_game === 0 ? 0 : null,
          participation_probability: null,
          label: typeof availability.label === "string" ? availability.label : null,
          event_type: availability.event_type ?? null,
        }
      : null,
    time_away:
      record?.time_away && typeof record.time_away === "object"
        ? record.time_away
        : null,
    line_conditioning: availability ? "if_plays" : null,
    line_label:
      state && state !== "projected_lineup"
        ? `If he plays · ${availability?.label ?? state}`
        : null,
  };
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
    // The slate is an Eastern-time date (L3): a UTC default is tomorrow between 00:00 and 05:00 UTC.
    const targetDate = dateParam || goalieNewYorkDate(new Date().toISOString());
    const horizonGames = parseHorizonGames(req.query.horizon);
    let runId: string | null = null;
    let runProof: ExternalInputProof | null = null;
    let runsByGame: ProvenRunsByGame | null = null;
    let projectionsRaw: any[] = [];
    let missingRequestedHorizon = false;

    // 1. The requested date's proven runs of the requested horizon (L3), per game (H3). No other date's run stands
    //    in for them (H6, TJ 2026-11-16): a date without one is served empty, with the reason.
    try {
      ({ runId, proof: runProof, runsByGame } = await requireLatestExternalInputProvenRun(targetDate, horizonGames));
    } catch (e) {
      if ((e as any)?.statusCode !== 404) throw e;
    }

    const selectQuery = `
        run_id,
        game_id,
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

    // 2. If runs were found, fetch their rows
    if (runId) {
      projectionsRaw = await fetchServedProjectionRows(selectQuery,
        runsByGame ?? { baseRunId: runId, overlays: [] }, horizonGames);
    }

    // 3. A multi-game request whose date has one-game output only says so, never relabels or scales it.
    if (projectionsRaw.length === 0 && horizonGames !== 1) {
      let oneGameRun: { runId: string; proof: ExternalInputProof } | null = runId ? { runId, proof: runProof! } : null;
      if (!oneGameRun) {
        try {
          oneGameRun = await requireLatestExternalInputProvenRun(targetDate, 1);
        } catch (e) {
          if ((e as any)?.statusCode !== 404) throw e;
        }
      }
      if (oneGameRun) {
        const { count, error } = await supabase
          .from("forge_player_projections")
          .select("player_id", { count: "exact", head: true })
          .eq("run_id", oneGameRun.runId)
          .eq("horizon_games", 1);
        if (error) throw error;
        missingRequestedHorizon = (count ?? 0) > 0;
        if (missingRequestedHorizon && !runId) ({ runId, proof: runProof } = oneGameRun);
      }
    }

    // 4. Why the date is empty, when it is: a verified off-day, or no proven output for a scheduled (or unknown) slate.
    const scheduledGames = projectionsRaw.length === 0 && !missingRequestedHorizon
      ? await fetchVerifiedScheduledGames(targetDate)
      : null;
    const emptyReason = projectionsRaw.length === 0 && !missingRequestedHorizon
      ? emptyDateReason(scheduledGames, Boolean(runId))
      : null;
    const emptyMessage = emptyReason === "no_games"
      ? `No NHL games are scheduled on ${targetDate}.`
      : emptyReason
        ? `FORGE skater projections are not available for the ${targetDate} slate.`
        : null;

    const resolvedSeasonId = await resolveLatestStartedSeasonIdForDate(
      targetDate,
      supabase,
    );
    const activeRosterPlayerIds = projectionsRaw.length
      ? await fetchActiveRosterPlayerIdSet(resolvedSeasonId)
      : new Set<number>();
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
      const totals = buildSkaterModeledHeadTotals(row);

      return {
        player_id: row.player_id,
        player_name: row.players?.fullName,
        team_name: row.teams?.name,
        teamIdentity,
        position: row.players?.position,
        g: totals.goals,
        a: totals.assists,
        pts: totals.points,
        ppp: totals.ppPoints,
        sog: totals.shots,
        // Unknown stays unknown (rule 5, W3-2 D3): never zero-filled here.
        hit: row.proj_hits ?? null,
        blk: row.proj_blocks ?? null,
        // L9a: PK heads are summed when known; when the team's PK exposure is
        // unknown, the row says so (ES then holds all non-PP time).
        pk_status:
          row.uncertainty?.model?.skater_selection?.strength_accounting
            ?.pk_status ?? null,
        ...extractAvailabilityContext(row.uncertainty),
        fw: 0,
        fl: 0,
        uncertainty: row.uncertainty,
        degradedProjectionContext,
        modelMetadata: extractSkaterModelMetadata(row.uncertainty),
        confidenceDrivers: extractSkaterConfidenceDrivers(row.uncertainty),
        projectionRange: extractProjectionRange(row.uncertainty),
      };
    });
    const calibrationHints = await fetchSkaterCalibrationHints(targetDate);
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
    const serving = buildResolvedDataServingContract({
      requestedDate: targetDate,
      resolvedDate: targetDate,
      fallbackApplied: false,
      strategy: "requested_date",
      requestedScheduledGames: scheduledGames,
      sourceLabel: "Skater projections",
    });
    const responseState = missingRequestedHorizon
      ? "blocked"
      : projections.length > 0
        ? "ready"
        : "empty";
    const missingHorizonMessage = missingRequestedHorizon
      ? `No genuine ${horizonGames}-game projection output is available for ${targetDate}; one-game output exists but is not relabeled or scaled.`
      : null;
    const scanSummary = buildEndpointScanSummary({
      surface: "forge_players_reader",
      requestedDate: targetDate,
      activeDataDate: targetDate,
      fallbackApplied: false,
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
      notes: [missingHorizonMessage, emptyMessage, degradedProjectionSummary.note],
      blockingIssueCount: missingRequestedHorizon ? 1 : 0,
    });

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      runId,
      asOfDate: targetDate,
      requestedDate: targetDate,
      requestedSeasonId: resolvedSeasonId,
      resolvedSeasonId,
      horizonGames,
      // Never another date's run (H6): kept false for readers of the field.
      fallbackApplied: false,
      reason: emptyReason,
      message: emptyMessage,
      degradedProjectionSummary,
      serving,
      scanSummary,
      diagnostics: {
        state: responseState,
        returnedRows: projections.length,
        requestedDate: targetDate,
        resolvedDate: targetDate,
        fallbackApplied: false,
        fallbackReason: missingRequestedHorizon
          ? "requested horizon has no genuine output while one-game output exists"
          : null,
        reason: emptyReason,
        scheduledGames,
        missingRequestedHorizon,
        message: missingHorizonMessage ?? emptyMessage,
        degradedProjectionSummary,
        // What admitted the served run: captured snapshot, verified producer closure or verified legacy release.
        runProof: runId ? runProofDiagnostics(runId, runProof) : null,
        // Newer single-game reruns that serve their own games over the slate run (H3).
        gameRuns: runsByGame?.overlays.map((overlay) => ({ ...runProofDiagnostics(overlay.runId, overlay.proof),
          gameIds: overlay.gameIds })) ?? [],
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
          goalieNewYorkDate(new Date().toISOString()),
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
