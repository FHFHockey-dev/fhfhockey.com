import { describe, expect, it } from "vitest";

import { buildTeamStrengthPriorFromInHouseXgAggregateRow } from "./team-context-queries";

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
