import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

// One marker per publication (surface x season x date x strength x window x
// peer group). Writers set `writing` before their first row and `complete`
// only after the database confirmed every row; the reader serves a date only
// when the Rankings and composites markers there are both complete.
export type RankingPublicationRow =
  Database["public"]["Tables"]["ranking_publications"]["Row"];
export type RankingPublicationInsert =
  Database["public"]["Tables"]["ranking_publications"]["Insert"];
export type RankingPublicationSurface =
  | "entity_metric_rankings"
  | "skater_composite_ratings";

export const RANKING_PUBLICATIONS_TABLE = "ranking_publications";
// The writers' default sample floors. Only a publication built with them is
// marked: the durable row key does not encode custom floors.
export const PUBLICATION_MIN_GP = 1;
export const PUBLICATION_MIN_TOI_SECONDS = 300;
const PRIMARY_KEY =
  "surface,season_id,snapshot_date,strength_state,window_type,window_size,peer_group_type,peer_group_key";

export class RankingPublicationTableMissingError extends Error {
  constructor() {
    super(
      "ranking_publications is not deployed; publications cannot be marked, so nothing was written.",
    );
    this.name = "RankingPublicationTableMissingError";
  }
}

// PostgREST answers PGRST205 (schema cache) or Postgres 42P01 while the table
// has not been migrated.
export function isMissingPublicationTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === "PGRST205" || code === "42P01") return true;
  return (
    typeof message === "string" &&
    message.includes(RANKING_PUBLICATIONS_TABLE) &&
    /schema cache|does not exist/i.test(message)
  );
}

export async function upsertPublicationMarkers(
  client: SupabaseClient<Database>,
  markers: RankingPublicationInsert[],
) {
  if (markers.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await client
    .from(RANKING_PUBLICATIONS_TABLE)
    .upsert(
      markers.map((marker) => ({ ...marker, updated_at: now })),
      { onConflict: PRIMARY_KEY },
    );
  if (error) {
    if (isMissingPublicationTableError(error)) {
      throw new RankingPublicationTableMissingError();
    }
    throw new Error(`Failed to write ranking_publications: ${error.message}`);
  }
}

export type PublicationKey = Pick<
  RankingPublicationRow,
  | "surface"
  | "season_id"
  | "snapshot_date"
  | "strength_state"
  | "window_type"
  | "window_size"
  | "peer_group_type"
  | "peer_group_key"
>;

export async function fetchPublicationMarker(
  client: SupabaseClient<Database>,
  key: PublicationKey,
): Promise<RankingPublicationRow | null> {
  const { data, error } = await client
    .from(RANKING_PUBLICATIONS_TABLE)
    .select("*")
    .eq("surface", key.surface)
    .eq("season_id", key.season_id)
    .eq("snapshot_date", key.snapshot_date)
    .eq("strength_state", key.strength_state)
    .eq("window_type", key.window_type)
    .eq("window_size", key.window_size)
    .eq("peer_group_type", key.peer_group_type)
    .eq("peer_group_key", key.peer_group_key)
    .limit(1);
  if (error) {
    if (isMissingPublicationTableError(error)) {
      throw new RankingPublicationTableMissingError();
    }
    throw new Error(`Failed to read ranking_publications: ${error.message}`);
  }
  return ((data ?? [])[0] as RankingPublicationRow | undefined) ?? null;
}

export type PublicationCounts = {
  expectedRows: number;
  dbWrittenRows: number | null;
  expectedEntities: number;
  writtenEntities: number;
};

// What `complete` proves: every write succeeded, the database reported as
// many affected rows as were built, and the distinct entities written equal the
// source-coverage population. It does not prove values are right or that no
// stale rows of departed players remain (upserts never delete).
export function publicationCompletionBlockers(counts: PublicationCounts) {
  const blockers: string[] = [];
  if (counts.dbWrittenRows == null) {
    blockers.push("The database did not report a written row count.");
  } else if (counts.dbWrittenRows !== counts.expectedRows) {
    blockers.push(
      `The database reported ${counts.dbWrittenRows} written rows; ${counts.expectedRows} were built.`,
    );
  }
  if (counts.expectedEntities <= 0) {
    blockers.push("The source-coverage population is empty.");
  } else if (counts.writtenEntities !== counts.expectedEntities) {
    blockers.push(
      `${counts.writtenEntities} entities were written; the source-coverage population is ${counts.expectedEntities}.`,
    );
  }
  return blockers;
}
