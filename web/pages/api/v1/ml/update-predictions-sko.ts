import { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";
import serviceRoleClient from "lib/supabase/server";

type PlayerStatsRow = {
  player_id: number;
  date: string;
  points: number | null;
  games_played: number | null;
};

type PredictionsInsert =
  Database["public"]["Tables"]["predictions_sko"]["Insert"];

const DEFAULT_LOOKBACK_DAYS = 120;
const DEFAULT_STABILITY_WINDOW = 10;
const DEFAULT_HORIZON = 5;
const MAX_GAMES_PER_PLAYER = 60;
const UPSERT_BATCH_SIZE = 200;

// Removed admin-only middleware; this route now runs unauthenticated

function parseString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function parseNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePositiveInt(
  value: unknown,
  fallback?: number
): number | undefined {
  const parsed = parseNumber(value);
  if (parsed === undefined) return fallback;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
}

function parseIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function coalesceDate(value?: string): string {
  const iso = parseIsoDate(value);
  return iso ?? new Date().toISOString().slice(0, 10);
}

function parsePlayerIds(value: unknown): number[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return parsePlayerIds(value.join(","));
  }
  if (typeof value !== "string") return undefined;
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const ids = tokens
    .map((token) => Number(token))
    .filter((id) => Number.isInteger(id) && id > 0);
  return ids.length ? Array.from(new Set(ids)) : undefined;
}

