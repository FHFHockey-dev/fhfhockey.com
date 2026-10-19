import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { persistCapturedGameNormalization } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";
import { parsePositiveInteger } from "lib/underlying-stats/adminRouteHelpers";
import { buildPlayerStatsSummaryPartitionSourceUrl } from "lib/underlying-stats/playerStatsLandingServer";
import {
  refreshPlayerUnderlyingSummarySnapshotsForGameIds,
  warmPlayerStatsLandingSeasonAggregateCache,
} from "lib/underlying-stats/playerStatsSummaryRefresh";
import { refreshTeamUnderlyingSummaryRowsForGameIds } from "lib/underlying-stats/teamStatsSummaryRefresh";
import adminOnly from "utils/adminOnlyMiddleware";

/**
 * DB-only safety net for NHL post-game corrections. A newer raw snapshot head
 * marks a game's Gamecenter normalization stale; this route completes it from
 * the stored head payloads (no NHL requests), then refreshes the Underlying
 * Stats summaries for those games and for any game re-normalized elsewhere
 * after its summaries were built. The selection predicate is the cursor:
 * finished games drop out of it.
 *
 * The newest player-summary partition marker is the derived-completion marker,
 * so the team refresh runs first and the player refresh (which writes the
 * marker) runs last: a failed team refresh leaves the game selected for the
 * next sweep. Landing-cache warming is in-memory only and runs after the
 * marker; its failure is reported but does not hold the game.
 */

const ROUTE = "/api/v1/db/sweep-gamecenter-normalization";
const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;
const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 400;
const DEFAULT_MAX_DURATION_MS = 240_000;
const MAX_DURATION_MS = 270_000;
// Time kept back for the batched summary refresh after the last normalization.
const SUMMARY_RESERVE_MS = 60_000;
const ID_CHUNK_SIZE = 50;
// Hosted PostgREST caps every response at max_rows=1000.
const STATUS_PAGE_SIZE = 1_000;
const ET_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type StatusRow = {
  game_id: number;
  season_id: number;
  game_date: string;
  status: string;
  completed_at: string | null;
  updated_at?: string | null;
};

type Candidate = {
  gameId: number;
  seasonId: number;
  gameDate: string;
  reason: "normalization_incomplete" | "derived_older_than_normalization";
};

