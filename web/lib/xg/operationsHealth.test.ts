import { describe, expect, it } from "vitest";
import { buildXgOperationsAlerts, buildXgTeamAggregateReconciliation } from "./operationsHealth";

describe("xG operations health", () => {
  it("surfaces missing leases, registry mismatch, and aggregate gaps", () => {
    const alerts = buildXgOperationsAlerts({
      featureCount: 100,
      predictionCount: 50,
      aggregateCounts: { team: 10, player: 0, goalie: 5 },
      aggregateReconciliation: { status: "warning", gamesChecked: 1, issueCount: 1, maximumAbsoluteDelta: 0.2 },
      flurryAggregateCoverage: { teamGame: { total: 10, adjusted: 0 } },
      flurryAggregateReconciliation: { status: "unavailable", gamesChecked: 0, issueCount: 0, maximumAbsoluteDelta: null },
      registryModelVersion: "v2",
      predictionModelVersion: "v1",
      registryAvailable: true,
      leasesAvailable: false,
      runningLeaseCount: 0,
      featureDriftStatus: "ok",
      featureDriftIssues: [],
      calibration: { minimumSampleSize: 10, binCount: 5, overall: { exampleCount: 0, goalCount: 0, goalRate: null, averagePrediction: null, logLoss: null, brierScore: null }, segments: [] },
      benchmarks: [],
    });
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "registry_mismatch", severity: "error" }),
      expect.objectContaining({ key: "leases_unavailable", severity: "warn" }),
      expect.objectContaining({ key: "aggregate_reconciliation", severity: "error" }),
      expect.objectContaining({ key: "flurry_aggregate_coverage", severity: "error" }),
    ]));
  });

  it("reports complete flurry surfaces and adjusted symmetry", () => {
    const alerts = buildXgOperationsAlerts({
      featureCount: 100,
      predictionCount: 100,
      aggregateCounts: { team: 10, player: 20, goalie: 5 },
      aggregateReconciliation: { status: "ok", gamesChecked: 5, issueCount: 0, maximumAbsoluteDelta: 0 },
      flurryAggregateCoverage: {
        teamGame: { total: 10, adjusted: 10 },
        playerGame: { total: 20, adjusted: 20 },
      },
      flurryAggregateReconciliation: { status: "ok", gamesChecked: 5, issueCount: 0, maximumAbsoluteDelta: 0 },
      registryModelVersion: "v1",
      predictionModelVersion: "v1",
      registryAvailable: true,
      leasesAvailable: true,
      runningLeaseCount: 0,
      featureDriftStatus: "ok",
      featureDriftIssues: [],
      calibration: { minimumSampleSize: 10, binCount: 5, overall: { exampleCount: 0, goalCount: 0, goalRate: null, averagePrediction: null, logLoss: null, brierScore: null }, segments: [] },
      benchmarks: [],
    });
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "flurry_aggregate_coverage", severity: "ok" }),
      expect.objectContaining({ key: "flurry_aggregate_reconciliation", severity: "ok" }),
    ]));
  });

  it("checks sampled team xGF/xGA symmetry by model, feature, and game", () => {
    expect(buildXgTeamAggregateReconciliation([
      { model_version: "v1", feature_version: 1, game_id: 1, xg_for: 2, xg_against: 1 },
      { model_version: "v1", feature_version: 1, game_id: 1, xg_for: 1, xg_against: 2 },
    ])).toMatchObject({ status: "ok", gamesChecked: 1, issueCount: 0, maximumAbsoluteDelta: 0 });
  });
});
