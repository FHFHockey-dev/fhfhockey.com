import type { buildNativeTeamGoalAccounting, buildNativeRosterContributorCoverage } from "../projections/nativeGoalAccounting";

export const FORECAST_DIAGNOSTICS_VERSION = "forecast-diagnostics-v1";

export type DiagnosticScope = {
  gameId: number;
  seasonId: number;
  phase: number;
  gameDate: string;
  startAt: string;
  cutoffAt: string;
  horizonGames: 1;
};

export type SourceEvidence = {
  source: string;
  revisionId: string | null;
  payloadHash: string | null;
  observedAt: string | null;
  availableAt: string | null;
  retrievedAt: string;
  availabilityBasis: "original_source" | "retained_capture" | "unknown";
  immutable: boolean;
  hashVerified: boolean;
};

export type GoalDefinition = {
  periods: "regulation_and_overtime";
  shootout: "excluded";
  emptyNet: "included" | "excluded" | "unknown";
};

export type GoalContributor = {
  playerId: number;
  scenarioId: string;
  mean: number | null;
  semantics: "conditional_on_appearance" | "unconditional" | "unknown";
  appearanceProbability: number | null;
};

export type ForecastBase = {
  source: "forge" | "team";
  contractVersion: string;
  forecastSetId: string;
  gameId: number;
  teamId: number;
  seasonId: number;
  phase: number;
  horizonGames: number | null;
  cutoffAt: string | null;
  issuedAt: string | null;
  modelVersion: string | null;
  calibrationVersion: string | null;
  featureNames: string[] | null;
  rosterScenarioId: string | null;
  strengthStates: string[];
  workloadByStrength: Record<string, number | null> | null;
  goalDefinition: GoalDefinition | null;
  rawMean: number | null;
  meanSemantics: "conditional_on_appearance" | "unconditional" | "unknown";
  appearanceProbability: number | null;
  residualMean: number | null;
  emptyNetMean: number | null;
  coverage: "complete" | "partial" | "unsupported";
  contributors: GoalContributor[];
  lineage: SourceEvidence[];
  /** Partial native buckets, not a supported full official-play forecast. */
  nativeGoalAccounting?: ReturnType<typeof buildNativeTeamGoalAccounting>;
  /** Retained producer selection provenance; not a complete game-time roster or residual proof. */
  nativeRosterContributorCoverage?: ReturnType<typeof buildNativeRosterContributorCoverage>;
};

export type TeamComparison = {
  teamId: number;
  abbreviation: string;
  forge: ForecastBase | null;
  team: ForecastBase | null;
  forgeMean: number | null;
  teamMean: number | null;
  difference: number | null;
  status: "aligned" | "incompatible" | "unavailable";
  reasons: string[];
};

export type ExposureReport = {
  teamId: number;
  abbreviation: string;
  seasonId: number;
  source: string;
  sourceRowCount: number;
  legacyTotals: { gp: number; gf: number; ga: number };
  correctedTotals: { gp: number | null; gf: number | null; ga: number | null };
  lastFiveGameIds: number[];
  actualLastFiveCount: number;
  acceptedGameIds: number[];
  coverage: "complete" | "partial" | "unavailable";
  exclusions: { rowIndex: number; reason: string }[];
};

export type ForecastDiagnosticsReport = {
  contractVersion: typeof FORECAST_DIAGNOSTICS_VERSION;
  forecastSetId: string;
  generatedAt: string;
  evidenceKind: "retained_records" | "synthetic_fixture";
  scope: DiagnosticScope;
  comparisons: TeamComparison[];
  exposure: ExposureReport[];
  sources: SourceEvidence[];
  replay: { status: "verified" | "not_verified"; blockers: string[] };
  limitations: string[];
};

const finiteNonnegative = (value: number | null): value is number =>
  value != null && Number.isFinite(value) && value >= 0;
const time = (value: string | null): number => value && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? Date.parse(value) : NaN;

