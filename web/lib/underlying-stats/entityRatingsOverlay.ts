import type { SupabaseClient } from "@supabase/supabase-js";

import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import type { PlayerStatsLandingApiResponse, PlayerStatsLandingApiRow } from "./playerStatsQueries";

type Client = SupabaseClient<Database>;

type RatingOverlayVariant = "skater" | "goalie";

type SkaterOffensiveRatingRow = {
  player_id: number | null;
  snapshot_date: string | null;
  rating_0_to_100: number | null;
  league_rank: number | null;
  percentile: number | null;
};

type SkaterDefensiveRatingRow = SkaterOffensiveRatingRow;
type GoalieRatingRow = SkaterOffensiveRatingRow;

type SkaterRatingOverlay = {
  offensiveRating: number | null;
  offensiveRatingRank: number | null;
  offensiveRatingPercentile: number | null;
  defensiveRating: number | null;
  defensiveRatingRank: number | null;
  defensiveRatingPercentile: number | null;
  ratingSnapshotDate: string | null;
};

type GoalieRatingOverlay = {
  goalieRating: number | null;
  goalieRatingRank: number | null;
  goalieRatingPercentile: number | null;
  ratingSnapshotDate: string | null;
};

function getDistinctPlayerIds(rows: readonly PlayerStatsLandingApiRow[]): number[] {
  return Array.from(
    new Set(
      rows
        .map((row) => Number(row.playerId))
        .filter((playerId): playerId is number => Number.isFinite(playerId) && playerId > 0)
    )
  );
}

function pickLatestByPlayerId<T extends { player_id: number | null; snapshot_date: string | null }>(
  rows: readonly T[]
): Map<number, T> {
  const result = new Map<number, T>();
  for (const row of rows) {
    const playerId = Number(row.player_id);
    if (!Number.isFinite(playerId) || playerId <= 0) continue;
    const existing = result.get(playerId);
    const nextDate = row.snapshot_date ?? "";
    const currentDate = existing?.snapshot_date ?? "";
    if (!existing || nextDate > currentDate) {
      result.set(playerId, row);
    }
  }
  return result;
}

async function fetchSkaterRatings(
  client: Client,
  playerIds: number[]
): Promise<Map<number, SkaterRatingOverlay>> {
  if (playerIds.length === 0) return new Map();

  const [{ data: offensiveData, error: offensiveError }, { data: defensiveData, error: defensiveError }] =
    await Promise.all([
      client
        .from("skater_offensive_ratings_daily")
        .select("player_id,snapshot_date,rating_0_to_100,league_rank,percentile")
        .in("player_id", playerIds)
        .order("snapshot_date", { ascending: false }),
      client
        .from("skater_defensive_ratings_daily")
        .select("player_id,snapshot_date,rating_0_to_100,league_rank,percentile")
        .in("player_id", playerIds)
        .order("snapshot_date", { ascending: false }),
    ]);

  if (offensiveError) throw offensiveError;
  if (defensiveError) throw defensiveError;

  const latestOffenseByPlayer = pickLatestByPlayerId(
    (offensiveData ?? []) as SkaterOffensiveRatingRow[]
  );
  const latestDefenseByPlayer = pickLatestByPlayerId(
    (defensiveData ?? []) as SkaterDefensiveRatingRow[]
  );

  const overlay = new Map<number, SkaterRatingOverlay>();
  for (const playerId of playerIds) {
    const offensive = latestOffenseByPlayer.get(playerId);
    const defensive = latestDefenseByPlayer.get(playerId);
    overlay.set(playerId, {
      offensiveRating: offensive?.rating_0_to_100 ?? null,
      offensiveRatingRank: offensive?.league_rank ?? null,
      offensiveRatingPercentile: offensive?.percentile ?? null,
      defensiveRating: defensive?.rating_0_to_100 ?? null,
      defensiveRatingRank: defensive?.league_rank ?? null,
      defensiveRatingPercentile: defensive?.percentile ?? null,
      ratingSnapshotDate: offensive?.snapshot_date ?? defensive?.snapshot_date ?? null,
    });
  }

  return overlay;
}

async function fetchGoalieRatings(
  client: Client,
  playerIds: number[]
): Promise<Map<number, GoalieRatingOverlay>> {
  if (playerIds.length === 0) return new Map();

  const { data, error } = await client
    .from("goalie_ratings_daily")
    .select("player_id,snapshot_date,rating_0_to_100,league_rank,percentile")
    .in("player_id", playerIds)
    .order("snapshot_date", { ascending: false });
  if (error) throw error;

  const latestByPlayer = pickLatestByPlayerId((data ?? []) as GoalieRatingRow[]);
  const overlay = new Map<number, GoalieRatingOverlay>();
  for (const playerId of playerIds) {
    const row = latestByPlayer.get(playerId);
    overlay.set(playerId, {
      goalieRating: row?.rating_0_to_100 ?? null,
      goalieRatingRank: row?.league_rank ?? null,
      goalieRatingPercentile: row?.percentile ?? null,
      ratingSnapshotDate: row?.snapshot_date ?? null,
    });
  }

  return overlay;
}

export async function overlayEntityRatingsOnLandingResponse(args: {
  response: PlayerStatsLandingApiResponse;
  variant: RatingOverlayVariant;
  client?: Client;
}): Promise<PlayerStatsLandingApiResponse> {
  const client = args.client ?? supabase;
  const playerIds = getDistinctPlayerIds(args.response.rows);
  if (playerIds.length === 0) {
    return args.response;
  }

  const overlayByPlayer =
    args.variant === "goalie"
      ? await fetchGoalieRatings(client, playerIds)
      : await fetchSkaterRatings(client, playerIds);

  return {
    ...args.response,
    rows: args.response.rows.map((row) => {
      const playerId = Number(row.playerId);
      if (!Number.isFinite(playerId) || playerId <= 0) return row;
      const overlay = overlayByPlayer.get(playerId);
      return overlay ? { ...row, ...overlay } : row;
    }),
  };
}
