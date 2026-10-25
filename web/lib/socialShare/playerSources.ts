import publicSupabase from "lib/supabase/public-client";
import { DEFAULT_SUPABASE_PAGE_SIZE, fetchAllSupabasePages } from "lib/supabase/pagination";
import { PICKUP_YAHOO_TEAM_ALIASES, type PickupOwnershipRow } from "./pickupsFixture";
import type { ShareGoalieGameRow, ShareGoalieRow, ShareMapRow, SharePlayerSources, ShareRecentRollingRow, ShareSkaterRow } from "./players";

/**
 * Explicit row ceilings for every team with games (the wider-pool fill needs teams ranked 11+): the
 * live top-10 read returned 203 Yahoo, 223 skater and 23 goalie rows, so all 32 teams fit with headroom.
 * Exceeding one fails closed.
 */
export const PLAYER_SOURCE_LIMITS = { yahoo: 2000, mapChunk: 150, skaters: 1500, goalies: 200 } as const;
/**
 * Recent-form reads cover only the ranking pool. Rows per player come from the true row grain (SS1-17): both
 * sources hold at most one row per player per date (rolling_player_game_metrics primary key
 * (player_id, game_date, strength_state), read for strength "all"; wgo_goalie_stats primary key (goalie_id, date)),
 * so a lookback of N days can never return more than N + 1 rows per player.
 */
const RECENT_LOOKBACK_DAYS = 21;
export const RECENT_LIMITS = { lookbackDays: RECENT_LOOKBACK_DAYS, skaterRowsPerPlayer: RECENT_LOOKBACK_DAYS + 1, goalieRowsPerPlayer: RECENT_LOOKBACK_DAYS + 1 } as const;
const YAHOO_COLUMNS = "player_key,player_id,editorial_team_abbreviation,display_position,eligible_positions,percent_ownership,status,season,last_updated";
const SKATER_COLUMNS = "player_id,player_name,season,games_played,points_per_game,goals,shots,hits,blocked_shots,current_team_abbreviation,updated_at";
const GOALIE_COLUMNS = "goalie_id,goalie_name,season_id,games_played,games_started,quality_starts_pct,save_pct,current_team_abbreviation,updated_at";
const NHL_TO_YAHOO = Object.fromEntries(Object.entries(PICKUP_YAHOO_TEAM_ALIASES).map(([yahoo, nhl]) => [nhl, yahoo]));

type CountedPage<T> = PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>;
/** Exact-count, single-page read: a source larger than `limit` rows fails instead of paging on. */
async function bounded<T>(what: string, limit: number, page: (from: number, to: number) => CountedPage<T>): Promise<T[]> {
  let expected: number | null = null;
  const rows = await fetchAllSupabasePages<T>(async ({ from, to }) => {
    // A result that is an exact multiple of the page size would otherwise request a page past the end, which
    // PostgREST answers with 416 (PGRST103) and the read would fail closed (SS1-20). The exact count is known.
    if (expected != null && from >= expected) return { data: [], error: null };
    const { data, error, count } = await page(from, to);
    if (!error) {
      if (count == null || !Number.isFinite(count) || count < 0 || (expected != null && count !== expected)) throw new Error(`${what} completeness changed or is unavailable.`);
      expected = count;
    }
    return { data, error };
  // One page never exceeds the API's 1,000-row response cap; pages keep the same exact count (ticket 15 pool).
  }, { pageSize: Math.min(limit, DEFAULT_SUPABASE_PAGE_SIZE), limit });
  if (expected === null || rows.length !== expected) throw new Error(`${what} response was incomplete or over its ${limit}-row limit.`);
  return rows;
}

/**
 * Read-only anon reads for the pickup and specialist cards, filtered server-side to the edition's
 * teams with games. yahoo_players reads only current-season rows under 50% rostered and no
 * ownership timelines; the existing yahoo_nhl_player_map_read view maps Yahoo ids to NHL ids.
 */
