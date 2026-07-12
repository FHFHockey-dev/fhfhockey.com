import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";
import { getUpcomingOpponents, type UpcomingOpponent } from "./data";
import { projectCountMetric, type ProjectableCountMetric } from "./model";
import {
  toSustainabilityProjectionRow,
  upsertSustainabilityProjectionRows,
  type SustainabilityProjectionRow
} from "./persist";

type RecomputeClient = SupabaseClient<Database>;

type ActiveSkater = {
  playerId: number;
  teamId: number | null;
};

type ProjectionSourceRow = {
  player_id: number;
  date: string;
  games_played: number | null;
  toi_per_game: number | null;
  goals_per_game: number | null;
  assists_per_game: number | null;
  points_per_game: number | null;
  shots_per_game: number | null;
  pp_points: number | null;
  hits_per_game: number | null;
  blocks_per_game: number | null;
};

const METRICS: Array<{
  key: ProjectableCountMetric;
  readPerGame: (row: ProjectionSourceRow) => number | null;
}> = [
  { key: "goals", readPerGame: (row) => row.goals_per_game },
  { key: "assists", readPerGame: (row) => row.assists_per_game },
  { key: "points", readPerGame: (row) => row.points_per_game },
  { key: "shots", readPerGame: (row) => row.shots_per_game },
  {
    key: "pp_points",
    readPerGame: (row) =>
      row.games_played && row.games_played > 0 && row.pp_points != null
        ? row.pp_points / row.games_played
        : null
  },
  { key: "hits", readPerGame: (row) => row.hits_per_game },
  { key: "blocks", readPerGame: (row) => row.blocks_per_game }
];

