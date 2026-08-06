import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYER_FORECAST_SCORING_VERSION } from "./researchContract";

const PROVISIONAL_DELAY_MS = 8 * 60 * 60 * 1000;
const CORRECTION_WINDOW_MS = 48 * 60 * 60 * 1000;

type OutputRow = {
  id: string;
  game_id: number;
  player_id: number;
  target_key: string;
  conditioning: string;
  point_estimate: number | null;
  probability: number | null;
  distribution: Record<string, unknown> | null;
  quantiles: Record<string, unknown> | null;
};

type Actual = { value: number; payload: Record<string, unknown> };

const SKATER_COLUMNS: Record<string, string> = {
  goals: "goals",
  assists: "assists",
  shots_on_goal: "shots",
  blocked_shots: "blockedShots",
  hits: "hits",
  penalty_minutes: "pim",
};

function numeric(value: unknown): number | null {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

export function parseTimeOnIceSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parts = value.split(":").map(Number);
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  return parts[0] * 60 + parts[1];
}

export function scoreForecast(args: {
  actual: number;
  pointEstimate: number | null;
  probability: number | null;
  conditioning: string;
  quantiles?: Record<string, unknown> | null;
  baselinePointEstimate?: number | null;
}) {
  const isProbability = args.conditioning === "playing_probability" || args.conditioning === "start_probability";
  const forecast = isProbability ? args.probability : args.pointEstimate;
  if (forecast === null || !Number.isFinite(forecast)) return null;
  const error = forecast - args.actual;
  const metrics: Record<string, number | boolean> = {
    actual: args.actual,
    forecast,
    absoluteError: Math.abs(error),
    squaredError: error * error,
  };
  if (isProbability) {
    const probability = Math.min(1 - 1e-15, Math.max(1e-15, forecast));
    metrics.brier = error * error;
    metrics.logLoss = -(args.actual * Math.log(probability) + (1 - args.actual) * Math.log(1 - probability));
  }
  const p10 = numeric(args.quantiles?.p10);
  const p90 = numeric(args.quantiles?.p90);
  if (p10 !== null && p90 !== null) metrics.interval80Covered = args.actual >= p10 && args.actual <= p90;

  const baseline = args.baselinePointEstimate;
  const baselineMetrics: Record<string, number> = {};
  let compositeSkillScore: number | null = null;
  if (baseline !== null && baseline !== undefined && Number.isFinite(baseline)) {
    const baselineAbsoluteError = Math.abs(baseline - args.actual);
    baselineMetrics.forecast = baseline;
    baselineMetrics.absoluteError = baselineAbsoluteError;
    baselineMetrics.squaredError = (baseline - args.actual) ** 2;
    const denominator = Math.max(baselineAbsoluteError, 1e-9);
    compositeSkillScore = Math.max(0, Math.min(100, 50 + 50 * ((baselineAbsoluteError - Math.abs(error)) / denominator)));
  }
  return { metrics, baselineMetrics, compositeSkillScore };
}

function actualForOutput(output: OutputRow, skater: Record<string, unknown> | undefined): Actual | null {
  if (output.conditioning === "playing_probability" && output.target_key === "plays") {
    return { value: skater ? 1 : 0, payload: { sourceTable: "skatersGameStats" } };
  }
  if (!skater || output.conditioning !== "conditional_playing") return null;
  if (output.target_key === "time_on_ice_seconds") {
    const value = parseTimeOnIceSeconds(skater.toi);
    return value === null ? null : { value, payload: { sourceTable: "skatersGameStats", rawToi: skater.toi } };
  }
  const column = SKATER_COLUMNS[output.target_key];
  if (!column) return null;
  const value = numeric(skater[column]);
  return value === null ? null : { value, payload: { sourceTable: "skatersGameStats", sourceColumn: column } };
}

function revisionKey(actual: Actual, finality: string): string {
  return crypto.createHash("sha256").update(JSON.stringify({ value: actual.value, payload: actual.payload, finality })).digest("hex");
}

