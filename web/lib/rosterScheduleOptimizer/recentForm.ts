import type { PlanningPlayer, ScoringCategory } from "./planningTypes";

/** Played games summed into `PlanningPlayer.recentTotals`. */
export const RECENT_GAMES = 10;
/** The per-game WGO column behind each points-league stat Yahoo scores per game (the same columns the Yahoo past-lineup
 * points read uses); ratio stats can't be scored per game. */
export const SKATER_RECENT_COLUMNS: Readonly<Record<string, string>> = { GOALS: "goals", ASSISTS: "assists", POINTS: "points",
  PLUS_MINUS: "plus_minus", PENALTY_MINUTES: "penalty_minutes", PP_GOALS: "pp_goals", PP_ASSISTS: "pp_assists", PP_POINTS: "pp_points",
  SH_GOALS: "sh_goals", SH_ASSISTS: "sh_assists", SH_POINTS: "sh_points", GAME_WINNING_GOALS: "gw_goals", SHOTS_ON_GOAL: "shots",
  FACEOFFS_WON: "total_fow", FACEOFFS_LOST: "total_fol", HITS: "hits", BLOCKED_SHOTS: "blocked_shots" };
export const GOALIE_RECENT_COLUMNS: Readonly<Record<string, string>> = { WINS_GOALIE: "wins", LOSSES_GOALIE: "losses",
  GOALS_AGAINST_GOALIE: "goals_against", SHOTS_AGAINST_GOALIE: "shots_against", SAVES_GOALIE: "saves", SHUTOUTS_GOALIE: "shutouts",
  GAMES_STARTED: "games_started" };
const isGoalieStat = (key: string) => key.endsWith("_GOALIE") || ["GAMES_STARTED", "GOALS_AGAINST_AVERAGE", "SAVE_PERCENTAGE"].includes(key);

/** Played games shown as the candidate card's last-5 box score (`PlanningPlayer.lastFive`). */
export const LAST_FIVE_GAMES = 5;
/** The box-score keys the card shows, in display order; goalie SV% is pooled from saves over shots against. */
export const SKATER_LAST_FIVE_KEYS = ["GOALS", "ASSISTS", "POINTS", "SHOTS_ON_GOAL", "PP_POINTS", "HITS", "BLOCKED_SHOTS"] as const;
export const GOALIE_LAST_FIVE_KEYS = ["WINS_GOALIE", "GOALS_AGAINST_GOALIE", "SAVES_GOALIE", "SHOTS_AGAINST_GOALIE"] as const;

type Row = Record<string, unknown>;
/** Sums of one player's last played games, newest first. A mapped key with a missing value in any summed game is null;
 * a mapped key absent from `stats` summed to 0 (zeros are left out to keep snapshots small). */
export function recentTotals(rows: Row[], playerClass: PlanningPlayer["playerClass"], games = RECENT_GAMES,
  keys?: readonly string[]): NonNullable<PlanningPlayer["recentTotals"]> | null {
  const mapped = playerClass === "goalie" ? GOALIE_RECENT_COLUMNS : SKATER_RECENT_COLUMNS;
  const columns = keys ? Object.fromEntries(keys.map(key => [key, mapped[key]])) : mapped;
  const played = rows.filter(row => Number(row.games_played) > 0).slice(0, games);
  if (!played.length) return null;
  const stats: Record<string, number | null> = {};
  for (const [key, column] of Object.entries(columns)) {
    let total: number | null = 0;
    for (const row of played) {
      const raw = row[column], value = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
      if (!Number.isFinite(value)) { total = null; break; }
      total += value;
    }
    if (total !== 0) stats[key] = total;
  }
  return { games: played.length, stats };
}

/** The candidate card's last-5 box score: the same sums as `recentTotals` over at most five played games and only
 * the shown keys, from the same WGO rows. */
export const lastFiveTotals = (rows: Row[], playerClass: PlanningPlayer["playerClass"]) =>
  recentTotals(rows, playerClass, LAST_FIVE_GAMES, playerClass === "goalie" ? GOALIE_LAST_FIVE_KEYS : SKATER_LAST_FIVE_KEYS);

/** League-scored fantasy points per game over the recent games; null outside points leagues, without recent totals,
 * or when a weighted stat can't be scored per game or is missing. A hint only: never a projection input. */
export function recentPointsPerGame(player: Pick<PlanningPlayer, "playerClass" | "recentTotals">,
  scoring: { mode: "points" | "categories"; weights: Record<string, number>; categories?: ScoringCategory[] }): number | null {
  const recent = player.recentTotals;
  if (scoring.mode !== "points" || !recent?.games) return null;
  const goalie = player.playerClass === "goalie", columns = goalie ? GOALIE_RECENT_COLUMNS : SKATER_RECENT_COLUMNS;
  const weights = Object.entries(scoring.weights).filter(([key, weight]) => Number.isFinite(weight) && weight !== 0 && isGoalieStat(key) === goalie);
  if (!weights.length) return null;
  let total = 0;
  for (const [key, weight] of weights) {
    if (!(key in columns)) return null;
    const value = recent.stats[key] === undefined ? 0 : recent.stats[key];
    if (value === null || !Number.isFinite(value)) return null;
    total += value * weight;
  }
  return total / recent.games;
}
