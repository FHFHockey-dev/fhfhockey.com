import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason } from "lib/NHL/server";
import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import { buildShotFeatureRows, type NhlShotFeatureRow } from "lib/supabase/Upserts/nhlShotFeatureBuilder";
import type { ParsedNhlPbpEvent } from "lib/supabase/Upserts/nhlPlayByPlayParser";
import { enrichShotRowsWithPersistedTrainingContext } from "lib/xg/shotFeatureEnrichment";
import { withXgExecutionLeaseApi } from "lib/xg/executionLease";
import { upsertXgShotFeatureRows } from "lib/xg/shotFeaturePersistence";

type GameRow = {
  id: number;
  seasonId: number | null;
  date: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
};

type PbpEventRow = Database["public"]["Tables"]["nhl_api_pbp_events"]["Row"];
type ShiftRow = Database["public"]["Tables"]["nhl_api_shift_rows"]["Row"];

const PAGE_SIZE = 1000;
const BACKFILL_GAME_PAGE_SIZE = 100;
const DEFAULT_GAME_BATCH_SIZE = 1;
const DEFAULT_UPSERT_BATCH_SIZE = 500;
let activeXgShotFeatureRun: { startedAt: string; url: string | null } | null = null;

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseQueryFlag(value: string | string[] | undefined): boolean {
  const normalized = firstQueryValue(value)?.toLowerCase();
  return normalized != null && ["1", "true", "yes", "y", "all", "full"].includes(normalized);
}

function parseGameTypes(query: NextApiRequest["query"]): number[] | null {
  const raw = firstQueryValue(query.gameTypes) ?? firstQueryValue(query.gameType);
  if (!raw) return [2, 3];
  if (["all", "full"].includes(raw.toLowerCase())) return null;

  const values = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length ? values : [2, 3];
}

function isIsoDate(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function chunkNumbers(values: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function groupByGameId<T extends { game_id: number | null }>(rows: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    if (typeof row.game_id !== "number") continue;
    const current = grouped.get(row.game_id) ?? [];
    current.push(row);
    grouped.set(row.game_id, current);
  }
  return grouped;
}

async function resolveSeasonId(query: NextApiRequest["query"]): Promise<number> {
  const explicit = parsePositiveInteger(firstQueryValue(query.seasonId));
  if (explicit != null) return explicit;
  const season = await getCurrentSeason();
  return season.seasonId;
}

async function fetchGameIdsForDateRange(args: {
  seasonId: number;
  startDate: string;
  endDate: string;
  limit: number | null;
}): Promise<number[]> {
  let query = supabase
    .from("games")
    .select("id")
    .eq("seasonId", args.seasonId)
    .gte("date", args.startDate)
    .lte("date", args.endDate)
    .order("date", { ascending: true })
    .order("id", { ascending: true });

  if (args.limit != null) {
    query = query.limit(args.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to select date-range games: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));
}

async function fetchExistingFeatureGameIds(
  gameIds: number[],
  featureVersion: number
): Promise<Set<number>> {
  const existing = new Set<number>();
  if (gameIds.length === 0) return existing;

  for (const chunk of chunkNumbers(gameIds, 20)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("nhl_xg_shot_features" as any)
        .select("game_id")
        .eq("feature_version", featureVersion)
        .in("game_id", chunk)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Failed to check existing nhl_xg_shot_features: ${error.message}`);
      }

      if (!data?.length) break;
      for (const row of data as unknown as Array<{ game_id: number | string | null }>) {
        const gameId = Number(row.game_id);
        if (Number.isFinite(gameId)) existing.add(gameId);
      }
      if (data.length < PAGE_SIZE) break;
    }
  }

  return existing;
}

async function fetchBackfillGamePage(args: {
  seasonId: number;
  today: string;
  gameTypes: number[] | null;
  from: number;
  to: number;
}): Promise<number[]> {
  let query = supabase
    .from("games")
    .select("id")
    .eq("seasonId", args.seasonId)
    .lt("date", args.today);

  if (args.gameTypes != null) {
    query = query.in("type", args.gameTypes);
  }

  const { data, error } = await query
    .order("date", { ascending: true })
    .order("id", { ascending: true })
    .range(args.from, args.to);

  if (error) {
    throw new Error(`Failed to select xG shot-feature backfill games: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));
}

async function hasNormalizedPbpRows(args: {
  gameId: number;
  parserVersion: number;
  strengthVersion: number;
}): Promise<boolean> {
  const { data, error } = await supabase
    .from("nhl_api_pbp_events")
    .select("game_id")
    .eq("game_id", args.gameId)
    .eq("parser_version", args.parserVersion)
    .eq("strength_version", args.strengthVersion)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check normalized PBP coverage: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}

