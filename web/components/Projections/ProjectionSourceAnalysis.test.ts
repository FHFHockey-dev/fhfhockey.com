import { describe, expect, it } from "vitest";

import { buildPerSourcePlayerProjections, computeSourceMetrics } from "./ProjectionSourceAnalysis";

// One skater, one source projecting exactly 1 point per game over 82 games.
const player = (actualGp: number | null, actualPoints: number | null) => ({
  playerId: 1,
  fullName: "Exact Pace",
  displayPosition: "C",
  fantasyPoints: { projected: 82, actual: actualPoints },
  combinedStats: {
    GAMES_PLAYED: { projected: 82, actual: actualGp, projectedDetail: { contributingSources: [] } },
    POINTS: { projected: 82, actual: actualPoints, projectedDetail: { contributingSources: [{ name: "Source A", value: 82 }] } },
  },
}) as any;

describe("projections Source Analysis compares like with like (audit M-DRF-010)", () => {
  it("pro-rates a source's projection to games played before comparing with season-to-date points", () => {
    // 15 of 82 games played, 15 points: an exactly right per-game source.
    const [projection] = buildPerSourcePlayerProjections(player(15, 15), { POINTS: 1 }, ["Source A"]);
    expect(projection.projectedTotal).toBe(15);
    expect(projection.projectedFullSeason).toBe(82);
    const metrics = computeSourceMetrics([player(15, 15)], { POINTS: 1 }, { "Source A": { isSelected: true, weight: 1 } });
    expect(metrics.overallRankingsTotal[0].averageMarginOfError).toBe(0);
    expect(metrics.overallRankingsTotal[0].averageAccuracyPercentage).toBe(100);
  });

  it("leaves the comparison unknown when games played is unknown or zero", () => {
    expect(buildPerSourcePlayerProjections(player(null, 15), { POINTS: 1 }, ["Source A"])[0].projectedTotal).toBeNull();
    expect(buildPerSourcePlayerProjections(player(0, 0), { POINTS: 1 }, ["Source A"])[0].projectedTotal).toBeNull();
  });
});
