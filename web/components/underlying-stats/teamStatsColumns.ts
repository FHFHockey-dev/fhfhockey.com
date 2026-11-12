import type {
  PlayerStatsColumnAlignment,
  PlayerStatsColumnDefinition,
  PlayerStatsColumnFormat,
} from "./playerStatsColumns";

import {
  TEAM_STATS_DEFAULT_SORTS,
  TEAM_STATS_TABLE_FAMILIES,
  type TeamStatsTableFamily,
} from "lib/underlying-stats/teamStatsFilters";

export const TEAM_STATS_IDENTITY_COLUMNS = {
  team: {
    key: "teamLabel",
    label: "Team",
    sortKey: "teamLabel",
    format: "team",
    align: "left",
    isIdentity: true,
  },
  gp: {
    key: "gamesPlayed",
    label: "GP",
    sortKey: "gamesPlayed",
    format: "integer",
    align: "right",
    isIdentity: true,
  },
  toi: {
    key: "toiSeconds",
    label: "TOI",
    sortKey: "toiSeconds",
    format: "toi",
    align: "right",
    isIdentity: true,
  },
  toiPerGame: {
    key: "toiPerGameSeconds",
    label: "TOI/GP",
    sortKey: "toiPerGameSeconds",
    format: "toiPerGame",
    align: "right",
    isIdentity: true,
  },
} as const satisfies Record<string, PlayerStatsColumnDefinition>;

export const TEAM_STATS_COUNT_IDENTITY_COLUMN_KEYS = [
  "team",
  "gp",
  "toi",
] as const;

export const TEAM_STATS_RATE_IDENTITY_COLUMN_KEYS = [
  "team",
  "gp",
  "toiPerGame",
] as const;

type TeamStatsIdentityColumnKey = keyof typeof TEAM_STATS_IDENTITY_COLUMNS;

function metric(
  key: string,
  label: string,
  format: PlayerStatsColumnFormat,
  align: PlayerStatsColumnAlignment = "right"
): PlayerStatsColumnDefinition {
  return {
    key,
    label,
    sortKey: key,
    format,
    align,
  };
}

// SC/HD/MD/LD use FHFH house shot-location definitions (L1
// `PARITY_CHANCE_DEFINITIONS`: high danger within 20 ft and 35°, scoring
// chance within 40 ft and 50°), not NST's, so the labels say so.
const TEAM_COUNTS_COLUMNS: readonly PlayerStatsColumnDefinition[] = [
  TEAM_STATS_IDENTITY_COLUMNS.team,
  TEAM_STATS_IDENTITY_COLUMNS.gp,
  TEAM_STATS_IDENTITY_COLUMNS.toi,
  metric("wins", "W", "integer"),
  metric("losses", "L", "integer"),
  metric("otl", "OTL", "integer"),
  metric("rowWins", "ROW", "integer"),
  metric("points", "Points", "integer"),
  metric("pointPct", "Point %", "percentage"),
  metric("cf", "CF", "integer"),
  metric("ca", "CA", "integer"),
  metric("cfPct", "CF%", "percentage"),
  metric("ff", "FF", "integer"),
  metric("fa", "FA", "integer"),
  metric("ffPct", "FF%", "percentage"),
  metric("sf", "SF", "integer"),
  metric("sa", "SA", "integer"),
  metric("sfPct", "SF%", "percentage"),
  metric("gf", "GF", "integer"),
  metric("ga", "GA", "integer"),
  metric("gfPct", "GF%", "percentage"),
  metric("scf", "FHFH SCF", "integer"),
  metric("sca", "FHFH SCA", "integer"),
  metric("scfPct", "FHFH SCF%", "percentage"),
  metric("scsf", "FHFH SCSF", "integer"),
  metric("scsa", "FHFH SCSA", "integer"),
  metric("scsfPct", "FHFH SCSF%", "percentage"),
  metric("scgf", "FHFH SCGF", "integer"),
  metric("scga", "FHFH SCGA", "integer"),
  metric("scgfPct", "FHFH SCGF%", "percentage"),
  metric("scshPct", "FHFH SCSH%", "percentage"),
  metric("scsvPct", "FHFH SCSV%", "percentage"),
  metric("hdcf", "FHFH HDCF", "integer"),
  metric("hdca", "FHFH HDCA", "integer"),
  metric("hdcfPct", "FHFH HDCF%", "percentage"),
  metric("hdsf", "FHFH HDSF", "integer"),
  metric("hdsa", "FHFH HDSA", "integer"),
  metric("hdsfPct", "FHFH HDSF%", "percentage"),
  metric("hdgf", "FHFH HDGF", "integer"),
  metric("hdga", "FHFH HDGA", "integer"),
  metric("hdgfPct", "FHFH HDGF%", "percentage"),
  metric("hdshPct", "FHFH HDSH%", "percentage"),
  metric("hdsvPct", "FHFH HDSV%", "percentage"),
  metric("mdcf", "FHFH MDCF", "integer"),
  metric("mdca", "FHFH MDCA", "integer"),
  metric("mdcfPct", "FHFH MDCF%", "percentage"),
  metric("mdsf", "FHFH MDSF", "integer"),
  metric("mdsa", "FHFH MDSA", "integer"),
  metric("mdsfPct", "FHFH MDSF%", "percentage"),
  metric("mdgf", "FHFH MDGF", "integer"),
  metric("mdga", "FHFH MDGA", "integer"),
  metric("mdgfPct", "FHFH MDGF%", "percentage"),
  metric("mdshPct", "FHFH MDSH%", "percentage"),
  metric("mdsvPct", "FHFH MDSV%", "percentage"),
  metric("ldcf", "FHFH LDCF", "integer"),
  metric("ldca", "FHFH LDCA", "integer"),
  metric("ldcfPct", "FHFH LDCF%", "percentage"),
  metric("ldsf", "FHFH LDSF", "integer"),
  metric("ldsa", "FHFH LDSA", "integer"),
  metric("ldsfPct", "FHFH LDSF%", "percentage"),
  metric("ldgf", "FHFH LDGF", "integer"),
  metric("ldga", "FHFH LDGA", "integer"),
  metric("ldgfPct", "FHFH LDGF%", "percentage"),
  metric("ldshPct", "FHFH LDSH%", "percentage"),
  metric("ldsvPct", "FHFH LDSV%", "percentage"),
  metric("shPct", "SH%", "percentage"),
  metric("svPct", "SV%", "percentage"),
  metric("pdo", "PDO", "decimal"),
] as const;

