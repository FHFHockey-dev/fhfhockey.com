import { describe, expect, it } from "vitest";
import type { ForecastDiscoveryExclusion } from "lib/rosterScheduleOptimizer/planningTypes";
import { attributeDetailedExclusion } from "./hostedReaders";

// Shapes from the sealed real-input rehearsal of 2026020360 (2026-11-20): the published revision carries a game-level
// identity_conflict (no playerId) for another payload row; the asked player (10398) has no published row at all.
const GAME = "2026020360";
const gameLevel: ForecastDiscoveryExclusion = { gameId: GAME, reasons: ["identity_conflict"] };

describe("attributeDetailedExclusion", () => {
  it("never reports a game-level exclusion as the asked player's reason (sealed 0360)", () => {
    expect(attributeDetailedExclusion([gameLevel], [gameLevel], GAME, "10398"))
      .toEqual({ reason: "no_usable_target", gameExclusions: ["identity_conflict"] });
  });

  it("keeps an exclusion that names the asked player, with the game-level one as context (sealed 0360, lineup centre)", () => {
    const own: ForecastDiscoveryExclusion = { gameId: GAME, playerId: "9013", reasons: ["missing_participation"] };
    expect(attributeDetailedExclusion([gameLevel, own], [gameLevel, own], GAME, "9013"))
      .toEqual({ reason: "missing_participation", gameExclusions: ["identity_conflict"] });
  });

  it("ignores another player's exclusion and anything the planner did not report", () => {
    const other: ForecastDiscoveryExclusion = { gameId: GAME, playerId: "1", reasons: ["stale_source"] };
    const unreported: ForecastDiscoveryExclusion = { gameId: GAME, playerId: "9013", reasons: ["future_input"] };
    expect(attributeDetailedExclusion([other, unreported, gameLevel], [other], GAME, "9013"))
      .toEqual({ reason: "no_usable_target", gameExclusions: [] });
  });
});
