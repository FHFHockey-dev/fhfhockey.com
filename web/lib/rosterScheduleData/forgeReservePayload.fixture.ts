import { createHash } from "node:crypto";
import type { PlanningGame, PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";
import type { ForgeDailyBridgeInputs } from "./forgeDailyBridge";

/**
 * Full-coverage payload measurement for the FORGE reserve pass (TJ, 2026-10-26: measure before raising the budget).
 * A large league-wide fixture shaped like production (measured 10-26: 1065 planning players, 950 skaters, 115 goalies,
 * 94 team-games a week): 32 teams x (30 skaters + 4 goalies) plus 58 teamless players, 64-hex revisions, numeric
 * identity ids, uuid run ids, every skater with season totals (so every stat key is filled) and no lineup news (the
 * longest reserve note). `typical`: each team plays 3 days in 7 (about 48 games a week, the real week had 47);
 * `maximal`: every other day, 4 games per team (56 games), an upper bound.
 */
export const hex = (value: string) => createHash("sha256").update(value).digest("hex");
const uuid = (seed: string) => { const h = hex(seed); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
export const now = new Date("2026-10-26T12:00:00Z"), seasonId = 20262027;
export const TEAMS = 32, SKATERS = 30, GOALIES = 4, LINEUP = 18;
const abbreviation = (team: number) => `T${String(team).padStart(2, "0")}`;

export type Shape = "typical" | "maximal";
export function league(days: number, shape: Shape = "typical") {
  const players: PlanningPlayer[] = [], games: PlanningGame[] = [];
  const run = { run_id: uuid("run"), as_of_date: "2026-10-26", created_at: "2026-10-26T10:00:00Z", git_sha: "a".repeat(40), external_input_proven: true };
  const skaters: Record<string, unknown>[] = [], goalies: Record<string, unknown>[] = [], reserves: Record<string, unknown>[] = [];
  const goalieShares: Record<string, unknown>[] = [], seasonTotals: Record<string, unknown>[] = [];
  let nextId = 30000;
  // Teams playing that day, paired in order (an odd one out sits).
  const schedule = new Map<number, Array<{ gameId: number; startsAt: string; opponent: number; home: boolean }>>();
  for (let day = 0; day < days; day++) {
    const date = new Date(Date.parse("2026-10-27T23:00:00Z") + day * 86400000).toISOString();
    const playing = Array.from({ length: TEAMS }, (_, team) => team + 1)
      .filter(team => shape === "maximal" ? (team + day) % 2 === 0 : [0, 2, 4].includes((team + day) % 7));
    for (let index = 0; index + 1 < playing.length; index += 2) {
      const [home, away] = [playing[index], playing[index + 1]], gameId = 2026020200 + day * 20 + index / 2;
      for (const [team, opponent, isHome] of [[home, away, true], [away, home, false]] as const)
        schedule.set(team, [...(schedule.get(team) ?? []), { gameId, startsAt: date, opponent, home: isHome }]);
    }
  }
  for (let team = 1; team <= TEAMS; team++) {
    const abbrev = abbreviation(team), own = schedule.get(team)!;
    for (const game of own) games.push({ id: String(game.gameId), scheduleRevision: hex(`${game.gameId}:${team}`), date: game.startsAt.slice(0, 10),
      startsAt: game.startsAt, teamAbbreviation: abbrev, opponent: abbreviation(game.opponent), home: game.home, status: "scheduled" });
    // FORGE's run projected each team's next game (the run's own slate) for its lineup and reserves.
    const first = own[0];
    for (let index = 0; index < SKATERS + GOALIES; index++) {
      const nhlId = 8470000 + team * 100 + index, goalie = index >= SKATERS;
      players.push({ id: String(nextId++), nhlId, nhlTeamId: team, rosterRevision: hex(`roster:${nhlId}`), name: `Player ${team}-${index} Lastname`,
        teamAbbreviation: abbrev, eligiblePositions: [goalie ? "G" : index % 3 === 0 ? "D" : "C"], eligibilityVerified: false,
        playerClass: goalie ? "goalie" : "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] });
      const scope = { run_id: run.run_id, as_of_date: run.as_of_date, horizon_games: 1, game_id: first.gameId, player_id: nhlId, team_id: team, opponent_team_id: first.opponent };
      const line = { proj_goals_es: 0.1834, proj_goals_pp: 0.0412, proj_assists_es: 0.2217, proj_assists_pp: 0.0623, proj_shots_es: 1.8731,
        proj_shots_pp: 0.3127, proj_toi_es_seconds: 812, proj_toi_pp_seconds: 104, proj_hits: 1.2213, proj_blocks: 0.7342 };
      if (!goalie) {
        seasonTotals.push({ player_id: nhlId, season: String(seasonId), games_played: 9, goals: 2, gw_goals: 0, penalty_minutes: 4, plus_minus: -1,
          sh_goals: 0, sh_assists: 0, sh_points: 0, total_fow: 31, total_fol: 29 });
        if (index < LINEUP) skaters.push({ ...scope, ...line, proj_goals_pk: null, proj_assists_pk: null, proj_shots_pk: null, proj_toi_pk_seconds: null, proj_pim: null, proj_plus_minus: null });
        else reserves.push({ ...scope, ...line, player_class: "skater", conditioning: "if_dressed", reserve_reason: "not_in_lineup" });
      } else if (index === SKATERS) {
        goalies.push({ ...scope, goalie_id: nhlId, starter_probability: 0.62, proj_saves: 24.8713, proj_goals_allowed: 2.7412,
          proj_shots_against: 27.6125, proj_win_prob: 0.2914, proj_shutout_prob: 0.0512 });
      } else reserves.push({ ...scope, player_class: "goalie", conditioning: "if_starts", reserve_reason: "backup_goalie",
        proj_saves: 23.9124, proj_goals_allowed: 2.9133, proj_shots_against: 26.8257, proj_shutout_prob: 0.0413 });
      // The usual pair have start shares; the third and fourth goalies have none (unknown start chance).
      if (goalie && index <= SKATERS + 1) goalieShares.push({ player_id: nhlId, team_id: team, game_id: first.gameId, game_date: first.startsAt.slice(0, 10),
        l10_start_pct: index === SKATERS ? 0.7 : 0.3, season_start_pct: null, updated_at: "2026-10-26T09:00:00Z" });
    }
  }
  for (let index = 0; index < 58; index++) players.push({ id: String(nextId++), nhlId: 8490000 + index, name: `Teamless ${index}`, teamAbbreviation: null,
    eligiblePositions: ["C"], eligibilityVerified: false, playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] });
  const inputs: ForgeDailyBridgeInputs = { runs: [run], skaters, goalies, goalieShares, seasonTotals, reserves, goalieNews: { assertions: [], conflicts: [] } };
  return { players, games, inputs };
}
