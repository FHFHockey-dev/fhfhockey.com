import { PROJECTION_SOURCES_CONFIG } from "../projectionsConfig/projectionSourcesConfig";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

type Mapping = { key: string; dbColumnName: string };
export type BaselineProjectionSchema = {
  id: string; tableName: string | null; appearanceColumn: string; startColumn: string | null;
  statMappings: readonly Mapping[];
};
export type BaselineProjectionReceipt = {
  sourceId: string; tableName: string | null;
  status: "available" | "table_unavailable" | "no_versioned_schema";
  rowCount: number;
};
type PlayerType = "skater" | "goalie";

function freeze<T extends object>(value: T): T {
  for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
}

// Candidate ingredients are independent of dashboard selection, formatting and paid imports.
const sourceIds = {
  skater: ["ag_skaters", "cullen_skaters", "dtz_skaters", "5v5_skaters"],
  goalie: ["cullen_goalies", "dtz_goalies", "5v5_goalies"],
} as const;
const skipTargets = new Set(["GAMES_PLAYED", "GAMES_STARTED_GOALIE", "SHOOTING_PERCENTAGE",
  "FACEOFF_PERCENTAGE", "TIME_ON_ICE_PER_GAME", "SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE",
  "LOSSES_GOALIE", "OTL_GOALIE"]);
const currentSchemas = Object.fromEntries([...sourceIds.skater, ...sourceIds.goalie].map(id => {
  const source = PROJECTION_SOURCES_CONFIG.find(row => row.id === id);
  if (!source) throw new Error(`Frozen baseline source mapping is missing: ${id}`);
  return [id, { id, tableTemplate: `PROJECTIONS_{season}_${id.toUpperCase()}`,
    appearanceColumn: "Games_Played", startColumn: source.playerType === "goalie" ? "Games_Started_Goalie" : null,
    statMappings: source.statMappings.filter(row => !skipTargets.has(row.key))
      .map(({ key, dbColumnName }) => ({ key, dbColumnName })) }];
})) as Record<string, { id: string; tableTemplate: string; appearanceColumn: string;
  startColumn: string | null; statMappings: Mapping[] }>;

// These legacy schemas were checked against hosted metadata; absent columns stay unsupported.
const legacyColumns: Record<string, readonly string[] | null> = {
  ag_skaters: ["Goals", "Assists", "Points", "PP_Points", "Shots_on_Goal", "Hits", "Blocked_Shots", "Penalty_Minutes"],
  cullen_skaters: ["Goals", "Assists", "Points", "Plus_Minus", "PP_Points", "Penalty_Minutes", "Hits", "Blocked_Shots", "Shots_on_Goal"],
  dtz_skaters: null, "5v5_skaters": null,
  cullen_goalies: ["Wins_Goalie", "Shutouts_Goalie"],
  dtz_goalies: ["Wins_Goalie", "Shutouts_Goalie", "Saves_Goalie", "Ga", "Sa"], "5v5_goalies": null,
};
const legacySchemas = Object.fromEntries(Object.entries(currentSchemas).map(([id, schema]) => {
  const columns = legacyColumns[id];
  return [id, { id, tableName: columns ? schema.tableTemplate.replace("{season}", "20252026") : null,
    appearanceColumn: schema.appearanceColumn, startColumn: null,
    statMappings: schema.statMappings.map(row => id === "dtz_goalies" && row.key === "GOALS_AGAINST_GOALIE"
      ? { ...row, dbColumnName: "Ga" } : id === "dtz_goalies" && row.key === "SHOTS_AGAINST_GOALIE"
        ? { ...row, dbColumnName: "Sa" } : row).filter(row => columns?.includes(row.dbColumnName)) }];
})) as Record<string, BaselineProjectionSchema>;

export const BASELINE_CANDIDATE_POLICY = freeze({
  definitionVersion: "baseline-candidate-definition-v1",
  sourceIds, excludedComponents: ["blake_ag_skaters", "nate_ag_skaters"],
  consensus: "equal_source_rates_per_target", projectionPriorWeight: 0.6, historyPriorWeight: 0.4,
  previousAppearanceWindow: 82, recentAppearanceWindow: 20, recentDecay: 0.9, priorAppearanceWeight: 20,
  recentIndex: "all_appearances_in_window; missing_target_skips_numerator_and_denominator",
  participation: "excluded", adjustments: "none", negativeTargets: ["PLUS_MINUS"],
  units: { skater: "count_per_appearance", goalieVolume: "count_per_appearance",
    goalieMinutes: "minutes_per_appearance", goalieOutcome: "count_per_start" },
  goalieVolumeTargets: ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES"],
  goalieStartTargets: ["WINS_GOALIE", "SHUTOUTS_GOALIE"],
  goalieShots: "saves_plus_goals_against_when_both_present",
  maximumGoalieProjectedAppearances: 100,
  appearanceCutoff: "prior_utc_date_or_same_day_final_boxscore_available_by_cutoff",
  seasonSchema: { legacySeason: 20252026, legacySchemas, canonicalSchemaFrom: 20262027, currentSchemas },
});

// Pin the definition separately from its source/data hashes. Changing ingredients needs a new definition.
export const BASELINE_CANDIDATE_DEFINITION_HASH = "431c0fa877c2046d011e612b630a08737d3a8a061a9148479d0788ca8ed8cdd8";
if (playerForecastSourcePayloadHash(BASELINE_CANDIDATE_POLICY) !== BASELINE_CANDIDATE_DEFINITION_HASH) {
  throw new Error("Baseline candidate ingredients changed; version and review the definition before use");
}

export function validBaselineSeasonId(value: number): boolean {
  const text = String(value);
  return Number.isSafeInteger(value) && /^[1-9]\d{7}$/.test(text)
    && Number(text.slice(4)) === Number(text.slice(0, 4)) + 1;
}

export function baselineProjectionSchemas(playerType: PlayerType, seasonId: number): readonly BaselineProjectionSchema[] {
  if (!validBaselineSeasonId(seasonId) || seasonId < BASELINE_CANDIDATE_POLICY.seasonSchema.legacySeason) {
    throw new Error("No versioned baseline projection schema for this season");
  }
  return BASELINE_CANDIDATE_POLICY.sourceIds[playerType].map(id => {
    if (seasonId === BASELINE_CANDIDATE_POLICY.seasonSchema.legacySeason) return legacySchemas[id];
    const schema = currentSchemas[id];
    return { id, tableName: schema.tableTemplate.replace("{season}", String(seasonId)),
      appearanceColumn: schema.appearanceColumn, startColumn: schema.startColumn, statMappings: schema.statMappings };
  });
}

export function baselineDefinitionHash(playerType: PlayerType, seasonId: number): string {
  return playerForecastSourcePayloadHash({ definitionHash: BASELINE_CANDIDATE_DEFINITION_HASH,
    playerType, seasonId, sourceSchemas: baselineProjectionSchemas(playerType, seasonId) });
}

export function unavailableProjectionTable(error: { code?: string } | null | undefined): boolean {
  // Permission, schema mismatch and arbitrary failures must still reject the capture.
  return error?.code === "PGRST205" || error?.code === "42P01";
}
