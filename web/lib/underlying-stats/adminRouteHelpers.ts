import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import serviceRoleClient from "lib/supabase/server";
import { ingestNhlApiRawGamesBestEffort } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";

import {
  fetchSeasonGoalieSummaryGameIdSet,
} from "./goalieStatsSummaryRefresh";
import {
  fetchSeasonSummaryGameIdSet,
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
} from "./playerStatsSummaryRefresh";
import { fetchSeasonTeamSummaryGameIdSet } from "./teamStatsSummaryRefresh";

const SUPABASE_PAGE_SIZE = 1000;
const DEFAULT_DEPENDENCY_RETRIES = 3;
const DEFAULT_DEPENDENCY_RETRY_DELAY_MS = 750;

export type QueryValue = string | string[] | undefined;

type GameRow = {
  id: number | string | null;
  date: string | null;
  startTime?: string | null;
  type?: number | string | null;
};

export type RawIngestBatchResult = {
  aggregatedResults: Array<{
    gameId?: number;
    rosterCount: number;
    eventCount: number;
    shiftCount: number;
    rawEndpointsStored: number;
  }>;
  failures: Array<{ gameId: number; message: string }>;
  processedGameIds: number[];
  rawRowsUpserted: number;
  summaryRowsUpserted: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isRetryableDependencyError(error: unknown) {
  const normalized = normalizeDependencyError(error);
  if (
    normalized.classification === "transport_fetch_failure" ||
    normalized.classification === "html_upstream_response"
  ) {
    return true;
  }

  const raw = stringifyError(error).toLowerCase();
  return (
    raw.includes("http 500") ||
    raw.includes("http 502") ||
    raw.includes("http 503") ||
    raw.includes("http 504") ||
    raw.includes("und_err_socket") ||
    raw.includes("socketerror") ||
    raw.includes("fetch failed")
  );
}

export async function runWithDependencyRetry<T>(args: {
  label: string;
  operation: () => Promise<T>;
  retries?: number;
  retryDelayMs?: number;
}) {
  const retries = args.retries ?? DEFAULT_DEPENDENCY_RETRIES;
  const retryDelayMs = args.retryDelayMs ?? DEFAULT_DEPENDENCY_RETRY_DELAY_MS;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await args.operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableDependencyError(error)) {
        throw error;
      }

      console.warn(
        `[${args.label}] retrying after transient dependency failure`,
        {
          attempt,
          retries,
          error: stringifyError(error)
        }
      );
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

export function getSingleQueryValue(value: QueryValue): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export function isTruthyQueryFlag(value: QueryValue): boolean {
  const normalized = getSingleQueryValue(value)?.toLowerCase();
  return normalized != null && ["1", "true", "yes", "y", "all", "full"].includes(normalized);
}

export function parsePositiveInteger(value: QueryValue): number | null {
  const normalized = getSingleQueryValue(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

export function chunkGameIds(gameIds: readonly number[], batchSize: number) {
  const normalizedBatchSize = Math.max(1, batchSize);
  const chunks: number[][] = [];

  for (let index = 0; index < gameIds.length; index += normalizedBatchSize) {
    chunks.push(gameIds.slice(index, index + normalizedBatchSize));
  }

  return chunks;
}

export function inferRequestedGameType(args: {
  explicitGameType: QueryValue;
  gameIds: readonly number[];
}) {
  const explicit = Number(getSingleQueryValue(args.explicitGameType));
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.trunc(explicit);
  }

  const inferredGameTypes = new Set(
    args.gameIds
      .map((gameId) => String(gameId).slice(4, 6))
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
  );

  if (inferredGameTypes.size !== 1) {
    return null;
  }

  return [...inferredGameTypes][0] ?? null;
}

export async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>
): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const pageRows = (data ?? []) as TRow[];

    if (!pageRows.length) {
      break;
    }

    rows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

export async function fetchFinishedSeasonGameIds(args: {
  seasonId: number;
  requestedGameType?: number | null;
  supabase?: SupabaseClient;
}): Promise<number[]> {
  const supabase = args.supabase ?? serviceRoleClient;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const finishedCutoff = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  const rows = await fetchAllRows<GameRow>((from, to) =>
    ((query: any) => {
      if (args.requestedGameType != null) {
        return query.eq("type", args.requestedGameType);
      }

      return query;
    })(
      supabase
        .from("games")
        .select("id,date,startTime,seasonId,type")
        .eq("seasonId", args.seasonId)
        .lte("date", today)
        .order("date", { ascending: false })
        .order("id", { ascending: false })
    ).range(from, to)
  );

  return rows.flatMap<number>((row) => {
    const id = Number(row.id);
    const date = row.date;
    const startTime = row.startTime;

    if (!Number.isFinite(id)) return [];
    if (typeof date !== "string" || date >= today) return [];
    if (typeof startTime === "string" && new Date(startTime) > finishedCutoff) {
      return [];
    }

    return [id];
  });
}

export async function selectMissingPlayerSummaryGameIds(args: {
  seasonId: number;
  requestedGameType?: number | null;
  limit: number;
  supabase?: SupabaseClient;
}) {
  const supabase = args.supabase ?? serviceRoleClient;
  const [finishedGameIds, summaryGameIds] = await Promise.all([
    fetchFinishedSeasonGameIds({
      seasonId: args.seasonId,
      requestedGameType: args.requestedGameType,
      supabase,
    }),
    fetchSeasonSummaryGameIdSet({
      supabase,
      seasonId: args.seasonId,
      sourceUrlPrefix: PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
    }),
  ]);

  const missingGameIds: number[] = [];

  for (const gameId of finishedGameIds) {
    if (summaryGameIds.has(gameId)) {
      continue;
    }

    missingGameIds.push(gameId);

    if (missingGameIds.length >= args.limit) {
      break;
    }
  }

  return missingGameIds;
}

export async function selectMissingGoalieSummaryGameIds(args: {
  seasonId: number;
  requestedGameType?: number | null;
  limit: number;
  supabase?: SupabaseClient;
}) {
  const supabase = args.supabase ?? serviceRoleClient;
  const [finishedGameIds, summaryGameIds] = await Promise.all([
    fetchFinishedSeasonGameIds({
      seasonId: args.seasonId,
      requestedGameType: args.requestedGameType,
      supabase,
    }),
    fetchSeasonGoalieSummaryGameIdSet({
      supabase,
      seasonId: args.seasonId,
    }),
  ]);

  const missingGameIds: number[] = [];

  for (const gameId of finishedGameIds) {
    if (summaryGameIds.has(gameId)) {
      continue;
    }

    missingGameIds.push(gameId);

    if (missingGameIds.length >= args.limit) {
      break;
    }
  }

  return missingGameIds;
}

export async function selectMissingTeamSummaryGameIds(args: {
  seasonId: number;
  requestedGameType?: number | null;
  limit: number;
  supabase?: SupabaseClient;
}) {
  const supabase = args.supabase ?? serviceRoleClient;
  const [finishedGameIds, summaryGameIds] = await Promise.all([
    fetchFinishedSeasonGameIds({
      seasonId: args.seasonId,
      requestedGameType: args.requestedGameType,
      supabase
    }),
    fetchSeasonTeamSummaryGameIdSet({
      supabase,
      seasonId: args.seasonId
    })
  ]);

  const missingGameIds: number[] = [];

  for (const gameId of finishedGameIds) {
    if (summaryGameIds.has(gameId)) {
      continue;
    }

    missingGameIds.push(gameId);

    if (missingGameIds.length >= args.limit) {
      break;
    }
  }

  return missingGameIds;
}

function sumRowsAffected(results: Array<{
  rosterCount: number;
  eventCount: number;
  shiftCount: number;
  rawEndpointsStored: number;
}>) {
  return results.reduce(
    (total, result) =>
      total +
      result.rosterCount +
      result.eventCount +
      result.shiftCount +
      result.rawEndpointsStored,
    0
  );
}

export async function runRawIngestAndRefreshBatches(args: {
  gameIdBatches: readonly number[][];
  seasonId: number;
  requestedGameType: number | null;
  shouldWarmLandingCache: boolean;
  refreshSummaries: (args: {
    gameIds: readonly number[];
    seasonId: number;
    requestedGameType: number | null;
    shouldWarmLandingCache: boolean;
  }) => Promise<{ rowsUpserted: number }>;
}): Promise<RawIngestBatchResult> {
  const aggregatedResults: RawIngestBatchResult["aggregatedResults"] = [];
  const failures: RawIngestBatchResult["failures"] = [];
  const processedGameIds: number[] = [];
  let rawRowsUpserted = 0;
  let summaryRowsUpserted = 0;

  for (let batchIndex = 0; batchIndex < args.gameIdBatches.length; batchIndex += 1) {
    const batchGameIds = args.gameIdBatches[batchIndex] ?? [];
    const rawIngest = await ingestNhlApiRawGamesBestEffort(serviceRoleClient, batchGameIds);
    const rawResults = rawIngest.results;
    aggregatedResults.push(...rawResults);
    rawRowsUpserted += sumRowsAffected(rawResults);
    failures.push(...rawIngest.failures);

    const successfulGameIds = rawResults
      .map((result) => Number(result.gameId))
      .filter((gameId) => Number.isFinite(gameId));
    processedGameIds.push(...successfulGameIds);

    if (successfulGameIds.length === 0) {
      continue;
    }

    try {
      const summaryRefresh = await runWithDependencyRetry({
        label: "run-raw-ingest-and-refresh-batches.summary-refresh",
        operation: () =>
          args.refreshSummaries({
            gameIds: successfulGameIds,
            seasonId: args.seasonId,
            requestedGameType: args.requestedGameType,
            shouldWarmLandingCache:
              args.shouldWarmLandingCache &&
              batchIndex === args.gameIdBatches.length - 1
          })
      });

      summaryRowsUpserted += summaryRefresh.rowsUpserted;
    } catch (error) {
      const message = `summary refresh failed: ${stringifyError(error)}`;
      failures.push(
        ...successfulGameIds.map((gameId) => ({
          gameId,
          message
        }))
      );
    }
  }

  return {
    aggregatedResults,
    failures,
    processedGameIds,
    rawRowsUpserted,
    summaryRowsUpserted,
  };
}