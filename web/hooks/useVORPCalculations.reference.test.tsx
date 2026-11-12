import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProcessedPlayer } from "./useProcessedProjectionsData";
import { computeVorpMetrics } from "./useVORPCalculations";
import { usePlayerRecommendations } from "./usePlayerRecommendations";
import { assignSlotsGlobally, type SlotPlayer } from "lib/draftDashboard/replacementReference";
import { buildPersonalizedRecommendations, type RecommendationCandidate } from "lib/draft-pro/recommendations";

function player(playerId: number, position: string, value: number | null, adp = playerId): ProcessedPlayer {
  return {
    playerId,
    fullName: `Player ${playerId}`,
    displayTeam: "TST",
    displayPosition: position,
    eligiblePositions: position.split(","),
    combinedStats: {},
    fantasyPoints: { projected: value, actual: null, diffPercentage: null, projectedPerGame: null, actualPerGame: null },
    yahooAvgPick: adp,
  } as ProcessedPlayer;
}

const settings = (rosterConfig: Record<string, number>, teamCount = 1) => ({ teamCount, rosterConfig });

describe("draft base score (W2-P0-14, decision 76)", () => {
  it("ranks centres 100/99/0 in value order on the base score; VONA stays its own column", () => {
    const players = [player(1, "C", 100, 1), player(2, "C", 99, 2), player(3, "C", 0, 3)];
    const vorp = computeVorpMetrics({
      players,
      availablePlayers: players,
      draftSettings: settings({ C: 1, LW: 0, RW: 0, D: 0, G: 0, utility: 0 }, 2),
      picksUntilNext: 1,
      forwardGrouping: "split",
    });
    const { result } = renderHook(() =>
      usePlayerRecommendations({ players, vorpMetrics: vorp.playerMetrics, teamCount: 2, forwardGrouping: "split" }),
    );
    expect(result.current.recommendations.map((item) => item.player.playerId)).toEqual([1, 2, 3]);
    expect(result.current.recommendations.map((item) => item.score)).toEqual([100, 99, 0]);
    // The candidate-relative VONA is still reported, separately.
    expect(vorp.playerMetrics.get("2")?.vona).toBe(99);
    expect(vorp.playerMetrics.get("2")?.vbd).toBe(99);
  });
});

describe("frozen replacement reference (W2-5 D3, decision 77)", () => {
  it("keeps replacement and a held player's VORP fixed when a pick leaves the pool", () => {
    const players = [player(1, "C", 100), player(2, "C", 90), player(3, "C", 80), player(4, "C", 70)];
    const config = settings({ C: 2, LW: 0, RW: 0, D: 0, G: 0, utility: 0 });
    const before = computeVorpMetrics({ players, availablePlayers: players, draftSettings: config, picksUntilNext: 0 });
    const after = computeVorpMetrics({ players, availablePlayers: players.slice(1), draftSettings: config, picksUntilNext: 0 });
    expect(before.replacementByPos.C.vorp).toBe(80);
    expect(after.replacementByPos.C.vorp).toBe(80);
    expect(after.playerMetrics.get("1")?.vorp).toBe(20);
    // The live board accounts for the league's actual fill, labelled separately.
    expect(after.liveReplacementByPos?.C).toBe(80);
  });

  it("ignores the legacy remaining/full toggle for VORP", () => {
    const players = [player(1, "C", 100), player(2, "C", 90), player(3, "C", 80)];
    const config = settings({ C: 1, LW: 0, RW: 0, D: 0, G: 0, utility: 0 });
    const remaining = computeVorpMetrics({ players, availablePlayers: players.slice(1), draftSettings: config, picksUntilNext: 0, baselineMode: "remaining" });
    const full = computeVorpMetrics({ players, availablePlayers: players.slice(1), draftSettings: config, picksUntilNext: 0, baselineMode: "full" });
    expect(remaining.playerMetrics.get("2")?.vorp).toBe(full.playerMetrics.get("2")?.vorp);
  });
});