function mean(values: number[]): number {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function stddev(values: number[]): number {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length < 2) return 0;
  const avg = mean(filtered);
  const variance = mean(filtered.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function smoothstepMultiplier(
  cv: number,
  t1: number,
  t2: number,
  min = 0.8,
  max = 1.0
): number {
  if (
    !Number.isFinite(cv) ||
    !Number.isFinite(t1) ||
    !Number.isFinite(t2) ||
    t2 <= t1
  ) {
    return 1;
  }
  const ratio = Math.max(0, Math.min(1, (cv - t1) / (t2 - t1)));
  const smooth = 3 * ratio ** 2 - 2 * ratio ** 3;
  const inverted = 1 - smooth;
  return min + (max - min) * inverted;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchPlayers(query: any, limit?: number): Promise<number[]> {
  const request = limit ? query.limit(limit) : query;
  const res = await request;
  const data = (res?.data ?? []) as Array<{
    player_id?: number | string | null;
  }>;
  const error = (res as any)?.error;
  if (error) throw error;
  const ids = data
    .map((row): number => Number(row.player_id))
    .filter((id): id is number => Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

async function fetchPlayerSeries(
  client: SupabaseClient<Database>,
  playerId: number,
  asOfDate: string,
  startDate: string
): Promise<PlayerStatsRow[]> {
  const { data, error } = await client
    .from("player_stats_unified")
    .select("player_id,date,points,games_played")
    .eq("player_id", playerId)
    .lte("date", asOfDate)
    .gte("date", startDate)
    .eq("games_played", 1)
    .order("date", { ascending: true })
    .limit(MAX_GAMES_PER_PLAYER);
  if (error) throw error;
  return (data as PlayerStatsRow[] | null) ?? [];
}

function buildPredictionRecord(
  playerId: number,
  asOfDate: string,
  horizon: number,
  pointsSeries: number[],
  stabilityWindow: number
): PredictionsInsert {
  const last5 = pointsSeries.slice(-5);
  const last10 = pointsSeries.slice(-10);
  const last20 = pointsSeries.slice(-20);

  const avg5 = mean(last5);
  const avg10 = mean(last10);
  const avg20 = mean(last20);
  const recentBlend = 0.6 * (avg10 || avg20) + 0.4 * (avg5 || avg10 || avg20);
  const predPoints = recentBlend * horizon;

  const stdevWindow =
    stabilityWindow > 0 ? pointsSeries.slice(-stabilityWindow) : pointsSeries;
  const stdevShort = stddev(stdevWindow);
  const stdevLong = stddev(last20);
  const t1 = Math.max(0, 0.8 * stdevLong);
  const t2 = Math.max(t1 + 1e-6, 1.2 * stdevLong);
  const stabilityMultiplier = smoothstepMultiplier(stdevShort, t1, t2);
  const sko = Number.isFinite(predPoints)
    ? predPoints * stabilityMultiplier
    : null;

  const predPerGame = Number.isFinite(predPoints) ? predPoints / horizon : null;

  return {
    player_id: playerId,
    as_of_date: asOfDate,
    horizon_games: horizon,
    pred_points: Number.isFinite(predPoints) ? predPoints : null,
    pred_points_per_game: predPerGame,
    stability_cv: Number.isFinite(stdevShort) ? stdevShort : null,
    stability_multiplier: Number.isFinite(stabilityMultiplier)
      ? stabilityMultiplier
      : null,
    sko: Number.isFinite(sko) ? sko : null,
    top_features: null,
    model_name: "baseline-moving-average",
    model_version: "v0.2"
  } satisfies PredictionsInsert;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const startWall = Date.now();
  const startHr = process.hrtime.bigint();
  const debugParam = (req.query?.debug ?? (req.body as any)?.debug) as
    | string
    | undefined;
  const debug = debugParam === "1" || debugParam === "true";

  const phases: Record<string, number> = {};
  const mark = (name: string) => {
    phases[name] = Date.now() - startWall;
  };

  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  // Use service role client directly (unauthenticated route)
  const admin = serviceRoleClient;

  try {
    const body =
      typeof req.body === "string" && req.body
        ? JSON.parse(req.body)
        : (req.body ?? {});
    const queryAccessor = (key: string) => body?.[key] ?? req.query?.[key];

    const asOfDate = coalesceDate(parseString(queryAccessor("asOfDate")));
    const horizon =
      parsePositiveInt(queryAccessor("horizon"), DEFAULT_HORIZON) ??
      DEFAULT_HORIZON;
    const lookbackDays =
      parsePositiveInt(queryAccessor("lookbackDays"), DEFAULT_LOOKBACK_DAYS) ??
      DEFAULT_LOOKBACK_DAYS;
    const stabilityWindow =
      parsePositiveInt(
        queryAccessor("stabilityWindow"),
        DEFAULT_STABILITY_WINDOW
      ) ?? DEFAULT_STABILITY_WINDOW;
    const batchSize =
      parsePositiveInt(
        queryAccessor("batchSize") ?? queryAccessor("limitPlayers")
      ) ?? undefined;
    const seasonCutoff = parseIsoDate(
      parseString(queryAccessor("seasonCutoff"))
    );
    const playerIdsFilter =
      parsePlayerIds(queryAccessor("playerId")) ??
      parsePlayerIds(queryAccessor("playerIds"));

    const startDate = new Date(asOfDate);
    startDate.setDate(startDate.getDate() - lookbackDays);
    const lookbackStartIso = startDate.toISOString().slice(0, 10);
    const effectiveStartIso =
      seasonCutoff && seasonCutoff > lookbackStartIso
        ? seasonCutoff
        : lookbackStartIso;

    let playerIds: number[];
    if (playerIdsFilter?.length) {
      playerIds = playerIdsFilter;
    } else {
      const baseQuery = admin
        .from("player_stats_unified")
        .select("player_id")
        .lte("date", asOfDate)
        .gte("date", effectiveStartIso)
        .eq("games_played", 1)
        .not("player_id", "is", null)
        .order("player_id", { ascending: true });
      playerIds = await fetchPlayers(baseQuery, batchSize);
    }
    mark("phase_player_discovery");

    if (!playerIds.length) {
      const totalMsEmpty = Number(
        (process.hrtime.bigint() - startHr) / BigInt(1_000_000)
      );
      phases.total = totalMsEmpty;
      return res.status(200).json({
        success: true,
        asOfDate,
        horizon,
        players: 0,
        upserts: 0,
        duration: `${(totalMsEmpty / 1000).toFixed(2)}s`,
        message: `No eligible skaters found for ${asOfDate}`,
        ...(debug ? { timings: phases } : {})
      });
    }

    if (batchSize && playerIds.length > batchSize) {
      playerIds = playerIds.slice(0, batchSize);
    }

    const predictionRecords: PredictionsInsert[] = [];
    let playerSeriesQueries = 0;
    let totalSeriesFetchMs = 0;
    let totalProcessMs = 0;
    let maxSeriesLength = 0;
    let minSeriesLength = Number.POSITIVE_INFINITY;
    const PROGRESS_INTERVAL = 50;

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      const fetchStart = Date.now();
      const series = await fetchPlayerSeries(
        admin,
        playerId,
        asOfDate,
        effectiveStartIso
      );
      const fetchEnd = Date.now();
      playerSeriesQueries += 1;
      totalSeriesFetchMs += fetchEnd - fetchStart;
      if (!series.length) continue;
      const processStart = Date.now();
      const pointsSeries = series.map((row) => Number(row.points ?? 0));
      maxSeriesLength = Math.max(maxSeriesLength, pointsSeries.length);
      minSeriesLength = Math.min(minSeriesLength, pointsSeries.length);
      const record = buildPredictionRecord(
        playerId,
        asOfDate,
        horizon,
        pointsSeries,
        stabilityWindow
      );
      predictionRecords.push(record);
      totalProcessMs += Date.now() - processStart;

      if (debug && (i + 1) % PROGRESS_INTERVAL === 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[update-predictions-sko] progress ${i + 1}/${playerIds.length} avgFetchMs=${(
            totalSeriesFetchMs / playerSeriesQueries
          ).toFixed(2)} avgProcessMs=${(
            totalProcessMs / playerSeriesQueries
          ).toFixed(2)}`
        );
      }
    }
    mark("phase_series_and_build");

    let upserts = 0;
    const batchDurations: number[] = [];
    for (const batch of chunk(predictionRecords, UPSERT_BATCH_SIZE)) {
      if (!batch.length) continue;
      const bStart = Date.now();
      const { error } = await admin
        .from("predictions_sko")
        .upsert(batch, { onConflict: "player_id,as_of_date,horizon_games" });
      if (error) throw error;
      upserts += batch.length;
      batchDurations.push(Date.now() - bStart);
    }
    mark("phase_upserts");

    const totalMs = Number(
      (process.hrtime.bigint() - startHr) / BigInt(1_000_000)
    );
    phases.total = totalMs;
    phases.avg_player_fetch_ms = playerSeriesQueries
      ? Number((totalSeriesFetchMs / playerSeriesQueries).toFixed(2))
      : 0;
    phases.avg_player_process_ms = playerSeriesQueries
      ? Number((totalProcessMs / playerSeriesQueries).toFixed(2))
      : 0;
    phases.max_series_len = maxSeriesLength;
    phases.min_series_len =
      minSeriesLength === Number.POSITIVE_INFINITY ? 0 : minSeriesLength;
    phases.upsert_batches = batchDurations.length;
    phases.avg_upsert_batch_ms = batchDurations.length
      ? Number(
          (
            batchDurations.reduce((a, b) => a + b, 0) / batchDurations.length
          ).toFixed(2)
        )
      : 0;

    // Server log summary
    // eslint-disable-next-line no-console
    console.log(
      `[update-predictions-sko] completed players=${playerIds.length} upserts=${upserts} totalMs=${totalMs} avgFetchMs=${phases.avg_player_fetch_ms} avgProcessMs=${phases.avg_player_process_ms} batches=${batchDurations.length}`
    );

    res.setHeader("X-Execution-Time-ms", String(totalMs));
    const durationSec = (totalMs / 1000).toFixed(2);
    return res.status(200).json({
      success: true,
      asOfDate,
      horizon,
      players: playerIds.length,
      upserts,
      duration: `${durationSec}s`,
      message: `Refreshed sKO predictions for ${playerIds.length} skaters (${upserts} rows) as of ${asOfDate} in ${durationSec}s`,
      ...(debug ? { timings: phases } : {})
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("update-predictions-sko error", error?.message ?? error);
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Unexpected error"
    });
  }
};

export default handler;
