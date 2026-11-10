import { describe, expect, it } from "vitest";
import {
  reconcileGoaliePopulation,
  type GoalieGameSourceRow,
  type GoalieScheduleRow,
  type OfficialGoalieAppearanceRow,
} from "./goaliePopulation";

const SEASON = 20262027;
const through = "2026-11-08";
const teams = new Map([
  [10, { id: 10, abbreviation: "AAA" }],
  [20, { id: 20, abbreviation: "BBB" }],
]);
const game = (id = 1, date = "2026-10-01", overrides: Partial<GoalieScheduleRow> = {}): GoalieScheduleRow => ({
  id, date, seasonId: SEASON, type: 2, homeTeamId: 10, awayTeamId: 20, ...overrides,
});
const official = (goalieId = 1, gameId = 1, date = "2026-10-01", overrides: Partial<OfficialGoalieAppearanceRow> = {}): OfficialGoalieAppearanceRow => ({
  goalie_id: goalieId, goalie_name: `Goalie ${goalieId}`, game_id: gameId,
  date, season_id: SEASON, team_abbreviation: "AAA", home_road: "H",
  games_played: 1, games_started: 1, wins: 1, saves: 27, shots_against: 30,
  goals_against: 3, time_on_ice: 3600, quality_start: 1, ...overrides,
});
const advanced = (overrides: Partial<GoalieGameSourceRow> = {}): GoalieGameSourceRow => ({
  player_id: 1, player_name: "Stale Name", date: "2026-10-01", season_id: SEASON,
  team_id: 10, team_id_source: "wgo_game_team", games_played: 1, games_started: 1,
  wins: 0, saves: 1, shots_against: 2, goals_against: 1, time_on_ice: 120,
  quality_start: 0, nst_5v5_counts_toi: 3000, nst_5v5_counts_xg_against: 4,
  nst_5v5_counts_goals_against: 3, nst_5v5_counts_gsaa: 1,
  nst_5v5_counts_saves: 22, nst_5v5_counts_shots_against: 25,
  nst_5v5_counts_hd_saves: 7, nst_5v5_counts_hd_shots_against: 8, ...overrides,
});
const run = (overrides: Partial<Parameters<typeof reconcileGoaliePopulation>[0]> = {}) => reconcileGoaliePopulation({
  season: SEASON, through, teams, games: [game()], official: [official()],
  unified: [advanced()], completedTeamGames: [], ...overrides,
});

