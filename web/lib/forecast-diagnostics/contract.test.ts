import { describe, expect, it } from "vitest";
import { compareForecastBases, forecastDiagnosticsJson, forecastDiagnosticsMarkdown } from "./contract";
import { makeSyntheticDiagnosticReport } from "./fixtures";

const compare = (report = makeSyntheticDiagnosticReport()) => {
  const row = report.comparisons[0];
  return compareForecastBases({ scope: report.scope, teamId: row.teamId, abbreviation: row.abbreviation, forge: row.forge, team: row.team });
};

describe("forecast diagnostic alignment", () => {
  it("preserves the illustrative bases without rescaling or double participation", () => {
    expect(compare()).toMatchObject({ forgeMean: 2, teamMean: 3.25, difference: -1.25, status: "aligned", reasons: [] });
  });
  it("applies conditional appearance once and includes explicitly declared residuals", () => {
    const report = makeSyntheticDiagnosticReport(), forge = report.comparisons[0].forge!;
    forge.contributors = [{ playerId: 10, scenarioId: forge.rosterScenarioId!, mean: 2, semantics: "conditional_on_appearance", appearanceProbability: 0.5 }];
    forge.residualMean = 0.25;
    expect(compare(report).forgeMean).toBe(1.25);
  });
  it.each([
    ["horizon_mismatch", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.horizonGames = 5; }],
    ["mixed_forecast_sets", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].team!.forecastSetId = "different"; }],
    ["cutoff_mismatch", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.cutoffAt = "2026-01-10T11:46:00Z"; }],
    ["unsupported_goal_endpoint", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.goalDefinition = null; }],
    ["ambiguous_strength_states", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.strengthStates = ["all", "pp"]; }],
    ["duplicate_player_scenario", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.contributors.push({ ...r.comparisons[0].forge!.contributors[0], scenarioId: "two" }); }],
    ["unknown_participation", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.contributors[0].semantics = "conditional_on_appearance"; r.comparisons[0].forge!.contributors[0].appearanceProbability = null; }],
    ["unknown_residual_contributors", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.residualMean = null; }],
    ["unknown_source_availability", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.lineage[0].availabilityBasis = "unknown"; }],
    ["future_source_availability", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.lineage[0].availableAt = "2026-01-10T11:46:00Z"; }],
    ["future_source_availability", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.lineage[0].availableAt = r.scope.cutoffAt; }],
    ["unknown_source_availability", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.lineage[0].availableAt = "2026-01-10T11:41:00"; }],
    ["player_roster_scenario_mismatch", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.contributors[0].scenarioId = "other"; }],
    ["forecast_source_mismatch", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].team!.source = "forge"; }],
    ["unverified_input_revision", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.lineage[0].hashVerified = false; }],
    ["invalid_regular_season_pregame_scope", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.scope.phase = 3; }],
    ["roster_scenario_mismatch", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].team!.rosterScenarioId = "other"; }],
    ["unavailable_or_invalid_player_mean", (r: ReturnType<typeof makeSyntheticDiagnosticReport>) => { r.comparisons[0].forge!.contributors[0].mean = -1; }],
  ])("keeps discrepancy unavailable for %s", (reason, change) => {
    const report = makeSyntheticDiagnosticReport(); change(report);
    const result = compare(report);
    expect(result.reasons).toContain(reason);
    expect(result).toMatchObject({ status: "incompatible", difference: null, forgeMean: null, teamMean: null });
  });
  it("accepts equivalent timezone-qualified cutoff timestamps", () => {
    const report = makeSyntheticDiagnosticReport(); report.scope.cutoffAt = "2026-01-10T06:45:00-05:00";
    expect(compare(report).status).toBe("aligned");
  });
  it("retains raw estimates and reasons when one forecast is missing", () => {
    const report = makeSyntheticDiagnosticReport(); report.comparisons[0].team = null;
    expect(compare(report)).toMatchObject({ status: "unavailable", difference: null, forgeMean: null, reasons: ["missing_team_forecast"] });
    expect(compare(report).forge?.rawMean).toBe(2);
  });
  it("exports the exact report without converting unavailable data to zero", () => {
    const report = makeSyntheticDiagnosticReport();
    report.comparisons[0].team = null; report.comparisons[0] = compare(report);
    report.exposure[0].correctedTotals = { gp: null, gf: null, ga: null };
    expect(JSON.parse(forecastDiagnosticsJson(report))).toEqual(report);
    const markdown = forecastDiagnosticsMarkdown(report);
    expect(markdown).toContain("| OTT | 2 | Unavailable | Unavailable | Unavailable | Unavailable | unavailable |");
    expect(markdown).toContain("Unavailable / Unavailable / Unavailable");
    expect(markdown).toContain(report.forecastSetId);
    expect(markdown).toContain("synthetic_fixture");
    expect(markdown).toContain("missing_team_forecast");
  });
});
