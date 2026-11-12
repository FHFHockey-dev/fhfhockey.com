import type { SupabaseClient } from "@supabase/supabase-js";

import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import { deriveFallbackCurrentSeasonId } from "./playerStatsFilters";
import type { PlayerStatsLandingApiResponse, PlayerStatsLandingApiRow } from "./playerStatsQueries";
import type { PlayerStatsLandingFilterState } from "./playerStatsTypes";

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
  /** Offense and defense snapshots can be from different dates (W2-2 D14). */
  offensiveRatingSnapshotDate: string | null;
  defensiveRatingSnapshotDate: string | null;
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
        .from("skater_offensive_ratings_daily" as any)
        .select("player_id,snapshot_date,rating_0_to_100,league_rank,percentile")
        .in("player_id", playerIds)
        .order("snapshot_date", { ascending: false }),
      client
        .from("skater_defensive_ratings_daily" as any)
        .select("player_id,snapshot_date,rating_0_to_100,league_rank,percentile")
        .in("player_id", playerIds)
        .order("snapshot_date", { ascending: false }),
    ]);

  if (offensiveError) throw offensiveError;
  if (defensiveError) throw defensiveError;

  const latestOffenseByPlayer = pickLatestByPlayerId(
    (offensiveData ?? []) as unknown as SkaterOffensiveRatingRow[]
  );
  const latestDefenseByPlayer = pickLatestByPlayerId(
    (defensiveData ?? []) as unknown as SkaterDefensiveRatingRow[]
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
      offensiveRatingSnapshotDate: offensive?.snapshot_date ?? null,
      defensiveRatingSnapshotDate: defensive?.snapshot_date ?? null,
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
    .from("goalie_ratings_daily" as any)
    .select("player_id,snapshot_date,rating_0_to_100,league_rank,percentile")
    .in("player_id", playerIds)
    .order("snapshot_date", { ascending: false });
  if (error) throw error;

  const latestByPlayer = pickLatestByPlayerId(
    (data ?? []) as unknown as GoalieRatingRow[]
  );
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

export type EntityRatingsOverlayStatus =
  | {
      status: "current";
      /** Latest snapshot date served per rating (offense, defense, goalie). */
      offensiveSnapshotDate: string | null;
      defensiveSnapshotDate: string | null;
      goalieSnapshotDate: string | null;
    }
  | { status: "hidden"; reason: "nonCurrentSeason" | "nonCurrentRange" };

export type PlayerStatsLandingApiResponseWithRatings = PlayerStatsLandingApiResponse & {
  ratingsOverlay?: EntityRatingsOverlayStatus;
};

/**
 * The daily ratings are today's snapshot. They are only overlaid on a table
 * for the current season with an open-ended window (decision 91, W2-2 D14);
 * historical seasons and past date ranges hide them.
 */
export function resolveEntityRatingsOverlayEligibility(
  state: Pick<PlayerStatsLandingFilterState, "primary" | "expandable"> | null | undefined,
  asOfDate: Date = new Date()
): { eligible: true } | { eligible: false; reason: "nonCurrentSeason" | "nonCurrentRange" } {
  if (state == null) {
    return { eligible: true };
  }

  const currentSeasonId = deriveFallbackCurrentSeasonId(asOfDate);
  const { fromSeasonId, throughSeasonId } = state.primary.seasonRange;
  if (fromSeasonId !== currentSeasonId || throughSeasonId !== currentSeasonId) {
    return { eligible: false, reason: "nonCurrentSeason" };
  }

  const scope = state.expandable.scope;
  if (scope.kind === "dateRange" && scope.endDate != null) {
    const yesterday = new Date(asOfDate.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    if (scope.endDate < yesterday) {
      return { eligible: false, reason: "nonCurrentRange" };
    }
  }

  return { eligible: true };
}

function latestDate(values: Iterable<string | null | undefined>): string | null {
  let latest: string | null = null;
  for (const value of values) {
    if (value && (latest == null || value > latest)) latest = value;
  }
  return latest;
}

export async function overlayEntityRatingsOnLandingResponse(args: {
  response: PlayerStatsLandingApiResponse;
  variant: RatingOverlayVariant;
  client?: Client;
  state?: Pick<PlayerStatsLandingFilterState, "primary" | "expandable"> | null;
  asOfDate?: Date;
}): Promise<PlayerStatsLandingApiResponseWithRatings> {
  const eligibility = resolveEntityRatingsOverlayEligibility(args.state, args.asOfDate);
  if (!eligibility.eligible) {
    return {
      ...args.response,
      ratingsOverlay: { status: "hidden", reason: eligibility.reason },
    };
  }

  const client = args.client ?? supabase;
  const playerIds = getDistinctPlayerIds(args.response.rows);
  if (playerIds.length === 0) {
    return args.response;
  }

  const overlayByPlayer: Map<number, SkaterRatingOverlay | GoalieRatingOverlay> =
    args.variant === "goalie"
      ? await fetchGoalieRatings(client, playerIds)
      : await fetchSkaterRatings(client, playerIds);
  const overlays = [...overlayByPlayer.values()];

  return {
    ...args.response,
    ratingsOverlay: {
      status: "current",
      offensiveSnapshotDate: latestDate(
        overlays.map((overlay) =>
          "offensiveRatingSnapshotDate" in overlay ? overlay.offensiveRatingSnapshotDate : null
        )
      ),
      defensiveSnapshotDate: latestDate(
        overlays.map((overlay) =>
          "defensiveRatingSnapshotDate" in overlay ? overlay.defensiveRatingSnapshotDate : null
        )
      ),
      goalieSnapshotDate:
        args.variant === "goalie"
          ? latestDate(overlays.map((overlay) => overlay.ratingSnapshotDate))
          : null,
    },
    rows: args.response.rows.map((row) => {
      const playerId = Number(row.playerId);
      if (!Number.isFinite(playerId) || playerId <= 0) return row;
      const overlay = overlayByPlayer.get(playerId);
      return overlay ? { ...row, ...overlay } : row;
    }),
  };
}
