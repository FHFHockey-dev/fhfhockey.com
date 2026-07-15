import type { XgCalibrationAudit, XgBenchmarkSurface } from "./hardeningAudit";
import type { XgScoringFeatureCoverageIssue } from "./featureCoverage";

export type XgOperationsAlert = {
  key: string;
  severity: "ok" | "warn" | "error";
  message: string;
};

export type XgTeamAggregateReconciliation = {
  status: "ok" | "warning" | "unavailable";
  gamesChecked: number;
  issueCount: number;
  maximumAbsoluteDelta: number | null;
};

export function buildXgTeamAggregateReconciliation(
  rows: Array<{ model_version: string; feature_version: number; game_id: number; xg_for: number; xg_against: number }>,
  tolerance = 0.0001,
): XgTeamAggregateReconciliation {
  if (rows.length === 0) return { status: "unavailable", gamesChecked: 0, issueCount: 0, maximumAbsoluteDelta: null };
  const games = new Map<string, { xgFor: number; xgAgainst: number }>();
  for (const row of rows) {
    const key = `${row.model_version}:${row.feature_version}:${row.game_id}`;
    const current = games.get(key) ?? { xgFor: 0, xgAgainst: 0 };
    current.xgFor += Number(row.xg_for) || 0;
    current.xgAgainst += Number(row.xg_against) || 0;
    games.set(key, current);
  }
  const deltas = [...games.values()].map((game) => Math.abs(game.xgFor - game.xgAgainst));
  const issueCount = deltas.filter((delta) => delta > tolerance).length;
  return {
    status: issueCount > 0 ? "warning" : "ok",
    gamesChecked: games.size,
    issueCount,
    maximumAbsoluteDelta: Number(Math.max(...deltas).toFixed(6)),
  };
}

export type XgOperationsSummaryInput = {
  featureCount: number | null;
  predictionCount: number | null;
  aggregateCounts: { team: number | null; player: number | null; goalie: number | null };
  aggregateReconciliation: XgTeamAggregateReconciliation;
  flurryAggregateCoverage: Record<string, { total: number | null; adjusted: number | null }>;
  flurryAggregateReconciliation: XgTeamAggregateReconciliation;
  registryModelVersion: string | null;
  predictionModelVersion: string | null;
  registryAvailable: boolean;
  leasesAvailable: boolean;
  runningLeaseCount: number;
  featureDriftStatus: "ok" | "warning" | "insufficient" | "unavailable";
  featureDriftIssues: XgScoringFeatureCoverageIssue[];
  calibration: XgCalibrationAudit;
  benchmarks: XgBenchmarkSurface[];
};

