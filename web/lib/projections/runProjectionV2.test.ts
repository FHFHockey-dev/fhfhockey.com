import { describe, expect, it } from "vitest";

import {
  computeStarterProbabilities,
  selectStarterCandidateGoalieIds,
  type StarterContextForTest
} from "./runProjectionV2";

function buildContext(
  overrides?: Partial<StarterContextForTest>
): StarterContextForTest {
  return {
    startsByGoalie: new Map<number, number>(),
    lastPlayedDateByGoalie: new Map<number, string>(),
    totalGames: 10,
    previousGameDate: null,
    previousGameStarterGoalieId: null,
    ...overrides
  };
}

describe("starter probability heuristics", () => {
  it("suppresses the previous-game starter on game 2 of a back-to-back", () => {
    const starterA = 1001;
    const starterB = 1002;
    const context = buildContext({
      startsByGoalie: new Map([
        [starterA, 5],
        [starterB, 5]
      ]),
      lastPlayedDateByGoalie: new Map([
        [starterA, "2026-02-06"],
        [starterB, "2026-02-03"]
      ]),
      previousGameDate: "2026-02-06",
      previousGameStarterGoalieId: starterA
    });

    const probs = computeStarterProbabilities({
      asOfDate: "2026-02-07",
      candidateGoalieIds: [starterA, starterB],
      starterContext: context,
      priorStartProbByGoalieId: new Map([
        [starterA, 0.5],
        [starterB, 0.5]
      ]),
      teamGoalsFor: 2.8,
      opponentGoalsFor: 3.1
    });

    expect((probs.get(starterA) ?? 0)).toBeLessThan(probs.get(starterB) ?? 0);
  });

  it("heavily penalizes stale goalies after 30+ days", () => {
    const stale = 2001;
    const active = 2002;
    const context = buildContext({
      startsByGoalie: new Map([
        [stale, 7],
        [active, 3]
      ]),
      lastPlayedDateByGoalie: new Map([
        [stale, "2025-12-20"],
        [active, "2026-02-05"]
      ]),
      previousGameDate: "2026-02-05",
      previousGameStarterGoalieId: active
    });

    const probs = computeStarterProbabilities({
      asOfDate: "2026-02-07",
      candidateGoalieIds: [stale, active],
      starterContext: context,
      priorStartProbByGoalieId: new Map([
        [stale, 0.6],
        [active, 0.4]
      ]),
      teamGoalsFor: 2.7,
      opponentGoalsFor: 2.9
    });

    expect((probs.get(stale) ?? 0)).toBeLessThan(0.2);
    expect((probs.get(active) ?? 0)).toBeGreaterThan(0.8);
  });
});

describe("starter candidate filtering", () => {
  it("removes non-current-team goalies and very stale options", () => {
    const legacyGoalie = 3001;
    const staleGoalie = 3002;
    const activeGoalie = 3003;
    const context = buildContext({
      startsByGoalie: new Map([
        [legacyGoalie, 6],
        [staleGoalie, 2],
        [activeGoalie, 2]
      ]),
      lastPlayedDateByGoalie: new Map([
        [legacyGoalie, "2026-02-01"],
        [staleGoalie, "2025-11-01"],
        [activeGoalie, "2026-02-06"]
      ])
    });

    const candidates = selectStarterCandidateGoalieIds({
      asOfDate: "2026-02-07",
      rawCandidateGoalieIds: [legacyGoalie, staleGoalie, activeGoalie],
      currentTeamGoalieIds: new Set([staleGoalie, activeGoalie]),
      context,
      limit: 3
    });

    expect(candidates).toContain(activeGoalie);
    expect(candidates).not.toContain(legacyGoalie);
    expect(candidates).not.toContain(staleGoalie);
  });
});
