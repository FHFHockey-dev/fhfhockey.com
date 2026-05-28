import { describe, expect, it } from "vitest";

import {
  buildReboundControlAggregates,
  type ReboundControlSourceRow,
} from "./reboundControl";

function row(overrides: Partial<ReboundControlSourceRow> = {}): ReboundControlSourceRow {
  return {
    model_version: "rebound-model-v1",
    prediction_type: "rebound_creation",
    feature_version: 1,
    game_id: 2025020001,
    event_id: 101,
    season_id: 20252026,
    game_date: "2025-10-07",
    event_owner_team_id: 10,
    shooter_player_id: 91,
    goalie_in_net_id: 31,
    shot_event_type: "shot-on-goal",
    expected_rebound_probability: 0.25,
    raw_probability: 0.24,
    calibrated_probability: 0.25,
    label: false,
    model_approved: true,
    creates_rebound: false,
    is_rebound_shot: false,
    is_empty_net_event: false,
    is_delayed_penalty_event: false,
    rebound_control_outcome: "no_danger_continuation",
    ...overrides,
  };
}

const games = [
  {
    id: 2025020001,
    seasonId: 20252026,
    date: "2025-10-07",
    homeTeamId: 10,
    awayTeamId: 20,
  },
];

describe("buildReboundControlAggregates", () => {
  it("builds team, player, and goalie rebound-control outputs from approved rebound predictions", () => {
    const result = buildReboundControlAggregates(
      [
        row({
          event_id: 101,
          expected_rebound_probability: 0.25,
          creates_rebound: true,
          label: true,
          rebound_control_outcome: "second_chance_allowed",
        }),
        row({
          event_id: 102,
          expected_rebound_probability: 0.1,
          creates_rebound: false,
          rebound_control_outcome: "goalie_freeze",
          creates_goalie_freeze: true,
          creates_covered_puck: true,
        }),
      ],
      games,
      { generatedAt: "2026-05-27T20:00:00.000Z" }
    );

    expect(result.teamGameRows).toEqual([
      expect.objectContaining({
        team_id: 10,
        expected_rebounds_for: 0.35,
        actual_rebounds_for: 1,
        goalie_freezes_for: 1,
        covered_pucks_for: 1,
        rebound_source_shots_for: 2,
      }),
      expect.objectContaining({
        team_id: 20,
        expected_rebounds_against: 0.35,
        actual_rebounds_against: 1,
        goalie_freezes_against: 1,
        covered_pucks_against: 1,
        rebound_source_shots_against: 2,
      }),
    ]);
    expect(result.playerGameRows).toEqual([
      expect.objectContaining({
        player_id: 91,
        expected_rebounds_created: 0.35,
        actual_rebounds_created: 1,
        goalie_freezes_created: 1,
        rebound_source_shots: 2,
      }),
    ]);
    expect(result.goalieGameRows).toEqual([
      expect.objectContaining({
        goalie_player_id: 31,
        team_id: 20,
        expected_rebounds_allowed: 0.35,
        actual_rebounds_allowed: 1,
        rebound_control_saved_above_expected: -0.65,
        actual_goalie_freezes: 1,
        actual_covered_pucks: 1,
      }),
    ]);
    expect(result.qa).toMatchObject({
      passed: true,
      exclusions: {
        skippedRows: 0,
        emptyNetRows: 0,
        delayedPenaltyRows: 0,
      },
    });
  });

  it("excludes empty-net rows from goalie aggregates while retaining team/player rebound creation", () => {
    const result = buildReboundControlAggregates(
      [
        row({
          is_empty_net_event: true,
          goalie_in_net_id: null,
          expected_rebound_probability: 0.2,
          creates_rebound: true,
          label: true,
        }),
      ],
      games,
      { generatedAt: "2026-05-27T20:00:00.000Z" }
    );

    expect(result.teamGameRows.find((item) => item.team_id === 10)).toMatchObject({
      expected_rebounds_for: 0.2,
      actual_rebounds_for: 1,
    });
    expect(result.goalieGameRows).toEqual([]);
    expect(result.qa).toMatchObject({
      passed: false,
      exclusions: {
        emptyNetRows: 1,
        missingGoalieRows: 0,
      },
    });
  });

  it("flags delayed penalties and unapproved rebound rows in QA", () => {
    const result = buildReboundControlAggregates(
      [
        row({ event_id: 201, is_delayed_penalty_event: true }),
        row({ event_id: 202, model_approved: false }),
      ],
      games,
      { generatedAt: "2026-05-27T20:00:00.000Z" }
    );

    expect(result.teamGameRows).toEqual([]);
    expect(result.skippedRows).toEqual([
      {
        gameId: 2025020001,
        eventId: 201,
        reason: "delayed_penalty_rebound_context_excluded",
      },
      {
        gameId: 2025020001,
        eventId: 202,
        reason: "not_approved_rebound_prediction",
      },
    ]);
    expect(result.qa).toMatchObject({
      passed: false,
      exclusions: {
        skippedRows: 2,
        delayedPenaltyRows: 1,
        unapprovedRows: 1,
      },
    });
  });
});
