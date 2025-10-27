import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { getTeamAbbreviationById } from "lib/teamsInfo";
import {
  DEFAULT_SKATER_LIMIT,
  DEFAULT_SKATER_WINDOW,
  MAX_SKATER_LIMIT,
  SKATER_POSITION_GROUP_MAP,
  SKATER_TREND_CATEGORIES,
  type SkaterPositionGroup,
  type SkaterTrendCategoryDefinition,
  type SkaterTrendCategoryId,
  type SkaterWindowSize,
  SKATER_WINDOW_OPTIONS
} from "lib/trends/skaterMetricConfig";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for skater trend API.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

type PlayerTrendRow = {
  player_id: number;
  game_date: string;
  raw_value: number | null;
  rolling_avg_3: number | null;
  rolling_avg_5: number | null;
  rolling_avg_10: number | null;
  season_id: number | null;
  position_code: string | null;
};

type SeriesPoint = { gp: number; percentile: number };

interface RankingEntry {
  playerId: number;
  percentile: number;
  gp: number;
  rank: number;
  previousRank: number | null;
  delta: number;
  latestValue: number | null;
}

interface CategoryResult {
  series: Record<string, SeriesPoint[]>;
  rankings: RankingEntry[];
  includedPlayerIds: number[];
}

interface SkaterTrendResponse {
  seasonId: number;
  generatedAt: string;
  positionGroup: SkaterPositionGroup;
  limit: number;
  windowSize: SkaterWindowSize;
  categories: Record<SkaterTrendCategoryId, Omit<CategoryResult, "includedPlayerIds">>;
  playerMetadata: Record<
    string,
    {
      id: number;
      fullName: string;
      position: string | null;
      teamAbbrev: string | null;
      imageUrl: string | null;
    }
  >;
}

const PAGE_SIZE = 2000;

function parseWindowSize(input: unknown): SkaterWindowSize {
  const candidate = Number(Array.isArray(input) ? input[0] : input);
  if (SKATER_WINDOW_OPTIONS.includes(candidate as SkaterWindowSize)) {
    return candidate as SkaterWindowSize;
  }
  return DEFAULT_SKATER_WINDOW;
}

function parseLimit(input: unknown): number {
  const candidate = Number(Array.isArray(input) ? input[0] : input);
  if (Number.isFinite(candidate) && candidate > 0) {
    return Math.min(Math.round(candidate), MAX_SKATER_LIMIT);
  }
  return DEFAULT_SKATER_LIMIT;
}

function parsePositionGroup(input: unknown): SkaterPositionGroup {
  const value = String(Array.isArray(input) ? input[0] : input || "").toLowerCase();
  if (value === "defense" || value === "defencemen" || value === "d") {
    return "defense";
  }
  if (value === "all") {
    return "all";
  }
  return "forward";
}

function valueForWindow(row: PlayerTrendRow, windowSize: SkaterWindowSize) {
  switch (windowSize) {
    case 3:
      return row.rolling_avg_3;
    case 5:
      return row.rolling_avg_5;
    case 10:
      return row.rolling_avg_10;
    case 1:
    default:
      return row.raw_value;
  }
}

function computePercentiles(
  entries: Array<{ playerId: number; value: number }>,
  higherIsBetter: boolean
): Map<number, number> {
  const result = new Map<number, number>();
  if (entries.length === 0) return result;
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  if (sorted.length === 1) {
    result.set(sorted[0].playerId, 50);
    return result;
  }
  const denom = sorted.length - 1;
  sorted.forEach((entry, idx) => {
    let percentile = (idx / denom) * 100;
    if (!higherIsBetter) {
      percentile = 100 - percentile;
    }
    result.set(entry.playerId, percentile);
  });
  return result;
}

