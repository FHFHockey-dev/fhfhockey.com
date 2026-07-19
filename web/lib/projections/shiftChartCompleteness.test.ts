import { describe, expect, it } from "vitest";

import {
  classifyShiftChartStrengthGame,
  classifyShiftChartStrengthRow,
  parseStrictShiftClock,
  type ShiftChartStrengthRow,
} from "./shiftChartCompleteness";

function row(
  overrides: Partial<ShiftChartStrengthRow> = {},
): ShiftChartStrengthRow {
  return {
    id: 1,
    game_id: 2025020001,
    player_id: 10,
    team_id: 1,
    opponent_team_id: 2,
    season_id: 20252026,
    game_date: "2025-10-07",
    game_type: "2",
    home_or_away: "home",
    team_abbreviation: "AAA",
    opponent_team_abbreviation: "BBB",
    total_es_toi: "12:34",
    total_pp_toi: "0:00",
    total_pk_toi: "1:02",
    ...overrides,
  };
}

describe("shift chart strength completeness", () => {
  it("accepts strict zero-aware clocks and rejects malformed clocks", () => {
    expect(parseStrictShiftClock("0:00")).toBe(0);
    expect(parseStrictShiftClock("123:59")).toBe(7439);
    expect(parseStrictShiftClock("1:2")).toBeNull();
    expect(parseStrictShiftClock("1:60")).toBeNull();
    expect(parseStrictShiftClock(" 1:02")).toBeNull();
  });

  it("distinguishes partial rows from present-but-invalid rows", () => {
    expect(
      classifyShiftChartStrengthRow(row({ total_pk_toi: null })).status,
    ).toBe("partial");
    expect(
      classifyShiftChartStrengthRow(row({ total_pk_toi: "bad" })).status,
    ).toBe("invalid");
  });

  it("requires two reciprocal teams and exact expected player coverage", () => {
    const rows = [
      row(),
      row({ id: 2, player_id: 11 }),
      row({
        id: 3,
        player_id: 20,
        team_id: 2,
        opponent_team_id: 1,
        home_or_away: "away",
        team_abbreviation: "BBB",
        opponent_team_abbreviation: "AAA",
      }),
    ];

    expect(
      classifyShiftChartStrengthGame({
        gameId: 2025020001,
        rows,
        expectedPlayerIds: [10, 10, 11, 11, 20],
      }),
    ).toMatchObject({ status: "complete", expectedPlayerCount: 3 });
    expect(
      classifyShiftChartStrengthGame({
        gameId: 2025020001,
        rows,
        expectedPlayerIds: [10, 11, 20, 21],
      }).status,
    ).toBe("partial");
  });

  it("rejects duplicate player rows and contradictory team metadata", () => {
    const duplicate = [row(), row({ id: 2 })];
    expect(
      classifyShiftChartStrengthGame({
        gameId: 2025020001,
        rows: duplicate,
      }),
    ).toMatchObject({ status: "invalid" });

    const contradictory = [
      row(),
      row({
        id: 2,
        player_id: 20,
        team_id: 2,
        opponent_team_id: 3,
        home_or_away: "away",
        team_abbreviation: "BBB",
        opponent_team_abbreviation: "CCC",
      }),
    ];
    expect(
      classifyShiftChartStrengthGame({
        gameId: 2025020001,
        rows: contradictory,
      }).status,
    ).toBe("invalid");

    const contradictoryAbbreviations = [
      row(),
      row({
        id: 2,
        player_id: 20,
        team_id: 2,
        opponent_team_id: 1,
        home_or_away: "away",
        team_abbreviation: "BBB",
        opponent_team_abbreviation: "CCC",
      }),
    ];
    expect(
      classifyShiftChartStrengthGame({
        gameId: 2025020001,
        rows: contradictoryAbbreviations,
      }).status,
    ).toBe("invalid");
  });
});
