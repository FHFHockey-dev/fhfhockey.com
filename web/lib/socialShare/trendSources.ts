import publicSupabase from "lib/supabase/public-client";
import { DEFAULT_SUPABASE_PAGE_SIZE, fetchAllSupabasePages } from "lib/supabase/pagination";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import type { ShareMapRow } from "./players";
import { buildTrendLayer, deploymentShownIds, EV_COLUMNS, MOVER_WINDOW_DAYS, moverShownKeys, NAME_COLUMNS, OWNERSHIP_COLUMNS, OWNERSHIP_SERIES_MAX_DAYS, ownershipSeriesDates, PPC_COLUMNS, ROLLING_COLUMNS, SERIES_COLUMNS, SERIES_LOOKBACK_DAYS, seriesShownIds, shiftDate, shortlistIds, TREND_MAX_GAME_AGE_DAYS, trendShortlists,
  type ShareEvRow, type ShareSeriesRow, type ShareOwnershipRow, type SharePlayerNameRow, type SharePpcRow, type ShareRollingRow, type ShareTrendSources, type SourceRead, type TrendContext } from "./trends";
import { SHARE_TIME_ZONE, type ShareTrendLayer } from "./types";

/**
 * Row ceilings for every Tuesday read (READ-PLAN.md in tasks/artifacts/tuesday-trends-2026-10-26). Each read asks
 * for an exact count; more rows than the ceiling, or a count that changes between pages, fails that source closed.
 */
export const TREND_LIMITS = {
  /** ~32 teams × ~22 dressed skaters × ≤4 games in 7 days ≈ 2,800 strength-all rows. */
  rolling: 5000,
  /** PK (player_key, ownership_date): one row per Yahoo player per date, two dates. */
  ownership: 6000,
  ppcGamesPerChunk: 25, ppcRowsPerGame: 40,
  mapChunk: 150,
  namesChunk: 100,
  evChunk: 20, evRowsPerPlayer: TREND_MAX_GAME_AGE_DAYS + 1,
  /** Sparklines (TT-4, READ-PLAN v2 S1/M2): one row per player per date, so a 35-day read holds at most 36 rows per player. */
  seriesChunk: 20, seriesRowsPerPlayer: SERIES_LOOKBACK_DAYS + 1, ownershipSeriesRowsPerKey: OWNERSHIP_SERIES_MAX_DAYS + 1,
  /** Statements in flight at once, across every stream (TJ's approved ceiling, READ-APPROVAL.md). */
  concurrency: 2,
} as const;

type CountedPage<T> = PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>;
// The builder chain is the supabase-js PostgREST builder; tests pass a fake with the same methods.
export type TrendReadClient = { from: (table: string) => any };

/** Exact-count read with a ceiling (playerSources.ts pattern): a larger or changing source fails instead of paging on. */
async function bounded<T>(what: string, limit: number, page: (from: number, to: number) => CountedPage<T>): Promise<T[]> {
  let expected: number | null = null;
  const rows = await fetchAllSupabasePages<T>(async ({ from, to }) => {
    if (expected != null && from >= expected) return { data: [], error: null };
    const { data, error, count } = await page(from, to);
    if (!error) {
      if (count == null || !Number.isFinite(count) || count < 0 || (expected != null && count !== expected)) throw new Error(`${what} completeness changed or is unavailable.`);
      expected = count;
    }
    return { data, error };
  }, { pageSize: Math.min(limit, DEFAULT_SUPABASE_PAGE_SIZE), limit });
  if (expected === null || rows.length !== expected) throw new Error(`${what} response was incomplete or over its ${limit}-row limit.`);
  return rows;
}

/** Ascending chunks with at most TREND_LIMITS.concurrency in flight; any failed chunk fails the whole source. */
async function chunked<V, T>(values: V[], size: number, read: (chunk: V[]) => Promise<T[]>): Promise<T[]> {
  const chunks: V[][] = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  const results: T[][] = new Array(chunks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(TREND_LIMITS.concurrency, chunks.length) }, async () => {
    while (next < chunks.length) { const index = next++; results[index] = await read(chunks[index]); }
  }));
  return results.flat();
}

