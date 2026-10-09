import { describe, expect, it } from "vitest";
import type { GameForecast, PlanEvaluation, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { comparePlanScenarios, comparePlanSensitivity } from "./planComparison";
import { forecastCalendarPolicy, resolveContribution, type ContributionSource } from "./contributions";

// These fixtures isolate paired scoring: legality and assignment were already evaluated.
function fixture() {
  const forecast = (playerId: string, value: number): GameForecast => ({ playerId, gameId: "g", stats: { GOALS: value },
    conditioning: "unconditional", allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    startProbability: null, confirmedStart: false, revisionId: `issued-${playerId}`, issuedAt: "2026-10-01T00:00:00Z",
    modelVersion: null, limitations: [] });
  const resolved = [forecast("shared", 10), forecast("a", 1), forecast("b", 2)];
  const snapshot = {
    id: "snap", forecasts: [forecast("shared", 100), forecast("a", 100), forecast("b", 100)],
    rules: { scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] } }, opponent: null,
  } as unknown as PlanningSnapshot;
  const plan = (playerId: string, goals: number): PlanEvaluation => ({
    objective: "outcome", steps: [], legal: true, budgetVerified: true, scheduledGames: 2, activeGames: 2, benchGames: 0,
    projectedValue: goals, projectedStats: { GOALS: goals }, categoryResults: [], acquisitions: {}, limitations: [],
    recommendation: { eligible: true, mode: "quality", reasons: [], unresolved: [] },
    comparisonEligible: true, forecastManifestId: "snap",
    forecastInputs: resolved.filter(row => row.playerId === "shared" || row.playerId === playerId),
    goalie: { credited: null, confirmed: 0, projected: null, required: null, risk: false },
    assignments: ["shared", playerId].map(id => ({ playerId: id, gameId: "g", date: "2026-10-01", slotId: id, locked: false })),
  });
  return { snapshot, baseline: plan("a", 11), candidate: plan("b", 12), resolved };
}

