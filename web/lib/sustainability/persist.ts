import type { Database } from "lib/supabase/database-generated.types";
import supabase from "lib/supabase/server";

export type TrendBandRow =
  Database["public"]["Tables"]["sustainability_trend_bands"]["Insert"];

type UpsertOptions = {
  onConflict: string;
};

type TrendBandClient = {
  from: (table: "sustainability_trend_bands") => {
    upsert: (
      rows: TrendBandRow[],
      options: UpsertOptions
    ) => Promise<{ error: Error | null }>;
  };
};

export const TREND_BAND_ON_CONFLICT =
  "player_id,snapshot_date,metric_key,window_code";

export async function upsertTrendBandRows({
  rows,
  client = supabase as unknown as TrendBandClient,
  chunkSize = 400
}: {
  rows: TrendBandRow[];
  client?: TrendBandClient;
  chunkSize?: number;
}): Promise<{ inserted: number; chunks: number }> {
  const filteredRows = rows.filter(Boolean);
  if (!filteredRows.length) {
    return { inserted: 0, chunks: 0 };
  }

  let chunks = 0;
  for (let i = 0; i < filteredRows.length; i += chunkSize) {
    const chunk = filteredRows.slice(i, i + chunkSize);
    const { error } = await client
      .from("sustainability_trend_bands")
      .upsert(chunk, {
        onConflict: TREND_BAND_ON_CONFLICT
      });
    if (error) throw error;
    chunks += 1;
  }

  return { inserted: filteredRows.length, chunks };
}