type SweepFailure = { gameId: number; stage: string; message: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function shiftIsoDate(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function gameTypeOf(gameId: number): number {
  return Math.floor(gameId / 10_000) % 100;
}

function summaryMarkerSourceUrl(gameId: number): string {
  return buildPlayerStatsSummaryPartitionSourceUrl({
    gameId,
    mode: "individual",
    strength: "allStrengths",
    scoreState: "allScores",
  });
}

async function selectIncompleteNormalizations(args: {
  startDate: string;
  endDate: string;
  limit: number;
}): Promise<StatusRow[]> {
  const { data, error } = await (supabase as any)
    .from("nhl_api_game_normalization_status")
    .select("game_id,season_id,game_date,status,completed_at,updated_at")
    .neq("status", "complete")
    .gte("game_date", args.startDate)
    .lt("game_date", args.endDate)
    // updated_at is when the game went stale; a failed attempt never moves it.
    // Newest invalidations first, so games stuck stale through earlier sweeps
    // (repeat failures) cannot hold every slot ahead of new corrections.
    .order("updated_at", { ascending: false })
    .order("game_id", { ascending: true })
    .limit(args.limit);
  if (error) throw error;
  return (data ?? []) as StatusRow[];
}

async function selectFreshSummaryGameIds(rows: StatusRow[]): Promise<Set<number>> {
  // Player summary payloads carry generatedAt, so every refresh writes a new
  // marker row. A game is fresh when some marker is no older than its
  // normalization; markers older than the chunk's earliest completion cannot
  // make any game in it fresh, so they are not read.
  const fresh = new Set<number>();
  for (const chunkRows of chunk(rows, ID_CHUNK_SIZE)) {
    const gameIds = chunkRows.map((row) => Number(row.game_id));
    const completedAt = new Map(
      chunkRows.map((row) => [Number(row.game_id), row.completed_at]),
    );
    const completions = chunkRows
      .map((row) => row.completed_at)
      .filter((value): value is string => value != null)
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    const markers = await fetchAllSupabasePages<{
      game_id: number;
      fetched_at: string;
    }>(({ from, to }) => {
      let query = (supabase as any)
        .from("nhl_api_game_payloads_raw")
        .select("game_id,fetched_at")
        .eq("endpoint", "landing")
        .in("game_id", gameIds)
        .in("source_url", gameIds.map(summaryMarkerSourceUrl));
      if (completions.length === chunkRows.length) {
        query = query.gte("fetched_at", completions[0]);
      }
      return query
        .order("game_id", { ascending: true })
        .order("fetched_at", { ascending: true })
        .range(from, to);
    }, { pageSize: STATUS_PAGE_SIZE });
    for (const marker of markers) {
      const gameId = Number(marker.game_id);
      const normalizedAt = completedAt.get(gameId);
      if (
        normalizedAt == null ||
        Date.parse(marker.fetched_at) >= Date.parse(normalizedAt)
      ) {
        fresh.add(gameId);
      }
    }
  }
  return fresh;
}

async function selectDerivedStaleGames(args: {
  startDate: string;
  endDate: string;
  limit: number;
  excludeGameIds: ReadonlySet<number>;
}): Promise<StatusRow[]> {
  const stale: StatusRow[] = [];
  if (args.limit <= 0) return stale;
  // Page the whole window in a stable order and test staleness page by page,
  // so newer stale games are reached however many fresh games precede them.
  for (let from = 0; ; from += STATUS_PAGE_SIZE) {
    const { data, error } = await (supabase as any)
      .from("nhl_api_game_normalization_status")
      .select("game_id,season_id,game_date,status,completed_at")
      .eq("status", "complete")
      .gte("game_date", args.startDate)
      .lt("game_date", args.endDate)
      .order("game_date", { ascending: true })
      .order("game_id", { ascending: true })
      .range(from, from + STATUS_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as StatusRow[];
    const rows = page.filter((row) => !args.excludeGameIds.has(Number(row.game_id)));
    const fresh = await selectFreshSummaryGameIds(rows);
    for (const row of rows) {
      if (fresh.has(Number(row.game_id))) continue;
      stale.push(row);
      if (stale.length >= args.limit) return stale;
    }
    if (page.length < STATUS_PAGE_SIZE) return stale;
  }
}

async function readHeadPayload(gameId: number, endpoint: string) {
  const { data: head, error: headError } = await (supabase as any)
    .from("nhl_api_game_payload_snapshot_heads")
    .select("raw_payload_id,payload_hash")
    .eq("game_id", gameId)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (headError) throw headError;
  if (!head) return null;

  const { data: raw, error: rawError } = await (supabase as any)
    .from("nhl_api_game_payloads_raw")
    .select("id,payload,payload_hash")
    .eq("id", head.raw_payload_id)
    .maybeSingle();
  if (rawError) throw rawError;
  if (!raw || raw.payload_hash !== head.payload_hash) {
    throw new Error(
      `Snapshot head for ${endpoint} does not match its raw payload row`,
    );
  }
  return { payload: raw.payload, payloadHash: raw.payload_hash as string };
}

async function findGamesWithXgFeatures(gameIds: number[]): Promise<number[]> {
  // One bounded probe per game: a row-scan over many games is truncated by
  // max_rows long before every game is represented.
  const affected: number[] = [];
  for (const gameId of [...new Set(gameIds)].sort((a, b) => a - b)) {
    const { data, error } = await (supabase as any)
      .from("nhl_xg_shot_features")
      .select("game_id")
      .eq("game_id", gameId)
      .limit(1);
    if (error) throw error;
    if ((data ?? []).length > 0) affected.push(gameId);
  }
  return affected;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const startedAt = Date.now();
  const limit = Math.min(parsePositiveInteger(req.query.limit) ?? DEFAULT_LIMIT, MAX_LIMIT);
  const lookbackDays = Math.min(
    parsePositiveInteger(req.query.lookbackDays) ?? DEFAULT_LOOKBACK_DAYS,
    MAX_LOOKBACK_DAYS,
  );
  const maxDurationMs = Math.min(
    parsePositiveInteger(req.query.maxDurationMs) ?? DEFAULT_MAX_DURATION_MS,
    MAX_DURATION_MS,
  );
  const normalizeDeadline =
    startedAt + Math.max(maxDurationMs - SUMMARY_RESERVE_MS, 0);
  // Only finished days: today's (ET) games may still be in progress.
  const endDate = ET_DATE_FORMAT.format(new Date(startedAt));
  const startDate = shiftIsoDate(endDate, -lookbackDays);

  let stage = "select_candidates";
  const normalizedGameIds: number[] = [];
  const skipped: Array<{ gameId: number; reason: string }> = [];
  const failures: SweepFailure[] = [];

  try {
    const incomplete = await selectIncompleteNormalizations({ startDate, endDate, limit });
    const incompleteCandidates: Candidate[] = incomplete.map((row) => ({
      gameId: Number(row.game_id),
      seasonId: Number(row.season_id),
      gameDate: row.game_date,
      reason: "normalization_incomplete" as const,
    }));

    const refreshCandidates: Candidate[] = [];
    let deadlineReached = false;
    for (const candidate of incompleteCandidates) {
      if (Date.now() > normalizeDeadline) {
        deadlineReached = true;
        break;
      }
      stage = "normalize_gamecenter";
      try {
        const pbp = await readHeadPayload(candidate.gameId, "play-by-play");
        const shifts = await readHeadPayload(candidate.gameId, "shiftcharts");
        if (!pbp || !shifts) {
          skipped.push({
            gameId: candidate.gameId,
            reason: !pbp ? "missing_pbp_head" : "missing_shift_head",
          });
          continue;
        }
        await persistCapturedGameNormalization(supabase, {
          gameId: candidate.gameId,
          seasonId: candidate.seasonId,
          gameDate: candidate.gameDate,
          pbp: pbp.payload,
          pbpPayloadHash: pbp.payloadHash,
          shiftPayload: shifts.payload,
          shiftPayloadHash: shifts.payloadHash,
        });
        normalizedGameIds.push(candidate.gameId);
        refreshCandidates.push(candidate);
      } catch (error) {
        failures.push({
          gameId: candidate.gameId,
          stage: "normalize_gamecenter",
          message: errorMessage(error),
        });
      }
    }

    // Refresh slots left by failed or skipped normalizations go to games whose
    // derived summaries are older than their normalization.
    stage = "select_derived_stale";
    const derivedStale = await selectDerivedStaleGames({
      startDate,
      endDate,
      limit: limit - refreshCandidates.length,
      excludeGameIds: new Set(normalizedGameIds),
    });
    const derivedCandidates: Candidate[] = derivedStale.map((row) => ({
      gameId: Number(row.game_id),
      seasonId: Number(row.season_id),
      gameDate: row.game_date,
      reason: "derived_older_than_normalization" as const,
    }));
    const candidates = [...incompleteCandidates, ...derivedCandidates];
    refreshCandidates.push(...derivedCandidates);

    const refreshGroups = new Map<string, Candidate[]>();
    for (const candidate of refreshCandidates) {
      const key = `${candidate.seasonId}:${gameTypeOf(candidate.gameId)}`;
      refreshGroups.set(key, [...(refreshGroups.get(key) ?? []), candidate]);
    }

    let playerSummaryRowsUpserted = 0;
    let teamSummaryRowsUpserted = 0;
    const refreshedGameIds: number[] = [];
    for (const group of refreshGroups.values()) {
      const gameIds = group.map((candidate) => candidate.gameId);
      const seasonId = group[0].seasonId;
      const requestedGameType = gameTypeOf(gameIds[0]);
      let groupStage = "refresh_team_summaries";
      try {
        // Team first: the player refresh writes the completion marker.
        const teamRefresh = await refreshTeamUnderlyingSummaryRowsForGameIds({
          gameIds,
          seasonId,
          requestedGameType,
          shouldWarmLandingCache: true,
          supabase,
        });
        teamSummaryRowsUpserted += teamRefresh.rowsUpserted;
        // Player refresh also writes the shared goalie partitions.
        groupStage = "refresh_player_summaries";
        const playerRefresh = await refreshPlayerUnderlyingSummarySnapshotsForGameIds({
          gameIds,
          seasonId,
          requestedGameType,
          shouldWarmLandingCache: false,
          shouldMigrateLegacySummaries: false,
          supabase,
        });
        playerSummaryRowsUpserted += playerRefresh.rowsUpserted;
      } catch (error) {
        console.error(`[sweep-gamecenter-normalization] ${groupStage} failed`, {
          error: errorMessage(error),
          gameIds,
        });
        for (const gameId of gameIds) {
          failures.push({ gameId, stage: groupStage, message: errorMessage(error) });
        }
        continue;
      }
      refreshedGameIds.push(...gameIds);
      try {
        await warmPlayerStatsLandingSeasonAggregateCache({
          seasonId,
          gameType: requestedGameType,
          supabase,
        });
      } catch (error) {
        for (const gameId of gameIds) {
          failures.push({
            gameId,
            stage: "warm_landing_cache",
            message: errorMessage(error),
          });
        }
      }
    }

    stage = "check_xg_features";
    // xG features/predictions upsert by event id and cannot drop events a
    // correction removed; report affected games instead of half-refreshing.
    const xgRefreshNeededGameIds = await findGamesWithXgFeatures(refreshedGameIds);

    const status =
      failures.length === 0 ? 200 : refreshedGameIds.length > 0 ? 207 : 502;
    return res.status(status).json({
      success: status === 200,
      route: ROUTE,
      window: { startDate, endDate },
      limit,
      candidateCount: candidates.length,
      normalizedGameIds,
      refreshedGameIds,
      derivedOnlyGameIds: derivedStale.map((row) => Number(row.game_id)),
      skipped,
      failures,
      deadlineReached,
      playerSummaryRowsUpserted,
      teamSummaryRowsUpserted,
      xgRefreshNeededGameIds,
      nhlRequests: 0,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error(`[sweep-gamecenter-normalization] failed during ${stage}`, {
      error: message,
      normalizedGameIds,
      failures,
    });
    return res.status(500).json({
      success: false,
      route: ROUTE,
      stage,
      // Backend detail stays in the server log above.
      error: `Gamecenter normalization sweep failed during ${stage}`,
      normalizedGameIds,
      failures: failures.map(({ gameId, stage: failedStage }) => ({
        gameId,
        stage: failedStage,
      })),
    });
  }
}

export default withCronJobAudit(adminOnly(handler), { jobName: ROUTE });