describe("paired complete-plan comparison", () => {
  it("cancels a shared player/game contribution using the same scenario", () => {
    const { snapshot, baseline, candidate } = fixture();
    const result = comparePlanScenarios(snapshot, baseline, candidate, [{ id: "shared-shock", label: "Shared game shock", games: [
      { playerId: "shared", gameId: "g", stats: { GOALS: 100 } },
      { playerId: "a", gameId: "g", stats: { GOALS: 1 } }, { playerId: "b", gameId: "g", stats: { GOALS: 2 } },
    ] }]);
    expect(result.scenarios[0]).toMatchObject({ baseline: 101, candidate: 102, difference: 1 });
    expect(snapshot.forecasts[0].stats.GOALS).toBe(100);
  });
  it("keeps missing scenario outcomes unknown and labels stresses without probabilities", () => {
    const { snapshot, baseline, candidate } = fixture();
    const incomplete = comparePlanScenarios(snapshot, baseline, candidate, [{ id: "missing", label: "Missing", games: [] }]);
    expect(incomplete.direction).toBe("unavailable");
    expect(incomplete.scenarios[0].difference).toBeNull();
    const sensitivity = comparePlanSensitivity(snapshot, baseline, candidate);
    expect(sensitivity.scenarios.map(row => row.difference)).toEqual([expect.closeTo(0.8), 1, expect.closeTo(1.2)]);
    expect(sensitivity.basis).toBe("sensitivity");
    expect(sensitivity).not.toHaveProperty("probability");
  });
  it("withholds numerical sensitivity when a plan lacks comparable recommendation evidence", () => {
    const { snapshot, baseline, candidate } = fixture();
    candidate.recommendation = { eligible: false, mode: "schedule_capacity", reasons: [], unresolved: [] };
    const result = comparePlanSensitivity(snapshot, baseline, candidate);
    expect(result.direction).toBe("unavailable");
    expect(result.scenarios.every(row => row.candidate === null && row.difference === null)).toBe(true);
  });
  it("uses exact baseline and blended means, and gives identical plans zero difference", () => {
    const { snapshot, baseline, candidate } = fixture();
    baseline.forecastInputs![1] = { ...baseline.forecastInputs![1], sourceKind: "baseline", stats: { GOALS: 1 } };
    candidate.forecastInputs![1] = { ...candidate.forecastInputs![1], sourceKind: "blended", stats: { GOALS: 2 } };
    expect(comparePlanSensitivity(snapshot, baseline, candidate).scenarios.map(row => row.difference))
      .toEqual([expect.closeTo(0.8), 1, expect.closeTo(1.2)]);
    expect(comparePlanSensitivity(snapshot, baseline, baseline).scenarios.every(row => row.difference === 0)).toBe(true);
  });

  it("compares mixed skater and goalie targets without filling in unrelated stats", () => {
    const { snapshot, baseline, candidate } = fixture();
    snapshot.rules.scoring.weights = { GOALS: 1, SAVES_GOALIE: 1 };
    baseline.forecastInputs![1] = { ...baseline.forecastInputs![1], stats: { SAVES_GOALIE: 1 } };
    candidate.forecastInputs![1] = { ...candidate.forecastInputs![1], stats: { SAVES_GOALIE: 2 } };
    baseline.projectedStats = { GOALS: 10, SAVES_GOALIE: 1 };
    candidate.projectedStats = { GOALS: 10, SAVES_GOALIE: 2 };
    expect(comparePlanSensitivity(snapshot, baseline, candidate).scenarios.map(row => row.difference))
      .toEqual([expect.closeTo(0.8), 1, expect.closeTo(1.2)]);
  });

  it("fails closed for missing permissions, duplicate inputs and mismatched shared lineage", () => {
    const { snapshot, baseline, candidate } = fixture();
    candidate.forecastInputs![0] = { ...candidate.forecastInputs![0], revisionId: "other-revision" };
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("unavailable");
    candidate.forecastInputs![0] = baseline.forecastInputs![0];
    candidate.forecastInputs![0] = { ...candidate.forecastInputs![0], issuedContext: {
      version: "forge-issued-context-v1", playerId: "shared", gameId: "g", nhlPlayerId: 7,
      seasonId: 20262027, teamId: 1, scheduledAt: "2026-10-01T23:00:00Z",
      scheduleRevision: "changed-schedule", rosterRevision: "roster", observedAt: "2026-09-30T23:00:00Z",
      scheduleSourceUpdatedAt: null, scheduleFetchedAt: null, identityUpdatedAt: null,
      membershipCreatedAt: ["2026-09-01T00:00:00Z"],
    } };
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("unavailable");
    candidate.forecastInputs![0] = baseline.forecastInputs![0];
    candidate.forecastInputs![1] = { ...candidate.forecastInputs![1], allowedUses: {
      assignment: true, totals: true, comparison: false, conditionalTieBreak: false } };
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("unavailable");
    candidate.forecastInputs![1] = { ...candidate.forecastInputs![1], allowedUses: baseline.forecastInputs![0].allowedUses };
    candidate.forecastInputs!.push(candidate.forecastInputs![1]);
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("unavailable");
    candidate.forecastInputs!.pop();
    candidate.forecastInputs![1] = { ...candidate.forecastInputs![1], contributions: { GOALS: {
      allowedUses: { assignment: true, totals: true, comparison: false, conditionalTieBreak: false },
    } as never } };
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("unavailable");
    candidate.forecastInputs![1] = { ...candidate.forecastInputs![1], contributions: undefined };
    candidate.forecastManifestId = "another-manifest";
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("unavailable");
    candidate.forecastManifestId = "snap";
    baseline.forecastInputs = undefined;
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("unavailable");
  });
  it("computes category ratios from complete component totals", () => {
    const { snapshot, baseline, candidate } = fixture();
    snapshot.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "SAVE_PERCENTAGE", direction: "higher", numerator: "SAVES", denominator: "SHOTS" }] };
    snapshot.opponent = { roster: [], realized: { SAVES: 9, SHOTS: 10 }, remaining: { SAVES: 9, SHOTS: 10 } };
    baseline.forecastInputs = baseline.forecastInputs!.map(row => ({ ...row, stats: { SAVES: 9, SHOTS: 10 } }));
    candidate.forecastInputs = candidate.forecastInputs!.map(row => ({ ...row, stats: { SAVES: 9, SHOTS: 10 } }));
    baseline.projectedStats = { SAVES: 18, SHOTS: 20 }; candidate.projectedStats = { SAVES: 18, SHOTS: 20 };
    const result = comparePlanScenarios(snapshot, baseline, candidate, [{ id: "ratio", label: "Ratio",
      games: [baseline.forecastInputs![0], baseline.forecastInputs![1], candidate.forecastInputs![1]]
        .map(row => ({ playerId: row.playerId, gameId: row.gameId,
          stats: { SAVES: row.playerId === "b" ? 1 : 9, SHOTS: row.playerId === "b" ? 1 : 10 } })) }]);
    expect(result.scenarios[0]).toMatchObject({ baseline: 0, candidate: 1, difference: 1 });
  });

  it("compares retained input lineage independent of object key order and rejects changed evidence", () => {
    const { snapshot, baseline, candidate } = fixture();
    const game = { playerId: 1, nhlPlayerId: 11, seasonId: 20262027, teamId: 1,
      gameId: 30, scheduledAt: "2026-10-01T23:00:00Z", scheduleRevision: "schedule", rosterRevision: "roster" };
    const source: ContributionSource = { ...game, kind: "baseline", sourceId: "rate", policyVersion: "rates-v1",
      released: true, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      targetKey: "GOALS", unit: "count", basis: "unconditional_game", mean: 10, participationIntegrated: true,
      cutoffAt: "2026-09-30T00:00:00Z", issuedAt: "2026-10-01T00:00:00Z",
      expiresAt: "2026-10-02T00:00:00Z", sourceWatermark: "captured-input" };
    const contribution = resolveContribution({ game, targetKey: "GOALS", baseline: source, now: source.issuedAt });
    baseline.forecastInputs![0] = { ...baseline.forecastInputs![0], contributions: { GOALS: contribution } };
    candidate.forecastInputs![0] = structuredClone(baseline.forecastInputs![0]);
    candidate.forecastInputs![0].contributions!.GOALS.inputs!.baseline =
      Object.fromEntries(Object.entries(source).reverse()) as ContributionSource;
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("candidate");
    snapshot.forecastManifest = { version: "planning-forecasts-v1", id: "snap", calendarPolicy: forecastCalendarPolicy(14),
      seasonId: 20262027, asOf: source.issuedAt, scheduleRevision: "schedule", rosterRevision: "roster",
      issuedRevisionIds: [], baselineChecksum: "rates", requiredOpportunities: 3, forecastedOpportunities: 3, exclusionCounts: {} };
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("candidate");
    snapshot.forecastManifest.calendarPolicy = forecastCalendarPolicy(21);
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("unavailable");
    snapshot.forecastManifest.calendarPolicy = forecastCalendarPolicy(14);
    candidate.forecastInputs![0].contributions!.GOALS.inputs!.baseline!.sourceWatermark = "different-input";
    expect(comparePlanSensitivity(snapshot, baseline, candidate).direction).toBe("unavailable");
  });
});
