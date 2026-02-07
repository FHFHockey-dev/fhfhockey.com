import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

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
    let resolvedDate = requestedDate;
    let resolvedRunId = q.runId ?? (await requireLatestSucceededRunId(requestedDate));
    let fallbackApplied = false;

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

    let data = await fetchGoalieRows(resolvedRunId, resolvedDate);

    if (data.length === 0 && q.fallbackToLatestWithData) {
      const fallback = await fetchFallbackRunWithGoalieData(requestedDate, q.horizon);
      if (fallback && fallback.runId !== resolvedRunId) {
        const fallbackRows = await fetchGoalieRows(fallback.runId, fallback.asOfDate);
        if (fallbackRows.length > 0) {
          data = fallbackRows;
          resolvedRunId = fallback.runId;
          resolvedDate = fallback.asOfDate;
          fallbackApplied = true;
        }
      }
    }

    const rows = data.map((row: any) => {
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

    const [runSummary, scheduledGamesCount] = await Promise.all([
      fetchRunSummary(resolvedRunId),
      fetchGamesScheduledCount(resolvedDate)
    ]);

    const notes: string[] = [];
    if (rows.length === 0) {
      notes.push("No goalie projection rows found for resolved date/run.");
      if (scheduledGamesCount === 0) {
        notes.push("No NHL games scheduled on the resolved date.");
      }
      const goalieRowsMetric = Number(runSummary?.metrics?.goalie_rows ?? 0);
      if (goalieRowsMetric === 0) {
        notes.push("Projection run metrics show zero goalie rows were generated.");
      }
    }

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      runId: resolvedRunId,
      asOfDate: resolvedDate,
      horizonGames: q.horizon,
      requestedDate,
      fallbackApplied,
      fallbackToLatestWithData: q.fallbackToLatestWithData,
      diagnostics: {
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
