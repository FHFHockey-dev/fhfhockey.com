import { describe, expect, it } from "vitest";

import { buildShotAssistCandidateRows, type ShotAssistFeatureRow } from "./shotAssists";

function feature(overrides: Partial<ShotAssistFeatureRow> = {}): ShotAssistFeatureRow {
  return {
    feature_version: 1,
    game_id: 2025020001,
    event_id: 102,
    season_id: 20252026,
    game_date: "2025-10-07",
    event_owner_team_id: 10,
    shooter_player_id: 91,
    shot_event_type: "shot-on-goal",
    is_unblocked_shot_attempt: true,
    is_rebound_shot: false,
    is_penalty_shot_event: false,
    is_shootout_event: false,
    previous_event_id: 101,
    previous_event_type_desc_key: "takeaway",
    previous_event_team_id: 10,
    previous_event_same_team: true,
    time_since_previous_event_seconds: 2,
    distance_from_previous_event: 25,
    feature_payload: {
      possessionSequenceId: "2025020001:10:1",
      possessionEventCount: 2,
      possessionDurationSeconds: 2,
      possessionEnteredOffensiveZone: true,
      possessionRegainedFromOpponent: true,
    },
    ...overrides,
  };
}

describe("buildShotAssistCandidateRows", () => {
  it("creates weighted expected primary assist candidates from same-team prior events", () => {
    const rows = buildShotAssistCandidateRows({
      features: [feature()],
      predictions: [
        {
          model_version: "model-v1",
          prediction_type: "shot_goal",
          feature_version: 1,
          game_id: 2025020001,
          event_id: 102,
          xg: 0.4,
          model_approved: true,
        },
      ],
      priorEvents: [
        {
          game_id: 2025020001,
          event_id: 101,
          type_desc_key: "takeaway",
          event_owner_team_id: 10,
          player_id: 92,
          shooting_player_id: null,
          scoring_player_id: null,
          winning_player_id: null,
          hitting_player_id: null,
          blocking_player_id: null,
          zone_code: "N",
        },
      ],
      generatedAt: "2026-05-27T20:00:00.000Z",
    });

    expect(rows).toEqual([
      expect.objectContaining({
        model_version: "model-v1",
        game_id: 2025020001,
        event_id: 102,
        shot_assist_player_id: 92,
        source_event_id: 101,
        confidence: 0.85,
        confidence_tier: "high",
        xg: 0.4,
        expected_primary_assists: 0.34,
      }),
    ]);
  });

  it("does not infer candidates for rebounds, faceoffs, self events, or unapproved predictions", () => {
    const basePrediction = {
      model_version: "model-v1",
      prediction_type: "shot_goal",
      feature_version: 1,
      game_id: 2025020001,
      event_id: 102,
      xg: 0.4,
      model_approved: true,
    };
    const priorEvent = {
      game_id: 2025020001,
      event_id: 101,
      type_desc_key: "takeaway",
      event_owner_team_id: 10,
      player_id: 92,
      shooting_player_id: null,
      scoring_player_id: null,
      winning_player_id: null,
      hitting_player_id: null,
      blocking_player_id: null,
      zone_code: "N",
    };

    expect(
      buildShotAssistCandidateRows({
        features: [
          feature({ is_rebound_shot: true }),
          feature({ previous_event_type_desc_key: "faceoff" }),
          feature({ previous_event_type_desc_key: "missed-shot" }),
          feature({ previous_event_type_desc_key: "blocked-shot" }),
          feature({ previous_event_type_desc_key: "giveaway" }),
          feature({ previous_event_type_desc_key: "line-change" }),
          feature({ previous_event_same_team: false }),
          feature({ shooter_player_id: 92 }),
        ],
        predictions: [basePrediction],
        priorEvents: [priorEvent],
      })
    ).toEqual([]);

    expect(
      buildShotAssistCandidateRows({
        features: [feature()],
        predictions: [{ ...basePrediction, model_approved: false }],
        priorEvents: [priorEvent],
      })
    ).toEqual([]);
  });
});
