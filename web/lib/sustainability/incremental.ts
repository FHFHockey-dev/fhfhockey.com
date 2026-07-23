import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";

function sourceDateFromComponents(value: Json | null): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cutoffs = value.sourceCutoffs;
  if (!cutoffs || typeof cutoffs !== "object" || Array.isArray(cutoffs)) return null;
  const observed = cutoffs.observed;
  if (!observed || typeof observed !== "object" || Array.isArray(observed)) return null;
  return typeof observed.player_stats_source_date === "string"
    ? observed.player_stats_source_date
    : null;
}

export function classifySustainabilitySourceAdvance(args: {
  latestSourceDate: string | null;
  latestProcessedSourceDate: string | null;
}) {
  if (!args.latestSourceDate) {
    return { shouldProcess: true, reason: "source_date_unavailable" as const };
  }
  if (!args.latestProcessedSourceDate) {
    return { shouldProcess: true, reason: "no_processed_source_cutoff" as const };
  }
  return args.latestSourceDate > args.latestProcessedSourceDate
    ? { shouldProcess: true, reason: "new_source_date" as const }
    : { shouldProcess: false, reason: "source_already_processed" as const };
}

export async function detectSustainabilitySourceAdvance(
  client: SupabaseClient<Database>
) {
  const [sourceResult, scoreResult] = await Promise.all([
    client
      .from("player_stats_unified")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("sustainability_scores")
      .select("components")
      .order("computed_at", { ascending: false })
      .limit(100)
  ]);
  if (sourceResult.error) throw sourceResult.error;
  if (scoreResult.error) throw scoreResult.error;
  const latestSourceDate = sourceResult.data?.date ?? null;
  const processedDates = (scoreResult.data ?? [])
    .map((row) => sourceDateFromComponents(row.components))
    .filter((date): date is string => Boolean(date))
    .sort();
  const latestProcessedSourceDate = processedDates.at(-1) ?? null;
  return {
    latest_source_date: latestSourceDate,
    latest_processed_source_date: latestProcessedSourceDate,
    ...classifySustainabilitySourceAdvance({
      latestSourceDate,
      latestProcessedSourceDate
    })
  };
}
