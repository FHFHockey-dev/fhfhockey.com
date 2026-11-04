import { describe, expect, it } from "vitest";
import { FHFH_STANDARD_SCORING } from "lib/buyLowSellHigh/trade";
import { FIXTURE_BLSH_EVIDENCE } from "./fixtureEvidence";
import { retrospectiveComparison, retrospectivePlayer } from "./retrospective";

const perGame = (id: string) => {
  const profile = FIXTURE_BLSH_EVIDENCE[id], fp = profile.tracks.find(track => track.track === "FP")!;
  return fp.observed / profile.evidence.window.games;
};

describe("retrospective trade fallback", () => {
  it("sums recorded FHFH Standard points per game from the BLSH FP track", () => {
    const result = retrospectiveComparison(["fx-f5"], ["fx-f3", "fx-f6"], FHFH_STANDARD_SCORING, FIXTURE_BLSH_EVIDENCE);
    expect(result.available).toBe(true);
    expect(result.give.value).toBeCloseTo(perGame("fx-f5"), 12);
    expect(result.receive.value).toBeCloseTo(perGame("fx-f3") + perGame("fx-f6"), 12);
    expect(result.net).toBeCloseTo(perGame("fx-f3") + perGame("fx-f6") - perGame("fx-f5"), 12);
  });

  it("withholds a side with a missing or scoreless player instead of counting zero", () => {
    const result = retrospectiveComparison(["fx-f5"], ["fx-f3", "fx-g1", "fx-d2"], FHFH_STANDARD_SCORING, FIXTURE_BLSH_EVIDENCE);
    expect(result).toMatchObject({ available: false, net: null, receive: { value: null, missingPlayerIds: ["fx-g1", "fx-d2"] } });
    expect(retrospectivePlayer("fx-d2", FIXTURE_BLSH_EVIDENCE["fx-d2"]).reason).toBe("Fewer than five current games recorded");
    expect(retrospectivePlayer("fx-g1", undefined).reason).toMatch(/No BLSH evidence/);
  });

  it("is unavailable under any scoring other than FHFH Standard", () => {
    const custom = retrospectiveComparison(["fx-f5"], ["fx-f3"], { mode: "points", scoringBasis: "points:custom", weights: { GOALS: 1 } }, FIXTURE_BLSH_EVIDENCE);
    expect(custom).toMatchObject({ available: false, net: null });
    expect(custom.reason).toMatch(/FHFH Standard points only/);
  });
});