describe("goaliePopulation", () => {
  it("keeps all official starters and relief appearances when advanced rows are absent", () => {
    const result = run({ official: [official(), official(2, 1, "2026-10-01", { games_started: 0 }), official(3, 2, "2026-10-02")], games: [game(), game(2, "2026-10-02")] });
    expect(result.rows.map((row) => row.player_id).sort()).toEqual([1, 2, 3]);
    expect(result.diagnostics.officialAppearances).toBe(3);
    expect(result.diagnostics.missingAdvancedAppearances).toBe(2);
    expect(result.rows.find((row) => row.player_id === 2)).toMatchObject({ games_played: 1, games_started: 0, saves: 27, nst_5v5_counts_xg_against: null });
    expect(result.latestObservationDate).toBe("2026-10-02");
  });

  it("takes official counting stats from WGO and only advanced stats from enrichment", () => {
    const row = run().rows[0];
    expect(row).toMatchObject({ game_id: 1, player_id: 1, player_name: "Goalie 1", team_id: 10, team_id_source: "wgo_game_team", games_played: 1, games_started: 1, saves: 27, shots_against: 30, goals_against: 3, time_on_ice: 3600, wins: 1, quality_start: 1, nst_5v5_counts_saves: 22, nst_5v5_counts_shots_against: 25 });
  });

  it("excludes nonappearances, wrong seasons, future games, preseason and playoffs with explicit identity gaps", () => {
    const result = run({
      games: [game(), game(2, "2026-10-02", { type: 1 }), game(3, "2026-10-03", { type: 3 }), game(4, "2026-12-01")],
      official: [official(), official(2, 1, "2026-10-01", { games_played: 0 }), official(3, 1, "2026-10-01", { season_id: 20252026 }), official(4, 4, "2026-12-01"), official(5, 2, "2026-10-02"), official(6, 3, "2026-10-03"), official(7, 1, "2026-10-01", { game_id: null }), official(8, 1, "2026-10-02")],
    });
    expect(result.rows.map((row) => row.player_id)).toEqual([1]);
    expect(result.diagnostics.excluded).toEqual({ outsideScope: 2, nonAppearance: 1, missingGameIdentity: 1, nonRegular: 2, missingSchedule: 0, dateMismatch: 1 });
    expect(result.sourceWarnings).toContain("partial_goalie_population_identity");
  });

  it("distinguishes a missing schedule record from a known nonregular game", () => {
    const result = run({ official: [official(), official(2, 99)] });
    expect(result.rows.map((row) => row.player_id)).toEqual([1]);
    expect(result.diagnostics.excluded.missingSchedule).toBe(1);
    expect(result.sourceWarnings).toContain("partial_goalie_population_schedule");
  });

  it("never adds a player or an appearance from an unmatched materialization row", () => {
    const result = run({ unified: [advanced(), advanced({ player_id: 99 })] });
    expect(result.rows.map((row) => row.player_id)).toEqual([1]);
    expect(result.diagnostics.unmatchedUnifiedKeys).toEqual(["99:2026-10-01"]);
    expect(result.sourceWarnings).toContain("partial_goalie_population_reconciliation");
    expect(run({ official: [] }).rows).toEqual([]);
  });

  it("refuses duplicate official player/game identity instead of doubling or silently dropping it", () => {
    expect(() => run({ official: [official(), official(1, 1, "2026-10-01", { saves: 10 })] })).toThrow("Duplicate official goalie player/game appearance");
  });

  it("keeps the official appearance but suppresses ambiguous duplicated advanced rows", () => {
    const result = run({ unified: [advanced(), advanced({ nst_5v5_counts_xg_against: 99 })] });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ saves: 27, nst_5v5_counts_xg_against: null });
    expect(result.rows[0].populationWarnings).toContain("partial_goalie_advanced_identity");
  });

  it("rejects conflicting verified advanced team identity", () => {
    const row = run({ unified: [advanced({ team_id: 20 })] }).rows[0];
    expect(row).toMatchObject({ team_id: 10, saves: 27, nst_5v5_counts_xg_against: null });
    expect(row.populationWarnings).toContain("partial_goalie_advanced_identity");
  });

  it("repairs a roster-fallback team from the official game without discarding correctly matched advanced counts", () => {
    const row = run({ unified: [advanced({ team_id: 20, team_id_source: "players_team_id_fallback" })] }).rows[0];
    expect(row).toMatchObject({ team_id: 10, team_id_source: "wgo_game_team", nst_5v5_counts_xg_against: 4 });
  });

  it("does not reuse one player/date advanced sample across two actual games", () => {
    const result = run({ games: [game(), game(2)], official: [official(), official(1, 2)] });
    expect(result.rows.map((row) => row.game_id)).toEqual([1, 2]);
    expect(result.rows.every((row) => row.nst_5v5_counts_xg_against == null)).toBe(true);
    expect(result.diagnostics.missingAdvancedAppearances).toBe(2);
  });

  it("does not enrich a regular game from an ambiguous same-date nonregular appearance", () => {
    const result = run({ games: [game(), game(2, "2026-10-01", { type: 1 })], official: [official(), official(1, 2)] });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].nst_5v5_counts_xg_against).toBeNull();
    expect(result.rows[0].populationWarnings).toContain("partial_goalie_advanced_identity");
  });

  it("does not treat an identified preseason appearance as a missing regular-season cohort member", () => {
    const result = run({ games: [game(), game(2, "2026-10-01", { type: 1 })],
      official: [official(), official(99, 2)], unified: [advanced(), advanced({ player_id: 99 })] });
    expect(result.rows.map((row) => row.player_id)).toEqual([1]);
    expect(result.diagnostics.unmatchedUnifiedKeys).toEqual([]);
    expect(result.rows[0].relativeSavePopulationComplete).not.toBe(false);
  });

  it("marks an unresolved extra advanced appearance's team window unsafe for relative-save baselines", () => {
    const result = run({ unified: [advanced(), advanced({ player_id: 99 })] });
    expect(result.rows[0].relativeSavePopulationComplete).toBe(false);
    expect(result.rows[0].populationWarnings).toContain("partial_goalie_relative_population");
    expect(result.rows[0].saves).toBe(27);
  });

  it("retains a long-absent goalie and a debut independently of recent advanced dates", () => {
    const result = run({ games: [game(), game(2, "2026-11-08")], official: [official(), official(2, 2, "2026-11-08")], unified: [] });
    expect(result.rows.map((row) => row.player_id)).toEqual([2, 1]);
    expect(result.rows.map((row) => row.date)).toEqual(["2026-11-08", "2026-10-01"]);
  });

  it("uses completed team games to reveal a wholly missing goalie date", () => {
    const result = run({ games: [game(), game(2, "2026-10-02")], completedTeamGames: [{ game_id: 2, date: "2026-10-02", season_id: SEASON, team_id: 10 }] });
    expect(result.latestObservationDate).toBe("2026-10-02");
    expect(result.diagnostics.missingCompletedTeamGames).toEqual(["10:2"]);
    expect(result.sourceWarnings).toContain("partial_goalie_official_game_coverage");
    expect(result.teamGames.map((row) => row.id)).toEqual([1, 2]);
  });

  it("keeps an empty official population explicit when completed games exist", () => {
    const result = run({ official: [], unified: [], completedTeamGames: [{ game_id: 1, date: "2026-10-01", season_id: SEASON, team_id: 10 }] });
    expect(result.rows).toEqual([]);
    expect(result.latestObservationDate).toBe("2026-10-01");
    expect(result.sourceWarnings).toContain("partial_goalie_official_game_coverage");
  });

  it("does not move the cutoff for invalid completed-game rows", () => {
    const result = run({ games: [game(), game(2, "2026-10-02")], completedTeamGames: [
      { game_id: 2, date: "2026-10-02", season_id: SEASON, team_id: 99 },
      { game_id: 2, date: "2026-10-03", season_id: SEASON, team_id: 10 },
      { game_id: 2, date: "2026-10-02", season_id: 20252026, team_id: 10 },
    ] });
    expect(result.latestObservationDate).toBe("2026-10-01");
    expect(result.diagnostics.missingCompletedTeamGames).toEqual([]);
  });

  it("rejects duplicate completed-team and schedule identities", () => {
    const completed = { game_id: 1, date: "2026-10-01", season_id: SEASON, team_id: 10 };
    expect(() => run({ completedTeamGames: [completed, completed] })).toThrow("Duplicate completed goalie team/game identity");
    expect(() => run({ games: [game(), game()] })).toThrow("Duplicate regular-season game identity");
  });

  it.each(["X", null])("keeps ambiguous historical team attribution unknown for side %s", (side) => {
    const duplicateAbbreviationTeams = new Map([[59, { id: 59, abbreviation: "UTA" }], [68, { id: 68, abbreviation: "UTA" }]]);
    const row = run({ teams: duplicateAbbreviationTeams, games: [game(1, "2026-10-01", { homeTeamId: 68, awayTeamId: 59 })], official: [official(1, 1, "2026-10-01", { team_abbreviation: "UTA", home_road: side })] }).rows[0];
    expect(row.team_id).toBeNull();
    expect(row.saves).toBe(27);
    expect(row.populationWarnings).toContain("partial_goalie_team_attribution");
  });

  it("uses the game's side to resolve repeated Utah abbreviations without current-roster inference", () => {
    const duplicateAbbreviationTeams = new Map([[59, { id: 59, abbreviation: "UTA" }], [68, { id: 68, abbreviation: "UTA" }]]);
    const row = run({ teams: duplicateAbbreviationTeams, games: [game(1, "2026-10-01", { homeTeamId: 68, awayTeamId: 59 })], official: [official(1, 1, "2026-10-01", { team_abbreviation: "UTA" })], unified: [] }).rows[0];
    expect(row.team_id).toBe(68);
  });

  it("does not mutate any input inventory", () => {
    const inputs = { season: SEASON, through, teams, games: [game()], official: [official()], unified: [advanced()], completedTeamGames: [] };
    const before = JSON.stringify(inputs);
    reconcileGoaliePopulation(inputs);
    expect(JSON.stringify(inputs)).toBe(before);
  });
});
