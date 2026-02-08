import { describe, expect, it } from "vitest";

import {
  buildSequentialHorizonScalarsFromDates,
  blendTopStarterScenarioOutputs,
  buildTopStarterScenarios,
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

describe("starter scenarios", () => {
  it("builds normalized top-2 scenarios from multi-goalie probabilities", () => {
    const scenarios = buildTopStarterScenarios({
      probabilitiesByGoalieId: new Map([
        [4001, 0.5],
        [4002, 0.3],
        [4003, 0.2]
      ])
    });

    expect(scenarios).toHaveLength(2);
    expect(scenarios[0]?.goalieId).toBe(4001);
    expect(scenarios[1]?.goalieId).toBe(4002);
    expect(scenarios[0]?.probability).toBeCloseTo(0.625, 5);
    expect(scenarios[1]?.probability).toBeCloseTo(0.375, 5);
  });

  it("returns a single scenario with full probability when only one goalie exists", () => {
    const scenarios = buildTopStarterScenarios({
      probabilitiesByGoalieId: new Map([[4010, 1]])
    });

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]?.goalieId).toBe(4010);
    expect(scenarios[0]?.probability).toBe(1);
    expect(scenarios[0]?.rawProbability).toBe(1);
  });
});

describe("scenario blending", () => {
  it("blends top scenarios using raw starter probabilities", () => {
    const blended = blendTopStarterScenarioOutputs({
      scenarioProjections: [
        {
          goalie_id: 5001,
          rank: 1,
          starter_probability_raw: 0.6,
          starter_probability_top2_normalized: 0.6,
          proj_shots_against: 30,
          proj_saves: 27,
          proj_goals_allowed: 3,
          proj_win_prob: 0.55,
          proj_shutout_prob: 0.05,
          modeled_save_pct: 0.9,
          workload_save_pct_penalty: 0
        },
        {
          goalie_id: 5002,
          rank: 2,
          starter_probability_raw: 0.3,
          starter_probability_top2_normalized: 0.3,
          proj_shots_against: 30,
          proj_saves: 26.1,
          proj_goals_allowed: 3.9,
          proj_win_prob: 0.5,
          proj_shutout_prob: 0.03,
          modeled_save_pct: 0.87,
          workload_save_pct_penalty: 0
        }
      ],
      fallbackProjection: {
        proj_shots_against: 30,
        proj_saves: 27,
        proj_goals_allowed: 3,
        proj_win_prob: 0.55,
        proj_shutout_prob: 0.05,
        modeled_save_pct: 0.9,
        workload_save_pct_penalty: 0
      }
    });

    expect(blended.probability_mass).toBeCloseTo(0.9, 5);
    expect(blended.residual_probability_mass).toBeCloseTo(0.1, 5);
    expect(blended.proj_saves).toBeCloseTo(26.73, 5);
    expect(blended.proj_goals_allowed).toBeCloseTo(3.27, 5);
  });
});

describe("horizon scalars", () => {
  it("builds sequential scalars with schedule decay and b2b penalty", () => {
    const scalars = buildSequentialHorizonScalarsFromDates(
      ["2026-02-10", "2026-02-11", "2026-02-14"],
      5
    );

    expect(scalars).toHaveLength(5);
    expect(scalars[0]).toBeCloseTo(1, 5);
    expect(scalars[1]).toBeLessThan(scalars[0] ?? 1);
    expect(scalars[2]).toBeGreaterThan(scalars[1] ?? 0);
  });
});
