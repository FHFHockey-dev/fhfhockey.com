import { describe, expect, it } from "vitest";

import {
  buildGoalieXgExplorerRows,
  buildPlayerXgExplorerRows,
  buildTeamXgExplorerRows,
  buildXgExplorerCoverageReport,
} from "./xgExplorer";

const teams = [
  { id: 1, abbreviation: "BOS", name: "Boston Bruins" },
  { id: 2, abbreviation: "NYR", name: "New York Rangers" },
];

const players = [
  { id: 10, fullName: "Shot Creator", team_id: 1, position: "C" },
  { id: 20, fullName: "Older Row", team_id: 2, position: "L" },
  { id: 30, fullName: "Net Minder", team_id: 1, position: "G" },
];

describe("xgExplorer", () => {
  it("merges latest player xG, created xG, transition, and rebound rows", () => {
    const rows = buildPlayerXgExplorerRows({
      players,
      teams,
      limit: 5,
      xgRows: [
        {
          player_id: 10,
          team_id: 1,
          as_of_game_date: "2026-01-02",
          as_of_game_id: 2,
          games_count: 10,
          ixg: 4.1234567,
          goals: 5,
          shot_attempts: 41,
        },
        {
          player_id: 10,
          team_id: 1,
          as_of_game_date: "2026-01-01",
          as_of_game_id: 1,
          games_count: 9,
          ixg: 2,
          goals: 2,
          shot_attempts: 20,
        },
      ],
      createdRows: [
        {
          player_id: 10,
          team_id: 1,
          as_of_game_date: "2026-01-01",
          as_of_game_id: 1,
          games_count: 9,
          created_xg: 9,
          shot_assist_created_xg: 9,
          transition_created_xg: 0,
          shot_assist_events: 9,
          transition_events: 0,
        },
        {
          player_id: 10,
          team_id: 1,
          as_of_game_date: "2026-01-02",
          as_of_game_id: 2,
          games_count: 10,
          created_xg: 3.5,
          shot_assist_created_xg: 2.25,
          transition_created_xg: 1.25,
          shot_assist_events: 6,
          transition_events: 3,
        },
      ],
      transitionRows: [
        {
          entity_type: "player",
          entity_id: 10,
          controlled_entries: 8,
          controlled_exits: 7,
          failed_exits_against: 0,
          entry_assists: 4,
          transition_created_shots: 3,
          transition_created_xg: 1.25,
        },
      ],
      reboundRows: [
        {
          player_id: 10,
          expected_rebounds_created: 1.75,
          actual_rebounds_created: 2,
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 10,
      name: "Shot Creator",
      teamAbbreviation: "BOS",
      gamesCount: 10,
      ixg: 4.123457,
      createdXg: 3.5,
      shotAssistEvents: 6,
      expectedPrimaryAssists: 2.25,
      transitionEvents: 3,
      transitionCreatedShots: 3,
      controlledEntries: 8,
      expectedReboundsCreated: 1.75,
      actualReboundsCreated: 2,
    });
  });

  it("computes team xG percentage and rebound context", () => {
    const rows = buildTeamXgExplorerRows({
      teams,
      limit: 5,
      xgRows: [
        {
          team_id: 1,
          as_of_game_date: "2026-01-02",
          as_of_game_id: 2,
          games_count: 10,
          xg_for: 30,
          xg_against: 20,
          goals_for: 28,
          goals_against: 18,
        },
      ],
      transitionRows: [
        {
          entity_type: "team",
          entity_id: 1,
          controlled_entries: 40,
          controlled_exits: 35,
          failed_exits_against: 12,
          entry_assists: 0,
          transition_created_xg: 5,
        },
      ],
      reboundRows: [
        {
          team_id: 1,
          expected_rebounds_for: 7,
          expected_rebounds_against: 4,
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      id: 1,
      abbreviation: "BOS",
      xgFor: 30,
      xgAgainst: 20,
      xgPct: 0.6,
      failedExitsAgainst: 12,
      expectedReboundsFor: 7,
      expectedReboundsAgainst: 4,
    });
  });

  it("sorts goalies by goals saved above expected with rebound saved as tiebreaker", () => {
    const rows = buildGoalieXgExplorerRows({
      players,
      teams,
      limit: 5,
      xgRows: [
        {
          goalie_player_id: 30,
          team_id: 1,
          as_of_game_date: "2026-01-02",
          as_of_game_id: 2,
          games_count: 8,
          xg_against: 21,
          goals_against: 18,
          shots_against: 240,
          goals_saved_above_expected: 3,
        },
      ],
      reboundRows: [
        {
          goalie_player_id: 30,
          expected_rebounds_allowed: 6.5,
          actual_rebounds_allowed: 5,
          rebound_control_saved_above_expected: 1.5,
          actual_goalie_freezes: 9,
          actual_covered_pucks: 4,
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      id: 30,
      name: "Net Minder",
      xgAgainst: 21,
      goalsAgainst: 18,
      goalsSavedAboveExpected: 3,
      expectedReboundsAllowed: 6.5,
      reboundControlSavedAboveExpected: 1.5,
      goalieFreezes: 9,
    });
  });

  it("flags sparse player created-xG coverage", () => {
    const report = buildXgExplorerCoverageReport({
      scope: "players",
      sourceRows: 42236,
      supplementalRows: 570,
      createdRows: 570,
      transitionRows: 191,
      reboundRows: 0,
    });

    expect(report.status).toBe("warning");
    expect(report.ratios.createdToSource).toBe(0.013496);
    expect(report.warnings.join(" ")).toContain("Sparse created-xG coverage");
  });
});