function buildCategoryResult(
  rows: PlayerTrendRow[],
  category: SkaterTrendCategoryDefinition,
  windowSize: SkaterWindowSize,
  limit: number
): CategoryResult {
  const byPlayer = new Map<
    number,
    Array<{ gameDate: string; value: number; gp: number }>
  >();

  rows.forEach((row) => {
    const value = valueForWindow(row, windowSize);
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    if (!byPlayer.has(row.player_id)) {
      byPlayer.set(row.player_id, []);
    }
    const list = byPlayer.get(row.player_id)!;
    list.push({
      gameDate: row.game_date,
      value: Number(value),
      gp: 0
    });
  });

  byPlayer.forEach((list) => {
    list
      .sort((a, b) => a.gameDate.localeCompare(b.gameDate))
      .forEach((entry, idx) => {
        entry.gp = idx + 1;
      });
  });

  const maxGames = Array.from(byPlayer.values()).reduce(
    (max, list) => Math.max(max, list.length),
    0
  );

  const series: Record<string, SeriesPoint[]> = {};

  for (let gp = 1; gp <= maxGames; gp += 1) {
    const entries: Array<{ playerId: number; value: number }> = [];
    byPlayer.forEach((list, playerId) => {
      const point = list[gp - 1];
      if (!point) return;
      entries.push({ playerId, value: point.value });
    });
    if (entries.length === 0) continue;
    const percentileMap = computePercentiles(entries, category.higherIsBetter);
    percentileMap.forEach((percentile, playerId) => {
      const key = String(playerId);
      if (!series[key]) {
        series[key] = [];
      }
      series[key].push({ gp, percentile });
    });
  }

  const rankings: RankingEntry[] = Object.entries(series).map(
    ([playerId, points]) => {
      const numericId = Number(playerId);
      const latest = points[points.length - 1];
      const previous = points.length > 1 ? points[points.length - 2] : undefined;
      const sourceList = byPlayer.get(numericId);
      const latestValue =
        sourceList && sourceList.length > 0
          ? sourceList[sourceList.length - 1].value
          : null;
      return {
        playerId: numericId,
        percentile: latest?.percentile ?? 0,
        gp: latest?.gp ?? 0,
        rank: 0,
        previousRank: null,
        delta: 0,
        latestValue
      };
    }
  );

  rankings.sort((a, b) => b.percentile - a.percentile);
  rankings.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  const previousOrder = [...rankings]
    .filter((entry) => series[String(entry.playerId)].length > 1)
    .sort((a, b) => {
      const prevA =
        series[String(a.playerId)][series[String(a.playerId)].length - 2]
          ?.percentile ?? 0;
      const prevB =
        series[String(b.playerId)][series[String(b.playerId)].length - 2]
          ?.percentile ?? 0;
      return prevB - prevA;
    });
  const previousRankMap = new Map<number, number>();
  previousOrder.forEach((entry, idx) => {
    previousRankMap.set(entry.playerId, idx + 1);
  });

  rankings.forEach((entry) => {
    const prevRank = previousRankMap.get(entry.playerId) ?? null;
    entry.previousRank = prevRank;
    entry.delta = prevRank === null ? 0 : prevRank - entry.rank;
  });

  const limitedRankings = rankings.slice(0, limit);
  const allowedIds = new Set(limitedRankings.map((entry) => entry.playerId));

  const limitedSeries: Record<string, SeriesPoint[]> = {};
  allowedIds.forEach((playerId) => {
    const key = String(playerId);
    if (series[key]) {
      limitedSeries[key] = series[key];
    }
  });

  return {
    series: limitedSeries,
    rankings: limitedRankings,
    includedPlayerIds: Array.from(allowedIds)
  };
}

async function fetchMetricRows(
  category: SkaterTrendCategoryDefinition,
  seasonId: number,
  seasonStart: string,
  positions: string[] | undefined
): Promise<PlayerTrendRow[]> {
  const rows: PlayerTrendRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("player_trend_metrics")
      .select(
        "player_id, game_date, raw_value, rolling_avg_3, rolling_avg_5, rolling_avg_10, season_id, position_code"
      )
      .eq("metric_key", category.metricKey)
      .eq("season_id", seasonId)
      .gte("game_date", seasonStart)
      .order("player_id", { ascending: true })
      .order("game_date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (positions && positions.length > 0) {
      query = query.in("position_code", positions);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(
        `Failed to load trend data for ${category.metricKey}: ${error.message}`
      );
    }
    if (!data || data.length === 0) {
      break;
    }
    rows.push(...(data as PlayerTrendRow[]));
    if (data.length < PAGE_SIZE) {
      break;
    }
  }
  return rows;
}

async function fetchPlayerMetadata(playerIds: number[]) {
  if (playerIds.length === 0) {
    return {};
  }
  const uniqueIds = Array.from(new Set(playerIds));
  const { data, error } = await supabase
    .from("players")
    .select("id, fullName, position, team_id, image_url")
    .in("id", uniqueIds);
  if (error) {
    throw new Error(`Failed to load player metadata: ${error.message}`);
  }
  const map: Record<
    string,
    {
      id: number;
      fullName: string;
      position: string | null;
      teamAbbrev: string | null;
      imageUrl: string | null;
    }
  > = {};
  (data ?? []).forEach((player) => {
    map[String(player.id)] = {
      id: player.id,
      fullName: player.fullName,
      position: player.position ?? null,
      teamAbbrev:
        player.team_id !== null && player.team_id !== undefined
          ? getTeamAbbreviationById(player.team_id)
          : null,
      imageUrl: player.image_url ?? null
    };
  });
  return map;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const season = await fetchCurrentSeason();
    const seasonId = season.id;
    const seasonStart = season.startDate;

    const limit = parseLimit(req.query.limit);
    const windowSize = parseWindowSize(req.query.window);
    const positionGroup = parsePositionGroup(req.query.position);
    const positions = SKATER_POSITION_GROUP_MAP[positionGroup];

    const categories: SkaterTrendResponse["categories"] = {};
    const playerIdsNeeded = new Set<number>();

    for (const category of SKATER_TREND_CATEGORIES) {
      const rows = await fetchMetricRows(
        category,
        seasonId,
        seasonStart,
        positions
      );
      const result = buildCategoryResult(rows, category, windowSize, limit);
      categories[category.id] = {
        series: result.series,
        rankings: result.rankings
      };
      result.includedPlayerIds.forEach((id) => playerIdsNeeded.add(id));
    }

    const playerMetadata = await fetchPlayerMetadata(
      Array.from(playerIdsNeeded)
    );

    const response: SkaterTrendResponse = {
      seasonId,
      generatedAt: new Date().toISOString(),
      positionGroup,
      limit,
      windowSize,
      categories,
      playerMetadata
    };

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
    return res.status(200).json(response);
  } catch (error: any) {
    console.error("skater-power API error", error);
    return res.status(500).json({
      message: "Failed to compute skater trends.",
      error: error?.message ?? "Unknown error"
    });
  }
}
