import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { getTeamAbbreviationById } from "lib/teamsInfo";
import {
  DEFAULT_GOALIE_LIMIT,
  DEFAULT_GOALIE_WINDOW,
  GOALIE_TREND_CATEGORIES,
  GOALIE_WINDOW_OPTIONS,
  MAX_GOALIE_LIMIT,
  type GoalieTrendCategoryDefinition,
  type GoalieTrendCategoryId,
  type GoalieWindowSize
} from "lib/trends/goalieMetricConfig";
import {
  buildRequestedDateServingState,
  type RequestedDateServingState
} from "lib/dashboard/freshness";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for goalie trend API.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

type GoalieTrendRow = {
  player_id: number;
  game_date: string;
  raw_value: number | null;
  rolling_avg_3: number | null;
  rolling_avg_5: number | null;
  rolling_avg_10: number | null;
  season_id: number | null;
};

type GoalieTrendPoint = {
  gameDate: string;
  rawValue: number;
  rollingAvg3: number | null;
  rollingAvg5: number | null;
  rollingAvg10: number | null;
  gp: number;
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

interface GoalieTrendResponse {
  seasonId: number;
  generatedAt: string;
  requestedDate: string;
  dateUsed: string;
  fallbackApplied: boolean;
  serving: RequestedDateServingState & {
    gapDays: number | null;
    severity: "none" | "warn" | "error";
    status: "requested_date" | "fallback_recent" | "degraded" | "blocked";
    message: string | null;
  };
  limit: number;
  windowSize: GoalieWindowSize;
  categories: Record<
    GoalieTrendCategoryId,
    Omit<CategoryResult, "includedPlayerIds">
  >;
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
const RESPONSE_TTL_MS = 60_000;
const RECENT_FALLBACK_MAX_DAYS = 3;
const BLOCKED_FALLBACK_MIN_DAYS = 14;
const responseCache = new Map<
  string,
  { expiresAt: number; payload: GoalieTrendResponse }
>();
const inFlight = new Map<string, Promise<GoalieTrendResponse>>();

function parseWindowSize(input: unknown): GoalieWindowSize {
  const candidate = Number(Array.isArray(input) ? input[0] : input);
  if (GOALIE_WINDOW_OPTIONS.includes(candidate as GoalieWindowSize)) {
    return candidate as GoalieWindowSize;
  }
  return DEFAULT_GOALIE_WINDOW;
}

function parseLimit(input: unknown): number {
  const candidate = Number(Array.isArray(input) ? input[0] : input);
  if (Number.isFinite(candidate) && candidate > 0) {
    return Math.min(Math.round(candidate), MAX_GOALIE_LIMIT);
  }
  return DEFAULT_GOALIE_LIMIT;
}

function diffDateOnlyDays(laterDate: string, earlierDate: string): number | null {
  const laterTs = Date.parse(`${laterDate}T00:00:00.000Z`);
  const earlierTs = Date.parse(`${earlierDate}T00:00:00.000Z`);
  if (!Number.isFinite(laterTs) || !Number.isFinite(earlierTs)) return null;
  return Math.max(0, Math.round((laterTs - earlierTs) / 86_400_000));
}

function buildGoalieServingContract(input: {
  requestedDate: string;
  resolvedDate: string;
}): GoalieTrendResponse["serving"] {
  const gapDays = diffDateOnlyDays(input.requestedDate, input.resolvedDate);
  const base = buildRequestedDateServingState({
    requestedDate: input.requestedDate,
    resolvedDate: input.resolvedDate,
    fallbackApplied: input.requestedDate !== input.resolvedDate,
    strategy:
      input.requestedDate === input.resolvedDate
        ? "requested_date"
        : "latest_available_with_data"
  });

  if (!base.fallbackApplied || gapDays == null || gapDays <= 0) {
    return {
      ...base,
      gapDays: gapDays ?? 0,
      severity: "none",
      status: "requested_date",
      message: null
    };
  }

  if (gapDays <= RECENT_FALLBACK_MAX_DAYS) {
    return {
      ...base,
      gapDays,
      severity: "warn",
      status: "fallback_recent",
      message: `Goalie movement is serving the nearest available scope date (${input.resolvedDate}), ${gapDays} day${gapDays === 1 ? "" : "s"} behind the requested dashboard date.`
    };
  }

  if (gapDays >= BLOCKED_FALLBACK_MIN_DAYS) {
    return {
      ...base,
      gapDays,
      severity: "error",
      status: "blocked",
      message: `Goalie movement fallback is materially stale: requested ${input.requestedDate}, but latest available scope is ${input.resolvedDate} (${gapDays} days old). Treat this module as degraded until fresher goalie trend rows exist.`
    };
  }

  return {
    ...base,
    gapDays,
    severity: "warn",
    status: "degraded",
    message: `Goalie movement is using stale fallback scope (${input.resolvedDate}), ${gapDays} days behind the requested dashboard date.`
  };
}

function computeTrailingAverage(
  list: GoalieTrendPoint[],
  index: number,
  sampleSize: number
): number | null {
  const values = list
    .slice(Math.max(0, index - sampleSize + 1), index + 1)
    .map((entry) => entry.rawValue)
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
  rows: GoalieTrendRow[],
  category: GoalieTrendCategoryDefinition,
  windowSize: GoalieWindowSize,
  limit: number
): CategoryResult {
  const byPlayer = new Map<number, GoalieTrendPoint[]>();

  rows.forEach((row) => {
    if (row.raw_value === null || row.raw_value === undefined) {
      return;
    }
    const rawValue = Number(row.raw_value);
    if (!Number.isFinite(rawValue)) return;

    if (!byPlayer.has(row.player_id)) {
      byPlayer.set(row.player_id, []);
    }

    byPlayer.get(row.player_id)!.push({
      gameDate: row.game_date,
      rawValue,
      rollingAvg3:
        row.rolling_avg_3 === null || row.rolling_avg_3 === undefined
          ? null
          : Number(row.rolling_avg_3),
      rollingAvg5:
        row.rolling_avg_5 === null || row.rolling_avg_5 === undefined
          ? null
          : Number(row.rolling_avg_5),
      rollingAvg10:
        row.rolling_avg_10 === null || row.rolling_avg_10 === undefined
          ? null
          : Number(row.rolling_avg_10),
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

      let value: number | null;
      switch (windowSize) {
        case 3:
          value = point.rollingAvg3 ?? computeTrailingAverage(list, gp - 1, 3);
          break;
        case 5:
          value = point.rollingAvg5 ?? computeTrailingAverage(list, gp - 1, 5);
          break;
        case 10:
          value =
            point.rollingAvg10 ?? computeTrailingAverage(list, gp - 1, 10);
          break;
        case 1:
        default:
          value = point.rawValue;
          break;
      }

      if (value === null || !Number.isFinite(value)) return;
      entries.push({ playerId, value });
    });

    if (!entries.length) continue;

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
      const sourceList = byPlayer.get(numericId);
      const latestValue =
        sourceList && sourceList.length > 0
          ? (() => {
              const latestPoint = sourceList[sourceList.length - 1];
              if (!latestPoint) return null;

              switch (windowSize) {
                case 3:
                  return (
                    latestPoint.rollingAvg3 ??
                    computeTrailingAverage(sourceList, sourceList.length - 1, 3)
                  );
                case 5:
                  return (
                    latestPoint.rollingAvg5 ??
                    computeTrailingAverage(sourceList, sourceList.length - 1, 5)
                  );
                case 10:
                  return (
                    latestPoint.rollingAvg10 ??
                    computeTrailingAverage(sourceList, sourceList.length - 1, 10)
                  );
                case 1:
                default:
                  return latestPoint.rawValue;
              }
            })()
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
  category: GoalieTrendCategoryDefinition,
  seasonId: number,
  seasonStart: string,
  asOfDate: string
): Promise<GoalieTrendRow[]> {
  const rows: GoalieTrendRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("player_trend_metrics")
      .select(
        "player_id, game_date, raw_value, rolling_avg_3, rolling_avg_5, rolling_avg_10, season_id"
      )
      .eq("metric_key", category.metricKey)
      .eq("metric_type", "goalie")
      .eq("season_id", seasonId)
      .gte("game_date", seasonStart)
      .lte("game_date", asOfDate)
      .order("player_id", { ascending: true })
      .order("game_date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Failed to load goalie trend data for ${category.metricKey}: ${error.message}`
      );
    }
    if (!data || data.length === 0) {
      break;
    }
    rows.push(...(data as GoalieTrendRow[]));
    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchPlayerMetadata(playerIds: number[]) {
  if (!playerIds.length) {
    return {};
  }

  const uniqueIds = Array.from(new Set(playerIds));
  const { data, error } = await supabase
    .from("players")
    .select("id, fullName, position, team_id, image_url")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`Failed to load goalie metadata: ${error.message}`);
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
          ? (getTeamAbbreviationById(player.team_id) ?? null)
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
    const limit = parseLimit(req.query.limit);
    const windowSize = parseWindowSize(req.query.window);
    const requestedDateRaw = String(
      Array.isArray(req.query.date) ? req.query.date[0] : req.query.date ?? ""
    ).trim();
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDateRaw)
      ? requestedDateRaw
      : new Date().toISOString().slice(0, 10);
    const cacheKey = `${windowSize}:${limit}:${requestedDate}`;
    const nowMs = Date.now();
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
      return res.status(200).json(cached.payload);
    }

    const pending = inFlight.get(cacheKey);
    if (pending) {
      const payload = await pending;
      res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
      return res.status(200).json(payload);
    }

    const loadPromise = (async () => {
      const season = await fetchCurrentSeason();
      const seasonId = season.id;
      const seasonStart = season.startDate;
      const categories: Partial<GoalieTrendResponse["categories"]> = {};
      const playerIdsNeeded = new Set<number>();
      let latestIncludedDate: string | null = null;

      for (const category of GOALIE_TREND_CATEGORIES) {
        const rows = await fetchMetricRows(
          category,
          seasonId,
          seasonStart,
          requestedDate
        );

        for (const row of rows) {
          if (
            typeof row.game_date === "string" &&
            row.game_date.length >= 10 &&
            (!latestIncludedDate || row.game_date > latestIncludedDate)
          ) {
            latestIncludedDate = row.game_date;
          }
        }

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
      const resolvedDate = latestIncludedDate ?? requestedDate;
      const serving = buildGoalieServingContract({
        requestedDate,
        resolvedDate
      });

      const response: GoalieTrendResponse = {
        seasonId,
        generatedAt: new Date().toISOString(),
        requestedDate,
        dateUsed: resolvedDate,
        fallbackApplied: serving.fallbackApplied,
        serving,
        limit,
        windowSize,
        categories: categories as GoalieTrendResponse["categories"],
        playerMetadata
      };

      responseCache.set(cacheKey, {
        payload: response,
        expiresAt: Date.now() + RESPONSE_TTL_MS
      });

      return response;
    })();

    inFlight.set(cacheKey, loadPromise);
    const response = await loadPromise;
    inFlight.delete(cacheKey);

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
    return res.status(200).json(response);
  } catch (error: any) {
    const limit = parseLimit(req.query.limit);
    const windowSize = parseWindowSize(req.query.window);
    return res.status(500).json({
      message: error?.message ?? "Failed to load goalie trend data",
      limit,
      windowSize
    });
  }
}