function comparableMean(base: ForecastBase, scope: DiagnosticScope): { mean: number | null; reasons: string[] } {
  const reasons: string[] = [];
  if (base.contractVersion !== FORECAST_DIAGNOSTICS_VERSION) reasons.push("unsupported_contract_version");
  if (base.gameId !== scope.gameId || base.seasonId !== scope.seasonId || base.phase !== scope.phase) reasons.push("game_or_population_mismatch");
  if (base.horizonGames !== scope.horizonGames) reasons.push("horizon_mismatch");
  if (!Number.isFinite(time(base.cutoffAt)) || time(base.cutoffAt) !== time(scope.cutoffAt)) reasons.push("cutoff_mismatch");
  if (!Number.isFinite(time(base.issuedAt)) || time(base.issuedAt) < time(scope.cutoffAt) || time(base.issuedAt) >= time(scope.startAt)) reasons.push("invalid_issuance");
  if (!base.modelVersion) reasons.push("missing_model_version");
  if (!base.rosterScenarioId) reasons.push("unknown_roster_scenario");
  if (base.coverage !== "complete") reasons.push("incomplete_goal_coverage");
  if (base.goalDefinition?.periods !== "regulation_and_overtime" || base.goalDefinition?.shootout !== "excluded" || base.goalDefinition?.emptyNet !== "included") reasons.push("unsupported_goal_endpoint");
  if (!base.strengthStates.length || new Set(base.strengthStates).size !== base.strengthStates.length ||
    (base.strengthStates.includes("all") && base.strengthStates.length > 1)) reasons.push("ambiguous_strength_states");
  if (!base.lineage.length) reasons.push("missing_source_lineage");
  for (const evidence of base.lineage) {
    if (!evidence.immutable || !evidence.revisionId || !evidence.payloadHash || !/^[a-f0-9]{64}$/i.test(evidence.payloadHash) || !evidence.hashVerified) reasons.push("unverified_input_revision");
    if (evidence.availabilityBasis === "unknown" || !Number.isFinite(time(evidence.availableAt))) reasons.push("unknown_source_availability");
    else if (time(evidence.availableAt) >= time(scope.cutoffAt)) reasons.push("future_source_availability");
  }
  let mean: number | null = null;
  if (base.source === "forge") {
    const playerIds = new Set<number>();
    let sum = 0;
    if (!base.contributors.length) reasons.push("missing_player_contributors");
    for (const player of base.contributors) {
      if (!Number.isInteger(player.playerId) || player.playerId <= 0 || !player.scenarioId) reasons.push("invalid_player_identity");
      if (player.scenarioId !== base.rosterScenarioId) reasons.push("player_roster_scenario_mismatch");
      if (playerIds.has(player.playerId)) reasons.push("duplicate_player_scenario");
      playerIds.add(player.playerId);
      if (!finiteNonnegative(player.mean)) { reasons.push("unavailable_or_invalid_player_mean"); continue; }
      if (player.semantics === "unconditional") sum += player.mean;
      else if (player.semantics === "conditional_on_appearance" && finiteNonnegative(player.appearanceProbability) && player.appearanceProbability <= 1) sum += player.mean * player.appearanceProbability;
      else reasons.push("unknown_participation");
    }
    if (!finiteNonnegative(base.residualMean)) reasons.push("unknown_residual_contributors");
    else mean = sum + base.residualMean;
  } else if (!finiteNonnegative(base.rawMean)) reasons.push("unavailable_or_invalid_team_mean");
  else if (base.meanSemantics === "unconditional") mean = base.rawMean;
  else reasons.push("unknown_team_mean_semantics");
  return { mean: reasons.length ? null : mean, reasons: [...new Set(reasons)] };
}

