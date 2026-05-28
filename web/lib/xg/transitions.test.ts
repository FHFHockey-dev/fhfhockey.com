import { describe, expect, it } from "vitest";

import { buildTransitionRows, type TransitionFeatureRow } from "./transitions";

function feature(overrides: Partial<TransitionFeatureRow> = {}): TransitionFeatureRow {
  return {
    feature_version: 1,
    game_id: 2025020001,
    event_id: 102,
    season_id: 20252026,
    game_date: "2025-10-07",
    event_owner_team_id: 10,
    shooter_player_id: 91,
    is_unblocked_shot_attempt: true,
    is_rebound_shot: false,
    is_penalty_shot_event: false,
    is_shootout_event: false,
    is_rush_shot: true,
    rush_source_event_id: 101,
    rush_source_type_desc_key: "takeaway",
    rush_time_since_source_seconds: 5,
    previous_event_id: 101,
    previous_event_type_desc_key: "takeaway",
    previous_event_same_team: true,
    time_since_previous_event_seconds: 5,
    feature_payload: {
      possessionSequenceId: "2025020001:10:1",
      possessionEventCount: 2,
      possessionDurationSeconds: 5,
      possessionStartEventId: 101,
      possessionStartTypeDescKey: "takeaway",
      possessionStartZoneCode: "D",
      possessionRegainedFromOpponent: true,
      possessionRegainEventTypeDescKey: "takeaway",
      possessionEnteredOffensiveZone: true,
      rushSourceTeamRelativeZoneCode: "D",
    },
    ...overrides,
  };
}

const prediction = {
  model_version: "model-v1",
  prediction_type: "shot_goal",
  feature_version: 1,
  game_id: 2025020001,
  event_id: 102,
  xg: 0.4,
  model_approved: true,
};

const sourceEvent = {
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
  zone_code: "D",
};

describe("buildTransitionRows", () => {
  it("creates transition event and aggregate rows from rush shots with defensive-zone sources", () => {
    const result = buildTransitionRows({
      modelVersion: "model-v1",
      features: [feature()],
      predictions: [prediction],
      sourceEvents: [sourceEvent],
      generatedAt: "2026-05-27T20:00:00.000Z",
    });

    expect(result.events.map((row) => row.transition_type).sort()).toEqual([
      "controlled_entry_proxy",
      "controlled_exit_proxy",
      "entry_assist_proxy",
      "transition_created_shot",
    ]);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        transition_type: "controlled_entry_proxy",
        player_id: 92,
        confidence_tier: "high",
        transition_created_xg: 0.28,
      })
    );
    expect(result.aggregates).toContainEqual(
      expect.objectContaining({
        entity_type: "team",
        entity_id: 10,
        controlled_entries: 1,
        controlled_exits: 1,
        entry_assists: 1,
        transition_created_shots: 1,
        transition_created_xg: 0.28,
      })
    );
  });

  it("skips offensive-zone faceoff starts, rebounds, and ambiguous non-entry shots", () => {
    const result = buildTransitionRows({
      modelVersion: "model-v1",
      features: [
        feature({ is_rebound_shot: true }),
        feature({
          is_rush_shot: false,
          feature_payload: {
            possessionStartEventId: 101,
            possessionStartTypeDescKey: "faceoff",
            possessionStartZoneCode: "O",
            possessionEnteredOffensiveZone: false,
          },
        }),
        feature({
          is_rush_shot: true,
          rush_source_type_desc_key: "faceoff",
          feature_payload: {
            possessionStartEventId: 101,
            possessionStartTypeDescKey: "faceoff",
            possessionStartZoneCode: "D",
            possessionEnteredOffensiveZone: true,
            rushSourceTeamRelativeZoneCode: "D",
          },
        }),
      ],
      predictions: [prediction],
      sourceEvents: [{ ...sourceEvent, type_desc_key: "faceoff" }],
    });

    expect(result.events).toEqual([]);
    expect(result.aggregates).toEqual([]);
  });

  it("creates failed-exit-against proxies when a giveaway starts an opponent transition shot", () => {
    const result = buildTransitionRows({
      modelVersion: "model-v1",
      features: [
        feature({
          is_rush_shot: false,
          previous_event_same_team: false,
          feature_payload: {
            possessionStartEventId: 101,
            possessionStartTypeDescKey: "giveaway",
            possessionStartZoneCode: "N",
            possessionRegainedFromOpponent: true,
            possessionRegainEventTypeDescKey: "giveaway",
            possessionEnteredOffensiveZone: true,
            possessionDurationSeconds: 6,
          },
        }),
      ],
      predictions: [prediction],
      sourceEvents: [{ ...sourceEvent, type_desc_key: "giveaway" }],
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        transition_type: "failed_exit_against_proxy",
        team_id: 10,
        confidence_tier: "low",
      })
    );
    expect(result.events).not.toContainEqual(
      expect.objectContaining({
        transition_type: "controlled_entry_proxy",
      })
    );
  });
});
