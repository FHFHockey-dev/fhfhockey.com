// web/lib/sustainability/entityProducerWrite.ts
//
// The only write path for the team/goalie sustainability producer. Dry runs
// and reports must not import this module.

import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertRowsInChunks } from "./persist";
import type { BandRow, ScoreRow } from "./entityProducer";

type AnyClient = SupabaseClient<any, any, any>;

export const ENTITY_SCORE_ON_CONFLICT =
  "snapshot_date,entity_type,entity_id,metric_scope,window_code";
export const ENTITY_BAND_ON_CONFLICT =
  "snapshot_date,entity_type,entity_id,metric_key,window_code";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Callers must have explicit approval to publish. Bands go first, so any
 * score a reader can see already has its bands. `pauseMs` spaces the chunks
 * to keep database load low during a backfill.
 */
export async function upsertEntitySustainabilityRows(
  client: AnyClient,
  rows: { scores: ScoreRow[]; bands: BandRow[] },
  options: { chunkSize?: number; pauseMs?: number; onChunk?: (table: string, done: number) => void } = {}
) {
  const now = new Date().toISOString();
  const chunkSize = options.chunkSize ?? 400;
  const pauseMs = options.pauseMs ?? 0;
  const write = (table: string, onConflict: string) => {
    let done = 0;
    return async (chunk: Record<string, unknown>[]) => {
      if (done > 0 && pauseMs > 0) await sleep(pauseMs);
      const { error } = await client.from(table).upsert(chunk, { onConflict });
      done += chunk.length;
      options.onChunk?.(table, done);
      return { error: error ? new Error(`${table}: ${error.message}`) : null };
    };
  };
  const bands = await upsertRowsInChunks({
    rows: rows.bands.map((row) => ({ ...row, computed_at: now, updated_at: now })),
    upsert: write("entity_sustainability_bands_daily", ENTITY_BAND_ON_CONFLICT),
    chunkSize
  });
  const scores = await upsertRowsInChunks({
    rows: rows.scores.map((row) => ({ ...row, computed_at: now, updated_at: now })),
    upsert: write("entity_sustainability_scores_daily", ENTITY_SCORE_ON_CONFLICT),
    chunkSize
  });
  return { scores, bands };
}
