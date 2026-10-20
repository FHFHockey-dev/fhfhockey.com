import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

type SustainabilityClient = SupabaseClient<Database>;

const HEALTH_TABLES = [
  "sustainability_scores",
  "sustainability_trend_bands",
  "sustainability_projections",
] as const;

type SustainabilityHealthTable = (typeof HEALTH_TABLES)[number];
const SCORE_WINDOWS = ["l3", "l5", "l10", "l20"] as const;
type ScoreWindow = (typeof SCORE_WINDOWS)[number];
type DistributionObservation = Pick<
  Database["public"]["Tables"]["sustainability_distribution_snapshots"]["Row"],
  "window_code" | "season_id" | "config_revision" | "model_version" | "config_hash" | "population_count"
>;

export type SustainabilitySnapshotDiagnostics = {
  snapshotDate: string | null;
  expectedPopulation: null;
  coverage: "unverified";
  coverageReason: string;
  scoreRowsByWindow: Record<ScoreWindow, number> | null;
  missingScoreWindows: ScoreWindow[];
  missingQuintileRows: number | null;
  distributions: {
    rowCount: number | null;
    rows: DistributionObservation[];
    truncated: boolean | null;
    missingWindows: ScoreWindow[] | null;
  };
  issues: string[];
};

export type SustainabilityTableHealth = {
  latestSnapshotDate: string | null;
  rowCount: number;
};

export type SustainabilityHealthReport = {
  generatedAt: string;
  tables: Record<SustainabilityHealthTable, SustainabilityTableHealth>;
  snapshotDiagnostics: SustainabilitySnapshotDiagnostics;
};

function requireExactCount(count: number | null): number {
  if (count == null || !Number.isSafeInteger(count) || count < 0) {
    throw new Error("Sustainability exact count is unavailable");
  }
  return count;
}

async function loadSnapshotDiagnostics(
  client: SustainabilityClient,
  snapshotDate: string | null,
): Promise<SustainabilitySnapshotDiagnostics> {
  const result: SustainabilitySnapshotDiagnostics = {
    snapshotDate,
    expectedPopulation: null,
    coverage: "unverified",
    coverageReason: "No authoritative eligible-player denominator or membership manifest; matching counts do not verify membership, model identity or freshness.",
    scoreRowsByWindow: null,
    missingScoreWindows: [],
    missingQuintileRows: null,
    distributions: { rowCount: null, rows: [], truncated: null, missingWindows: null },
    issues: [],
  };
  if (snapshotDate == null) {
    result.issues.push("no_score_snapshot");
    return result;
  }

  // Serialize these six date-scoped reads; never scan score/player histories.
  const counts = {} as Record<ScoreWindow, number>;
  for (const window of SCORE_WINDOWS) {
    const { count, error } = await client.from("sustainability_scores")
      .select("player_id", { count: "exact", head: true })
      .eq("snapshot_date", snapshotDate).eq("window_code", window);
    if (error) throw error;
    counts[window] = requireExactCount(count);
  }
  result.scoreRowsByWindow = counts;
  result.missingScoreWindows = SCORE_WINDOWS.filter(window => counts[window] === 0);
  if (result.missingScoreWindows.length) result.issues.push("missing_score_windows");
  if (new Set(Object.values(counts)).size > 1) result.issues.push("unequal_score_window_counts");

  const quintiles = await client.from("sustainability_scores")
    .select("player_id", { count: "exact", head: true })
    .eq("snapshot_date", snapshotDate).in("window_code", [...SCORE_WINDOWS])
    .is("sustainability_quintile", null);
  if (quintiles.error) throw quintiles.error;
  result.missingQuintileRows = requireExactCount(quintiles.count);
  if (result.missingQuintileRows > 0) result.issues.push("missing_quintiles");

  const distributions = await client.from("sustainability_distribution_snapshots")
    .select("window_code,season_id,config_revision,model_version,config_hash,population_count", { count: "exact" })
    .eq("snapshot_date", snapshotDate).in("window_code", [...SCORE_WINDOWS])
    .order("config_revision", { ascending: false }).order("season_id", { ascending: true })
    .order("window_code", { ascending: true }).limit(5);
  if (distributions.error) throw distributions.error;
  const rowCount = requireExactCount(distributions.count);
  const rows = distributions.data ?? [];
  const truncated = rowCount > rows.length;
  const identities = new Set(rows.map(row => JSON.stringify([row.config_revision, row.season_id, row.model_version, row.config_hash])));
  const duplicateWindows = new Set(rows.map(row => row.window_code)).size !== rows.length;
  const ambiguous = truncated || identities.size > 1 || duplicateWindows || rowCount > SCORE_WINDOWS.length;
  const missingWindows = ambiguous ? null : SCORE_WINDOWS.filter(window => !rows.some(row => row.window_code === window));
  result.distributions = { rowCount, rows, truncated, missingWindows };
  if (truncated) result.issues.push("truncated_distributions");
  if (ambiguous) result.issues.push("ambiguous_distribution_identity");
  if (missingWindows?.length) result.issues.push("missing_distribution_windows");
  return result;
}

async function loadTableHealth(
  client: SustainabilityClient,
  table: SustainabilityHealthTable,
): Promise<SustainabilityTableHealth> {
  const [latestResult, countResult] = await Promise.all([
    client
      .from(table)
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client.from(table).select("*", { count: "exact", head: true }),
  ]);

  if (latestResult.error) throw latestResult.error;
  if (countResult.error) throw countResult.error;

  return {
    latestSnapshotDate: latestResult.data?.snapshot_date ?? null,
    rowCount: requireExactCount(countResult.count),
  };
}

export async function loadSustainabilityHealth(
  client: SustainabilityClient,
  generatedAt = new Date().toISOString(),
): Promise<SustainabilityHealthReport> {
  const tableReports = await Promise.all(
    HEALTH_TABLES.map(
      async (table) => [table, await loadTableHealth(client, table)] as const,
    ),
  );

  const tables = Object.fromEntries(tableReports) as SustainabilityHealthReport["tables"];
  const snapshotDiagnostics = await loadSnapshotDiagnostics(
    client, tables.sustainability_scores.latestSnapshotDate,
  );
  return {
    generatedAt,
    tables,
    snapshotDiagnostics,
  };
}
