import type { SupabaseClient } from "@supabase/supabase-js";
import { pages } from "./planningInputs";

type Row = Record<string, any>;

/**
 * The current season's Yahoo ownership, newest reading per NHL player, from the history the live Yahoo player job writes
 * (`upsert_yahoo_players_atomic` → `yahoo_player_ownership_history`). The legacy `yahoo_player_ownership_daily` table
 * stopped at 2024-25 and is never read (Astra 2026-11-23). The game is resolved from `yahoo_game_keys` for the NHL
 * season's start year, and rows join to NHL ids on the full Yahoo player key (`<game>.p.<id>`), which is what
 * `yahoo_nhl_player_map_read.yahoo_player_id` carries. A key with no unique NHL match is skipped (unknown, never 0%).
 * Throws when the game is not exactly one numeric NHL key for that season, or a read is incomplete.
 */
export async function readYahooOwnership(db: SupabaseClient<any>, seasonId: number, now: Date, deadline: number) {
  const season = Math.floor(seasonId / 10000);
  const games = await pages(() => db.from("yahoo_game_keys").select("game_key,season,code", { count: "exact" })
    .eq("code", "nhl").eq("season", season).order("game_key"), deadline, 2, row => row.game_key);
  const gameKey = games.length === 1 && Number(games[0].season) === season && games[0].code === "nhl" ? String(games[0].game_key) : "";
  if (!/^\d+$/.test(gameKey)) throw new Error("Yahoo game context is not unique");
  const since = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
  const [ownership, mapping] = await Promise.all([
    pages(() => db.from("yahoo_player_ownership_history").select("player_key,game_id,ownership_pct,ownership_date", { count: "exact" })
      .eq("game_id", gameKey).gte("ownership_date", since).order("ownership_date", { ascending: false }).order("player_key"),
    deadline, 25000, row => [row.ownership_date, row.player_key]),
    pages(() => db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id", { count: "exact" })
      .like("yahoo_player_id", `${gameKey}.p.%`).order("nhl_player_id").order("yahoo_player_id"),
    deadline, 25000, row => [row.nhl_player_id, row.yahoo_player_id]),
  ]);
  const keyPattern = new RegExp(`^${gameKey}\\.p\\.\\d+$`);
  const nhlByKey = new Map<string, Set<number>>();
  for (const row of mapping) {
    const key = String(row.yahoo_player_id);
    if (keyPattern.test(key)) nhlByKey.set(key, new Set([...nhlByKey.get(key) ?? [], Number(row.nhl_player_id)]));
  }
  // Rows arrive newest first, so the first row kept per player is his latest reading.
  const latest = new Map<number, Row>();
  for (const row of ownership) {
    const key = String(row.player_key);
    if (String(row.game_id) !== gameKey || !keyPattern.test(key)) continue;
    const matches = nhlByKey.get(key);
    if (matches?.size !== 1) continue;
    const nhl = [...matches][0];
    if (!latest.has(nhl)) latest.set(nhl, row);
  }
  return { gameKey, latest, observedOn: ownership[0]?.ownership_date ?? null };
}