/**
 * Recent reads go out in chunks of player ids (SS1-24): the single pool-wide `IN` statement hit the anon role's
 * statement timeout in production (57014). Each chunk is its own exact-count, fail-closed read ordered by
 * (player id asc, date desc), matching idx_rpgm_player_date / the goalie primary key; at most
 * RECENT_CHUNK_CONCURRENCY chunks run at once.
 */
export const RECENT_ID_CHUNK = 20;
export const RECENT_CHUNK_CONCURRENCY = 2;
export type ChunkedRows<T> = { rows: T[] | null; failedIds: number[] };

/**
 * Read ids in ascending chunks; a failed chunk logs its reason and only its players lose recent form. Rows merge
 * in chunk order (ids ascending), so the result is stable whatever order the chunks finish in. All chunks failing
 * means the whole source is unavailable (null).
 */
async function chunkedRead<T>(what: string, ids: number[], read: (chunk: number[]) => Promise<T[]>): Promise<ChunkedRows<T>> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b), chunks: number[][] = [];
  for (let i = 0; i < sorted.length; i += RECENT_ID_CHUNK) chunks.push(sorted.slice(i, i + RECENT_ID_CHUNK));
  const results: (T[] | null)[] = new Array(chunks.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(RECENT_CHUNK_CONCURRENCY, chunks.length) }, async () => {
    while (next < chunks.length) {
      const index = next++;
      try { results[index] = await read(chunks[index]); }
      catch (reason) { console.warn(`[social-share] ${what} unavailable for ${chunks[index].length} players (chunk ${index + 1} of ${chunks.length}): ${failureReason(reason)}`); }
    }
  }));
  const failedIds = chunks.flatMap((chunk, index) => (results[index] === null ? chunk : []));
  return { rows: chunks.length && failedIds.length === sorted.length ? null : results.flatMap(rows => rows ?? []), failedIds };
}

/**
 * Last-five-games evidence for the ranking pool: strength-all rolling rows (skaters) and per-game WGO goalie
 * rows (goalies) within the lookback window, each chunk with an explicit, fail-closed limit. Skaters and goalies
 * stay isolated (SS1-17), and so do chunks (SS1-24): `failedIds` lists only the players whose chunk failed.
 */
export async function loadSharePlayerRecent(season: number, skaterIds: number[], goalieIds: number[], since: string): Promise<{ rolling: ShareRecentRollingRow[] | null; goalieGames: ShareGoalieGameRow[] | null; failedIds: number[] }> {
  const [rolling, goalieGames] = await Promise.all([
    chunkedRead<ShareRecentRollingRow>("Skater recent games", skaterIds, chunk => bounded<ShareRecentRollingRow>("Skater recent games", chunk.length * RECENT_LIMITS.skaterRowsPerPlayer, (from, to) => publicSupabase.from("rolling_player_game_metrics")
      .select(RECENT_SKATER_COLUMNS, { count: "exact" }).eq("season", season).eq("strength_state", "all").in("player_id", chunk).gte("game_date", since)
      // Unique order (C7 SS1-15-F2) in index order: player id, then newest game first.
      .order("player_id", { ascending: true }).order("game_date", { ascending: false }).range(from, to) as unknown as CountedPage<ShareRecentRollingRow>)),
    chunkedRead<ShareGoalieGameRow>("Goalie recent games", goalieIds, chunk => bounded<ShareGoalieGameRow>("Goalie recent games", chunk.length * RECENT_LIMITS.goalieRowsPerPlayer, (from, to) => publicSupabase.from("wgo_goalie_stats")
      .select(RECENT_GOALIE_COLUMNS, { count: "exact" }).eq("season_id", season).in("goalie_id", chunk).gte("date", since)
      .order("goalie_id", { ascending: true }).order("date", { ascending: false }).range(from, to) as unknown as CountedPage<ShareGoalieGameRow>)),
  ]);
  return { rolling: rolling.rows, goalieGames: goalieGames.rows, failedIds: [...rolling.failedIds, ...goalieGames.failedIds] };
}
/** A loggable reason for a failed read: the message and PostgREST code only, never rows or ids. */
function failureReason(reason: unknown) {
  if (reason && typeof reason === "object") {
    const { message, code } = reason as { message?: unknown; code?: unknown };
    return [typeof code === "string" ? code : null, typeof message === "string" ? message.slice(0, 200) : null].filter(Boolean).join(" ") || "unknown error";
  }
  return String(reason).slice(0, 200);
}
const RECENT_SKATER_COLUMNS = "player_id,season,game_date,strength_state,season_games_played,goals_total_last5,assists_total_last5,points_total_last5,shots_total_last5,hits_avg_last5,blocks_avg_last5,toi_seconds_avg_last5,pp_points_total_last5,toi_seconds_avg_season,line_combo_slot,line_combo_group,pp_unit,goals_total_all,assists_total_all,toi_seconds_total_last5,pp_toi_seconds_total_last5,pp_toi_seconds_avg_season";
const RECENT_GOALIE_COLUMNS = "goalie_id,date,season_id,games_played,wins,saves,shots_against,goals_against,quality_start,shutouts";