describe("global slot assignment (W2-5 D4, decisions 77 and 113)", () => {
  it("solves the two-slot counterexample that greedy C-then-LW gets wrong", () => {
    // A C/LW 100, B C 99, Y C 50, X LW 1; one C and one LW slot.
    const players = [player(1, "C,LW", 100), player(2, "C", 99), player(3, "C", 50), player(4, "LW", 1)];
    const result = computeVorpMetrics({
      players,
      availablePlayers: players,
      draftSettings: settings({ C: 1, LW: 1, RW: 0, D: 0, G: 0, utility: 0 }),
      picksUntilNext: 0,
    });
    expect(result.replacementByPos.C.vorp).toBe(50);
    expect(result.replacementByPos.LW.vorp).toBe(1);
    expect(result.playerMetrics.get("2")?.vorp).toBe(49);
  });

  it("matches exhaustive enumeration on every small eligibility pattern", () => {
    const patterns = [["C"], ["LW"], ["C", "LW"]];
    const values = [100, 99, 60, 1];
    for (let mask = 0; mask < 3 ** 4; mask += 1) {
      const pool: SlotPlayer[] = values.map((value, index) => ({
        id: String(index),
        value,
        eligible: patterns[Math.floor(mask / 3 ** index) % 3],
      }));
      const capacities = { C: 1, LW: 1 };
      const { assigned } = assignSlotsGlobally(pool, capacities);
      const total = pool.filter((item) => assigned.has(item.id)).reduce((sum, item) => sum + item.value, 0);
      let best = 0;
      for (const c of [...pool, null]) {
        for (const lw of [...pool, null]) {
          if (c && lw && c.id === lw.id) continue;
          if (c && !c.eligible.includes("C")) continue;
          if (lw && !lw.eligible.includes("LW")) continue;
          best = Math.max(best, (c?.value ?? 0) + (lw?.value ?? 0));
        }
      }
      expect(total).toBe(best);
    }
  });

  it("lets any skater, including a defenceman, fill UTIL", () => {
    const players = [player(1, "C", 100), player(2, "D", 90), player(3, "D", 80), player(4, "C", 10), player(5, "D", 5)];
    const result = computeVorpMetrics({
      players,
      availablePlayers: players,
      draftSettings: settings({ C: 1, LW: 0, RW: 0, D: 1, G: 0, utility: 1 }),
      picksUntilNext: 0,
    });
    expect(result.replacementByPos.D.vorp).toBe(5);
    expect(result.replacementByPos.C.vorp).toBe(10);
  });
});

describe("unknown values stay unknown (W2-5 §4.2)", () => {
  it("keeps [null, -5] as unknown and -5, and never recommends the unknown above it", () => {
    const players = [player(1, "C", null), player(2, "C", -5), player(3, "C", -20)];
    const result = computeVorpMetrics({
      players,
      availablePlayers: players,
      draftSettings: settings({ C: 1, LW: 0, RW: 0, D: 0, G: 0, utility: 0 }),
      picksUntilNext: 0,
    });
    expect(result.playerMetrics.get("1")).toMatchObject({ value: null, vorp: null, vbd: null });
    expect(result.playerMetrics.get("2")).toMatchObject({ value: -5, vorp: 15 });
    expect(result.unknownValueCount).toBe(1);
    const { result: recs } = renderHook(() => usePlayerRecommendations({ players, vorpMetrics: result.playerMetrics }));
    expect(recs.current.recommendations.map((item) => item.player.playerId)).toEqual([2, 3]);
  });
});

