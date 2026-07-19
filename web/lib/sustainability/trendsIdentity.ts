import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

export type SustainabilityTrendScoreRow = {
  player_id: number;
  season_id: number;
  snapshot_date: string;
  position_group: string;
  window_code: string;
  s_raw: number | null;
  s_100: number | null;
  components: Record<string, unknown> | string | null;
};

export type SustainabilityTrendIdentity = {
  playerId: number;
  playerName: string | null;
  positionCode: string | null;
};

const SCORE_PAGE_SIZE = 500;
const IDENTITY_CHUNK_SIZE = 200;

function uniquePlayerIds(rows: SustainabilityTrendScoreRow[]): number[] {
  return Array.from(
    new Set(
      rows
        .map((row) => Number(row.player_id))
        .filter((playerId) => Number.isFinite(playerId) && playerId > 0),
    ),
  );
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function fetchSustainabilityTrendScores(
  client: SupabaseClient<Database>,
  args: {
    snapshotDate: string;
    windowCode: string;
    positionGroup?: "F" | "D";
  },
): Promise<SustainabilityTrendScoreRow[]> {
  const rows: SustainabilityTrendScoreRow[] = [];

  for (let offset = 0; ; offset += SCORE_PAGE_SIZE) {
    let query = client
      .from("sustainability_scores")
      .select(
        "player_id, season_id, snapshot_date, position_group, window_code, s_raw, s_100, components",
      )
      .eq("snapshot_date", args.snapshotDate)
      .eq("window_code", args.windowCode);

    if (args.positionGroup) {
      query = query.eq("position_group", args.positionGroup);
    }

    const { data, error } = await query
      .order("player_id", { ascending: true })
      .range(offset, offset + SCORE_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as SustainabilityTrendScoreRow[];
    rows.push(...page);
    if (page.length < SCORE_PAGE_SIZE) break;
  }

  return rows;
}

export async function fetchSustainabilityTrendIdentity(
  client: SupabaseClient<Database>,
  scoreRows: SustainabilityTrendScoreRow[],
  snapshotDate: string,
): Promise<Map<number, SustainabilityTrendIdentity>> {
  const playerIds = uniquePlayerIds(scoreRows);
  if (playerIds.length === 0) return new Map();

  const baselineMap = new Map<
    number,
    { playerName: string | null; positionCode: string | null }
  >();
  const canonicalMap = new Map<
    number,
    { playerName: string | null; positionCode: string | null }
  >();

  for (const playerIdChunk of chunks(playerIds, IDENTITY_CHUNK_SIZE)) {
    const { data, error } = await client
      .from("player_baselines")
      .select("player_id, player_name, position_code")
      .eq("snapshot_date", snapshotDate)
      .in("player_id", playerIdChunk);

    if (error) throw error;
    for (const row of data ?? []) {
      baselineMap.set(Number(row.player_id), {
        playerName: row.player_name ?? null,
        positionCode: row.position_code ?? null,
      });
    }
  }

  for (const playerIdChunk of chunks(playerIds, IDENTITY_CHUNK_SIZE)) {
    const { data, error } = await client
      .from("players")
      .select("id, fullName, position")
      .in("id", playerIdChunk);

    if (error) throw error;
    for (const row of data ?? []) {
      canonicalMap.set(Number(row.id), {
        playerName: row.fullName ?? null,
        positionCode: row.position ?? null,
      });
    }
  }

  return new Map(
    playerIds.map((playerId) => {
      const baseline = baselineMap.get(playerId);
      const canonical = canonicalMap.get(playerId);
      return [
        playerId,
        {
          playerId,
          playerName: canonical?.playerName ?? baseline?.playerName ?? null,
          positionCode:
            canonical?.positionCode ?? baseline?.positionCode ?? null,
        },
      ];
    }),
  );
}
