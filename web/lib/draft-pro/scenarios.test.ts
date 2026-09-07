import { describe, expect, it } from "vitest";
import type { DraftProDustResult } from "./dust";
import { compareDraftProScenarios, scenarioFingerprint, scenarioIsStale, type ScenarioInput, type ScenarioPlayer } from "./scenarios";

const source = { projection: { id: "public", version: "v1", origin: "server" as const }, schedule: { season: "20262027", gameKey: "500", startWeek: 1, endWeek: 2, lineupMode: "daily" as const, rosterSlots: { C: 1, G: 1 } } };
const skater = (id: string, goals: number, points = 50): ScenarioPlayer => ({ id, name: id, role: "skater", eligiblePositions: ["C", "LW"], teamAbbreviation: "AAA", projectionSeason: "20262027", globalVorp: goals, rankValue: goals, projectedPoints: points, categoryValues: { GOALS: goals } });
const goalie = (id: string, saves: number, shots: number, against: number, toi: number): ScenarioPlayer => ({ id, name: id, role: "goalie", eligiblePositions: ["G"], teamAbbreviation: "BBB", projectionSeason: "20262027", globalVorp: 3, rankValue: 3, projectedPoints: 20, categoryValues: { SAVES_GOALIE: saves, SHOTS_AGAINST_GOALIE: shots, GOALS_AGAINST_GOALIE: against, TOTAL_TOI: toi } });

describe("Draft Pro scenarios", () => {
  it("uses weighted goalie workloads and excludes skater TOI from GAA", () => {
    const roster = [skater("s", 20), goalie("g1", 90, 100, 10, 3600), goalie("g2", 45, 50, 3, 1800)];
    const result = compareDraftProScenarios({ roster, candidateA: goalie("a", 80, 100, 20, 3600), candidateB: goalie("b", 99, 100, 5, 3600), leagueType: "categories", categoryWeights: { SAVE_PERCENTAGE: 1, GOALS_AGAINST_AVERAGE: 2 }, source });
    expect(result.baseline.categories.SAVE_PERCENTAGE).toBeCloseTo(0.9);
    expect(result.baseline.categories.GOALS_AGAINST_AVERAGE).toBeCloseTo(8.6666667);
    expect(result.candidates[0].categories.SAVE_PERCENTAGE.after).toBeCloseTo(0.86);
    expect(result.candidates[1].categories.GOALS_AGAINST_AVERAGE.delta).toBeLessThan(0);
  });
  it("distinguishes missing data from irrelevant categories and rejects invalid individual ratios", () => {
    const result = compareDraftProScenarios({ roster: [skater("s", 10), goalie("g", 95, 100, 5, 3600)], candidateA: skater("a", 5), candidateB: goalie("bad", 101, 100, 2, 3600), leagueType: "categories", categoryWeights: { GOALS: 1, SAVE_PERCENTAGE: 1 }, source });
    expect(result.candidates[0].categories.SAVE_PERCENTAGE.state).toBe("irrelevant");
    expect(result.candidates[1].categories.SAVE_PERCENTAGE.state).toBe("missing");
  });
  it("supports empty-roster points increments, multi-position needs, A/B reversal, and immutability", () => {
    const input: ScenarioInput = { roster: [], candidateA: skater("a", 1, 40), candidateB: skater("b", 9, 60), leagueType: "points", positionNeeds: { LW: 1 }, source }; const before = JSON.stringify(input);
    const first = compareDraftProScenarios(input); const reversed = compareDraftProScenarios({ ...input, candidateA: input.candidateB, candidateB: input.candidateA });
    expect(first.baseline.projectedPoints).toBe(0); expect(first.candidates[0].projectedPointsDelta).toBe(40); expect(first.candidates[0].positionNeeds).toEqual(["LW"]); expect(reversed.candidates[0].id).toBe("b"); expect(JSON.stringify(input)).toBe(before);
  });
  it("carries schedule unavailable diagnostics and makes saved results stale when inputs change", () => {
    const dust = { state: "stale_schedule", freshness: { oldestFetchedAt: "2026-01-01T00:00:00Z", latestFetchedAt: "2026-01-01T00:00:00Z" }, window: { startWeek: 1, endWeek: 2, startDate: "2026-10-01", endDate: "2026-10-14" }, baseline: null, insights: [], diagnostics: ["Schedule data is stale."] } satisfies DraftProDustResult;
    const input: ScenarioInput = { roster: [skater("r", 2)], candidateA: skater("a", 3), candidateB: skater("b", 4), leagueType: "points", source };
    const result = compareDraftProScenarios(input, dust); expect(result.schedule.state).toBe("stale_schedule"); expect(result.candidates[0].dust.reason).toContain("stale"); expect(scenarioIsStale(result.fingerprint, { ...input, candidateA: { ...input.candidateA, globalVorp: 99 } }, dust)).toBe(true);
    expect(scenarioFingerprint({ b: 1, a: 2 })).toBe(scenarioFingerprint({ a: 2, b: 1 }));
  });
  it.each(["weekly_lock_unsupported", "unknown_team"] as const)("preserves %s schedule state without invented DUST", (state) => {
    const dust = { state, freshness: { oldestFetchedAt: null, latestFetchedAt: null }, window: { startWeek: 1, endWeek: 1, startDate: null, endDate: null }, baseline: null, insights: [], diagnostics: [`${state} detail`] } satisfies DraftProDustResult;
    const input: ScenarioInput = { roster: [skater("r", 2)], candidateA: skater("a", 3), candidateB: skater("b", 4), leagueType: "points", source };
    const result = compareDraftProScenarios(input, dust); expect(result.schedule.state).toBe(state); expect(result.candidates[0].dust.activeGamesAdded).toBeNull(); expect(result.candidates[0].dust.reason).toContain(state);
  });
});
