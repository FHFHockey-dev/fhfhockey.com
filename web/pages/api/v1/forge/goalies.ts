import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { buildEndpointScanSummary } from "lib/api/scanSummary";
import { buildResolvedDataServingContract } from "lib/dashboard/freshness";
import { buildGoalieReaderCompatibility } from "lib/projections/compatibilityInventory";
import supabase from "lib/supabase/server";
import { excludeOffReleaseRuns, isOffReleaseGitSha } from "lib/projections/releasedRunFence";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import {
  buildProjectionApiErrorResponse,
  dateSchema,
  getQueryStringParam,
} from "lib/projections/apiHelpers";
import { readGoalieCandidatesContract } from "lib/projections/goalie/goalieCandidates";
import { loadExternalInputProof, requireExternalInputProvenRun, requireLatestExternalInputProvenRun, runProofDiagnostics,
  type ExternalInputProof } from "lib/projections/externalInputProof";

const querySchema = z.object({
  date: dateSchema.optional(),
  horizon: z.coerce.number().int().min(1).max(10).default(1),
  runId: z.string().uuid().optional(),
  fallbackToLatestWithData: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

function parseQuery(req: NextApiRequest) {
  const parsed = querySchema.safeParse({
    date: getQueryStringParam(req.query.date),
    horizon: getQueryStringParam(req.query.horizon),
    runId: getQueryStringParam(req.query.runId),
    fallbackToLatestWithData: getQueryStringParam(
      req.query.fallbackToLatestWithData,
    ),
  });
  if (!parsed.success) {
    const err = new Error("Invalid query parameters");
    (err as any).statusCode = 400;
    (err as any).details = parsed.error.flatten();
    throw err;
  }
  return parsed.data;
}

type GoalieUncertaintyModel = {
  save_pct?: number;
  volatility_index?: number;
  blowup_risk?: number;
  confidence_tier?: string;
  quality_tier?: string;
  reliability_tier?: string;
  recommendation?: string;
};

type ScenarioMetadata = {
  modelVersion: string | null;
  scenarioCount: number | null;
};

type CalibrationHints = {
  sourceDate: string | null;
  projectionDate: string | null;
  sampleCount30d: number | null;
  starterBrier: number | null;
  winBrier: number | null;
  shutoutBrier: number | null;
  savesMae30d: number | null;
  goalsAgainstMae30d: number | null;
  savesIntervalHitRate: number | null;
  goalsAllowedIntervalHitRate: number | null;
};

function extractModel(uncertainty: unknown): GoalieUncertaintyModel {
  if (!uncertainty || typeof uncertainty !== "object") return {};
  const model = (uncertainty as any).model;
  if (!model || typeof model !== "object") return {};
  return {
    save_pct: Number.isFinite(model.save_pct)
      ? Number(model.save_pct)
      : undefined,
    volatility_index: Number.isFinite(model.volatility_index)
      ? Number(model.volatility_index)
      : undefined,
    blowup_risk: Number.isFinite(model.blowup_risk)
      ? Number(model.blowup_risk)
      : undefined,
    confidence_tier:
      typeof model.confidence_tier === "string"
        ? model.confidence_tier
        : undefined,
    quality_tier:
      typeof model.quality_tier === "string" ? model.quality_tier : undefined,
    reliability_tier:
      typeof model.reliability_tier === "string"
        ? model.reliability_tier
        : undefined,
    recommendation:
      typeof model.recommendation === "string"
        ? model.recommendation
        : undefined,
  };
}

function extractScenarioMetadata(uncertainty: unknown): ScenarioMetadata {
  if (!uncertainty || typeof uncertainty !== "object") {
    return { modelVersion: null, scenarioCount: null };
  }
  const model = (uncertainty as any).model;
  if (!model || typeof model !== "object") {
    return { modelVersion: null, scenarioCount: null };
  }
  const scenarioMeta = model.scenario_metadata;
  const starterSelection = model.starter_selection;
  const modelVersion =
    typeof scenarioMeta?.model_version === "string"
      ? scenarioMeta.model_version
      : null;
  const scenarioCountRaw =
    scenarioMeta?.top2_scenario_count ??
    starterSelection?.scenario_projection_count;
  const scenarioCount =
    Number.isFinite(scenarioCountRaw) && Number(scenarioCountRaw) >= 0
      ? Number(scenarioCountRaw)
      : null;
  return { modelVersion, scenarioCount };
}

function mostCommonValue<T extends string | number>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let winner: T | null = null;
  let winnerCount = -1;
  for (const [value, count] of counts.entries()) {
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  }
  return winner;
}

function parseFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchGoalieCalibrationHints(
  projectionDate: string,
): Promise<CalibrationHints | null> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await supabase
    .from("forge_projection_calibration_daily")
    .select("date,projection_date,metrics")
    .eq("scope", "goalie_calibration_summary")
    .lte("projection_date", projectionDate)
    .order("projection_date", { ascending: false })
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const metrics = (data as any).metrics ?? {};
  const probability = metrics?.probability ?? {};
  const intervals = metrics?.intervals ?? {};
  const stats = metrics?.stats ?? {};
  return {
    sourceDate:
      typeof (data as any).date === "string"
        ? ((data as any).date as string)
        : null,
    projectionDate:
      typeof (data as any).projection_date === "string"
        ? ((data as any).projection_date as string)
        : null,
    sampleCount30d: parseFiniteNumber(stats?.saves?.rolling_30d?.player_count),
    starterBrier: parseFiniteNumber(
      probability?.starter_probability?.brier_score,
    ),
    winBrier: parseFiniteNumber(probability?.win_probability?.brier_score),
    shutoutBrier: parseFiniteNumber(
      probability?.shutout_probability?.brier_score,
    ),
    savesMae30d: parseFiniteNumber(stats?.saves?.rolling_30d?.mae),
    goalsAgainstMae30d: parseFiniteNumber(
      stats?.goals_against?.rolling_30d?.mae,
    ),
    savesIntervalHitRate: parseFiniteNumber(intervals?.saves?.p10_p90_hit_rate),
    goalsAllowedIntervalHitRate: parseFiniteNumber(
      intervals?.goals_allowed?.p10_p90_hit_rate,
    ),
  };
}

