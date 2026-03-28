import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { buildRequestedDateServingState } from "lib/dashboard/freshness";
import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import {
  dateSchema,
  getQueryStringParam,
  requireLatestSucceededRunId
} from "pages/api/v1/projections/_helpers";

const querySchema = z.object({
  date: dateSchema.optional(),
  horizon: z.coerce.number().int().min(1).max(10).default(1),
  runId: z.string().uuid().optional(),
  fallbackToLatestWithData: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false")
});

function parseQuery(req: NextApiRequest) {
  const parsed = querySchema.safeParse({
    date: getQueryStringParam(req.query.date),
    horizon: getQueryStringParam(req.query.horizon),
    runId: getQueryStringParam(req.query.runId),
    fallbackToLatestWithData: getQueryStringParam(
      req.query.fallbackToLatestWithData
    )
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
    save_pct: Number.isFinite(model.save_pct) ? Number(model.save_pct) : undefined,
    volatility_index: Number.isFinite(model.volatility_index)
      ? Number(model.volatility_index)
      : undefined,
    blowup_risk: Number.isFinite(model.blowup_risk)
      ? Number(model.blowup_risk)
      : undefined,
    confidence_tier:
      typeof model.confidence_tier === "string" ? model.confidence_tier : undefined,
    quality_tier:
      typeof model.quality_tier === "string" ? model.quality_tier : undefined,
    reliability_tier:
      typeof model.reliability_tier === "string" ? model.reliability_tier : undefined,
    recommendation:
      typeof model.recommendation === "string" ? model.recommendation : undefined
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
    scenarioMeta?.top2_scenario_count ?? starterSelection?.scenario_projection_count;
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

function normalizeLikelyStarterWinProbabilities<T extends {
  team_id: number;
  opponent_team_id: number;
  starter_probability: number;
  proj_win_prob: number;
}>(rows: T[]): { rows: T[]; adjustedMatchups: number } {
  const normalizedRows = rows.map((row) => ({ ...row }));
  const matchupIndexMap = new Map<string, number[]>();

  normalizedRows.forEach((row, idx) => {
    const teams = [row.team_id, row.opponent_team_id].sort((a, b) => a - b);
    const key = `${teams[0]}__${teams[1]}`;
    const existing = matchupIndexMap.get(key) ?? [];
    existing.push(idx);
    matchupIndexMap.set(key, existing);
  });

  let adjustedMatchups = 0;
  for (const indices of matchupIndexMap.values()) {
    if (indices.length < 2) continue;
    const positiveMass = indices.reduce(
      (sum, idx) => sum + Math.max(0, Number(normalizedRows[idx].proj_win_prob ?? 0)),
      0
    );
    const starterMass = indices.reduce(
      (sum, idx) => sum + Math.max(0, Number(normalizedRows[idx].starter_probability ?? 0)),
      0
    );
    const denominator = positiveMass > 0 ? positiveMass : starterMass > 0 ? starterMass : 0;
    if (denominator <= 0) {
      const equalProb = 1 / indices.length;
      indices.forEach((idx) => {
        normalizedRows[idx].proj_win_prob = Number(equalProb.toFixed(4));
      });
      adjustedMatchups += 1;
      continue;
    }

    let running = 0;
    indices.forEach((idx, listIdx) => {
      const sourceValue =
        positiveMass > 0
          ? Math.max(0, Number(normalizedRows[idx].proj_win_prob ?? 0))
          : Math.max(0, Number(normalizedRows[idx].starter_probability ?? 0));
      const normalized =
        listIdx === indices.length - 1
          ? Math.max(0, 1 - running)
          : Math.max(0, sourceValue / denominator);
      const rounded = Number(normalized.toFixed(4));
      running += rounded;
      normalizedRows[idx].proj_win_prob = rounded;
    });
    adjustedMatchups += 1;
  }

  return { rows: normalizedRows, adjustedMatchups };
}

async function fetchGoalieCalibrationHints(
  projectionDate: string
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
      typeof (data as any).date === "string" ? ((data as any).date as string) : null,
    projectionDate:
      typeof (data as any).projection_date === "string"
        ? ((data as any).projection_date as string)
        : null,
    sampleCount30d: parseFiniteNumber(stats?.saves?.rolling_30d?.player_count),
    starterBrier: parseFiniteNumber(probability?.starter_probability?.brier_score),
    winBrier: parseFiniteNumber(probability?.win_probability?.brier_score),
    shutoutBrier: parseFiniteNumber(probability?.shutout_probability?.brier_score),
    savesMae30d: parseFiniteNumber(stats?.saves?.rolling_30d?.mae),
    goalsAgainstMae30d: parseFiniteNumber(stats?.goals_against?.rolling_30d?.mae),
    savesIntervalHitRate: parseFiniteNumber(intervals?.saves?.p10_p90_hit_rate),
    goalsAllowedIntervalHitRate: parseFiniteNumber(
      intervals?.goals_allowed?.p10_p90_hit_rate
    )
  };
}

async function fetchRunSummary(runId: string) {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await supabase
    .from("forge_runs")
    .select("run_id,as_of_date,status,created_at,metrics")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        run_id: string;
        as_of_date: string;
        status: string;
        created_at: string;
        metrics: any;
      }
    | null;
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

async function fetchFallbackRunWithGoalieData(
  targetDate: string,
  horizon: number
): Promise<{ runId: string; asOfDate: string } | null> {
  if (!supabase) throw new Error("Supabase server client not available");
  const { data, error } = await supabase
    .from("forge_goalie_projections")
    .select("run_id,as_of_date")
    .lte("as_of_date", targetDate)
    .eq("horizon_games", horizon)
    .order("as_of_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const runId = (data as any)?.run_id as string | undefined;
  const asOfDate = (data as any)?.as_of_date as string | undefined;
  if (!runId || !asOfDate) return null;
  return { runId, asOfDate };
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
    const q = parseQuery(req);
    const requestedDate = q.date ?? new Date().toISOString().slice(0, 10);
    let requestedRunId: string | null = q.runId ?? null;
    if (!requestedRunId) {
      try {
        requestedRunId = await requireLatestSucceededRunId(requestedDate);
      } catch (e) {
        const statusCode = (e as any)?.statusCode;
        if (statusCode !== 404 || !q.fallbackToLatestWithData) throw e;
      }
    }
    let resolvedDate = requestedDate;
    let resolvedRunId = requestedRunId;
    let fallbackApplied = false;
    let requestedRowCount = 0;
    let fallbackCandidate: { runId: string; asOfDate: string; rowCount: number } | null =
      null;

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
        `
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
      const fallback = await fetchFallbackRunWithGoalieData(requestedDate, q.horizon);
      if (fallback && fallback.runId !== resolvedRunId) {
        const fallbackRows = await fetchGoalieRows(fallback.runId, fallback.asOfDate);
        fallbackCandidate = {
          runId: fallback.runId,
          asOfDate: fallback.asOfDate,
          rowCount: fallbackRows.length
        };
        if (fallbackRows.length > 0) {
          data = fallbackRows;
          resolvedRunId = fallback.runId;
          resolvedDate = fallback.asOfDate;
          fallbackApplied = true;
        }
      }
    }

    if (!resolvedRunId) {
      const err = new Error(
        `No succeeded projection run found for date=${requestedDate}`
      );
      (err as any).statusCode = 404;
      throw err;
    }

    const rawRows = data.map((row: any) => {
      const model = extractModel(row.uncertainty);
      return {
        goalie_id: row.goalie_id,
        goalie_name: row.players?.fullName ?? `Goalie ${row.goalie_id}`,
        team_id: row.team_id,
        team_name: row.teams?.name ?? "",
        team_abbreviation: row.teams?.abbreviation ?? "",
        opponent_team_id: row.opponent_team_id,
        opponent_team_name: row.opponent?.name ?? "",
        opponent_team_abbreviation: row.opponent?.abbreviation ?? "",
        starter_probability: row.starter_probability ?? 0,
        proj_shots_against: row.proj_shots_against ?? 0,
        proj_saves: row.proj_saves ?? 0,
        proj_goals_allowed: row.proj_goals_allowed ?? 0,
        proj_win_prob: row.proj_win_prob ?? 0,
        proj_shutout_prob: row.proj_shutout_prob ?? 0,
        modeled_save_pct: model.save_pct ?? null,
        volatility_index: model.volatility_index ?? null,
        blowup_risk: model.blowup_risk ?? null,
        confidence_tier: model.confidence_tier ?? null,
        quality_tier: model.quality_tier ?? null,
        reliability_tier: model.reliability_tier ?? null,
        recommendation: model.recommendation ?? null,
        uncertainty: row.uncertainty
      };
    });
    const normalizationResult = normalizeLikelyStarterWinProbabilities(rawRows);
    const rows = normalizationResult.rows;
    const scenarioMeta = rows.map((row) => extractScenarioMetadata(row.uncertainty));
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
      calibrationHints
    ] = await Promise.all([
      requestedRunId ? fetchRunSummary(requestedRunId) : Promise.resolve(null),
      !requestedRunId || requestedRunId === resolvedRunId
        ? Promise.resolve(null)
        : fetchRunSummary(resolvedRunId),
      fetchGamesScheduledCount(requestedDate),
      requestedDate === resolvedDate
        ? Promise.resolve(null)
        : fetchGamesScheduledCount(resolvedDate),
      fetchGoalieCalibrationHints(resolvedDate)
    ]);
    const runSummary = resolvedRunSummaryMaybe ?? requestedRunSummary;
    const scheduledGamesCount =
      resolvedScheduledGamesCountMaybe ?? requestedScheduledGamesCount;

    const notes: string[] = [];
    if (rows.length === 0) {
      notes.push("No goalie projection rows found for resolved date/run.");
      if (requestedDate !== resolvedDate || requestedRunId !== resolvedRunId) {
        notes.push(
          "Requested context differs from resolved context after fallback resolution."
        );
      }
      if (scheduledGamesCount === 0) {
        notes.push("No NHL games scheduled on the resolved date.");
      }
      const goalieRowsMetric = Number(runSummary?.metrics?.goalie_rows ?? 0);
      if (goalieRowsMetric === 0) {
        notes.push("Projection run metrics show zero goalie rows were generated.");
      }
    }
    if (!modelVersion) {
      notes.push("Model version metadata is missing from goalie uncertainty payloads.");
    }
    if (scenarioCount == null) {
      notes.push("Starter scenario count metadata is missing from goalie rows.");
    }
    if (!calibrationHints) {
      notes.push("No goalie calibration hints available for the resolved projection date.");
    }
    if (normalizationResult.adjustedMatchups > 0) {
      notes.push(
        `Normalized likely-starter win probabilities across ${normalizationResult.adjustedMatchups} matchup(s) to total 100%.`
      );
    }
    const serving = buildRequestedDateServingState({
      requestedDate,
      resolvedDate,
      fallbackApplied,
      strategy: fallbackApplied
        ? "latest_available_with_data"
        : "requested_date"
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
      diagnostics: {
        requested: {
          date: requestedDate,
          runId: requestedRunId,
          scheduledGamesOnDate: requestedScheduledGamesCount,
          rowCount: requestedRowCount,
          runStatus: requestedRunSummary?.status ?? null,
          runCreatedAt: requestedRunSummary?.created_at ?? null,
          runMetrics: requestedRunSummary?.metrics ?? null
        },
        resolved: {
          date: resolvedDate,
          runId: resolvedRunId,
          scheduledGamesOnDate: scheduledGamesCount,
          rowCount: rows.length,
          runStatus: runSummary?.status ?? null,
          runCreatedAt: runSummary?.created_at ?? null,
          runMetrics: runSummary?.metrics ?? null
        },
        fallback: {
          enabled: q.fallbackToLatestWithData,
          applied: fallbackApplied,
          candidateRunId: fallbackCandidate?.runId ?? null,
          candidateAsOfDate: fallbackCandidate?.asOfDate ?? null,
          candidateRowCount: fallbackCandidate?.rowCount ?? null
        },
        emptyResultAnalysis: {
          isEmpty: rows.length === 0,
          requestedContextChanged:
            requestedDate !== resolvedDate || requestedRunId !== resolvedRunId
        },
        runStatus: runSummary?.status ?? null,
        runCreatedAt: runSummary?.created_at ?? null,
        runMetrics: runSummary?.metrics ?? null,
        scheduledGamesOnDate: scheduledGamesCount,
        rowCount: rows.length,
        notes
      },
      data: rows
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