/** A loggable reason: PostgREST code and message only, never rows or ids. */
function failureReason(reason: unknown) {
  if (reason && typeof reason === "object") {
    const { message, code } = reason as { message?: unknown; code?: unknown };
    return [typeof code === "string" ? code : null, typeof message === "string" ? message.slice(0, 200) : null].filter(Boolean).join(" ") || "unknown error";
  }
  return String(reason).slice(0, 200);
}
async function settle<T>(what: string, read: () => Promise<T[]>): Promise<SourceRead<T>> {
  try { return { rows: await read() }; }
  catch (reason) {
    const failed = failureReason(reason);
    console.warn(`[social-share] Tuesday ${what} unavailable: ${failed}`);
    return { failed: `${what} read failed (${failed})` };
  }
}

/** Latest ownership date, then the latest on or before MOVER_WINDOW_DAYS earlier, then every row on those two dates. */
async function readOwnership(client: TrendReadClient): Promise<ShareOwnershipRow[]> {
  const probe = async (before?: string) => {
    let query = client.from("yahoo_player_ownership_history").select("ownership_date");
    if (before) query = query.lte("ownership_date", before);
    const { data, error } = await query.order("ownership_date", { ascending: false }).limit(1);
    if (error) throw error;
    return (data as { ownership_date: string }[] | null)?.[0]?.ownership_date ?? null;
  };
  const latest = await probe();
  if (!latest) return [];
  const previous = await probe(shiftDate(latest, -MOVER_WINDOW_DAYS));
  const dates = previous ? [previous, latest] : [latest];
  return bounded<ShareOwnershipRow>("Yahoo ownership", TREND_LIMITS.ownership, (from, to) => client.from("yahoo_player_ownership_history")
    .select(OWNERSHIP_COLUMNS.join(","), { count: "exact" }).in("ownership_date", dates)
    .order("ownership_date", { ascending: true }).order("player_key", { ascending: true }).range(from, to));
}

/**
 * Live Tuesday layer. Reads only after auth and parameter validation (server.ts), in four bounded rounds:
 * rolling + ownership (one statement each at a time); then PP rows for the window's games (two chunks at a time) and
 * the id map for the mover candidates; then names for
 * the shortlisted players; then EV rows for the shown deployment players. Each failed source becomes its sections'
 * "missing" state with the reason; only listed players leave the server.
 */