async function selectBackfillGameIds(args: {
  seasonId: number;
  featureVersion: number;
  parserVersion: number;
  strengthVersion: number;
  limit: number | null;
  force: boolean;
  gameTypes: number[] | null;
}): Promise<number[]> {
  const today = new Date().toISOString().slice(0, 10);
  const selected: number[] = [];

  for (
    let from = 0;
    args.limit == null || selected.length < args.limit;
    from += BACKFILL_GAME_PAGE_SIZE
  ) {
    const pageGameIds = await fetchBackfillGamePage({
      seasonId: args.seasonId,
      today,
      gameTypes: args.gameTypes,
      from,
      to: from + BACKFILL_GAME_PAGE_SIZE - 1
    });

    if (pageGameIds.length === 0) break;

    const existingGameIds = args.force
      ? new Set<number>()
      : await fetchExistingFeatureGameIds(pageGameIds, args.featureVersion);

    for (const gameId of pageGameIds) {
      if (existingGameIds.has(gameId)) continue;
      if (
        !(await hasNormalizedPbpRows({
          gameId,
          parserVersion: args.parserVersion,
          strengthVersion: args.strengthVersion
        }))
      ) {
        continue;
      }
      selected.push(gameId);
      if (args.limit != null && selected.length >= args.limit) break;
    }

    if (pageGameIds.length < BACKFILL_GAME_PAGE_SIZE) break;
  }

  return selected;
}

async function resolveRequestedXgShotFeatureGameIds(
  query: NextApiRequest["query"],
  featureVersion: number,
  parserVersion: number,
  strengthVersion: number
): Promise<{
  mode: "game" | "date_range" | "backfill_batch";
  seasonId: number;
  gameIds: number[];
}> {
  const seasonId = await resolveSeasonId(query);
  const explicitGameId = parsePositiveInteger(firstQueryValue(query.gameId));
  const startDate = firstQueryValue(query.startDate);
  const endDate = firstQueryValue(query.endDate);
  const limit = parsePositiveInteger(firstQueryValue(query.limit));
  const backfill = parseQueryFlag(query.backfill) || parseQueryFlag(query.games);

  if (explicitGameId != null) {
    return { mode: "game", seasonId, gameIds: [explicitGameId] };
  }

  if (isIsoDate(startDate) && isIsoDate(endDate)) {
    return {
      mode: "date_range",
      seasonId,
      gameIds: await fetchGameIdsForDateRange({
        seasonId,
        startDate,
        endDate,
        limit
      })
    };
  }

  if (backfill) {
    return {
      mode: "backfill_batch",
      seasonId,
      gameIds: await selectBackfillGameIds({
        seasonId,
        featureVersion,
        parserVersion,
        strengthVersion,
        limit,
        force: parseQueryFlag(query.force),
        gameTypes: parseGameTypes(query)
      })
    };
  }

  throw new Error(
    "Provide gameId, startDate+endDate, or backfill=true (optionally with seasonId, limit, and force=true)."
  );
}

async function fetchGames(gameIds: number[]): Promise<GameRow[]> {
  if (gameIds.length === 0) return [];

  const { data, error } = await supabase
    .from("games")
    .select("id, seasonId, date, homeTeamId, awayTeamId")
    .in("id", gameIds)
    .order("date", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch games: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => ({
      id: Number(row.id),
      seasonId: typeof row.seasonId === "number" ? row.seasonId : null,
      date: row.date ?? null,
      homeTeamId: typeof row.homeTeamId === "number" ? row.homeTeamId : null,
      awayTeamId: typeof row.awayTeamId === "number" ? row.awayTeamId : null
    }))
    .filter((row) => Number.isFinite(row.id));
}