async function fetchRunSummary(runId: string) {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await supabase
    .from("forge_runs")
    .select("run_id,as_of_date,status,created_at,git_sha,metrics")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    run_id: string;
    as_of_date: string;
    status: string;
    created_at: string;
    git_sha: string | null;
    metrics: any;
  } | null;
}

async function fetchGamesScheduledCount(date: string): Promise<number> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { count, error } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("date", date);
  if (error) throw error;
  return count ?? 0;
}

/** Recent released runs searched for a proven fallback with goalie rows. */
const FALLBACK_RUN_CANDIDATES = 30;

async function fetchFallbackRunWithGoalieData(
  targetDate: string,
  horizon: number,
): Promise<{ runId: string; asOfDate: string; proof: ExternalInputProof } | null> {
  if (!supabase) throw new Error("Supabase server client not available");

  const findCandidate = async (includeFutureDates: boolean) => {
    // Only succeeded released runs with external-input exclusion proof (Astra F4): goalie lines use opponent shots
    // derived from the same run's skater lines. Failed, running, off-release (null or local:) or unproven runs'
    // rows are not served.
    let query = excludeOffReleaseRuns(supabase
      .from("forge_runs")
      .select("run_id,as_of_date")
      .eq("status", "succeeded"))
      .order("as_of_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(FALLBACK_RUN_CANDIDATES);
    if (!includeFutureDates) query = query.lte("as_of_date", targetDate);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as Array<{ run_id: string; as_of_date: string }>;
    const proof = rows.length ? await loadExternalInputProof(supabase, rows.map((row) => row.run_id)) : new Map();
    for (const row of rows.filter((candidate) => proof.has(candidate.run_id))) {
      const { count, error: countError } = await supabase
        .from("forge_goalie_projections")
        .select("goalie_id", { count: "exact", head: true })
        .eq("run_id", row.run_id)
        .eq("as_of_date", row.as_of_date)
        .eq("horizon_games", horizon);
      if (countError) throw countError;
      if ((count ?? 0) > 0) return { runId: row.run_id, asOfDate: row.as_of_date, proof: proof.get(row.run_id)! };
    }
    return null;
  };

  return (await findCandidate(false)) ?? (await findCandidate(true));
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
    const q = parseQuery(req);
    const requestedDate = q.date ?? new Date().toISOString().slice(0, 10);
    let requestedRunId: string | null = q.runId ?? null;
    let runProof: ExternalInputProof | null = null;
    if (requestedRunId) {
      // An explicit run is admitted before any of its rows are read: it must exist, be a succeeded release and carry proof.
      runProof = (await requireExternalInputProvenRun(requestedRunId)).proof;
    } else {
      try {
        ({ runId: requestedRunId, proof: runProof } = await requireLatestExternalInputProvenRun(requestedDate));
      } catch (e) {
        const statusCode = (e as any)?.statusCode;
        if (statusCode !== 404 || !q.fallbackToLatestWithData) throw e;
      }
    }
    let resolvedDate = requestedDate;
    let resolvedRunId = requestedRunId;
    let fallbackApplied = false;
    let requestedRowCount = 0;
    let fallbackCandidate: {
      runId: string;
      asOfDate: string;
      rowCount: number;
    } | null = null;

    const fetchGoalieRows = async (runId: string, asOfDate: string) => {
      const { data, error } = await supabase
        .from("forge_goalie_projections")
        .select(
          `
          goalie_id,
          team_id,
          opponent_team_id,
          players!goalie_id (
            fullName
          ),
          teams!team_id (
            name,
            abbreviation
          ),
          opponent:teams!opponent_team_id (
            name,
            abbreviation
          ),
          starter_probability,
          proj_shots_against,
          proj_saves,
          proj_goals_allowed,
          proj_win_prob,
          proj_shutout_prob,
          uncertainty
        `,
        )
        .eq("run_id", runId)
        .eq("as_of_date", asOfDate)
        .eq("horizon_games", q.horizon);
      if (error) throw error;
      return data ?? [];
    };

    let data: any[] = [];
    if (resolvedRunId) {
      data = await fetchGoalieRows(resolvedRunId, resolvedDate);
      requestedRowCount = data.length;
    }

    if (data.length === 0 && q.fallbackToLatestWithData) {
      const fallback = await fetchFallbackRunWithGoalieData(
        requestedDate,
        q.horizon,
      );
      if (fallback && fallback.runId !== resolvedRunId) {
        const fallbackRows = await fetchGoalieRows(
          fallback.runId,
          fallback.asOfDate,
        );
        fallbackCandidate = {
          runId: fallback.runId,
          asOfDate: fallback.asOfDate,
          rowCount: fallbackRows.length,
        };
        if (fallbackRows.length > 0) {
          data = fallbackRows;
          resolvedRunId = fallback.runId;
          resolvedDate = fallback.asOfDate;
          runProof = fallback.proof;
          fallbackApplied = true;
        }
      }
    }

    if (!resolvedRunId) {
      const err = new Error(
        `No succeeded projection run found for date=${requestedDate}`,
      );
      (err as any).statusCode = 404;
      throw err;
    }

    // One row per candidate goalie (decision 25): his own line if he starts, his start probability and
    // the unconditional product. The team win % is its own field, never a goalie's Win, and no row is
    // rescaled against another. Runs that predate the per-candidate contract serve the stored team slot,
    // labelled, with its slot "win" withheld (it was never the named goalie's own Win).
    const contracts = data.map((row: any) => readGoalieCandidatesContract(row.uncertainty));
    const candidateIds = [...new Set(contracts.flatMap((contract) => contract?.rows.map((r) => r.goalie_id) ?? []))];
    const nameById = new Map<number, string | null>(data.map((row: any) => [row.goalie_id, row.players?.fullName ?? null]));
    const missingNames = candidateIds.filter((id) => !nameById.get(id));
    if (missingNames.length > 0) {
      const { data: players, error } = await supabase.from("players").select("id,fullName").in("id", missingNames);
      if (error) throw error;
      for (const player of (players ?? []) as Array<{ id: number; fullName: string | null }>) nameById.set(player.id, player.fullName ?? null);
    }
    let legacySlotRows = 0;
    const rows = data.flatMap((row: any, index: number): Array<Record<string, any>> => {
      const model = extractModel(row.uncertainty);
      const shared = {
        team_id: row.team_id,
        team_name: row.teams?.name ?? "",
        team_abbreviation: row.teams?.abbreviation ?? "",
        opponent_team_id: row.opponent_team_id,
        opponent_team_name: row.opponent?.name ?? "",
        opponent_team_abbreviation: row.opponent?.abbreviation ?? "",
        uncertainty: row.uncertainty,
      };
      const contract = contracts[index];
      if (!contract) {
        legacySlotRows += 1;
        const teamWin = parseFiniteNumber(row.uncertainty?.win_populations?.team?.win_probability);
        return [{
          ...shared,
          goalie_id: row.goalie_id,
          goalie_name: row.players?.fullName ?? `Goalie ${row.goalie_id}`,
          row_basis: "team_goalie_slot_legacy" as const,
          conditioning: "team_slot_mixture" as const,
          is_projected_starter: true,
          // Unknown stays unknown (Astra F4): a missing starter chance or line is null, never a projected zero.
          starter_probability: row.starter_probability ?? null,
          start_probability_status: null,
          proj_shots_against: row.proj_shots_against ?? null,
          proj_saves: row.proj_saves ?? null,
          proj_goals_allowed: row.proj_goals_allowed ?? null,
          proj_win_prob: null,
          team_win_prob: teamWin,
          // Older multi-game rows multiplied the shutout probability by the horizon (decision 28).
          proj_shutout_prob: q.horizon === 1 ? row.proj_shutout_prob ?? null : null,
          unconditional: null,
          relief_basis: null,
          modeled_save_pct: model.save_pct ?? null,
          volatility_index: model.volatility_index ?? null,
          blowup_risk: model.blowup_risk ?? null,
          confidence_tier: model.confidence_tier ?? null,
          quality_tier: model.quality_tier ?? null,
          reliability_tier: model.reliability_tier ?? null,
          recommendation: model.recommendation ?? null,
        }];
      }
      return contract.rows.map((candidate) => {
        // The stored model tiers describe the projected starter's own evidence only.
        const isSelected = candidate.goalie_id === row.goalie_id;
        return {
          ...shared,
          goalie_id: candidate.goalie_id,
          goalie_name: nameById.get(candidate.goalie_id) ?? `Goalie ${candidate.goalie_id}`,
          row_basis: "candidate_goalie_game" as const,
          conditioning: "if_starts" as const,
          is_projected_starter: candidate.rank === 1,
          starter_probability: candidate.start_probability,
          start_probability_status: candidate.start_probability_status,
          proj_shots_against: candidate.if_starts.shots_against,
          proj_saves: candidate.if_starts.saves,
          proj_goals_allowed: candidate.if_starts.goals_allowed,
          proj_win_prob: candidate.if_starts.credited_win_prob,
          team_win_prob: contract.team_win_probability,
          proj_shutout_prob: candidate.if_starts.shutout_prob,
          unconditional: candidate.unconditional,
          relief_basis: contract.relief_basis,
          modeled_save_pct: candidate.if_starts.modeled_save_pct,
          volatility_index: isSelected ? model.volatility_index ?? null : null,
          blowup_risk: null,
          confidence_tier: isSelected ? model.confidence_tier ?? null : null,
          quality_tier: isSelected ? model.quality_tier ?? null : null,
          reliability_tier: isSelected ? model.reliability_tier ?? null : null,
          recommendation: null,
        };
      });
    });
    const scenarioMeta = rows.map((row) =>
      extractScenarioMetadata(row.uncertainty),
    );
    const modelVersions = scenarioMeta
      .map((meta) => meta.modelVersion)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const scenarioCounts = scenarioMeta
      .map((meta) => meta.scenarioCount)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const modelVersion = mostCommonValue(modelVersions);
    const scenarioCount = mostCommonValue(scenarioCounts);

    const [
      requestedRunSummary,
      resolvedRunSummaryMaybe,
      requestedScheduledGamesCount,
      resolvedScheduledGamesCountMaybe,
      calibrationHints,
    ] = await Promise.all([
      requestedRunId ? fetchRunSummary(requestedRunId) : Promise.resolve(null),
      !requestedRunId || requestedRunId === resolvedRunId
        ? Promise.resolve(null)
        : fetchRunSummary(resolvedRunId),
      fetchGamesScheduledCount(requestedDate),
      requestedDate === resolvedDate
        ? Promise.resolve(null)
        : fetchGamesScheduledCount(resolvedDate),
      fetchGoalieCalibrationHints(resolvedDate),
    ]);
    const runSummary = resolvedRunSummaryMaybe ?? requestedRunSummary;
    if (q.runId && requestedRunSummary && isOffReleaseGitSha(requestedRunSummary.git_sha)) {
      const error = new Error(`Projection run ${q.runId} was made off the release path (null or local git_sha) and is not served.`);
      (error as any).statusCode = 422;
      throw error;
    }
    const scheduledGamesCount =
      resolvedScheduledGamesCountMaybe ?? requestedScheduledGamesCount;

    const notes: string[] = [];
    if (rows.length === 0) {
      notes.push("No goalie projection rows found for resolved date/run.");
      if (requestedDate !== resolvedDate || requestedRunId !== resolvedRunId) {
        notes.push(
          "Requested context differs from resolved context after fallback resolution.",
        );
      }
      if (scheduledGamesCount === 0) {
        notes.push("No NHL games scheduled on the resolved date.");
      }
      const goalieRowsMetric = Number(runSummary?.metrics?.goalie_rows ?? 0);
      if (goalieRowsMetric === 0) {
        notes.push(
          "Projection run metrics show zero goalie rows were generated.",
        );
      }
    }
    if (!modelVersion) {
      notes.push(
        "Model version metadata is missing from goalie uncertainty payloads.",
      );
    }
    if (scenarioCount == null) {
      notes.push(
        "Starter scenario count metadata is missing from goalie rows.",
      );
    }
    if (!calibrationHints) {
      notes.push(
        "No goalie calibration hints available for the resolved projection date.",
      );
    }
    if (legacySlotRows > 0) {
      notes.push(
        `${legacySlotRows} row(s) predate per-candidate goalie rows: each is the team's goalie slot under the projected starter, with its win withheld.`,
      );
    }
    const serving = buildResolvedDataServingContract({
      requestedDate,
      resolvedDate,
      fallbackApplied,
      strategy: fallbackApplied
        ? "latest_available_with_data"
        : "requested_date",
      requestedScheduledGames: requestedScheduledGamesCount,
      resolvedScheduledGames: scheduledGamesCount,
      sourceLabel: "Goalie projections",
    });
    const scanSummary = buildEndpointScanSummary({
      surface: "forge_goalies_reader",
      requestedDate,
      activeDataDate: resolvedDate,
      fallbackApplied,
      status:
        rows.length > 0
          ? serving.severity === "error"
            ? "partial"
            : "ready"
          : "empty",
      rowCounts: {
        returned: rows.length,
        requested: requestedRowCount,
        scheduledGamesOnDate: scheduledGamesCount,
      },
      blockingIssueCount: serving.severity === "error" ? 1 : 0,
      notes: [
        serving.message,
        fallbackApplied
          ? `Serving fallback goalie projections from ${resolvedDate}.`
          : null,
        ...notes,
      ],
    });

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      runId: resolvedRunId,
      asOfDate: resolvedDate,
      horizonGames: q.horizon,
      requestedRunId,
      modelVersion,
      scenarioCount,
      calibrationHints,
      requestedDate,
      fallbackApplied,
      fallbackToLatestWithData: q.fallbackToLatestWithData,
      serving,
      scanSummary,
      compatibilityInventory: buildGoalieReaderCompatibility(),
      diagnostics: {
        requested: {
          date: requestedDate,
          runId: requestedRunId,
          scheduledGamesOnDate: requestedScheduledGamesCount,
          rowCount: requestedRowCount,
          runStatus: requestedRunSummary?.status ?? null,
          runCreatedAt: requestedRunSummary?.created_at ?? null,
          runMetrics: requestedRunSummary?.metrics ?? null,
        },
        resolved: {
          date: resolvedDate,
          runId: resolvedRunId,
          scheduledGamesOnDate: scheduledGamesCount,
          rowCount: rows.length,
          runStatus: runSummary?.status ?? null,
          runCreatedAt: runSummary?.created_at ?? null,
          runMetrics: runSummary?.metrics ?? null,
        },
        fallback: {
          enabled: q.fallbackToLatestWithData,
          applied: fallbackApplied,
          candidateRunId: fallbackCandidate?.runId ?? null,
          candidateAsOfDate: fallbackCandidate?.asOfDate ?? null,
          candidateRowCount: fallbackCandidate?.rowCount ?? null,
        },
        emptyResultAnalysis: {
          isEmpty: rows.length === 0,
          requestedContextChanged:
            requestedDate !== resolvedDate || requestedRunId !== resolvedRunId,
        },
        runStatus: runSummary?.status ?? null,
        runCreatedAt: runSummary?.created_at ?? null,
        runMetrics: runSummary?.metrics ?? null,
        scheduledGamesOnDate: scheduledGamesCount,
        rowCount: rows.length,
        // What admitted the served run: captured snapshot, verified producer closure or verified legacy release.
        runProof: runProofDiagnostics(resolvedRunId, runProof),
        notes,
      },
      data: rows,
    });
  } catch (e) {
    const failure = buildProjectionApiErrorResponse(
      e,
      "FORGE_GOALIES_UNAVAILABLE",
    );
    return res.status(failure.statusCode).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      error: failure.error,
      details: failure.details,
    });
  }
}
