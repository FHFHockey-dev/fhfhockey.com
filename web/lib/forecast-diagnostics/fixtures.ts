import { compareForecastBases, FORECAST_DIAGNOSTICS_VERSION, type ForecastBase, type ForecastDiagnosticsReport, type SourceEvidence } from "./contract";

/** Explicitly synthetic accounting fixtures; never loaded by the production API. */
export function makeSyntheticDiagnosticReport(): ForecastDiagnosticsReport {
  const scope = { gameId: 2025020001, seasonId: 20252026, phase: 2, gameDate: "2026-01-10", startAt: "2026-01-10T23:00:00Z", cutoffAt: "2026-01-10T11:45:00Z", horizonGames: 1 as const };
  const source: SourceEvidence = { source: "synthetic_fixture", revisionId: "fixture-input-1", payloadHash: "a".repeat(64), observedAt: "2026-01-10T11:40:00Z", availableAt: "2026-01-10T11:41:00Z", retrievedAt: "2026-01-10T11:41:00Z", availabilityBasis: "retained_capture", immutable: true, hashVerified: true };
  const base: Omit<ForecastBase, "source" | "rawMean"> = { contractVersion: FORECAST_DIAGNOSTICS_VERSION, forecastSetId: "synthetic-ottawa-comparison-v1", gameId: scope.gameId, seasonId: scope.seasonId, phase: 2, teamId: 9, horizonGames: 1, cutoffAt: scope.cutoffAt, issuedAt: "2026-01-10T11:46:00Z", modelVersion: "synthetic-model-v1", calibrationVersion: null, featureNames: ["synthetic_rate"], rosterScenarioId: "synthetic-roster-1", strengthStates: ["all"], workloadByStrength: { all: 60 }, goalDefinition: { periods: "regulation_and_overtime", shootout: "excluded", emptyNet: "included" }, meanSemantics: "unconditional", appearanceProbability: null, residualMean: 0, emptyNetMean: null, coverage: "complete", contributors: [], lineage: [source] };
  const forge: ForecastBase = { ...base, source: "forge", rawMean: 2, contributors: [
    { playerId: 10, scenarioId: "synthetic-roster-1", mean: 0.8, semantics: "unconditional", appearanceProbability: 0.75 },
    { playerId: 11, scenarioId: "synthetic-roster-1", mean: 1.2, semantics: "unconditional", appearanceProbability: 0.6 },
  ] };
  const team: ForecastBase = { ...base, source: "team", rawMean: 3.25 };
  return { contractVersion: FORECAST_DIAGNOSTICS_VERSION, forecastSetId: base.forecastSetId, generatedAt: "2026-01-10T11:46:00Z", evidenceKind: "synthetic_fixture", scope,
    comparisons: [compareForecastBases({ scope, teamId: 9, abbreviation: "OTT", forge, team })],
    exposure: [{ teamId: 9, abbreviation: "OTT", seasonId: scope.seasonId, source: "synthetic_team_game_facts", sourceRowCount: 4,
      legacyTotals: { gp: 12, gf: 30, ga: 22 }, correctedTotals: { gp: 3, gf: 8, ga: 6 }, lastFiveGameIds: [2025020000, 2025019999, 2025019998], actualLastFiveCount: 3,
      acceptedGameIds: [2025020000, 2025019999, 2025019998], coverage: "partial", exclusions: [{ rowIndex: 3, reason: "cumulative_or_invalid_gp" }] }],
    sources: [source], replay: { status: "not_verified", blockers: ["Synthetic fixture; no real-game executable replay has been verified."] },
    limitations: ["Ottawa 2.0 versus 3.25 is an illustrative fixture, not a historical accuracy result.", "Missing uncertainty is unavailable, not a calibrated confidence interval."] };
}
