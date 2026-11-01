import { describe, expect, it } from "vitest";
import { teamStartShare, toCompletedTeamGames, toGoalieAppearances, type CompletedTeamGame, type GoalieAppearance, type GoalieAppearanceRow, type TeamGameRow } from "./goalieLedger";
import { appearancesByPlayer, toSkaterAppearances, type SkaterAppearanceRow } from "./skaterAppearances";

const season = 20262027, scope = { season, through: "2026-10-30" };
const skater = (over: Partial<SkaterAppearanceRow>): SkaterAppearanceRow => ({ player_id: 1, player_name: "A", position_code: "C", date: "2026-10-10", season_id: season, game_id: 100, team_abbrev: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, goals: 0, assists: 0, points: 0, shots: 0, hits: 0, blocked_shots: 0, pp_points: 0, toi_per_game: 900, pp_toi: 0, penalty_minutes: 0, ...over });
const goalieRow = (over: Partial<GoalieAppearanceRow>): GoalieAppearanceRow => ({ goalie_id: 30, goalie_name: "G", date: "2026-10-10", season_id: season, game_id: 100, team_abbreviation: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, games_started: 1, wins: 1, losses: 0, ot_losses: 0, saves: 27, shots_against: 30, goals_against: 3, time_on_ice: 3600, shutouts: 0, quality_start: 1, ...over });

describe("skater appearances", () => {
  it("keeps known zeros and null stats apart, and binds team to the game", () => {
    const [row] = toSkaterAppearances([skater({ hits: null, team_abbrev: "NYI" })], scope);
    expect(row).toMatchObject({ hits: null, shots: 0, team: "NYI", group: "F", home: true, toiSeconds: 900 });
  });
  it("drops non-appearances and refuses duplicates", () => {
    expect(toSkaterAppearances([skater({ game_id: null }), skater({ season_id: 20252026 }), skater({ date: "2026-10-31" }), skater({ games_played: 0 })], scope)).toEqual([]);
    expect(() => toSkaterAppearances([skater({}), skater({})], scope)).toThrow("duplicate");
  });
  it("groups each player's games oldest first", () => {
    const rows = toSkaterAppearances([skater({ game_id: 102, date: "2026-10-12" }), skater({ game_id: 100 }), skater({ player_id: 2, position_code: "D" })], scope);
    expect(appearancesByPlayer(rows).get(1)?.map(row => row.gameId)).toEqual([100, 102]);
    expect(appearancesByPlayer(rows).get(2)?.[0].group).toBe("D");
  });
});

describe("goalie ledger", () => {
  it("skips June-dated rows without a game id and keeps an unlabeled starter distinct from relief", () => {
    const rows = toGoalieAppearances([goalieRow({ game_id: null, date: "2026-06-14" }), goalieRow({ games_started: null }), goalieRow({ goalie_id: 31, games_started: 0 })], scope);
    expect(rows.map(row => row.started)).toEqual([null, false]);
  });
  it("maps team ids and refuses duplicate team games", () => {
    const row: TeamGameRow = { team_id: 1, game_id: 100, date: "2026-10-10", season_id: season, opponent_id: 2 };
    expect(toCompletedTeamGames([row], scope)).toEqual([{ gameId: 100, date: "2026-10-10", team: "NJD" }]);
    expect(() => toCompletedTeamGames([row, row], scope)).toThrow("duplicate");
  });
  const games: CompletedTeamGame[] = [1, 2, 3, 4].map(id => ({ gameId: id, date: `2026-10-0${id}`, team: "NJD" }));
  const appearance = (gameId: number, goalieId: number, started: boolean | null, team = "NJD"): GoalieAppearance => ({ goalieId, name: `G${goalieId}`, gameId, date: `2026-10-0${gameId}`, team, opponent: "NYR", home: true, started, wins: null, losses: null, otLosses: null, saves: null, shotsAgainst: null, goalsAgainst: null, toiSeconds: null, shutouts: null, qualityStart: null });
  it("uses team games as the denominator and counts relief apart", () => {
    const share = teamStartShare("NJD", games, [appearance(1, 30, true), appearance(2, 30, true), appearance(3, 31, true), appearance(3, 30, false), appearance(4, 30, true)], 10);
    expect(share).toMatchObject({ teamGames: 4, requested: 10, short: true, complete: true, unresolvedGames: [] });
    expect(share.goalies.map(goalie => [goalie.goalieId, goalie.starts, goalie.reliefAppearances, goalie.share])).toEqual([[30, 3, 1, 0.75], [31, 1, 0, 0.25]]);
  });
  it("withholds shares when a game has no single labeled starter", () => {
    const share = teamStartShare("NJD", games.slice(0, 3), [appearance(1, 30, true), appearance(2, 30, null), appearance(3, 30, true), appearance(3, 31, true)], 10);
    expect(share).toMatchObject({ complete: false, unresolvedGames: [2, 3] });
    expect(share.goalies.every(goalie => goalie.share === 0)).toBe(true);
  });
  it("binds a traded goalie's games to the team he played for", () => {
    const share = teamStartShare("NJD", games.slice(0, 2), [appearance(1, 30, true), appearance(2, 31, true), appearance(2, 30, true, "NYR")], 2);
    expect(share.goalies.map(goalie => [goalie.goalieId, goalie.starts])).toEqual([[30, 1], [31, 1]]);
  });
  it("offers a labeled comparison window before the recent one", () => {
    const share = teamStartShare("NJD", games, [appearance(1, 30, true), appearance(2, 31, true)], 2, 2);
    expect(share).toMatchObject({ teamGames: 2, firstDate: "2026-10-01", lastDate: "2026-10-02", complete: true });
  });
});
