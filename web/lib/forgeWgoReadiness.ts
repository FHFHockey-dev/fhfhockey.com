import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveGameFinality } from "lib/games/gameFinality";

/**
 * Read-only WGO skater readiness for the scheduled FORGE run (TJ, 2026-11-22).
 *
 * The standalone pg_cron job 9 (07:30 UTC, `update-wgo-skaters?action=all`)
 * owns WGO skater ingestion; the scheduled pipeline no longer calls it. Before
 * its upstream stage spends any NST request, the run checks what that job
 * persisted for the source date:
 *   - the game set: `games` rows for the date, final only by stored NHL state
 *     (lib/games/gameFinality, basis `game_state`); postponed, suspended and
 *     cancelled games need no rows, and any other state is a gap. Only regular
 *     season games are required: the table's identity constraint admits only
 *     game type 2, and FORGE reads no playoff WGO table;
 *   - the producer receipt: the newest `update-all-wgo-skaters` audit row that
 *     names the date must be a clean success written after every required game
 *     could have ended (its run_time is the data cutoff);
 *   - row proof: the data read now is the data that run wrote. The receipt's
 *     `context.sourceDigests[date]` must equal `public.wgo_skater_date_digest`
 *     recomputed at read time (the Rankings readiness contract, migration
 *     20261122145409), so a later write to the date, audited or not, defers;
 *   - coverage: every required game has rows for both its home and road side,
 *     dated the source date, and no player twice.
 * Anything missing is a named gap and the next scheduled slot checks again;
 * the coordinator never reruns WGO. A date with no stored games needs no WGO
 * rows; NST's verified off-day check still decides whether it is an off day.
 */
export const WGO_SKATER_PRODUCER_JOB = "update-all-wgo-skaters";
export const WGO_READINESS_STEP_ID = "wgo-skater-readiness";
// A game is over this long after its start; the same rule the pipeline uses for
// line and power-play context (GAME_COMPLETION_GRACE_MS).
export const WGO_GAME_COMPLETION_GRACE_MS = 3 * 60 * 60 * 1000;
// Heuristic floor, not an exact player list (none exists at this point of the
// run): a team dresses 18 skaters, so fewer than this is a partial capture.
export const WGO_MIN_SKATERS_PER_SIDE = 16;
const REGULAR_SEASON_GAME_TYPE = 2;
const GAMES_PER_ROW_READ = 10;
const ROW_READ_CAP = 1000;
const RECEIPT_READ_CAP = 50;
const GAP_REPORT_CAP = 25;

export type WgoGapKind =
  | "game_not_final"
  | "no_producer_receipt"
  | "producer_receipt_failed"
  | "producer_receipt_stale"
  | "producer_digest_missing"
  | "data_changed_since_receipt"
  | "game_missing"
  | "side_missing"
  | "side_partial"
  | "row_date_mismatch"
  | "duplicate_player"
  | "read_failed";

export type WgoGap = {
  kind: WgoGapKind;
  gameId?: number;
  teamId?: number;
  side?: "home" | "road";
  playerId?: number;
  detail: string;
};

export type WgoProducerReceipt = {
  jobName: string;
  runTime: string;
  status: string;
  url: string | null;
  rowsAffected: number | null;
  // Audit rows touching the source date since its start; the newest decides.
  receiptsForDate: number;
  // The digest the producer recorded for the date, and the one read now.
  sourceDigest: WgoDateDigest | null;
  liveDigest: WgoDateDigest | null;
};

export type WgoDateDigest = { rows: number; md5: string };

function readDigest(value: unknown): WgoDateDigest | null {
  const digest = readRecord(value);
  return digest && typeof digest.rows === "number" && Number.isSafeInteger(digest.rows) &&
    typeof digest.md5 === "string" && /^[0-9a-f]{32}$/.test(digest.md5)
    ? { rows: digest.rows, md5: digest.md5 } : null;
}

export type WgoReadiness = {
  ready: boolean;
  sourceDate: string;
  checkedAt: string;
  requiredGameIds: number[];
  excludedGames: Array<{ gameId: number; reason: string }>;
  receipt: WgoProducerReceipt | null;
  dataCutoff: string | null;
  coverage: Array<{ gameId: number; homeSkaters: number; roadSkaters: number }>;
  gaps: WgoGap[];
};