const TEAM_RATES_COLUMNS: readonly PlayerStatsColumnDefinition[] = [
  TEAM_STATS_IDENTITY_COLUMNS.team,
  TEAM_STATS_IDENTITY_COLUMNS.gp,
  TEAM_STATS_IDENTITY_COLUMNS.toiPerGame,
  metric("wins", "W", "integer"),
  metric("losses", "L", "integer"),
  metric("otl", "OTL", "integer"),
  metric("rowWins", "ROW", "integer"),
  metric("points", "Points", "integer"),
  metric("pointPct", "Point %", "percentage"),
  metric("cfPer60", "CF/60", "per60"),
  metric("caPer60", "CA/60", "per60"),
  metric("cfPct", "CF%", "percentage"),
  metric("ffPer60", "FF/60", "per60"),
  metric("faPer60", "FA/60", "per60"),
  metric("ffPct", "FF%", "percentage"),
  metric("sfPer60", "SF/60", "per60"),
  metric("saPer60", "SA/60", "per60"),
  metric("sfPct", "SF%", "percentage"),
  metric("gfPer60", "GF/60", "per60"),
  metric("gaPer60", "GA/60", "per60"),
  metric("gfPct", "GF%", "percentage"),
  metric("scfPer60", "FHFH SCF/60", "per60"),
  metric("scaPer60", "FHFH SCA/60", "per60"),
  metric("scfPct", "FHFH SCF%", "percentage"),
  metric("scsfPer60", "FHFH SCSF/60", "per60"),
  metric("scsaPer60", "FHFH SCSA/60", "per60"),
  metric("scsfPct", "FHFH SCSF%", "percentage"),
  metric("scgfPer60", "FHFH SCGF/60", "per60"),
  metric("scgaPer60", "FHFH SCGA/60", "per60"),
  metric("scgfPct", "FHFH SCGF%", "percentage"),
  metric("scshPct", "FHFH SCSH%", "percentage"),
  metric("scsvPct", "FHFH SCSV%", "percentage"),
  metric("hdcfPer60", "FHFH HDCF/60", "per60"),
  metric("hdcaPer60", "FHFH HDCA/60", "per60"),
  metric("hdcfPct", "FHFH HDCF%", "percentage"),
  metric("hdsfPer60", "FHFH HDSF/60", "per60"),
  metric("hdsaPer60", "FHFH HDSA/60", "per60"),
  metric("hdsfPct", "FHFH HDSF%", "percentage"),
  metric("hdgfPer60", "FHFH HDGF/60", "per60"),
  metric("hdgaPer60", "FHFH HDGA/60", "per60"),
  metric("hdgfPct", "FHFH HDGF%", "percentage"),
  metric("hdshPct", "FHFH HDSH%", "percentage"),
  metric("hdsvPct", "FHFH HDSV%", "percentage"),
  metric("mdcfPer60", "FHFH MDCF/60", "per60"),
  metric("mdcaPer60", "FHFH MDCA/60", "per60"),
  metric("mdcfPct", "FHFH MDCF%", "percentage"),
  metric("mdsfPer60", "FHFH MDSF/60", "per60"),
  metric("mdsaPer60", "FHFH MDSA/60", "per60"),
  metric("mdsfPct", "FHFH MDSF%", "percentage"),
  metric("mdgfPer60", "FHFH MDGF/60", "per60"),
  metric("mdgaPer60", "FHFH MDGA/60", "per60"),
  metric("mdgfPct", "FHFH MDGF%", "percentage"),
  metric("mdshPct", "FHFH MDSH%", "percentage"),
  metric("mdsvPct", "FHFH MDSV%", "percentage"),
  metric("ldcfPer60", "FHFH LDCF/60", "per60"),
  metric("ldcaPer60", "FHFH LDCA/60", "per60"),
  metric("ldcfPct", "FHFH LDCF%", "percentage"),
  metric("ldsfPer60", "FHFH LDSF/60", "per60"),
  metric("ldsaPer60", "FHFH LDSA/60", "per60"),
  metric("ldsfPct", "FHFH LDSF%", "percentage"),
  metric("ldgfPer60", "FHFH LDGF/60", "per60"),
  metric("ldgaPer60", "FHFH LDGA/60", "per60"),
  metric("ldgfPct", "FHFH LDGF%", "percentage"),
  metric("ldshPct", "FHFH LDSH%", "percentage"),
  metric("ldsvPct", "FHFH LDSV%", "percentage"),
  metric("shPct", "SH%", "percentage"),
  metric("svPct", "SV%", "percentage"),
  metric("pdo", "PDO", "decimal"),
] as const;