/** Alignment is an accounting/lineage check, not predictive validation. */
export function compareForecastBases(args: {
  scope: DiagnosticScope;
  teamId: number;
  abbreviation: string;
  forge: ForecastBase | null;
  team: ForecastBase | null;
}): TeamComparison {
  const { scope, forge, team } = args;
  const reasons: string[] = [];
  if (scope.phase !== 2 || !Number.isFinite(time(scope.cutoffAt)) || !Number.isFinite(time(scope.startAt)) || time(scope.cutoffAt) >= time(scope.startAt)) reasons.push("invalid_regular_season_pregame_scope");
  if (!forge) reasons.push("missing_forge_forecast");
  if (!team) reasons.push("missing_team_forecast");
  const forgeResult = forge ? comparableMean(forge, scope) : { mean: null, reasons: [] };
  const teamResult = team ? comparableMean(team, scope) : { mean: null, reasons: [] };
  reasons.push(...forgeResult.reasons, ...teamResult.reasons);
  if (forge && team) {
    if (forge.source !== "forge" || team.source !== "team") reasons.push("forecast_source_mismatch");
    if (!forge.forecastSetId || forge.forecastSetId !== team.forecastSetId) reasons.push("mixed_forecast_sets");
    if (forge.teamId !== args.teamId || team.teamId !== args.teamId) reasons.push("team_mismatch");
    if (forge.rosterScenarioId !== team.rosterScenarioId) reasons.push("roster_scenario_mismatch");
    if (JSON.stringify([...forge.strengthStates].sort()) !== JSON.stringify([...team.strengthStates].sort())) reasons.push("strength_state_mismatch");
  }
  const aligned = reasons.length === 0 && forgeResult.mean != null && teamResult.mean != null;
  return { teamId: args.teamId, abbreviation: args.abbreviation, forge, team,
    forgeMean: aligned ? forgeResult.mean : null, teamMean: aligned ? teamResult.mean : null,
    difference: aligned ? forgeResult.mean! - teamResult.mean! : null,
    status: aligned ? "aligned" : !forge || !team ? "unavailable" : "incompatible",
    reasons: [...new Set(reasons)],
  };
}

export function forecastDiagnosticsJson(report: ForecastDiagnosticsReport): string {
  return JSON.stringify(report, null, 2) + "\n";
}

const display = (value: unknown): string => value == null ? "Unavailable" : String(value).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
export function forecastDiagnosticsMarkdown(report: ForecastDiagnosticsReport): string {
  const rows = ["# Forecast diagnostics", "", `Evidence: ${report.evidenceKind}`, `Forecast set: ${report.forecastSetId}`,
    `Contract: ${report.contractVersion}`, `Generated: ${report.generatedAt}`, `Game: ${report.scope.gameId}`,
    `Season / phase / horizon: ${report.scope.seasonId} / ${report.scope.phase} / ${report.scope.horizonGames}`,
    `Start: ${report.scope.startAt}`, `Cutoff: ${report.scope.cutoffAt}`, "", "Diagnostic estimates are unvalidated. Alignment does not establish model accuracy.", "",
    "## Base comparisons", "", "| Team | Raw FORGE | Raw team | Comparable FORGE | Comparable team | Difference | Status |", "| --- | --- | --- | --- | --- | --- | --- |"];
  for (const row of report.comparisons) rows.push(`| ${display(row.abbreviation)} | ${display(row.forge?.rawMean)} | ${display(row.team?.rawMean)} | ${display(row.forgeMean)} | ${display(row.teamMean)} | ${display(row.difference)} | ${row.status} |`);
  for (const row of report.comparisons) {
    rows.push("", `### ${display(row.abbreviation)} definitions and lineage`, "", `Reasons: ${row.reasons.join(", ") || "None"}`);
    for (const base of [row.forge, row.team]) if (base) rows.push("", `\`\`\`json\n${JSON.stringify(base, null, 2)}\n\`\`\``);
  }
  rows.push("", "## Team-game exposure", "", "| Team | Season | Source rows | Legacy GP/GF/GA | Verified GP/GF/GA | Last-five count | Coverage |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of report.exposure) {
    rows.push(`| ${display(row.abbreviation)} | ${row.seasonId} | ${row.sourceRowCount} | ${row.legacyTotals.gp} / ${row.legacyTotals.gf} / ${row.legacyTotals.ga} | ${display(row.correctedTotals.gp)} / ${display(row.correctedTotals.gf)} / ${display(row.correctedTotals.ga)} | ${row.actualLastFiveCount} | ${row.coverage} |`, "",
      `Accepted game IDs: ${row.acceptedGameIds.join(", ") || "None"}`, `Last-five game IDs: ${row.lastFiveGameIds.join(", ") || "None"}`, `Source: ${display(row.source)}`, "", `\`\`\`json\n${JSON.stringify(row.exclusions, null, 2)}\n\`\`\``);
  }
  rows.push("", "## Source manifest", "", `\`\`\`json\n${JSON.stringify(report.sources, null, 2)}\n\`\`\``, "", `Replay: ${report.replay.status}`, "", ...report.replay.blockers.map(reason => `- ${display(reason)}`), "", "## Limitations", "", ...report.limitations.map(reason => `- ${display(reason)}`), "");
  return rows.join("\n");
}
