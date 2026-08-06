import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

type SustainabilityClient = SupabaseClient<Database>;

const HEALTH_TABLES = [
  "sustainability_scores",
  "sustainability_trend_bands",
  "sustainability_projections",
] as const;

type SustainabilityHealthTable = (typeof HEALTH_TABLES)[number];

export type SustainabilityTableHealth = {
  latestSnapshotDate: string | null;
  rowCount: number;
};

export type SustainabilityHealthReport = {
  generatedAt: string;
  tables: Record<SustainabilityHealthTable, SustainabilityTableHealth>;
};

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
    rowCount: countResult.count ?? 0,
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

  return {
    generatedAt,
    tables: Object.fromEntries(
      tableReports,
    ) as SustainabilityHealthReport["tables"],
  };
}
