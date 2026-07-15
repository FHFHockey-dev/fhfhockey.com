import { describe, expect, it } from "vitest";
import { auditXgTrackingAlignment, type XgTrackingFrame } from "./trackingAlignment";

function frame(overrides: Partial<XgTrackingFrame> = {}): XgTrackingFrame {
  return { gameId: 1, eventId: 2, eventType: "goal", frameIndex: 0, frameTimestamp: 0.1, trackingObjectId: "puck", playerId: null, teamId: null, x: 0, y: 0, isPuck: true, ...overrides };
}

describe("tracking alignment audit", () => {
  it("keeps goal-only replay frames out of model training", () => {
    const audit = auditXgTrackingAlignment([
      frame(),
      frame({ trackingObjectId: "10", isPuck: false, playerId: 10, teamId: 1 }),
    ]);
    expect(audit).toMatchObject({ goalOnlyCoverage: true, trainingEligible: false, playerIdentityCoverage: 1, puckEventCoverage: 1 });
    expect(audit.issues).toContain("Replay coverage is goal-only and cannot represent full-game tracking.");
  });

  it("accepts aligned multi-event-type frames with complete identity and puck coverage", () => {
    const audit = auditXgTrackingAlignment([
      frame({ eventId: 1, eventType: "shot-on-goal" }),
      frame({ eventId: 1, eventType: "shot-on-goal", trackingObjectId: "10", isPuck: false, playerId: 10, teamId: 1 }),
      frame({ eventId: 2, eventType: "goal" }),
      frame({ eventId: 2, eventType: "goal", trackingObjectId: "20", isPuck: false, playerId: 20, teamId: 2 }),
    ]);
    expect(audit).toMatchObject({ goalOnlyCoverage: false, trainingEligible: true, issueCount: 0 });
  });
});

