import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import supabase from "lib/supabase/server";
import { persistCapturedGameNormalization } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";
import { parsePositiveInteger } from "lib/underlying-stats/adminRouteHelpers";
import { buildPlayerStatsSummaryPartitionSourceUrl } from "lib/underlying-stats/playerStatsLandingServer";
import { refreshPlayerUnderlyingSummarySnapshotsForGameIds } from "lib/underlying-stats/playerStatsSummaryRefresh";
import { refreshTeamUnderlyingSummaryRowsForGameIds } from "lib/underlying-stats/teamStatsSummaryRefresh";
import adminOnly from "utils/adminOnlyMiddleware";

/**
 * DB-only safety net for NHL post-game corrections. A newer raw snapshot head
 * marks a game's Gamecenter normalization stale; this route completes it from
 * the stored head payloads (no NHL requests), then refreshes the Underlying
 * Stats summaries for those games and for any game re-normalized elsewhere
 * after its summaries were built. The selection predicate is the cursor:
 * finished games drop out of it.
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
const XG_FEATURE_ROW_SCAN_LIMIT = 5_000;

type StatusRow = {
  game_id: number;
  season_id: number;
  game_date: string;
  status: string;
  completed_at: string | null;
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

function isoDateDaysAgo(now: number, days: number): string {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
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
    .select("game_id,season_id,game_date,status,completed_at")
    .neq("status", "complete")
    .gte("game_date", args.startDate)
    .lt("game_date", args.endDate)
    .order("game_date", { ascending: true })
    .order("game_id", { ascending: true })
    .limit(args.limit);
  if (error) throw error;
  return (data ?? []) as StatusRow[];
}

async function selectDerivedStaleGames(args: {
  startDate: string;
  endDate: string;
  limit: number;
}): Promise<StatusRow[]> {
  const { data, error } = await (supabase as any)
    .from("nhl_api_game_normalization_status")
    .select("game_id,season_id,game_date,status,completed_at")
    .eq("status", "complete")
    .gte("game_date", args.startDate)
    .lt("game_date", args.endDate)
    .order("game_date", { ascending: true })
    .order("game_id", { ascending: true })
    .limit(1_000);
  if (error) throw error;
  const completeRows = (data ?? []) as StatusRow[];

  // Player summary payloads carry generatedAt, so every refresh writes a new
  // marker row; the newest marker is when the summaries were last built.
  const latestSummaryAt = new Map<number, string>();
  for (const rows of chunk(completeRows, ID_CHUNK_SIZE)) {
    const gameIds = rows.map((row) => Number(row.game_id));
    const { data: markers, error: markerError } = await (supabase as any)
      .from("nhl_api_game_payloads_raw")
      .select("game_id,fetched_at")
      .eq("endpoint", "landing")
      .in("game_id", gameIds)
      .in("source_url", gameIds.map(summaryMarkerSourceUrl));
    if (markerError) throw markerError;
    for (const marker of (markers ?? []) as Array<{
      game_id: number;
      fetched_at: string;
    }>) {
      const gameId = Number(marker.game_id);
      const previous = latestSummaryAt.get(gameId);
      if (!previous || Date.parse(marker.fetched_at) > Date.parse(previous)) {
        latestSummaryAt.set(gameId, marker.fetched_at);
      }
    }
  }

  return completeRows
    .filter((row) => {
      const summaryAt = latestSummaryAt.get(Number(row.game_id));
      if (!summaryAt) return true;
      return (
        row.completed_at != null &&
        Date.parse(summaryAt) < Date.parse(row.completed_at)
      );
    })
    .slice(0, args.limit);
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
  if (gameIds.length === 0) return [];
  const { data, error } = await (supabase as any)
    .from("nhl_xg_shot_features")
    .select("game_id")
    .in("game_id", gameIds)
    .limit(XG_FEATURE_ROW_SCAN_LIMIT);
  if (error) throw error;
  return [...new Set(((data ?? []) as Array<{ game_id: number }>).map(
    (row) => Number(row.game_id),
  ))].sort((a, b) => a - b);
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
  // Only finished days: today's games may still be in progress.
  const endDate = isoDateDaysAgo(startedAt, 0);
  const startDate = isoDateDaysAgo(startedAt, lookbackDays);

  let stage = "select_candidates";
  const normalizedGameIds: number[] = [];
  const skipped: Array<{ gameId: number; reason: string }> = [];
  const failures: SweepFailure[] = [];

  try {
    const incomplete = await selectIncompleteNormalizations({ startDate, endDate, limit });
    const derivedStale =
      incomplete.length < limit
        ? await selectDerivedStaleGames({
            startDate,
            endDate,
            limit: limit - incomplete.length,
          })
        : [];
    const candidates: Candidate[] = [
      ...incomplete.map((row) => ({
        gameId: Number(row.game_id),
        seasonId: Number(row.season_id),
        gameDate: row.game_date,
        reason: "normalization_incomplete" as const,
      })),
      ...derivedStale.map((row) => ({
        gameId: Number(row.game_id),
        seasonId: Number(row.season_id),
        gameDate: row.game_date,
        reason: "derived_older_than_normalization" as const,
      })),
    ];

    const refreshCandidates: Candidate[] = [];
    let deadlineReached = false;
    for (const candidate of candidates) {
      if (candidate.reason === "derived_older_than_normalization") {
        refreshCandidates.push(candidate);
        continue;
      }
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

    const refreshGroups = new Map<string, Candidate[]>();
    for (const candidate of refreshCandidates) {
      const key = `${candidate.seasonId}:${gameTypeOf(candidate.gameId)}`;
      refreshGroups.set(key, [...(refreshGroups.get(key) ?? []), candidate]);
    }

    let playerSummaryRowsUpserted = 0;
    let teamSummaryRowsUpserted = 0;
    for (const group of refreshGroups.values()) {
      const gameIds = group.map((candidate) => candidate.gameId);
      const seasonId = group[0].seasonId;
      const requestedGameType = gameTypeOf(gameIds[0]);
      // Player refresh also writes the shared goalie partitions.
      stage = "refresh_player_summaries";
      const playerRefresh = await refreshPlayerUnderlyingSummarySnapshotsForGameIds({
        gameIds,
        seasonId,
        requestedGameType,
        shouldWarmLandingCache: true,
        shouldMigrateLegacySummaries: false,
        supabase,
      });
      playerSummaryRowsUpserted += playerRefresh.rowsUpserted;
      stage = "refresh_team_summaries";
      const teamRefresh = await refreshTeamUnderlyingSummaryRowsForGameIds({
        gameIds,
        seasonId,
        requestedGameType,
        shouldWarmLandingCache: true,
        supabase,
      });
      teamSummaryRowsUpserted += teamRefresh.rowsUpserted;
    }

    const refreshedGameIds = refreshCandidates.map((candidate) => candidate.gameId);
    stage = "check_xg_features";
    // xG features/predictions upsert by event id and cannot drop events a
    // correction removed; report affected games instead of half-refreshing.
    const xgRefreshNeededGameIds = await findGamesWithXgFeatures(refreshedGameIds);

    const status = refreshedGameIds.length === 0 && failures.length > 0 ? 502 : 200;
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
    });
    return res.status(500).json({
      success: false,
      route: ROUTE,
      stage,
      error: `Gamecenter normalization sweep failed during ${stage}: ${message}`,
      normalizedGameIds,
      failures,
    });
  }
}

export default withCronJobAudit(adminOnly(handler), { jobName: ROUTE });