export async function loadSharePlayerSources(season: number, teams: string[]): Promise<SharePlayerSources> {
  if (!teams.length) return { yahoo: [], map: [], skaters: [], goalies: [] };
  const yahooSeason = Math.floor(season / 10000);
  const yahooTeams = [...new Set(teams.flatMap(team => [team, NHL_TO_YAHOO[team]].filter((item): item is string => !!item)))];
  const [yahoo, skaters, goalies] = await Promise.all([
    bounded<PickupOwnershipRow>("Yahoo ownership", PLAYER_SOURCE_LIMITS.yahoo, (from, to) => publicSupabase.from("yahoo_players")
      .select(YAHOO_COLUMNS, { count: "exact" }).eq("season", yahooSeason).lt("percent_ownership", 50).in("editorial_team_abbreviation", yahooTeams)
      .order("player_key", { ascending: true }).range(from, to) as unknown as CountedPage<PickupOwnershipRow>),
    bounded<ShareSkaterRow>("Skater season totals", PLAYER_SOURCE_LIMITS.skaters, (from, to) => publicSupabase.from("wgo_skater_stats_totals")
      .select(SKATER_COLUMNS, { count: "exact" }).eq("season", String(season)).in("current_team_abbreviation", teams)
      .order("player_id", { ascending: true }).range(from, to) as unknown as CountedPage<ShareSkaterRow>),
    bounded<ShareGoalieRow>("Goalie season totals", PLAYER_SOURCE_LIMITS.goalies, (from, to) => publicSupabase.from("wgo_goalie_stats_totals")
      .select(GOALIE_COLUMNS, { count: "exact" }).eq("season_id", season).in("current_team_abbreviation", teams)
      .order("goalie_id", { ascending: true }).range(from, to) as unknown as CountedPage<ShareGoalieRow>),
  ]);
  // The view keys some rows by player_key and some by bare player_id; ask for both, in bounded chunks.
  const ids = [...new Set(yahoo.flatMap(row => [row.player_key, row.player_id]).filter((id): id is string => !!id))];
  const map: ShareMapRow[] = [];
  for (let index = 0; index < ids.length; index += PLAYER_SOURCE_LIMITS.mapChunk) {
    const chunk = ids.slice(index, index + PLAYER_SOURCE_LIMITS.mapChunk);
    map.push(...await bounded<ShareMapRow>("Yahoo to NHL id map", chunk.length * 2, (from, to) => publicSupabase.from("yahoo_nhl_player_map_read")
      .select("yahoo_player_id,nhl_player_id", { count: "exact" }).in("yahoo_player_id", chunk)
      .order("yahoo_player_id", { ascending: true }).range(from, to) as unknown as CountedPage<ShareMapRow>));
  }
  return { yahoo, map, skaters, goalies };
}