function finiteNonNegative(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeToiSeconds(value: number | null): number {
  const toi = finiteNonNegative(value);
  if (!toi) return 0;
  return toi > 180 ? toi : toi * 60;
}

export async function loadActiveSkaterBatch(args: {
  client: RecomputeClient;
  offset: number;
  limit: number;
}): Promise<ActiveSkater[]> {
  const { data, error } = await args.client
    .from("rosters")
    .select("playerId, teamId, players!inner(position)")
    .eq("is_current", true)
    .neq("players.position", "G")
    .order("playerId", { ascending: true })
    .range(args.offset, args.offset + args.limit - 1);
  if (error) throw error;

  const deduped = new Map<number, ActiveSkater>();
  for (const row of data ?? []) {
    const playerId = Number(row.playerId);
    if (!Number.isFinite(playerId)) continue;
    deduped.set(playerId, {
      playerId,
      teamId: row.teamId == null ? null : Number(row.teamId)
    });
  }
  return [...deduped.values()];
}

export async function loadLatestProjectionSource(args: {
  client: RecomputeClient;
  playerId: number;
  snapshotDate: string;
}): Promise<ProjectionSourceRow | null> {
  const { data, error } = await args.client
    .from("wgo_skater_stats")
    .select(
      "player_id, date, games_played, toi_per_game, goals_per_game, assists_per_game, points_per_game, shots_per_game, pp_points, hits_per_game, blocks_per_game"
    )
    .eq("player_id", args.playerId)
    .lte("date", args.snapshotDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ProjectionSourceRow | null) ?? null;
}

export function buildProjectionRows(args: {
  source: ProjectionSourceRow;
  teamId: number | null;
  snapshotDate: string;
  upcoming: UpcomingOpponent[];
}): SustainabilityProjectionRow[] {
  const toiSeconds = normalizeToiSeconds(args.source.toi_per_game);
  if (toiSeconds <= 0) return [];
  const rows: SustainabilityProjectionRow[] = [];

  for (const metric of METRICS) {
    const perGame = finiteNonNegative(metric.readPerGame(args.source));
    if (perGame == null) continue;
    const ratePer60 = (perGame * 3600) / toiSeconds;
    const overall = projectCountMetric({
      metric: metric.key,
      ratePer60,
      toiSeconds,
      horizons: [5, 10]
    });

    for (const horizonGames of [5, 10]) {
      const horizon = overall.horizons[horizonGames];
      if (!horizon) continue;
      rows.push(
        toSustainabilityProjectionRow({
          playerId: args.source.player_id,
          snapshotDate: args.snapshotDate,
          metricKey: metric.key,
          horizonGames,
          expectedValue: horizon.mean,
          teamId: args.teamId,
          band50: horizon.band50,
          band80: horizon.band80,
          ratePer60: overall.adjustedRatePer60,
          toiSeconds,
          distributionModel: horizon.model,
          opponentAdjustment: overall.opponentAdjustment,
          distributionSummary: horizon,
          metadata: {
            source: "wgo_skater_stats",
            sourceDate: args.source.date,
            gamesPlayed: args.source.games_played
          }
        })
      );
    }

    for (const game of args.upcoming) {
      const adjusted = projectCountMetric({
        metric: metric.key,
        ratePer60,
        toiSeconds,
        horizons: [1],
        opponentAdjustment: game.opponentStrength
      });
      const horizon = adjusted.horizons[1];
      if (!horizon) continue;
      rows.push(
        toSustainabilityProjectionRow({
          playerId: args.source.player_id,
          snapshotDate: args.snapshotDate,
          metricKey: metric.key,
          horizonGames: 1,
          expectedValue: horizon.mean,
          projectionType: "opponent_game",
          gameId: game.gameId,
          teamId: args.teamId,
          opponentTeamId: game.opponentTeamId,
          band50: horizon.band50,
          band80: horizon.band80,
          ratePer60: adjusted.adjustedRatePer60,
          toiSeconds,
          distributionModel: horizon.model,
          opponentAdjustment: adjusted.opponentAdjustment,
          distributionSummary: horizon,
          metadata: {
            source: "wgo_skater_stats",
            sourceDate: args.source.date,
            gameDate: game.gameDate,
            opponentTeamAbbreviation: game.opponentTeamAbbreviation
          }
        })
      );
    }
  }

  return rows;
}

export type SustainabilityRecomputeDependencies = {
  loadPlayers: typeof loadActiveSkaterBatch;
  loadSource: typeof loadLatestProjectionSource;
  loadUpcoming: typeof getUpcomingOpponents;
  persist: typeof upsertSustainabilityProjectionRows;
};

const DEFAULT_DEPENDENCIES: SustainabilityRecomputeDependencies = {
  loadPlayers: loadActiveSkaterBatch,
  loadSource: loadLatestProjectionSource,
  loadUpcoming: getUpcomingOpponents,
  persist: upsertSustainabilityProjectionRows
};

export async function runSustainabilityRecompute(args: {
  client: RecomputeClient;
  snapshotDate: string;
  offset: number;
  limit: number;
  dry: boolean;
  dependencies?: SustainabilityRecomputeDependencies;
}) {
  const deps = args.dependencies ?? DEFAULT_DEPENDENCIES;
  const players = await deps.loadPlayers({
    client: args.client,
    offset: args.offset,
    limit: args.limit
  });
  const rows: SustainabilityProjectionRow[] = [];
  const failures: Array<{ playerId: number; message: string }> = [];
  let skippedNoSource = 0;

  for (const player of players) {
    try {
      const source = await deps.loadSource({
        client: args.client,
        playerId: player.playerId,
        snapshotDate: args.snapshotDate
      });
      if (!source) {
        skippedNoSource += 1;
        continue;
      }
      const upcoming = await deps.loadUpcoming(
        player.playerId,
        10,
        args.snapshotDate,
        args.client
      );
      rows.push(
        ...buildProjectionRows({
          source,
          teamId: player.teamId,
          snapshotDate: args.snapshotDate,
          upcoming
        })
      );
    } catch (error) {
      failures.push({
        playerId: player.playerId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const persistence = args.dry
    ? { inserted: 0, chunks: 0 }
    : await deps.persist({ rows });

  return {
    offset: args.offset,
    limit: args.limit,
    playersLoaded: players.length,
    rowsBuilt: rows.length,
    rowsUpserted: persistence.inserted,
    chunks: persistence.chunks,
    skippedNoSource,
    failures,
    hasMore: players.length === args.limit
  };
}
