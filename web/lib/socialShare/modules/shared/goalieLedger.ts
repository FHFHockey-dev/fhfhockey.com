import type { Database } from "lib/supabase/database-generated.types";
import { teamsInfo } from "lib/teamsInfo";
import { lastN } from "./definitions";

type WgoGoalieRow = Database["public"]["Tables"]["wgo_goalie_stats"]["Row"];
type WgoTeamRow = Database["public"]["Tables"]["wgo_team_stats"]["Row"];
export const GOALIE_APPEARANCE_COLUMNS = ["goalie_id", "goalie_name", "date", "season_id", "game_id", "team_abbreviation", "opponent_team_abbrev", "home_road", "games_played", "games_started", "wins", "losses", "ot_losses", "saves", "shots_against", "goals_against", "time_on_ice", "shutouts", "quality_start"] as const satisfies readonly (keyof WgoGoalieRow)[];
export const TEAM_GAME_COLUMNS = ["team_id", "game_id", "date", "season_id", "opponent_id"] as const satisfies readonly (keyof WgoTeamRow)[];
export type GoalieAppearanceRow = Pick<WgoGoalieRow, typeof GOALIE_APPEARANCE_COLUMNS[number]>;
export type TeamGameRow = Pick<WgoTeamRow, typeof TEAM_GAME_COLUMNS[number]>;

/** One goalie in one completed game. Team is that game's team, so a traded goalie's games bind to the team he played for. */
export type GoalieAppearance = {
  goalieId: number; name: string | null; gameId: number; date: string; team: string; opponent: string | null; home: boolean | null;
  /** Official starter label; null means not labeled, which is not a relief appearance. */
  started: boolean | null;
  wins: number | null; losses: number | null; otLosses: number | null; saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null; toiSeconds: number | null; shutouts: number | null; qualityStart: number | null;
};
/** A completed team game: a season game the league's team-stats feed has reported for this team. */
export type CompletedTeamGame = { gameId: number; date: string; team: string };

const teamById = new Map(Object.entries(teamsInfo).map(([abbreviation, team]) => [team.id, abbreviation]));

export function toGoalieAppearances(rows: readonly GoalieAppearanceRow[], scope: { season: number; through: string }): GoalieAppearance[] {
  const seen = new Set<string>(), appearances: GoalieAppearance[] = [];
  for (const row of rows) {
    // Two 20262027 rows are dated June with no game id: not appearances.
    if (row.season_id !== scope.season || row.game_id == null || !row.team_abbreviation || row.date > scope.through || row.games_played === 0) continue;
    const key = `${row.goalie_id}:${row.game_id}`;
    if (seen.has(key)) throw new Error("Goalie appearance read returned a duplicate goalie game.");
    seen.add(key);
    appearances.push({ goalieId: row.goalie_id, name: row.goalie_name, gameId: row.game_id, date: row.date, team: row.team_abbreviation, opponent: row.opponent_team_abbrev, home: row.home_road === "H" ? true : row.home_road === "R" ? false : null,
      started: row.games_started === 1 ? true : row.games_started === 0 ? false : null,
      wins: row.wins, losses: row.losses, otLosses: row.ot_losses, saves: row.saves, shotsAgainst: row.shots_against, goalsAgainst: row.goals_against, toiSeconds: row.time_on_ice, shutouts: row.shutouts, qualityStart: row.quality_start });
  }
  return appearances.sort((a, b) => a.date.localeCompare(b.date) || a.gameId - b.gameId || a.goalieId - b.goalieId);
}
export function toCompletedTeamGames(rows: readonly TeamGameRow[], scope: { season: number; through: string }): CompletedTeamGame[] {
  const seen = new Set<string>(), games: CompletedTeamGame[] = [];
  for (const row of rows) {
    const team = teamById.get(row.team_id ?? -1);
    if (row.season_id !== scope.season || row.game_id == null || !team || row.date > scope.through) continue;
    const key = `${team}:${row.game_id}`;
    if (seen.has(key)) throw new Error("Team game read returned a duplicate team game.");
    seen.add(key);
    games.push({ gameId: row.game_id, date: row.date, team });
  }
  return games.sort((a, b) => a.date.localeCompare(b.date) || a.gameId - b.gameId);
}

export type TeamStartShareGoalie = { goalieId: number; name: string | null; starts: number; reliefAppearances: number; share: number };
export type TeamStartShare = {
  team: string; requested: number | null; teamGames: number; short: boolean; firstDate: string | null; lastDate: string | null;
  /** Null shares, and unresolved games listed, unless every window game has exactly one labeled starter. */
  unresolvedGames: number[]; goalies: TeamStartShareGoalie[]; complete: boolean;
};
/**
 * Official start share over a team's last N completed games (null = all games to date). The denominator is team games,
 * not goalie appearances, and relief appearances are counted apart. Descriptive only: this is no start probability.
 */
export function teamStartShare(team: string, games: readonly CompletedTeamGame[], appearances: readonly GoalieAppearance[], n: number | null, skip = 0): TeamStartShare {
  const teamGames = games.filter(game => game.team === team);
  const pool = skip > 0 ? teamGames.slice(0, Math.max(0, teamGames.length - skip)) : teamGames;
  const window = n === null ? { rows: pool, short: false, actual: pool.length } : lastN(pool, n);
  const ids = new Set(window.rows.map(game => game.gameId));
  const rows = appearances.filter(row => row.team === team && ids.has(row.gameId));
  const starters = new Map<number, number>(), goalies = new Map<number, TeamStartShareGoalie>();
  const unlabeled = new Set<number>();
  for (const row of rows) {
    const goalie = goalies.get(row.goalieId) ?? { goalieId: row.goalieId, name: row.name, starts: 0, reliefAppearances: 0, share: 0 };
    goalie.name = row.name ?? goalie.name;
    if (row.started === null) unlabeled.add(row.gameId);
    else if (row.started) { goalie.starts++; starters.set(row.gameId, (starters.get(row.gameId) ?? 0) + 1); }
    else goalie.reliefAppearances++;
    goalies.set(row.goalieId, goalie);
  }
  const unresolvedGames = window.rows.map(game => game.gameId).filter(id => unlabeled.has(id) || starters.get(id) !== 1);
  const complete = unresolvedGames.length === 0 && window.actual > 0;
  const list = [...goalies.values()].map(goalie => ({ ...goalie, share: complete ? goalie.starts / window.actual : 0 })).sort((a, b) => b.starts - a.starts || a.goalieId - b.goalieId);
  return { team, requested: n, teamGames: window.actual, short: window.short, firstDate: window.rows[0]?.date ?? null, lastDate: window.rows[window.rows.length - 1]?.date ?? null, unresolvedGames, goalies: list, complete };
}
