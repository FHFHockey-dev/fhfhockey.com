import { describe, expect, it } from "vitest";

import {
  rankTopAddsCandidates,
  scoreTopAddsCandidate,
  type TopAddsCandidateInput
} from "./topAddsRanking";

function makeCandidate(
  overrides: Partial<TopAddsCandidateInput>
): TopAddsCandidateInput {
  return {
    playerId: 1,
    name: "Test Skater",
    team: "NJD",
    teamAbbr: "NJD",
    position: "C",
    headshot: null,
    ownership: 50,
    ownershipTimeline: [],
    delta: 4,
    projectionPts: 2,
    ppp: 0.5,
    sog: 3,
    hit: 1,
    blk: 1,
    uncertainty: 0.3,
    scheduleGamesRemaining: null,
    scheduleOffNightsRemaining: null,
    scheduleLabel: null,
    ...overrides
  };
}

describe("topAddsRanking", () => {
  it("keeps recent trend strength as the dominant factor", () => {
    const highTrend = scoreTopAddsCandidate(
      makeCandidate({ delta: 8, ownership: 60, projectionPts: 1.8 }),
      "tonight"
    );
    const lowTrend = scoreTopAddsCandidate(
      makeCandidate({ delta: 3, ownership: 30, projectionPts: 2.6 }),
      "tonight"
    );

    expect(highTrend.total).toBeGreaterThan(lowTrend.total);
    expect(highTrend.trendStrengthScore).toBeGreaterThan(
      lowTrend.trendStrengthScore
    );
  });

  it("uses low ownership as a meaningful tie-breaker when trend is similar", () => {
    const ranked = rankTopAddsCandidates(
      [
        makeCandidate({
          playerId: 1,
          name: "Higher Ownership",
          ownership: 68,
          delta: 5,
          projectionPts: 2.2
        }),
        makeCandidate({
          playerId: 2,
          name: "Lower Ownership",
          ownership: 31,
          delta: 5,
          projectionPts: 2.2
        })
      ],
      "tonight"
    );

    expect(ranked[0]?.name).toBe("Lower Ownership");
    expect(ranked[0]?.score.ownershipBiasScore).toBeGreaterThan(
      ranked[1]?.score.ownershipBiasScore ?? 0
    );
  });

  it("adds a real schedule term in week mode without overriding trend strength", () => {
    const tonight = scoreTopAddsCandidate(makeCandidate({ delta: 5 }), "tonight");
    const week = scoreTopAddsCandidate(
      makeCandidate({
        delta: 5,
        scheduleGamesRemaining: 3,
        scheduleOffNightsRemaining: 2
      }),
      "week"
    );

    expect(tonight.scheduleContextScore).toBe(0);
    expect(week.scheduleContextScore).toBeGreaterThan(0);
    expect(week.total).toBeGreaterThan(tonight.total);
  });

  it("prefers the better weekly streaming path when trends are close", () => {
    const ranked = rankTopAddsCandidates(
      [
        makeCandidate({
          playerId: 1,
          name: "Two-Game Stream",
          delta: 5.2,
          scheduleGamesRemaining: 2,
          scheduleOffNightsRemaining: 0
        }),
        makeCandidate({
          playerId: 2,
          name: "Four-Game Stream",
          delta: 5,
          scheduleGamesRemaining: 4,
          scheduleOffNightsRemaining: 2
        })
      ],
      "week"
    );

    expect(ranked[0]?.name).toBe("Four-Game Stream");
    expect(ranked[0]?.score.scheduleContextScore).toBeGreaterThan(
      ranked[1]?.score.scheduleContextScore ?? 0
    );
  });
});