type GameRow = {
  id: number;
  date: string;
  startTime: string | null;
  type: number | null;
  homeTeamId: number;
  awayTeamId: number;
  game_state: string | null;
  game_schedule_state: string | null;
  game_state_observed_at: string | null;
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const stringList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const gameTypeOf = (game: GameRow) => game.type ?? Math.floor(game.id / 10000) % 100;

/**
 * The dates an audit row touches, as the route writes them under `context` and
 * `response`: processed, failed and skipped dates, a `startDate`, a
 * `rankingsSourceDate`, or a `date`/`startDate` in its URL. The same rule as
 * Rankings readiness, so a later failed or empty rerun supersedes an earlier
 * green row.
 */
function receiptDates(details: Record<string, unknown> | null) {
  const context = readRecord(details?.context);
  const response = readRecord(details?.response);
  const processed = new Set([...stringList(context?.datesProcessed), ...stringList(response?.datesProcessed)]);
  const failed = new Set([...stringList(context?.failedDates), ...stringList(response?.failedDates)]);
  for (const failure of [...(Array.isArray(context?.failures) ? context.failures : []), ...(Array.isArray(response?.failures) ? response.failures : [])]) {
    const date = readRecord(failure)?.date;
    if (typeof date === "string") failed.add(date);
  }
  const skipped = new Set([...stringList(context?.skippedDates), ...stringList(response?.skippedDates)]);
  const touched = new Set([...processed, ...failed, ...skipped,
    ...[context?.startDate, response?.startDate, details?.rankingsSourceDate].filter((value): value is string => typeof value === "string")]);
  if (typeof details?.url === "string") {
    const params = new URL(details.url, "http://audit.local").searchParams;
    for (const key of ["date", "startDate"]) {
      const value = params.get(key);
      if (value) touched.add(value);
    }
  }
  const failedCount = Number(context?.failedDatesCount ?? response?.failedDatesCount ?? 0);
  return { processed, failed, skipped, touched, failedCount: Number.isFinite(failedCount) ? failedCount : 1 };
}

export async function checkWgoSkaterReadiness(args: {
  supabase: SupabaseClient<any>;
  sourceDate: string;
  now: Date;
}): Promise<WgoReadiness> {
  const { sourceDate, now } = args;
  const db = args.supabase as SupabaseClient<any>;
  const gaps: WgoGap[] = [];
  const excludedGames: WgoReadiness["excludedGames"] = [];
  const result = (extra: Partial<WgoReadiness> = {}): WgoReadiness => ({
    ready: gaps.length === 0,
    sourceDate,
    checkedAt: now.toISOString(),
    requiredGameIds: [],
    excludedGames,
    receipt: null,
    dataCutoff: null,
    coverage: [],
    gaps,
    ...extra
  });

  const gamesRead = await db
    .from("games")
    .select("id,date,startTime,type,homeTeamId,awayTeamId,game_state,game_schedule_state,game_state_observed_at")
    .eq("date", sourceDate);
  if (gamesRead.error) {
    gaps.push({ kind: "read_failed", detail: `Could not read games for ${sourceDate}: ${gamesRead.error.message}` });
    return result();
  }
  const required: GameRow[] = [];
  for (const game of (gamesRead.data ?? []) as GameRow[]) {
    const finality = resolveGameFinality(game, now);
    if (finality.reason === "not_played_schedule_state") {
      excludedGames.push({ gameId: game.id, reason: `not played (${game.game_schedule_state})` });
    } else if (!finality.isFinal || finality.basis !== "game_state") {
      gaps.push({ kind: "game_not_final", gameId: game.id,
        detail: `Game ${game.id} is not final by its stored NHL state (${game.game_state ?? "unknown"}).` });
    } else if (gameTypeOf(game) !== REGULAR_SEASON_GAME_TYPE) {
      excludedGames.push({ gameId: game.id, reason: `game type ${gameTypeOf(game)}: FORGE reads only regular-season WGO rows` });
    } else {
      required.push(game);
    }
  }
  const requiredGameIds = required.map(game => game.id).sort((a, b) => a - b);
  // No required game (an off day, or only unplayed or non-regular games): no WGO rows to wait for.
  if (required.length === 0) return result({ requiredGameIds });

  // Producer receipt: the newest audit row naming the source date decides.
  const receiptsRead = await db
    .from("cron_job_audit")
    .select("run_time,status,rows_affected,details")
    .eq("job_name", WGO_SKATER_PRODUCER_JOB)
    // From the day after the source date: no earlier run can hold its finished games
    // (the date's own 07:30 run only skips it). Rankings readiness uses the same window.
    .gte("run_time", new Date(Date.parse(`${sourceDate}T00:00:00.000Z`) + 86_400_000).toISOString())
    .lte("run_time", now.toISOString())
    .order("run_time", { ascending: false })
    .limit(RECEIPT_READ_CAP);
  let receipt: WgoProducerReceipt | null = null;
  if (receiptsRead.error) {
    gaps.push({ kind: "read_failed", detail: `Could not read ${WGO_SKATER_PRODUCER_JOB} audit rows: ${receiptsRead.error.message}` });
  } else {
    const naming = ((receiptsRead.data ?? []) as Array<Record<string, unknown>>).flatMap(row => {
      const details = readRecord(row.details);
      const dates = receiptDates(details);
      return dates.touched.has(sourceDate) ? [{ row, details, dates }] : [];
    });
    const newest = naming[0];
    if (!newest) {
      gaps.push({ kind: "no_producer_receipt",
        detail: `No ${WGO_SKATER_PRODUCER_JOB} audit row touches ${sourceDate} yet (pg_cron job 9, 07:30 UTC).` });
    } else {
      receipt = {
        jobName: WGO_SKATER_PRODUCER_JOB,
        runTime: String(newest.row.run_time),
        status: String(newest.row.status),
        url: typeof newest.details?.url === "string" ? newest.details.url : null,
        rowsAffected: typeof newest.row.rows_affected === "number" ? newest.row.rows_affected : null,
        receiptsForDate: naming.length,
        sourceDigest: readDigest(readRecord(readRecord(newest.details?.context)?.sourceDigests)?.[sourceDate]
          ?? readRecord(readRecord(newest.details?.response)?.sourceDigests)?.[sourceDate]),
        liveDigest: null
      };
      const clean = newest.row.status === "success" && Number(newest.details?.statusCode) === 200 &&
        newest.dates.processed.has(sourceDate) && !newest.dates.failed.has(sourceDate) &&
        !newest.dates.skipped.has(sourceDate) && newest.dates.failedCount === 0 &&
        newest.details?.auditPersistence !== "not_confirmed" && newest.details?.writePersistence !== "not_confirmed";
      const lastEnd = Math.max(...required.map(game => Date.parse(game.startTime ?? ""))) + WGO_GAME_COMPLETION_GRACE_MS;
      if (!clean) {
        gaps.push({ kind: "producer_receipt_failed",
          detail: `The newest ${WGO_SKATER_PRODUCER_JOB} run touching ${sourceDate} (${receipt.runTime}) is ${receipt.status}, HTTP ${String(newest.details?.statusCode)}, ${newest.dates.processed.has(sourceDate) ? "processed" : newest.dates.skipped.has(sourceDate) ? "skipped" : "did not process"} the date, with ${newest.dates.failedCount} failed dates.` });
      } else if (!Number.isFinite(lastEnd) || Date.parse(receipt.runTime) < lastEnd) {
        gaps.push({ kind: "producer_receipt_stale",
          detail: `The newest ${WGO_SKATER_PRODUCER_JOB} run touching ${sourceDate} ran at ${receipt.runTime}, before every required game could have ended (${Number.isFinite(lastEnd) ? new Date(lastEnd).toISOString() : "unknown start time"}).` });
      } else if (!receipt.sourceDigest || receipt.sourceDigest.rows < 1) {
        gaps.push({ kind: "producer_digest_missing",
          detail: `The newest ${WGO_SKATER_PRODUCER_JOB} run touching ${sourceDate} (${receipt.runTime}) recorded no row digest for the date, so the rows cannot be tied to it.` });
      } else {
        const live = await db.rpc("wgo_skater_date_digest", { p_date: sourceDate });
        receipt.liveDigest = live.error ? null : readDigest(live.data);
        if (live.error || !receipt.liveDigest) {
          gaps.push({ kind: "read_failed", detail: `Could not read the wgo_skater_stats digest for ${sourceDate}${live.error ? `: ${live.error.message}` : ""}.` });
        } else if (receipt.liveDigest.rows !== receipt.sourceDigest.rows || receipt.liveDigest.md5 !== receipt.sourceDigest.md5) {
          gaps.push({ kind: "data_changed_since_receipt",
            detail: `wgo_skater_stats for ${sourceDate} no longer matches the ${receipt.runTime} run (recorded ${receipt.sourceDigest.rows} rows ${receipt.sourceDigest.md5}, now ${receipt.liveDigest.rows} rows ${receipt.liveDigest.md5}); a later write changed it.` });
        }
      }
    }
  }

  // Coverage of every required game, read by game id (indexed) under the row cap.
  const byGame = new Map<number, { home: Set<number>; road: Set<number> }>();
  const seenPlayers = new Map<number, number>();
  for (let offset = 0; offset < requiredGameIds.length; offset += GAMES_PER_ROW_READ) {
    const chunk = requiredGameIds.slice(offset, offset + GAMES_PER_ROW_READ);
    const rowsRead = await db
      .from("wgo_skater_stats")
      .select("game_id,player_id,date,home_road")
      .in("game_id", chunk)
      .limit(ROW_READ_CAP);
    if (rowsRead.error || (rowsRead.data ?? []).length >= ROW_READ_CAP) {
      gaps.push({ kind: "read_failed", detail: `Could not read complete wgo_skater_stats rows for games ${chunk.join(", ")}${rowsRead.error ? `: ${rowsRead.error.message}` : " (row cap reached)"}.` });
      continue;
    }
    for (const row of (rowsRead.data ?? []) as Array<{ game_id: number; player_id: number; date: string; home_road: string | null }>) {
      const gameId = Number(row.game_id), playerId = Number(row.player_id);
      if (row.date !== sourceDate) {
        gaps.push({ kind: "row_date_mismatch", gameId, playerId, detail: `Player ${playerId}'s row for game ${gameId} is dated ${row.date}, not ${sourceDate}.` });
        continue;
      }
      const prior = seenPlayers.get(playerId);
      if (prior != null) {
        gaps.push({ kind: "duplicate_player", gameId, playerId, detail: `Player ${playerId} has rows for games ${prior} and ${gameId} on ${sourceDate}.` });
        continue;
      }
      seenPlayers.set(playerId, gameId);
      const sides = byGame.get(gameId) ?? { home: new Set<number>(), road: new Set<number>() };
      if (row.home_road === "H") sides.home.add(playerId);
      else if (row.home_road === "R") sides.road.add(playerId);
      byGame.set(gameId, sides);
    }
  }
  const coverage: WgoReadiness["coverage"] = [];
  for (const game of required) {
    const sides = byGame.get(game.id);
    coverage.push({ gameId: game.id, homeSkaters: sides?.home.size ?? 0, roadSkaters: sides?.road.size ?? 0 });
    if (!sides || sides.home.size + sides.road.size === 0) {
      gaps.push({ kind: "game_missing", gameId: game.id, detail: `No wgo_skater_stats rows for game ${game.id}.` });
      continue;
    }
    for (const [side, players, teamId] of [["home", sides.home, game.homeTeamId], ["road", sides.road, game.awayTeamId]] as const) {
      if (players.size === 0) {
        gaps.push({ kind: "side_missing", gameId: game.id, teamId, side, detail: `No ${side} skater rows for team ${teamId} in game ${game.id}.` });
      } else if (players.size < WGO_MIN_SKATERS_PER_SIDE) {
        gaps.push({ kind: "side_partial", gameId: game.id, teamId, side,
          detail: `Only ${players.size} ${side} skater rows for team ${teamId} in game ${game.id} (fewer than ${WGO_MIN_SKATERS_PER_SIDE}).` });
      }
    }
  }
  return result({ requiredGameIds, receipt, dataCutoff: receipt?.runTime ?? null, coverage });
}

/** The bounded form kept near the top of the pipeline response, so the audit preview holds it. */
export function compactWgoReadiness(readiness: WgoReadiness) {
  return {
    ready: readiness.ready,
    sourceDate: readiness.sourceDate,
    checkedAt: readiness.checkedAt,
    dataCutoff: readiness.dataCutoff,
    receipt: readiness.receipt,
    requiredGames: readiness.requiredGameIds.length,
    excludedGameIds: readiness.excludedGames.map(game => game.gameId),
    gapCount: readiness.gaps.length,
    gaps: readiness.gaps.slice(0, GAP_REPORT_CAP).map(gap => ({
      kind: gap.kind,
      ...(gap.gameId != null ? { gameId: gap.gameId } : {}),
      ...(gap.teamId != null ? { teamId: gap.teamId } : {}),
      ...(gap.playerId != null ? { playerId: gap.playerId } : {})
    }))
  };
}
