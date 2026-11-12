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

  it("detects a 1010 / 0101 penalty-shot attempt outside the shootout and never calls it empty net", () => {
    for (const situation_code of ["1010", "0101"]) {
      expect(
        evaluateNormalizedEventInclusion(
          createEvent({
            situation_code,
            strength_exact: situation_code === "1010" ? "0v1" : "1v0",
            // v1 rows stored any pulled goalie digit as EN.
            strength_state: "EN",
            event_owner_side: situation_code === "1010" ? "home" : "away",
          })
        )
      ).toMatchObject({
        includeInParity: false,
        exclusionReason: "penalty-shot",
        isPenaltyShotEvent: true,
        isEmptyNetEvent: false,
      });
    }
  });

  it("detects a penalty-shot infraction by its ps- desc key", () => {
    expect(
      evaluateNormalizedEventInclusion(
        createEvent({
          type_desc_key: "penalty",
          penalty_desc_key: "ps-hooking-on-breakaway",
          situation_code: "1551",
        })
      )
    ).toMatchObject({ isPenaltyShotEvent: true, includeInParity: false });
  });

  it("flags EN only when the event owner attacks an empty net (decisions 7, 84)", () => {
    // 1560: home pulled its goalie. A home shot is not EN even if a v1 row says so.
    expect(
      evaluateNormalizedEventInclusion(
        createEvent({ situation_code: "1560", strength_state: "EN", event_owner_side: "home" })
      ).isEmptyNetEvent
    ).toBe(false);
    expect(
      evaluateNormalizedEventInclusion(
        createEvent({ situation_code: "1560", strength_state: "EN", event_owner_side: "away" })
      ).isEmptyNetEvent
    ).toBe(true);
  });
});