export async function loadTrendLayer(context: TrendContext, client: TrendReadClient = publicSupabase): Promise<ShareTrendLayer> {
  const since = shiftDate(localDate(context.generatedAt, SHARE_TIME_ZONE), -TREND_MAX_GAME_AGE_DAYS);
  const [rolling, ownership] = await Promise.all([
    settle("Rolling game metrics", () => bounded<ShareRollingRow>("Rolling game metrics", TREND_LIMITS.rolling, (from, to) => client.from("rolling_player_game_metrics")
      .select(ROLLING_COLUMNS.join(","), { count: "exact" }).eq("season", context.season).eq("strength_state", "all").gte("game_date", since)
      // Unique order: the primary key is (player_id, game_date, strength_state) and strength is fixed.
      .order("game_date", { ascending: false }).order("player_id", { ascending: true }).range(from, to))),
    settle("Yahoo ownership", () => readOwnership(client)),
  ]);
  const first = trendShortlists({ rolling, ownership, ppc: { rows: [] }, map: { rows: [] } }, context);
  // PP rows (two chunks at a time), then the id map: never more than TREND_LIMITS.concurrency statements in flight.
  const ppc: SourceRead<SharePpcRow> = await (
    "failed" in rolling ? Promise.resolve<SourceRead<SharePpcRow>>({ failed: "not read because rolling game metrics are unavailable" })
      : settle("Power-play combinations", () => chunked(first.gameIds, TREND_LIMITS.ppcGamesPerChunk, chunk => bounded<SharePpcRow>("Power-play combinations", chunk.length * TREND_LIMITS.ppcRowsPerGame, (from, to) => client.from("powerPlayCombinations")
        .select(PPC_COLUMNS.join(","), { count: "exact" }).in("gameId", chunk).order("gameId", { ascending: true }).order("playerId", { ascending: true }).range(from, to)))));
  const map: SourceRead<ShareMapRow> = await (
    "failed" in ownership ? Promise.resolve<SourceRead<ShareMapRow>>({ failed: "not read because Yahoo ownership is unavailable" })
      : settle("Yahoo to NHL id map", () => chunked([...new Set(first.moverKeys)].sort(), TREND_LIMITS.mapChunk, chunk => bounded<ShareMapRow>("Yahoo to NHL id map", chunk.length * 2, (from, to) => client.from("yahoo_nhl_player_map_read")
        .select("yahoo_player_id,nhl_player_id", { count: "exact" }).in("yahoo_player_id", chunk).order("yahoo_player_id", { ascending: true }).order("nhl_player_id", { ascending: true }).range(from, to)))));
  const lists = trendShortlists({ rolling, ownership, ppc, map }, context);
  const players = await settle("Player names", () => chunked(shortlistIds(lists), TREND_LIMITS.namesChunk, chunk => bounded<SharePlayerNameRow>("Player names", chunk.length, (from, to) => client.from("players")
    .select(NAME_COLUMNS.join(","), { count: "exact" }).in("id", chunk).order("id", { ascending: true }).range(from, to))));
  const evIds = "rows" in players ? deploymentShownIds(lists, players.rows) : [];
  const ev = await settle("Even-strength rolling rows", () => chunked(evIds, TREND_LIMITS.evChunk, chunk => bounded<ShareEvRow>("Even-strength rolling rows", chunk.length * TREND_LIMITS.evRowsPerPlayer, (from, to) => client.from("rolling_player_game_metrics")
    .select(EV_COLUMNS.join(","), { count: "exact" }).eq("season", context.season).eq("strength_state", "ev").in("player_id", chunk).gte("game_date", since)
    .order("player_id", { ascending: true }).order("game_date", { ascending: false }).range(from, to))));
  // Sparklines (TT-4): the listed skaters' season rows for 35 days (S1), then the listed movers' daily rows P..D (M2).
  const today = localDate(context.generatedAt, SHARE_TIME_ZONE), seriesIds = "rows" in players ? seriesShownIds(lists, players.rows) : [];
  const series = await settle("Sparkline game rows", () => chunked(seriesIds, TREND_LIMITS.seriesChunk, chunk => bounded<ShareSeriesRow>("Sparkline game rows", chunk.length * TREND_LIMITS.seriesRowsPerPlayer, (from, to) => client.from("rolling_player_game_metrics")
    .select(SERIES_COLUMNS.join(","), { count: "exact" }).eq("season", context.season).eq("strength_state", "all").in("player_id", chunk).gte("game_date", shiftDate(today, -SERIES_LOOKBACK_DAYS))
    .order("player_id", { ascending: true }).order("game_date", { ascending: false }).range(from, to))));
  const dates = ownershipSeriesDates(lists.previousDate, lists.latestDate), keys = "rows" in players && dates ? moverShownKeys(lists, players.rows) : [];
  const ownershipSeries: SourceRead<ShareOwnershipRow> = !keys.length ? { rows: [] } : await settle("Ownership sparkline rows", () => bounded<ShareOwnershipRow>("Ownership sparkline rows", keys.length * TREND_LIMITS.ownershipSeriesRowsPerKey, (from, to) => client.from("yahoo_player_ownership_history")
    .select(OWNERSHIP_COLUMNS.join(","), { count: "exact" }).in("player_key", keys).gte("ownership_date", dates![0]).lte("ownership_date", dates![dates!.length - 1])
    .order("player_key", { ascending: true }).order("ownership_date", { ascending: true }).range(from, to)));
  const sources: ShareTrendSources = { rolling, ev, ppc, ownership, map, players, series, ownershipSeries };
  return buildTrendLayer(sources, context);
}
