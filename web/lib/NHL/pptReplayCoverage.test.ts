import { describe, expect, it } from "vitest";

import { discoverPptReplayEventsFromPbp } from "./pptReplayCoverage";

describe("pptReplayCoverage", () => {
  it("discovers only explicit NHL PBP pptReplayUrl fields", () => {
    const coverage = discoverPptReplayEventsFromPbp({
      id: 2025030314,
      season: 20252026,
      gameType: 3,
      gameDate: "2026-05-27",
      gameState: "OFF",
      plays: [
        {
          eventId: 427,
          typeDescKey: "shot-on-goal",
          details: {
            highlightClip: 123,
          },
        },
        {
          eventId: 428,
          typeDescKey: "goal",
          sortOrder: 428,
          periodDescriptor: { number: 2, periodType: "REG" },
          timeInPeriod: "12:34",
          pptReplayUrl: "https://wsr.nhle.com/sprites/20252026/2025030314/ev428.json",
          details: {
            highlightClip: 6396802376112,
            highlightClipSharingUrl:
              "https://nhl.com/video/car-mtl-aho-scores-ppg-against-jakub-dobes-6396802376112",
          },
        },
      ],
    });

    expect(coverage).toMatchObject({
      gameId: 2025030314,
      seasonId: 20252026,
      gameType: 3,
      gameState: "OFF",
      playCount: 2,
      replayEventCount: 1,
      replayEventTypes: { goal: 1 },
      nonGoalReplayEventCount: 0,
    });
    expect(coverage.events[0]).toMatchObject({
      eventId: 428,
      eventType: "goal",
      pptReplayUrl: "https://wsr.nhle.com/sprites/20252026/2025030314/ev428.json",
      highlightClip: "6396802376112",
    });
  });

  it("reports non-goal replay URLs if NHL exposes them in PBP", () => {
    const coverage = discoverPptReplayEventsFromPbp({
      id: 1,
      plays: [
        {
          eventId: 10,
          typeDescKey: "shot-on-goal",
          pptReplayUrl: "https://wsr.nhle.com/sprites/20252026/1/ev10.json",
        },
      ],
    });

    expect(coverage.replayEventTypes).toEqual({ "shot-on-goal": 1 });
    expect(coverage.nonGoalReplayEventCount).toBe(1);
  });
});
