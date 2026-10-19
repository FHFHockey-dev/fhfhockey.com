import { describe, expect, it } from "vitest";

import {
  buildTeamStrengthPriorFromInHouseXgAggregateRow,
  buildTeamStrengthPriorFromNhlTeamDataRows
} from "./team-context-queries";

describe("buildTeamStrengthPriorFromInHouseXgAggregateRow", () => {
  it("maps in-house rolling team xG into projection team-strength prior fields", () => {
    const prior = buildTeamStrengthPriorFromInHouseXgAggregateRow({
      model_version: "logistic_l2-s20252026-p1-st1-f1-cfg9bac2706",
      feature_version: 1,
      as_of_game_date: "2026-05-01",
      window_games: 10,
      games_count: 10,
      xg_for: 31.24,
      xg_against: 27.91
    });

    expect(prior).toEqual({
      source: "nhl_xg_team_rolling_aggregates",
      sourceDate: "2026-05-01",
      xga: 27.91,
      xgaPerGame: 2.791,
      xgfPerGame: 3.124,
      sourceModelVersion: "logistic_l2-s20252026-p1-st1-f1-cfg9bac2706",
      featureVersion: 1,
      windowGames: 10
    });
  });

  it("rejects rows without a usable game denominator or xG totals", () => {
    expect(
      buildTeamStrengthPriorFromInHouseXgAggregateRow({
        games_count: 0,
        xg_for: 3,
        xg_against: 2
      })
    ).toBeNull();
    expect(
      buildTeamStrengthPriorFromInHouseXgAggregateRow({
        games_count: 10,
        xg_for: null,
        xg_against: 2
      })
    ).toBeNull();
  });
});

describe("buildTeamStrengthPriorFromNhlTeamDataRows", () => {
  // One row per NST season, as the view returns them on 2026-10-19.
  const rows = [
    { date: "2026-10-19", games_played: 8, xga: 210, xga_per_game: 3, xgf_per_game: 2.6 },
    { date: "2026-10-19", games_played: 8, xga: 246, xga_per_game: 3, xgf_per_game: 2.7 },
    { date: "2026-10-19", games_played: 8, xga: 24.8, xga_per_game: 3.1, xgf_per_game: 3.4 }
  ];

  it("picks the season-to-date row whose implied games played match", () => {
    for (const order of [rows, [...rows].reverse()]) {
      expect(buildTeamStrengthPriorFromNhlTeamDataRows(order)).toEqual({
        source: "nhl_team_data",
        sourceDate: "2026-10-19",
        xga: 24.8,
        xgaPerGame: 3.1,
        xgfPerGame: 3.4,
        rowSelection: {
          method: "implied_gp_match",
          candidateRows: 3,
          gamesPlayed: 8,
          impliedGamesPlayed: 8
        }
      });
    }
  });

  it("only considers rows from the latest date", () => {
    const prior = buildTeamStrengthPriorFromNhlTeamDataRows([
      { date: "2026-10-18", games_played: 7, xga: 21, xga_per_game: 3, xgf_per_game: 3 },
      ...rows
    ]);
    expect(prior?.sourceDate).toBe("2026-10-19");
    expect(prior?.rowSelection?.candidateRows).toBe(3);
  });

  it("tolerates a one-game NST lag but rejects prior-season rows", () => {
    expect(
      buildTeamStrengthPriorFromNhlTeamDataRows([
        { date: "2026-10-19", games_played: 9, xga: 24.8, xga_per_game: 3.1, xgf_per_game: 3.4 }
      ])?.rowSelection?.impliedGamesPlayed
    ).toBe(8);
    expect(buildTeamStrengthPriorFromNhlTeamDataRows(rows.slice(0, 2))).toBeNull();
  });

  it("uses a row without games played only when it is the only one", () => {
    const unknown = rows.map((row) => ({ ...row, games_played: null }));
    expect(buildTeamStrengthPriorFromNhlTeamDataRows(unknown)).toBeNull();
    expect(
      buildTeamStrengthPriorFromNhlTeamDataRows(unknown.slice(2))?.rowSelection
    ).toEqual({
      method: "single_row",
      candidateRows: 1,
      gamesPlayed: null,
      impliedGamesPlayed: null
    });
    expect(buildTeamStrengthPriorFromNhlTeamDataRows([])).toBeNull();
  });
});
