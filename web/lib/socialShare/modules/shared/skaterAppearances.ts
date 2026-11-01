import type { Database } from "lib/supabase/database-generated.types";

type WgoSkaterRow = Database["public"]["Tables"]["wgo_skater_stats"]["Row"];
export const SKATER_APPEARANCE_COLUMNS = ["player_id", "player_name", "position_code", "date", "season_id", "game_id", "team_abbrev", "opponent_team_abbrev", "home_road", "games_played", "goals", "assists", "points", "shots", "hits", "blocked_shots", "pp_points", "toi_per_game", "pp_toi", "penalty_minutes"] as const satisfies readonly (keyof WgoSkaterRow)[];
export type SkaterAppearanceRow = Pick<WgoSkaterRow, typeof SKATER_APPEARANCE_COLUMNS[number]>;

/** One skater in one completed game. A DNP has no row; a null stat is missing, never zero. Team is that game's team. */
export type SkaterAppearance = {
  playerId: number; name: string | null; position: string | null; group: "F" | "D" | null;
  gameId: number; date: string; team: string | null; opponent: string | null; home: boolean | null;
  goals: number | null; assists: number | null; points: number | null;
  shots: number | null; hits: number | null; blocks: number | null; ppPoints: number | null;
  toiSeconds: number | null; ppToiSeconds: number | null; penaltyMinutes: number | null;
};
const group = (position: string | null) => position === "D" ? "D" as const : position && ["C", "L", "R", "F"].includes(position) ? "F" as const : null;

/** Oldest first, one player's rows together. Rows for other seasons, past the cutoff or without a game id are not appearances. */
export function toSkaterAppearances(rows: readonly SkaterAppearanceRow[], scope: { season: number; through: string }): SkaterAppearance[] {
  const seen = new Set<string>(), appearances: SkaterAppearance[] = [];
  for (const row of rows) {
    if (row.season_id !== scope.season || row.game_id == null || row.date > scope.through || row.games_played === 0) continue;
    const key = `${row.player_id}:${row.game_id}`;
    if (seen.has(key)) throw new Error("Skater appearance read returned a duplicate player game.");
    seen.add(key);
    appearances.push({ playerId: row.player_id, name: row.player_name, position: row.position_code, group: group(row.position_code), gameId: row.game_id, date: row.date, team: row.team_abbrev, opponent: row.opponent_team_abbrev, home: row.home_road === "H" ? true : row.home_road === "R" ? false : null,
      goals: row.goals, assists: row.assists, points: row.points, shots: row.shots, hits: row.hits, blocks: row.blocked_shots, ppPoints: row.pp_points, toiSeconds: row.toi_per_game, ppToiSeconds: row.pp_toi, penaltyMinutes: row.penalty_minutes });
  }
  return appearances.sort((a, b) => a.playerId - b.playerId || a.date.localeCompare(b.date) || a.gameId - b.gameId);
}
/** Appearances by player, each oldest first, ready for lastN/previousN. */
export function appearancesByPlayer(appearances: readonly SkaterAppearance[]) {
  const players = new Map<number, SkaterAppearance[]>();
  for (const row of appearances) { const list = players.get(row.playerId); if (list) list.push(row); else players.set(row.playerId, [row]); }
  return players;
}