export async function settlePlayerForecasts(args: {
  supabase: SupabaseClient<any>;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const cutoff = new Date(now.getTime() - PROVISIONAL_DELAY_MS).toISOString();
  const { data: games, error: gamesError } = await args.supabase
    .from("games")
    .select("id,startTime,date")
    .lte("startTime", cutoff);
  if (gamesError) throw gamesError;
  const gameMap = new Map((games ?? []).map((game: any) => [Number(game.id), game]));
  const gameIds = [...gameMap.keys()];
  if (gameIds.length === 0) return { eligibleOutputs: 0, outcomesAppended: 0, evaluationsAppended: 0, unsupportedOutputs: 0 };

  const { data: outputs, error: outputsError } = await args.supabase
    .from("player_forecast_outputs")
    .select("id,game_id,player_id,target_key,conditioning,point_estimate,probability,distribution,quantiles")
    .in("game_id", gameIds);
  if (outputsError) throw outputsError;
  const typedOutputs = (outputs ?? []) as OutputRow[];
  if (typedOutputs.length === 0) return { eligibleOutputs: 0, outcomesAppended: 0, evaluationsAppended: 0, unsupportedOutputs: 0 };

  const outputGameIds = [...new Set(typedOutputs.map((output) => output.game_id))];
  const { data: skaterRows, error: skaterError } = await args.supabase
    .from("skatersGameStats")
    .select("gameId,playerId,goals,assists,shots,blockedShots,hits,pim,toi")
    .in("gameId", outputGameIds);
  if (skaterError) throw skaterError;
  const skaters = new Map<string, Record<string, unknown>>();
  const gamesWithSkaterStats = new Set<number>();
  for (const row of skaterRows ?? []) {
    gamesWithSkaterStats.add(Number(row.gameId));
    skaters.set(`${row.gameId}:${row.playerId}`, row);
  }

  const outcomeKeys = typedOutputs.map((output) => `${output.game_id}:${output.player_id}:${output.target_key}`);
  const { data: existingOutcomes, error: outcomeError } = await args.supabase
    .from("player_forecast_outcome_revisions")
    .select("id,game_id,player_id,target_key,outcome_value,available_at,finality")
    .in("game_id", outputGameIds)
    .lte("available_at", now.toISOString())
    .order("available_at", { ascending: false });
  if (outcomeError) throw outcomeError;
  const latestOutcomes = new Map<string, any>();
  for (const row of existingOutcomes ?? []) {
    const key = `${row.game_id}:${row.player_id}:${row.target_key}`;
    if (outcomeKeys.includes(key) && !latestOutcomes.has(key)) latestOutcomes.set(key, row);
  }

  let outcomesAppended = 0;
  let evaluationsAppended = 0;
  let unsupportedOutputs = 0;
  const outcomeByKey = new Map<string, any>();
  for (const output of typedOutputs) {
    if (!gamesWithSkaterStats.has(output.game_id)) continue;
    const actual = actualForOutput(output, skaters.get(`${output.game_id}:${output.player_id}`));
    if (!actual) {
      unsupportedOutputs += 1;
      continue;
    }
    const key = `${output.game_id}:${output.player_id}:${output.target_key}`;
    if (!outcomeByKey.has(key)) {
      const latest = latestOutcomes.get(key);
      const game = gameMap.get(output.game_id);
      const startMs = Date.parse(game.startTime);
      const sameValue = latest && numeric(latest.outcome_value) === actual.value;
      const finality = latest && !sameValue
        ? "corrected"
        : latest?.finality === "corrected" || latest?.finality === "final"
          ? latest.finality
          : now.getTime() >= startMs + CORRECTION_WINDOW_MS
            ? "final"
            : "provisional";
      if (sameValue && latest.finality === finality) {
        outcomeByKey.set(key, latest);
      } else {
        const row = {
          game_id: output.game_id,
          player_id: output.player_id,
          target_key: output.target_key,
          target_version: "research-contract-v1",
          outcome_value: actual.value,
          outcome_payload: actual.payload,
          source: "nhl_game_stats",
          source_revision_key: revisionKey(actual, finality),
          observed_at: now.toISOString(),
          available_at: now.toISOString(),
          finality,
          supersedes_id: latest?.id ?? null,
        };
        const { data, error } = await args.supabase
          .from("player_forecast_outcome_revisions")
          .upsert(row as never, {
            onConflict: "game_id,player_id,target_key,target_version,source_revision_key",
            ignoreDuplicates: true,
          })
          .select("id,game_id,player_id,target_key,outcome_value,available_at,finality")
          .maybeSingle();
        if (error) throw error;
        const stored = data ?? latest;
        if (!stored) throw new Error("Outcome revision could not be resolved after insert.");
        outcomeByKey.set(key, stored);
        if (data) outcomesAppended += 1;
      }
    }
    const outcome = outcomeByKey.get(key);
    const baselinePointEstimate = numeric(output.distribution?.baselinePointEstimate);
    const score = scoreForecast({
      actual: actual.value,
      pointEstimate: numeric(output.point_estimate),
      probability: numeric(output.probability),
      conditioning: output.conditioning,
      quantiles: output.quantiles,
      baselinePointEstimate,
    });
    if (!score) continue;
    const { data: evaluation, error: evaluationError } = await args.supabase
      .from("player_forecast_evaluation_revisions")
      .upsert({
        forecast_output_id: output.id,
        outcome_revision_id: outcome.id,
        scoring_version: PLAYER_FORECAST_SCORING_VERSION,
        settlement_status: outcome.finality ?? "provisional",
        evaluated_at: now.toISOString(),
        metrics: score.metrics,
        baseline_metrics: score.baselineMetrics,
        composite_skill_score: score.compositeSkillScore,
      } as never, {
        onConflict: "forecast_output_id,outcome_revision_id,scoring_version",
        ignoreDuplicates: true,
      })
      .select("id")
      .maybeSingle();
    if (evaluationError) throw evaluationError;
    if (evaluation) evaluationsAppended += 1;
  }

  return {
    eligibleOutputs: typedOutputs.length,
    outcomesAppended,
    evaluationsAppended,
    unsupportedOutputs,
  };
}
