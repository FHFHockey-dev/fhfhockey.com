import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import { buildShiftStintsByGameId } from "lib/xg/deploymentContext";
import {
  buildQotQocFeatureRows,
  buildQotQocPlayerRatings,
  validateQotQocLeakage,
  type QotQocPositionGroup,
  type QotQocRatingInput,
} from "lib/xg/qotQoc";

const PAGE_SIZE = 1000;
const DEFAULT_UPSERT_BATCH_SIZE = 500;

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseOptionalInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string | null, fallback: number): number {
  return parseOptionalInteger(value) ?? fallback;
}

function parseBoolean(value: string | null): boolean {
  return value != null && ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseWindowGames(value: string | null): number[] {
  if (!value) return [5, 10, 20];
  const parsed = value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
  return parsed.length ? Array.from(new Set(parsed)) : [5, 10, 20];
}

function parseGameIds(value: string | null): number[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isInteger(entry) && entry > 0)
    )
  );
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positionGroup(position: unknown): QotQocPositionGroup {
  const normalized = typeof position === "string" ? position.toUpperCase() : "";
  if (["C", "L", "R"].includes(normalized)) return "forward";
  if (normalized === "D") return "defense";
  if (normalized === "G") return "goalie";
  return "unknown";
}

async function resolveRatingSnapshotDate(args: {
  seasonId: number | null;
  requestedSnapshotDate: string | null;
}): Promise<string | null> {
  if (args.requestedSnapshotDate) return args.requestedSnapshotDate;

  let query = supabase
    .from("skater_offensive_ratings_daily" as any)
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (args.seasonId != null) query = query.eq("season_id", args.seasonId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to resolve QoT/QoC rating snapshot: ${error.message}`);
  const row = (data ?? [])[0] as { snapshot_date?: string } | undefined;
  return row?.snapshot_date ?? null;
}

async function fetchRatings(args: {
  seasonId: number | null;
  snapshotDate: string | null;
}): Promise<QotQocRatingInput[]> {
  if (!args.snapshotDate) return [];

  const [offenseResult, defenseResult] = await Promise.all([
    supabase
      .from("skater_offensive_ratings_daily" as any)
      .select("player_id,rating_0_to_100,sample_toi_seconds")
      .eq("snapshot_date", args.snapshotDate)
      .order("player_id", { ascending: true }),
    supabase
      .from("skater_defensive_ratings_daily" as any)
      .select("player_id,rating_0_to_100,sample_toi_seconds")
      .eq("snapshot_date", args.snapshotDate)
      .order("player_id", { ascending: true }),
  ]);
  if (offenseResult.error) {
    throw new Error(`Failed to fetch offensive QoT/QoC ratings: ${offenseResult.error.message}`);
  }
  if (defenseResult.error) {
    throw new Error(`Failed to fetch defensive QoT/QoC ratings: ${defenseResult.error.message}`);
  }

  const offensiveByPlayer = new Map(
    ((offenseResult.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => [
      Number(row.player_id),
      {
        rating: Number(row.rating_0_to_100) / 100,
        toi: numberOrNull(row.sample_toi_seconds) ?? 0,
      },
    ])
  );
  const defensiveByPlayer = new Map(
    ((defenseResult.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => [
      Number(row.player_id),
      {
        rating: Number(row.rating_0_to_100) / 100,
        toi: numberOrNull(row.sample_toi_seconds) ?? 0,
      },
    ])
  );
  const playerIds = Array.from(
    new Set([...offensiveByPlayer.keys(), ...defensiveByPlayer.keys()])
  ).filter((id) => Number.isFinite(id));
  const positions = await fetchPlayerPositions(playerIds);

  return playerIds
    .map((playerId) => {
      const offense = offensiveByPlayer.get(playerId);
      const defense = defensiveByPlayer.get(playerId);
      if (!offense || !defense) return null;
      return {
        playerId,
        positionGroup: positions.get(playerId) ?? "unknown",
        toiSeconds: Math.max(offense.toi, defense.toi),
        offensiveMetric: offense.rating,
        defensiveMetric: defense.rating,
      } satisfies QotQocRatingInput;
    })
    .filter((row): row is QotQocRatingInput => row != null);
}

async function fetchPlayerPositions(playerIds: number[]): Promise<Map<number, QotQocPositionGroup>> {
  const positions = new Map<number, QotQocPositionGroup>();
  for (const chunk of chunkRows(Array.from(new Set(playerIds)), 500)) {
    const { data, error } = await supabase
      .from("players")
      .select("id,position")
      .in("id", chunk);
    if (error) throw new Error(`Failed to fetch player positions for QoT/QoC: ${error.message}`);
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      positions.set(Number(row.id), positionGroup(row.position));
    }
  }
  return positions;
}

async function fetchShiftRows(args: {
  seasonId: number | null;
  gameIds: number[];
  limitGames: number | null;
}) {
  let gameIds = args.gameIds;
  if (gameIds.length === 0 && args.limitGames != null) {
    let gameQuery = supabase
      .from("nhl_api_shift_rows" as any)
      .select("game_id")
      .order("game_date", { ascending: true })
      .limit(args.limitGames);
    if (args.seasonId != null) gameQuery = gameQuery.eq("season_id", args.seasonId);
    const { data, error } = await gameQuery;
    if (error) throw new Error(`Failed to fetch QoT/QoC game IDs: ${error.message}`);
    gameIds = Array.from(
      new Set(
        ((data ?? []) as unknown as Array<{ game_id: number }>).map((row) =>
          Number(row.game_id)
        )
      )
    );
  }

  const rows: Array<Record<string, unknown>> = [];
  const gameChunks = gameIds.length ? chunkRows(gameIds, 200) : [null];
  for (const gameChunk of gameChunks) {
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase
        .from("nhl_api_shift_rows" as any)
        .select(
          "game_id,shift_id,season_id,game_date,player_id,team_id,period,shift_number,start_seconds,end_seconds,duration_seconds"
        )
        .order("game_id", { ascending: true })
        .order("period", { ascending: true })
        .order("start_seconds", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (args.seasonId != null) query = query.eq("season_id", args.seasonId);
      if (gameChunk) query = query.in("game_id", gameChunk);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch QoT/QoC shift rows: ${error.message}`);
      if (!data?.length) break;
      rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
      if (data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

async function upsertRows(table: string, rows: unknown[], onConflict: string, batchSize: number) {
  let upserted = 0;
  for (const batch of chunkRows(rows, batchSize)) {
    const { error } = await supabase.from(table as any).upsert(batch as any, { onConflict });
    if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
    upserted += batch.length;
  }
  return upserted;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const qotQocVersion = firstQueryValue(req.query.qotQocVersion) ?? "qotqoc-v1";
  const seasonId = parseOptionalInteger(firstQueryValue(req.query.seasonId));
  const snapshotDate = await resolveRatingSnapshotDate({
    seasonId,
    requestedSnapshotDate: firstQueryValue(req.query.snapshotDate),
  });
  const dryRun = parseBoolean(firstQueryValue(req.query.dryRun));
  const gameIds = parseGameIds(firstQueryValue(req.query.gameIds));
  const limitGames = parseOptionalInteger(firstQueryValue(req.query.limitGames));
  const rollingWindows = parseWindowGames(firstQueryValue(req.query.rollingWindows));
  const usageMode =
    firstQueryValue(req.query.usageMode) === "pregame" ? "pregame" : "postgame_descriptive";
  const upsertBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
  );
  const leakage = validateQotQocLeakage({
    featureAvailability: "postgame_descriptive",
    usageMode,
  });
  if (!leakage.passed) {
    return res.status(409).json({
      success: false,
      dryRun,
      qotQocVersion,
      seasonId,
      snapshotDate,
      leakage,
    });
  }

  const [ratingInputs, shiftRows] = await Promise.all([
    fetchRatings({ seasonId, snapshotDate }),
    fetchShiftRows({ seasonId, gameIds, limitGames }),
  ]);
  const ratings = buildQotQocPlayerRatings(ratingInputs);
  const features = buildQotQocFeatureRows({
    version: qotQocVersion,
    ratings,
    ratingSnapshotDate: snapshotDate,
    stints: Array.from(buildShiftStintsByGameId(shiftRows as any[]).values()).flat(),
    rollingWindows,
  });
  const counts = {
    ratingInputs: ratingInputs.length,
    playerRatings: ratings.length,
    shiftRows: shiftRows.length,
    playerGameRows: features.playerGameRows.length,
    unitGameRows: features.unitGameRows.length,
    playerRollingRows: features.playerRollingRows.length,
  };

  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun,
      qotQocVersion,
      seasonId,
      snapshotDate,
      rollingWindows,
      leakage,
      counts,
      samples: {
        playerGameRows: features.playerGameRows.slice(0, 5),
        unitGameRows: features.unitGameRows.slice(0, 5),
      },
    });
  }

  const upserted = {
    playerGameRows: await upsertRows(
      "nhl_xg_qot_qoc_player_game_features",
      features.playerGameRows,
      "qot_qoc_version,game_id,player_id",
      upsertBatchSize
    ),
    unitGameRows: await upsertRows(
      "nhl_xg_qot_qoc_unit_game_features",
      features.unitGameRows,
      "qot_qoc_version,game_id,team_id,unit_type,unit_key",
      upsertBatchSize
    ),
    playerRollingRows: await upsertRows(
      "nhl_xg_qot_qoc_player_rolling_features",
      features.playerRollingRows,
      "qot_qoc_version,player_id,as_of_game_id,window_games",
      upsertBatchSize
    ),
  };

  return res.status(200).json({
    success: true,
    dryRun,
    qotQocVersion,
    seasonId,
    snapshotDate,
    rollingWindows,
    leakage,
    counts,
    upserted,
  });
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-xg-qot-qoc",
});