async function fetchPbpRows(
  gameIds: number[],
  parserVersion: number,
  strengthVersion: number
): Promise<PbpEventRow[]> {
  const rows: PbpEventRow[] = [];

  for (const chunk of chunkNumbers(gameIds, 20)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("nhl_api_pbp_events")
        .select("*")
        .in("game_id", chunk)
        .eq("parser_version", parserVersion)
        .eq("strength_version", strengthVersion)
        .order("game_id", { ascending: true })
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("event_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Failed to fetch nhl_api_pbp_events: ${error.message}`);
      }

      if (!data?.length) break;
      rows.push(...(data as PbpEventRow[]));
      if (data.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

async function fetchShiftRows(
  gameIds: number[],
  parserVersion: number
): Promise<ShiftRow[]> {
  const rows: ShiftRow[] = [];

  for (const chunk of chunkNumbers(gameIds, 20)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("nhl_api_shift_rows")
        .select("*")
        .in("game_id", chunk)
        .eq("parser_version", parserVersion)
        .order("game_id", { ascending: true })
        .order("period", { ascending: true, nullsFirst: false })
        .order("start_seconds", { ascending: true, nullsFirst: false })
        .order("shift_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Failed to fetch nhl_api_shift_rows: ${error.message}`);
      }

      if (!data?.length) break;
      rows.push(...(data as ShiftRow[]));
      if (data.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (activeXgShotFeatureRun != null) {
    return res.status(409).json({
      success: false,
      error: "update-nhl-xg-shot-features is already running in this server process",
      activeRun: activeXgShotFeatureRun
    });
  }

  activeXgShotFeatureRun = {
    startedAt: new Date().toISOString(),
    url: req.url ?? null
  };

  try {
  const parserVersion = parseInteger(firstQueryValue(req.query.parserVersion), 1);
  const strengthVersion = parseInteger(firstQueryValue(req.query.strengthVersion), 1);
  const featureVersion = parseInteger(firstQueryValue(req.query.featureVersion), 1);
  const gameBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.gameBatchSize), DEFAULT_GAME_BATCH_SIZE)
  );
  const upsertBatchSize = Math.max(
    1,
    parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
  );
  const selection = await resolveRequestedXgShotFeatureGameIds(
    req.query,
    featureVersion,
    parserVersion,
    strengthVersion
  );
  const gameIds = selection.gameIds;

  if (gameIds.length === 0) {
    return res.status(200).json({
      success: true,
      mode: selection.mode,
      seasonId: selection.seasonId,
      requestedGameCount: selection.gameIds.length,
      processedGameCount: 0,
      rowsUpserted: 0,
      message: "No matching games were available for xG shot-feature materialization."
    });
  }

  const skippedGames: Array<{ gameId: number; reason: string }> = [];
  let rowsBuilt = 0;
  let rowsUpserted = 0;
  let processedGameCount = 0;
  const counts = {
    unblockedTrainingEligible: 0,
    goals: 0,
    rebounds: 0,
    reboundCreators: 0,
    rushShots: 0
  };

  for (const gameIdBatch of chunkNumbers(gameIds, gameBatchSize)) {
    const games = await fetchGames(gameIdBatch);
    const [pbpRows, shiftRows] = await Promise.all([
      fetchPbpRows(gameIdBatch, parserVersion, strengthVersion),
      fetchShiftRows(gameIdBatch, parserVersion)
    ]);
    const pbpByGameId = groupByGameId(pbpRows.map((row) => ({ ...row, game_id: row.game_id })));
    const shiftByGameId = groupByGameId(shiftRows.map((row) => ({ ...row, game_id: row.game_id })));
    const baseShotRows: NhlShotFeatureRow[] = [];

    for (const game of games) {
      if (game.homeTeamId == null || game.awayTeamId == null) {
        skippedGames.push({ gameId: game.id, reason: "missing_home_or_away_team" });
        continue;
      }

      const events = (pbpByGameId.get(game.id) ?? []) as unknown as ParsedNhlPbpEvent[];
      if (events.length === 0) {
        skippedGames.push({ gameId: game.id, reason: "missing_normalized_pbp_events" });
        continue;
      }

      processedGameCount += 1;
      baseShotRows.push(
        ...buildShotFeatureRows(
          events,
          shiftByGameId.get(game.id) ?? [],
          game.homeTeamId,
          game.awayTeamId,
          { featureVersion }
        )
      );
    }

    const shotRows = await enrichShotRowsWithPersistedTrainingContext({
      supabase,
      shotRows: baseShotRows,
      shiftRows,
      seasonId: selection.seasonId
    });

    rowsBuilt += shotRows.length;
    rowsUpserted += await upsertXgShotFeatureRows(supabase, shotRows, {
      batchSize: upsertBatchSize
    });

    counts.unblockedTrainingEligible += shotRows.filter(
      (row) =>
        row.isUnblockedShotAttempt &&
        !row.isPenaltyShotEvent &&
        !row.isShootoutEvent
    ).length;
    counts.goals += shotRows.filter((row) => row.isGoal).length;
    counts.rebounds += shotRows.filter((row) => row.isReboundShot).length;
    counts.reboundCreators += shotRows.filter((row) => row.createsRebound).length;
    counts.rushShots += shotRows.filter((row) => row.isRushShot).length;
  }

  return res.status(200).json({
    success: true,
    mode: selection.mode,
    seasonId: selection.seasonId,
    parserVersion,
    strengthVersion,
    featureVersion,
    requestedGameCount: selection.gameIds.length,
    processedGameCount,
    rowsBuilt,
    rowsUpserted,
    skippedGames,
    batches: {
      gameBatchSize,
      upsertBatchSize
    },
    counts
  });
  } finally {
    activeXgShotFeatureRun = null;
  }
}

export default withCronJobAudit(withXgExecutionLeaseApi(handler, {
  leaseKey: "xg:shot-features",
  ttlSeconds: 1800
}), {
  jobName: "update-nhl-xg-shot-features"
});
