import type { Database } from "lib/supabase/database-generated.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runSustainabilityBaselineBacktest,
  runSustainabilityProbabilityBacktest,
  type SustainabilityBacktestExample,
  type SustainabilityProbabilityBacktestExample
} from "./backtest";

export type HistoricalProjectionRow = Pick<
  Database["public"]["Tables"]["sustainability_projections"]["Row"],
  "player_id" | "snapshot_date" | "metric_key" | "horizon_games" | "expected_value"
>;

type HistoricalProjectionClient = Pick<SupabaseClient<Database>, "from">;

export type HistoricalBacktestCoverage = {
  projectionRows: number;
  resolvedActuals: number;
  probabilityExamples: number;
  status: "ready" | "insufficient_projection_history" | "insufficient_actual_history";
};

export async function loadHistoricalProjectionRows(options: {
  client: HistoricalProjectionClient;
  fromDate?: string;
  toDate?: string;
  pageSize?: number;
}): Promise<HistoricalProjectionRow[]> {
  const pageSize = Math.max(1, Math.min(1000, options.pageSize ?? 1000));
  const rows: HistoricalProjectionRow[] = [];
  let from = 0;

  while (true) {
    let query = options.client
      .from("sustainability_projections")
      .select("player_id,snapshot_date,metric_key,horizon_games,expected_value")
      .eq("projection_type", "snapshot")
      .order("snapshot_date", { ascending: true })
      .order("player_id", { ascending: true })
      .order("metric_key", { ascending: true })
      .order("horizon_games", { ascending: true });
    if (options.fromDate) query = query.gte("snapshot_date", options.fromDate);
    if (options.toDate) query = query.lte("snapshot_date", options.toDate);
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as HistoricalProjectionRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function runHistoricalSustainabilityBacktest(options: {
  rows: HistoricalProjectionRow[];
  resolveExample: (
    row: HistoricalProjectionRow
  ) => Promise<Omit<SustainabilityBacktestExample, "metricKey" | "sustainabilityPrediction"> | null>;
  probabilityExamples?: SustainabilityProbabilityBacktestExample[];
}) {
  const examples: SustainabilityBacktestExample[] = [];
  for (const row of options.rows) {
    const resolved = await options.resolveExample(row);
    if (!resolved) continue;
    examples.push({
      ...resolved,
      metricKey: row.metric_key,
      sustainabilityPrediction: row.expected_value
    });
  }
  const probabilityExamples = options.probabilityExamples ?? [];
  const status: HistoricalBacktestCoverage["status"] =
    options.rows.length === 0
      ? "insufficient_projection_history"
      : examples.length === 0
        ? "insufficient_actual_history"
        : "ready";

  return {
    coverage: {
      projectionRows: options.rows.length,
      resolvedActuals: examples.length,
      probabilityExamples: probabilityExamples.length,
      status
    } satisfies HistoricalBacktestCoverage,
    countMetrics: runSustainabilityBaselineBacktest(examples),
    probabilityMetrics: runSustainabilityProbabilityBacktest(probabilityExamples)
  };
}
