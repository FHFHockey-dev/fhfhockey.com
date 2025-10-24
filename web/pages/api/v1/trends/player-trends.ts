import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import {
  GOALIE_TREND_REQUIRED_COLUMNS,
  SKATER_TREND_REQUIRED_COLUMNS,
  buildPlayerTrendRecords
} from "lib/trends/playerTrendCalculator";

type PlayerStatsRow =
  Database["public"]["Views"]["player_stats_unified"]["Row"];
type GoalieStatsRow =
  Database["public"]["Views"]["goalie_stats_unified"]["Row"];

interface RebuildResponse {
  success: boolean;
  startDate: string;
  seasonId?: number;
  playersProcessed: number;
  gamesProcessed: number;
  metricsUpserted: number;
}

interface FetchResponse {
  success: boolean;
  data: any[];
}

const DEFAULT_START_DATE = "2023-01-01";
const SKATER_SELECT_COLUMNS = SKATER_TREND_REQUIRED_COLUMNS.join(",");
const GOALIE_SELECT_COLUMNS = GOALIE_TREND_REQUIRED_COLUMNS.join(",");
const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 500;

function parsePlayerIds(input: unknown): number[] | undefined {
  if (!input) return undefined;

  if (Array.isArray(input)) {
    return input
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
  }

  return undefined;
}

async function fetchSkaterStats(options: {
  startDate: string;
  seasonId?: number;
  playerIds?: number[];
}) {
  const { startDate, seasonId, playerIds } = options;
  const results: PlayerStatsRow[] = [];

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("player_stats_unified")
      .select(SKATER_SELECT_COLUMNS);

    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (seasonId) {
      query = query.eq("season_id", seasonId);
    }
    if (playerIds && playerIds.length > 0) {
      query = query.in("player_id", playerIds);
    }

    query = query
      .order("player_id", { ascending: true })
      .order("date", { ascending: true })
      .range(from, to);

    const { data, error } = await query.returns<PlayerStatsRow[]>();

    if (error) {
      throw new Error(
        `Failed to load skater stats (page ${page}): ${error.message}`
      );
    }

    if (!data || data.length === 0) {
      break;
    }

    results.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return results;
}

async function fetchGoalieStats(options: {
  startDate: string;
  seasonId?: number;
  playerIds?: number[];
}) {
  const { startDate, seasonId, playerIds } = options;
  const results: GoalieStatsRow[] = [];

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("goalie_stats_unified")
      .select(GOALIE_SELECT_COLUMNS);

    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (seasonId) {
      query = query.eq("season_id", seasonId);
    }
    if (playerIds && playerIds.length > 0) {
      query = query.in("player_id", playerIds);
    }

    query = query
      .order("player_id", { ascending: true })
      .order("date", { ascending: true })
      .range(from, to);

    const { data, error } = await query.returns<GoalieStatsRow[]>();

    if (error) {
      throw new Error(
        `Failed to load goalie stats (page ${page}): ${error.message}`
      );
    }

    if (!data || data.length === 0) {
      break;
    }

    results.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return results;
}

function chunkArray<T>(input: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < input.length; index += size) {
    chunks.push(input.slice(index, index + size));
  }
  return chunks;
}

async function upsertTrendRecords(
  records: ReturnType<typeof buildPlayerTrendRecords>
) {
  if (!records.length) {
    return;
  }

  const batches = chunkArray(records, UPSERT_BATCH_SIZE);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];

    const { error } = await supabase
      .from("player_trend_metrics")
      .upsert(batch, {
        onConflict: "player_id,game_date,metric_key"
      });

    if (error) {
      throw new Error(
        `Failed to upsert trend metrics (batch ${index + 1}/${
          batches.length
        }): ${error.message}`
      );
    }
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const startDate =
    typeof req.body?.startDate === "string" && req.body.startDate.length > 0
      ? req.body.startDate
      : DEFAULT_START_DATE;

  const seasonId =
    req.body?.seasonId !== undefined && req.body.seasonId !== null
      ? Number(req.body.seasonId)
      : undefined;

  const playerIds = parsePlayerIds(req.body?.playerIds);

  try {
    const [skaterRows, goalieRows] = await Promise.all([
      fetchSkaterStats({
        startDate,
        seasonId: Number.isFinite(seasonId) ? seasonId : undefined,
        playerIds
      }),
      fetchGoalieStats({
        startDate,
        seasonId: Number.isFinite(seasonId) ? seasonId : undefined,
        playerIds
      })
    ]);

    const rows = [...skaterRows, ...goalieRows];

    const trendRecords = buildPlayerTrendRecords(rows);
    await upsertTrendRecords(trendRecords);

    const uniquePlayers = new Set(
      trendRecords.map((record) => record.player_id)
    );

    const response: RebuildResponse = {
      success: true,
      startDate,
      seasonId: Number.isFinite(seasonId) ? seasonId : undefined,
      playersProcessed: uniquePlayers.size,
      gamesProcessed: rows.length,
      metricsUpserted: trendRecords.length
    };

    return res.status(200).json(response);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to rebuild player trends"
    });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const playerId =
    typeof req.query.playerId === "string"
      ? Number(req.query.playerId)
      : undefined;
  const metricKey =
    typeof req.query.metricKey === "string" ? req.query.metricKey : undefined;
  const seasonId =
    typeof req.query.seasonId === "string"
      ? Number(req.query.seasonId)
      : undefined;

  const limit =
    typeof req.query.limit === "string"
      ? Math.min(Math.max(Number(req.query.limit), 1) || 50, 500)
      : 50;

  try {
    let query = supabase
      .from("player_trend_metrics")
      .select("*")
      .order("game_date", { ascending: false })
      .limit(limit);

    if (Number.isFinite(playerId)) {
      query = query.eq("player_id", playerId as number);
    }
    if (metricKey) {
      query = query.eq("metric_key", metricKey);
    }
    if (Number.isFinite(seasonId)) {
      query = query.eq("season_id", seasonId as number);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load trend metrics: ${error.message}`);
    }

    const response: FetchResponse = {
      success: true,
      data: data ?? []
    };

    return res.status(200).json(response);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to fetch trend metrics"
    });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    return handlePost(req, res);
  }

  if (req.method === "GET") {
    return handleGet(req, res);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} Not Allowed`
  });
}
