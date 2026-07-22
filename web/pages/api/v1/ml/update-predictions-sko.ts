import { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { Database } from "lib/supabase/database-generated.types";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import {
  assertPredictionsSkoPrerequisites,
  isPredictionsSkoDependencyError,
} from "lib/ml/predictionsSkoDependencyChecks";
import adminOnly from "utils/adminOnlyMiddleware";

/**
 * Query params:
 * - asOfDate: optional YYYY-MM-DD; defaults to today.
 * - horizon: optional positive integer; defaults to 5.
 * - lookbackDays: optional positive integer; defaults to 120.
 * - stabilityWindow: optional positive integer; defaults to 10.
 * - batchSize / limitPlayers: optional positive integer limit.
 * - seasonCutoff: optional YYYY-MM-DD lower bound.
 * - playerId / playerIds: optional targeted player ids.
 * - debug: optional truthy flag for timings.
 *
 * Cron-safe static URL:
 * - /api/v1/ml/update-predictions-sko
 */

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
const PLAYER_DISCOVERY_PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 200;
const MODEL_NAME = "baseline-moving-average";
const MODEL_VERSION = "v0.2";

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
  fallback?: number,
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
  max = 1.0,
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

type PlayerDiscoveryPage = {
  data: Array<{ player_id?: number | string | null }> | null;
  error: unknown;
};

export async function fetchPlayerIdsPaginated(
  loadPage: (from: number, to: number) => PromiseLike<PlayerDiscoveryPage>,
  pageSize = PLAYER_DISCOVERY_PAGE_SIZE,
): Promise<{ playerIds: number[]; pages: number; rowsScanned: number }> {
  const playerIds = new Set<number>();
  let pages = 0;
  let rowsScanned = 0;

  for (let from = 0; ; from += pageSize) {
    const res = await loadPage(from, from + pageSize - 1);
    const data = (res?.data ?? []) as Array<{
      player_id?: number | string | null;
    }>;
    if (res?.error) throw res.error;
    pages += 1;
    rowsScanned += data.length;
    for (const row of data) {
      const playerId = Number(row.player_id);
      if (Number.isInteger(playerId) && playerId > 0) playerIds.add(playerId);
    }
    if (data.length < pageSize) break;
  }

  return {
    playerIds: Array.from(playerIds).sort((a, b) => a - b),
    pages,
    rowsScanned,
  };
}

export async function fetchPlayerSeries(
  client: SupabaseClient<Database>,
  playerId: number,
  asOfDate: string,
  startDate: string,
): Promise<PlayerStatsRow[]> {
  const { data, error } = await client
    .from("player_stats_unified")
    .select("player_id,date,points,games_played")
    .eq("player_id", playerId)
    .lte("date", asOfDate)
    .gte("date", startDate)
    .eq("games_played", 1)
    .order("date", { ascending: false })
    .limit(MAX_GAMES_PER_PLAYER);
  if (error) throw error;
  return ((data as PlayerStatsRow[] | null) ?? []).slice().reverse();
}

function sourceLagDays(asOfDate: string, latestSourceDate: string | null) {
  if (!latestSourceDate) return null;
  return Math.round(
    (Date.parse(`${asOfDate}T00:00:00Z`) -
      Date.parse(`${latestSourceDate}T00:00:00Z`)) /
      86_400_000,
  );
}

type PredictionRunDiagnostics = {
  partial: boolean;
  model: { name: string; version: string };
  coverage: {
    discoveredPlayers: number;
    selectedPlayers: number;
    processedPlayers: number;
    skippedNoSeries: number;
    discoveryPages: number;
    discoveryRows: number;
    sourceRows: number;
    minSeriesLength: number;
    maxSeriesLength: number;
  };
  source: {
    requestedAsOfDate: string;
    lookbackStartDate: string;
    earliestDate: string | null;
    latestDate: string | null;
    lagDays: number | null;
  };
  write: {
    attemptedRows: number;
    upsertedRows: number;
    batchesCompleted: number;
    partial: boolean;
  };
};

function emptyDiagnostics(
  asOfDate: string,
  lookbackStartDate: string,
): PredictionRunDiagnostics {
  return {
    partial: false,
    model: { name: MODEL_NAME, version: MODEL_VERSION },
    coverage: {
      discoveredPlayers: 0,
      selectedPlayers: 0,
      processedPlayers: 0,
      skippedNoSeries: 0,
      discoveryPages: 0,
      discoveryRows: 0,
      sourceRows: 0,
      minSeriesLength: 0,
      maxSeriesLength: 0,
    },
    source: {
      requestedAsOfDate: asOfDate,
      lookbackStartDate,
      earliestDate: null,
      latestDate: null,
      lagDays: null,
    },
    write: {
      attemptedRows: 0,
      upsertedRows: 0,
      batchesCompleted: 0,
      partial: false,
    },
  };
}

function buildPredictionRecord(
  playerId: number,
  asOfDate: string,
  horizon: number,
  pointsSeries: number[],
  stabilityWindow: number,
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
    model_name: MODEL_NAME,
    model_version: MODEL_VERSION,
  } satisfies PredictionsInsert;
}