describe("roster-need scale (W2-5 D5)", () => {
  const candidate = (id: string, position: string, score: number): RecommendationCandidate => ({
    id, name: id, role: "skater", eligiblePositions: [position], globalVorp: score, rankValue: score, baselineScore: score,
  });

  it("an unrelated -1,000 candidate does not change a needed player's boosted score", () => {
    const base = [candidate("A", "C", 100), candidate("B", "LW", 40)];
    const options = { leagueType: "points" as const, positionNeeds: { C: 0, LW: 1 }, needAlpha: 0.5, limit: 10 };
    const without = buildPersonalizedRecommendations(base, options);
    const withTail = buildPersonalizedRecommendations([...base, candidate("Z", "C", -1000)], options);
    const score = (results: typeof without, id: string) => results.find((item) => item.candidate.id === id)!.recommendationScore;
    expect(score(withTail, "B")).toBeLessThan(200);
    expect(score(withTail, "A")).toBe(100);
    expect(score(without, "B")).toBeGreaterThan(40);
  });
});

describe("Draft Dashboard category values for goalies (W1 P0 #30, decision 62)", () => {
  const goalie = (playerId: number, stats: Record<string, number>) => ({
    ...player(playerId, "G", null),
    combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected }])),
  }) as ProcessedPlayer;
  const regulars = [
    goalie(1, { SAVE_PERCENTAGE: 0.92, SAVES_GOALIE: 1840, SHOTS_AGAINST_GOALIE: 2000, WINS_GOALIE: 30 }),
    goalie(2, { SAVE_PERCENTAGE: 0.94, SAVES_GOALIE: 470, SHOTS_AGAINST_GOALIE: 500, WINS_GOALIE: 8 }),
    goalie(3, { SAVE_PERCENTAGE: 0.9, SAVES_GOALIE: 1350, SHOTS_AGAINST_GOALIE: 1500, WINS_GOALIE: 20 }),
  ];
  const oneShot = goalie(4, { SAVE_PERCENTAGE: 0, SAVES_GOALIE: 0, SHOTS_AGAINST_GOALIE: 1, WINS_GOALIE: 0 });
  const run = (players: ProcessedPlayer[]) => computeVorpMetrics({
    players,
    availablePlayers: players,
    // Three teams × one goalie slot: the league pool is the top three goalies.
    draftSettings: settings({ C: 0, LW: 0, RW: 0, D: 0, G: 1, utility: 0 }, 3),
    picksUntilNext: 0,
    leagueType: "categories",
    categoryWeights: { SAVE_PERCENTAGE: 1, WINS_GOALIE: 1 },
  });

  it("a one-shot goalie outside the league pool does not move the others' values", () => {
    const without = run(regulars);
    const withOneShot = run([...regulars, oneShot]);
    for (const id of ["1", "2", "3"]) {
      expect(withOneShot.playerMetrics.get(id)?.value).toBeCloseTo(without.playerMetrics.get(id)!.value!, 12);
    }
  });

  it("keeps a goalie with SV% but no shots against or saves unknown", () => {
    const noExposure = goalie(5, { SAVE_PERCENTAGE: 0.95, WINS_GOALIE: 25 });
    expect(run([...regulars, noExposure]).playerMetrics.get("5")?.value).toBeNull();
  });
});

describe("bench in the frozen reference (TJ, 2026-11-11)", () => {
  it("counts the league's bench slots, any position, before naming replacement", () => {
    // One C, one G and one bench slot (bench takes any position). Without the
    // bench the first free C would be 50; with it, 50 is rostered on the bench.
    const players = [player(1, "C", 100), player(2, "G", 60), player(3, "C", 50), player(4, "C", 40)];
    const result = computeVorpMetrics({
      players,
      availablePlayers: players,
      draftSettings: settings({ C: 1, LW: 0, RW: 0, D: 0, G: 1, utility: 0, bench: 1 }),
      picksUntilNext: 0,
    });
    // Slots: C ← 100, G ← 60, bench ← 50; first free C is 40.
    expect(result.replacementByPos.C.vorp).toBe(40);
    expect(result.referenceLabel).toContain("bench included");
  });
});
