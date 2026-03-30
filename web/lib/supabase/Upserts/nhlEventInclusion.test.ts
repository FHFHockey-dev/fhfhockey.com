import { describe, expect, it } from "vitest";

import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 1,
    event_index: 0,
    game_id: 2025020418,
    source_play_by_play_hash: "hash",
    parser_version: 1,
    strength_version: 1,
    raw_event: {},
    details: {},
    type_desc_key: "shot-on-goal",
    period_type: "REG",
    period_number: 1,
    strength_state: "EV",
    strength_exact: "5v5",
    reason: null,
    secondary_reason: null,
    penalty_desc_key: null,
    ...overrides,
  } as any;
}

describe("nhlEventInclusion", () => {
  it("excludes shootout events from parity and shot-feature eligibility", () => {
    expect(
      evaluateNormalizedEventInclusion(
        createEvent({
          type_desc_key: "shootout-complete",
          period_type: "SO",
          period_number: 5,
        })
      )
    ).toMatchObject({
      includeInNormalizedLayer: true,
      includeInParity: false,
      includeInOnIceParity: false,
      includeInShotFeatures: false,
      exclusionReason: "shootout",
      isShootoutEvent: true,
      isOvertimeEvent: false,
    });
  });

  it("flags penalty-shot events for exclusion while keeping the normalized row", () => {
    expect(
      evaluateNormalizedEventInclusion(
        createEvent({
          type_desc_key: "goal",
          reason: "Penalty Shot",
          raw_event: {
            details: {
              reason: "Penalty Shot",
            },
          },
        })
      )
    ).toMatchObject({
      includeInNormalizedLayer: true,
      includeInParity: false,
      includeInOnIceParity: false,
      includeInShotFeatures: false,
      exclusionReason: "penalty-shot",
      isPenaltyShotEvent: true,
    });
  });

  it("keeps delayed-penalty and empty-net events in parity while distinguishing their flags", () => {
    expect(
      evaluateNormalizedEventInclusion(
        createEvent({
          type_desc_key: "delayed-penalty",
          strength_state: "EN",
          strength_exact: "6v5",
        })
      )
    ).toMatchObject({
      includeInParity: true,
      includeInOnIceParity: true,
      includeInShotFeatures: false,
      exclusionReason: null,
      isDelayedPenaltyEvent: true,
      isEmptyNetEvent: true,
    });
  });

  it("keeps overtime and rare manpower events included but explicitly flagged", () => {
    expect(
      evaluateNormalizedEventInclusion(
        createEvent({
          type_desc_key: "shot-on-goal",
          period_type: "OT",
          period_number: 4,
          strength_state: "PP",
          strength_exact: "6v4",
        })
      )
    ).toMatchObject({
      includeInParity: true,
      includeInShotFeatures: true,
      isOvertimeEvent: true,
      hasRareManpower: true,
    });
  });

  it("treats SO period-type events as shootout exclusions even when the event type is goal", () => {
    expect(
      evaluateNormalizedEventInclusion(
        createEvent({
          type_desc_key: "goal",
          period_type: "SO",
          period_number: 5,
        })
      )
    ).toMatchObject({
      includeInParity: false,
      includeInOnIceParity: false,
      includeInShotFeatures: false,
      exclusionReason: "shootout",
      isShootoutEvent: true,
    });
  });
});