export function buildXgOperationsAlerts(input: XgOperationsSummaryInput): XgOperationsAlert[] {
  const alerts: XgOperationsAlert[] = [];
  if (input.featureCount == null || input.predictionCount == null) {
    alerts.push({ key: "coverage_unavailable", severity: "error", message: "Feature or prediction coverage count is unavailable." });
  } else if (input.featureCount > 0 && input.predictionCount === 0) {
    alerts.push({ key: "prediction_coverage", severity: "error", message: "Feature rows exist without approved prediction coverage." });
  } else {
    alerts.push({ key: "prediction_coverage", severity: "ok", message: `Coverage counts available: ${input.featureCount ?? 0} features and ${input.predictionCount ?? 0} approved predictions.` });
  }
  if (input.featureDriftStatus === "unavailable") {
    alerts.push({ key: "feature_drift", severity: "error", message: "Feature null-rate drift is unavailable because the registry coverage contract is missing or invalid." });
  } else if (input.featureDriftStatus === "insufficient") {
    alerts.push({ key: "feature_drift", severity: "warn", message: "Feature null-rate drift sample is below the registry confidence threshold." });
  } else if (input.featureDriftIssues.length > 0) {
    alerts.push({ key: "feature_drift", severity: "error", message: `${input.featureDriftIssues.length} feature coverage drift issue(s) exceed the registry policy.` });
  } else {
    alerts.push({ key: "feature_drift", severity: "ok", message: "Sampled feature null rates remain within the registry drift policy." });
  }
  if (!input.registryAvailable) {
    alerts.push({ key: "registry_unavailable", severity: "warn", message: "Model registry is unavailable; artifact/registry parity cannot be proven." });
  } else if (input.registryModelVersion !== input.predictionModelVersion) {
    alerts.push({ key: "registry_mismatch", severity: "error", message: "Latest approved prediction model does not match the active/champion registry model." });
  } else {
    alerts.push({ key: "registry_match", severity: "ok", message: "Prediction and registry model versions agree." });
  }
  if (!input.leasesAvailable) {
    alerts.push({ key: "leases_unavailable", severity: "warn", message: "Durable xG execution leases are not deployed; cross-instance coordination is not active." });
  } else if (input.runningLeaseCount > 0) {
    alerts.push({ key: "leases_running", severity: "warn", message: `${input.runningLeaseCount} xG job lease(s) are currently running.` });
  } else {
    alerts.push({ key: "leases_idle", severity: "ok", message: "No overlapping xG jobs are currently running." });
  }
  const aggregateMissing = Object.entries(input.aggregateCounts).filter(([, count]) => count === 0 || count == null);
  alerts.push({
    key: "aggregate_reconciliation",
    severity: input.predictionCount && aggregateMissing.length ? "error" : "ok",
    message: aggregateMissing.length
      ? `Aggregate coverage missing/unavailable for: ${aggregateMissing.map(([key]) => key).join(", ")}.`
      : "Team, player, and goalie aggregate coverage is present; numeric reconciliation remains enforced by the aggregate builder QA.",
  });
  if (input.aggregateReconciliation.status === "unavailable") {
    alerts.push({ key: "aggregate_numeric_reconciliation", severity: "warn", message: "Sampled team aggregate numeric reconciliation is unavailable." });
  } else if (input.aggregateReconciliation.issueCount > 0) {
    alerts.push({ key: "aggregate_numeric_reconciliation", severity: "error", message: `${input.aggregateReconciliation.issueCount}/${input.aggregateReconciliation.gamesChecked} sampled game aggregate(s) fail xGF/xGA symmetry.` });
  } else {
    alerts.push({ key: "aggregate_numeric_reconciliation", severity: "ok", message: `${input.aggregateReconciliation.gamesChecked} sampled game aggregate(s) pass xGF/xGA symmetry.` });
  }
  const flurryCoverageRows = Object.entries(input.flurryAggregateCoverage);
  const unavailableFlurrySurfaces = flurryCoverageRows.filter(([, value]) => value.total == null || value.adjusted == null);
  const incompleteFlurrySurfaces = flurryCoverageRows.filter(([, value]) => value.total != null && value.adjusted != null && value.adjusted !== value.total);
  alerts.push({
    key: "flurry_aggregate_coverage",
    severity: unavailableFlurrySurfaces.length > 0 || incompleteFlurrySurfaces.length > 0 ? "error" : "ok",
    message: unavailableFlurrySurfaces.length > 0
      ? `Flurry-adjusted aggregate completeness is unavailable for: ${unavailableFlurrySurfaces.map(([key]) => key).join(", ")}.`
      : incompleteFlurrySurfaces.length > 0
        ? `Flurry-adjusted aggregate materialization is incomplete for: ${incompleteFlurrySurfaces.map(([key, value]) => `${key} (${value.adjusted}/${value.total})`).join(", ")}.`
        : `All ${flurryCoverageRows.length} flurry-adjusted aggregate surfaces are complete for the active model.`,
  });
  if (input.flurryAggregateReconciliation.status === "unavailable") {
    alerts.push({ key: "flurry_aggregate_reconciliation", severity: "warn", message: "Sampled flurry-adjusted team aggregate reconciliation is unavailable." });
  } else if (input.flurryAggregateReconciliation.issueCount > 0) {
    alerts.push({ key: "flurry_aggregate_reconciliation", severity: "error", message: `${input.flurryAggregateReconciliation.issueCount}/${input.flurryAggregateReconciliation.gamesChecked} sampled game aggregate(s) fail flurry-adjusted xGF/xGA symmetry.` });
  } else {
    alerts.push({ key: "flurry_aggregate_reconciliation", severity: "ok", message: `${input.flurryAggregateReconciliation.gamesChecked} sampled game aggregate(s) pass flurry-adjusted xGF/xGA symmetry.` });
  }
  const insufficientSegments = input.calibration.segments.filter((row) => row.status === "insufficient").length;
  alerts.push({
    key: "calibration_segments",
    severity: insufficientSegments > 0 ? "warn" : "ok",
    message: insufficientSegments > 0
      ? `${insufficientSegments} calibration segment(s) are below confidence thresholds.`
      : "All sampled calibration segments meet confidence thresholds.",
  });
  return alerts;
}