export const TEAM_STATS_COLUMN_DEFINITIONS: Record<
  TeamStatsTableFamily,
  readonly PlayerStatsColumnDefinition[]
> = {
  counts: TEAM_COUNTS_COLUMNS,
  rates: TEAM_RATES_COLUMNS,
};

const TEAM_STATS_RECORD_COLUMN_KEYS = new Set([
  "wins",
  "losses",
  "otl",
  "rowWins",
  "points",
  "pointPct",
]);

/**
 * Record columns are game outcomes, so they are hidden outside all strengths
 * and all score states (decision 92).
 */
export function getTeamStatsColumns(
  family: TeamStatsTableFamily,
  options: { showRecordColumns?: boolean } = {}
): readonly PlayerStatsColumnDefinition[] {
  const columns = TEAM_STATS_COLUMN_DEFINITIONS[family];
  if (options.showRecordColumns === false) {
    return columns.filter((column) => !TEAM_STATS_RECORD_COLUMN_KEYS.has(column.key));
  }
  return columns;
}

export function getTeamStatsIdentityColumns(
  family: TeamStatsTableFamily
): readonly PlayerStatsColumnDefinition[] {
  const keys =
    family === "rates"
      ? TEAM_STATS_RATE_IDENTITY_COLUMN_KEYS
      : TEAM_STATS_COUNT_IDENTITY_COLUMN_KEYS;

  return keys.map(
    (key) => TEAM_STATS_IDENTITY_COLUMNS[key as TeamStatsIdentityColumnKey]
  );
}

export function getTeamStatsDefaultSortForFamily(
  family: TeamStatsTableFamily
) {
  return TEAM_STATS_DEFAULT_SORTS[family];
}

export function getTeamStatsColumnByKey(
  family: TeamStatsTableFamily,
  key: string
): PlayerStatsColumnDefinition | undefined {
  return TEAM_STATS_COLUMN_DEFINITIONS[family].find((column) => column.key === key);
}

export function getAllTeamStatsTableFamilies(): readonly TeamStatsTableFamily[] {
  return TEAM_STATS_TABLE_FAMILIES;
}