import { describe, expect, it } from "vitest";

import {
  buildGoalieStarterBranchProjectionRows,
  buildGoalieStarterMixtureRows,
  mixtureRowsToStarterScenarios,
  type GoalieStarterProjectionInput,
} from "./goalieStarterMixtures";

function projection(overrides: Partial<GoalieStarterProjectionInput>): GoalieStarterProjectionInput {
  return {
    game_id: 2025020001,
    game_date: "2025-10-07",
    team_id: 10,
    player_id: 1,
    start_probability: 0.5,
    confirmed_status: false,
    updated_at: "2026-05-27T12:00:00.000Z",
    ...overrides,
  };
}

describe("goalieStarterMixtures", () => {
  it("forces a confirmed starter to full normalized probability", () => {
    const rows = buildGoalieStarterMixtureRows({
      asOfTimestamp: "2026-05-27T13:00:00.000Z",
      projections: [
        projection({ player_id: 11, start_probability: 0.55, confirmed_status: true }),
        projection({ player_id: 12, start_probability: 0.45 }),
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        goalie_id: 11,
        normalized_start_probability: 1,
        confirmed_status: true,
        source_confidence: "high",
        rank: 1,
      }),
      expect.objectContaining({
        goalie_id: 12,
        normalized_start_probability: 0,
        rank: 2,
      }),
    ]);
  });

  it("keeps ambiguous starter distributions as first-class probabilities", () => {
    const rows = buildGoalieStarterMixtureRows({
      asOfTimestamp: "2026-05-27T13:00:00.000Z",
      projections: [
        projection({ player_id: 21, start_probability: 0.52 }),
        projection({ player_id: 22, start_probability: 0.48 }),
      ],
    });

    expect(rows[0]).toMatchObject({
      goalie_id: 21,
      normalized_start_probability: 0.52,
      source_confidence: "low",
    });
    expect(rows[1]).toMatchObject({
      goalie_id: 22,
      normalized_start_probability: 0.48,
    });
    expect(rows[0]?.probability_mass).toBe(1);
  });

  it("flags stale source rows and lowers confidence", () => {
    const rows = buildGoalieStarterMixtureRows({
      asOfTimestamp: "2026-05-27T13:00:00.000Z",
      projections: [
        projection({
          player_id: 31,
          start_probability: 0.9,
          updated_at: "2026-05-25T00:00:00.000Z",
        }),
      ],
    });

    expect(rows[0]).toMatchObject({
      is_stale: true,
      is_hard_stale: true,
      source_confidence: "low",
    });
  });

  it("suppresses repeat starters on back-to-backs before normalization", () => {
    const rows = buildGoalieStarterMixtureRows({
      asOfTimestamp: "2026-05-27T13:00:00.000Z",
      projections: [
        projection({ game_id: 2, team_id: 10, player_id: 41, start_probability: 0.7 }),
        projection({ game_id: 2, team_id: 10, player_id: 42, start_probability: 0.3 }),
      ],
      previousGameStarterByGameTeam: new Map([["2:10", 41]]),
      backToBackGameTeams: new Set(["2:10"]),
    });

    expect(rows[0]).toMatchObject({
      goalie_id: 41,
      is_back_to_back: true,
      previous_game_starter_goalie_id: 41,
      adjusted_start_probability: 0.455,
    });
    expect(rows[0]!.normalized_start_probability).toBeLessThan(0.7);
    expect(rows[1]!.normalized_start_probability).toBeGreaterThan(0.3);
  });

  it("honors manual overrides over source probabilities", () => {
    const rows = buildGoalieStarterMixtureRows({
      asOfTimestamp: "2026-05-27T13:00:00.000Z",
      projections: [
        projection({ game_id: 3, team_id: 10, player_id: 51, start_probability: 0.9 }),
        projection({ game_id: 3, team_id: 10, player_id: 52, start_probability: 0.1 }),
      ],
      manualOverridesByGameTeam: new Map([["3:10", 52]]),
    });

    expect(rows[0]).toMatchObject({
      goalie_id: 52,
      normalized_start_probability: 1,
      is_manual_override: true,
    });
    expect(rows[1]).toMatchObject({
      goalie_id: 51,
      normalized_start_probability: 0,
      is_manual_override: false,
    });
  });

  it("converts mixture rows to projection scenarios and stores weighted branches", () => {
    const mixtures = buildGoalieStarterMixtureRows({
      asOfTimestamp: "2026-05-27T13:00:00.000Z",
      projections: [
        projection({ player_id: 61, start_probability: 0.6 }),
        projection({ player_id: 62, start_probability: 0.4 }),
      ],
    });

    expect(mixtureRowsToStarterScenarios(mixtures)).toEqual([
      { goalieId: 61, probability: 0.6, rawProbability: 0.6, rank: 1 },
      { goalieId: 62, probability: 0.4, rawProbability: 0.4, rank: 2 },
    ]);

    expect(
      buildGoalieStarterBranchProjectionRows(
        [
          {
            mixture_version: "goalie_starter_mixture_v1",
            game_id: 2025020001,
            game_date: "2025-10-07",
            team_id: 10,
            goalie_id: 61,
            as_of_timestamp: "2026-05-27T13:00:00.000Z",
            branch_rank: 1,
            branch_probability: 0.6,
            projection_version: "forge-goalie-v1",
            proj_shots_against: 30,
            proj_saves: 27,
            proj_goals_allowed: 3,
            proj_win_prob: 0.55,
            proj_shutout_prob: 0.05,
            modeled_save_pct: 0.9,
          },
        ],
        "2026-05-27T13:01:00.000Z"
      )
    ).toEqual([
      expect.objectContaining({
        branch_key: "goalie_starter_mixture_v1:forge-goalie-v1:2025020001:10:61",
        weighted_proj_saves: 16.2,
        weighted_proj_goals_allowed: 1.8,
        updated_at: "2026-05-27T13:01:00.000Z",
      }),
    ]);
  });
});