type RequestWithSupabase = NextApiRequest & {
  supabase: SupabaseClient<Database>;
};

const handler = async (req: RequestWithSupabase, res: NextApiResponse) => {
  const startWall = Date.now();
  const startHr = process.hrtime.bigint();
  const debugParam = (req.query?.debug ?? (req.body as any)?.debug) as
    | string
    | undefined;
  const debug = debugParam === "1" || debugParam === "true";

  const phases: Record<string, number> = {};
  let runDiagnostics: PredictionRunDiagnostics | null = null;
  const mark = (name: string) => {
    phases[name] = Date.now() - startWall;
  };

  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const admin = req.supabase;

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
        DEFAULT_STABILITY_WINDOW,
      ) ?? DEFAULT_STABILITY_WINDOW;
    const batchSize =
      parsePositiveInt(
        queryAccessor("batchSize") ?? queryAccessor("limitPlayers"),
      ) ?? undefined;
    const seasonCutoff = parseIsoDate(
      parseString(queryAccessor("seasonCutoff")),
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
    runDiagnostics = emptyDiagnostics(asOfDate, effectiveStartIso);

    await assertPredictionsSkoPrerequisites({
      asOfDate,
      startDate: effectiveStartIso,
    });

    let discoveredPlayerIds: number[];
    if (playerIdsFilter?.length) {
      discoveredPlayerIds = playerIdsFilter;
    } else {
      const discovery = await fetchPlayerIdsPaginated((from, to) =>
        admin
          .from("player_stats_unified")
          .select("player_id,date")
          .lte("date", asOfDate)
          .gte("date", effectiveStartIso)
          .eq("games_played", 1)
          .not("player_id", "is", null)
          .order("player_id", { ascending: true })
          .order("date", { ascending: true })
          .range(from, to),
      );
      discoveredPlayerIds = discovery.playerIds;
      runDiagnostics.coverage.discoveryPages = discovery.pages;
      runDiagnostics.coverage.discoveryRows = discovery.rowsScanned;
    }
    runDiagnostics.coverage.discoveredPlayers = discoveredPlayerIds.length;
    const playerIds = batchSize
      ? discoveredPlayerIds.slice(0, batchSize)
      : discoveredPlayerIds;
    runDiagnostics.coverage.selectedPlayers = playerIds.length;
    runDiagnostics.partial = playerIds.length < discoveredPlayerIds.length;
    mark("phase_player_discovery");

    if (!playerIds.length) {
      const totalMsEmpty = Number(
        (process.hrtime.bigint() - startHr) / BigInt(1_000_000),
      );
      phases.total = totalMsEmpty;
      return res.status(200).json({
        success: true,
        asOfDate,
        horizon,
        players: 0,
        upserts: 0,
        ...runDiagnostics,
        duration: `${(totalMsEmpty / 1000).toFixed(2)}s`,
        message: `No eligible skaters found for ${asOfDate}`,
        ...(debug ? { timings: phases } : {}),
      });
    }

    const predictionRecords: PredictionsInsert[] = [];
    let playerSeriesQueries = 0;
    let totalSeriesFetchMs = 0;
    let totalProcessMs = 0;
    let maxSeriesLength = 0;
    let minSeriesLength = Number.POSITIVE_INFINITY;
    let skippedNoSeries = 0;
    let sourceRows = 0;
    let earliestSourceDate: string | null = null;
    let latestSourceDate: string | null = null;
    const PROGRESS_INTERVAL = 50;

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      const fetchStart = Date.now();
      const series = await fetchPlayerSeries(
        admin,
        playerId,
        asOfDate,
        effectiveStartIso,
      );
      const fetchEnd = Date.now();
      playerSeriesQueries += 1;
      totalSeriesFetchMs += fetchEnd - fetchStart;
      if (!series.length) {
        skippedNoSeries += 1;
        continue;
      }
      const processStart = Date.now();
      const pointsSeries = series.map((row) => Number(row.points ?? 0));
      sourceRows += series.length;
      const seriesEarliestDate = series[0]?.date ?? null;
      const seriesLatestDate = series[series.length - 1]?.date ?? null;
      if (
        seriesEarliestDate &&
        (!earliestSourceDate || seriesEarliestDate < earliestSourceDate)
      ) {
        earliestSourceDate = seriesEarliestDate;
      }
      if (
        seriesLatestDate &&
        (!latestSourceDate || seriesLatestDate > latestSourceDate)
      ) {
        latestSourceDate = seriesLatestDate;
      }
      maxSeriesLength = Math.max(maxSeriesLength, pointsSeries.length);
      minSeriesLength = Math.min(minSeriesLength, pointsSeries.length);
      const record = buildPredictionRecord(
        playerId,
        asOfDate,
        horizon,
        pointsSeries,
        stabilityWindow,
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
          ).toFixed(2)}`,
        );
      }
    }
    runDiagnostics.coverage.processedPlayers = predictionRecords.length;
    runDiagnostics.coverage.skippedNoSeries = skippedNoSeries;
    runDiagnostics.coverage.sourceRows = sourceRows;
    runDiagnostics.coverage.maxSeriesLength = maxSeriesLength;
    runDiagnostics.coverage.minSeriesLength =
      minSeriesLength === Number.POSITIVE_INFINITY ? 0 : minSeriesLength;
    runDiagnostics.source.earliestDate = earliestSourceDate;
    runDiagnostics.source.latestDate = latestSourceDate;
    runDiagnostics.source.lagDays = sourceLagDays(asOfDate, latestSourceDate);
    runDiagnostics.write.attemptedRows = predictionRecords.length;
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
      runDiagnostics.write.upsertedRows = upserts;
      runDiagnostics.write.batchesCompleted = batchDurations.length;
    }
    mark("phase_upserts");

    const totalMs = Number(
      (process.hrtime.bigint() - startHr) / BigInt(1_000_000),
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
          ).toFixed(2),
        )
      : 0;

    // Server log summary
    // eslint-disable-next-line no-console
    console.log(
      `[update-predictions-sko] completed players=${playerIds.length} upserts=${upserts} totalMs=${totalMs} avgFetchMs=${phases.avg_player_fetch_ms} avgProcessMs=${phases.avg_player_process_ms} batches=${batchDurations.length}`,
    );

    res.setHeader("X-Execution-Time-ms", String(totalMs));
    const durationSec = (totalMs / 1000).toFixed(2);
    return res.status(200).json({
      success: true,
      asOfDate,
      horizon,
      players: playerIds.length,
      upserts,
      rowsUpserted: upserts,
      ...runDiagnostics,
      duration: `${durationSec}s`,
      message: `Refreshed sKO predictions for ${playerIds.length} skaters (${upserts} rows) as of ${asOfDate} in ${durationSec}s`,
      ...(debug ? { timings: phases } : {}),
    });
  } catch (error: any) {
    if (isPredictionsSkoDependencyError(error)) {
      return res.status(error.statusCode).json({
        success: false,
        rowsUpserted: 0,
        message: error.issue.message,
        prerequisite: error.issue,
        dependencyError: {
          kind: "dependency_error",
          source: "unknown",
          classification: "structured_upstream_error",
          message: error.issue.message,
          detail: error.issue.detail,
          htmlLike: false,
        },
      });
    }
    const dependencyError = normalizeDependencyError(error);
    if (runDiagnostics) {
      runDiagnostics.partial = true;
      runDiagnostics.write.partial =
        runDiagnostics.write.upsertedRows < runDiagnostics.write.attemptedRows;
    }
    // eslint-disable-next-line no-console
    console.error("update-predictions-sko error", error?.message ?? error);
    return res.status(500).json({
      success: false,
      rowsUpserted: runDiagnostics?.write.upsertedRows ?? 0,
      message: dependencyError.message,
      dependencyError,
      ...(runDiagnostics ?? {}),
    });
  }
};

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "update-predictions-sko",
});
