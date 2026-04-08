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
  metric("xgf", "xGF", "decimal"),
  metric("xga", "xGA", "decimal"),
  metric("xgfPct", "xGF%", "percentage"),
  metric("scf", "SCF", "integer"),
  metric("sca", "SCA", "integer"),
  metric("scfPct", "SCF%", "percentage"),
  metric("scsf", "SCSF", "integer"),
  metric("scsa", "SCSA", "integer"),
  metric("scsfPct", "SCSF%", "percentage"),
  metric("scgf", "SCGF", "integer"),
  metric("scga", "SCGA", "integer"),
  metric("scgfPct", "SCGF%", "percentage"),
  metric("scshPct", "SCSH%", "percentage"),
  metric("scsvPct", "SCSV%", "percentage"),
  metric("hdcf", "HDCF", "integer"),
  metric("hdca", "HDCA", "integer"),
  metric("hdcfPct", "HDCF%", "percentage"),
  metric("hdsf", "HDSF", "integer"),
  metric("hdsa", "HDSA", "integer"),
  metric("hdsfPct", "HDSF%", "percentage"),
  metric("hdgf", "HDGF", "integer"),
  metric("hdga", "HDGA", "integer"),
  metric("hdgfPct", "HDGF%", "percentage"),
  metric("hdshPct", "HDSH%", "percentage"),
  metric("hdsvPct", "HDSV%", "percentage"),
  metric("mdcf", "MDCF", "integer"),
  metric("mdca", "MDCA", "integer"),
  metric("mdcfPct", "MDCF%", "percentage"),
  metric("mdsf", "MDSF", "integer"),
  metric("mdsa", "MDSA", "integer"),
  metric("mdsfPct", "MDSF%", "percentage"),
  metric("mdgf", "MDGF", "integer"),
  metric("mdga", "MDGA", "integer"),
  metric("mdgfPct", "MDGF%", "percentage"),
  metric("mdshPct", "MDSH%", "percentage"),
  metric("mdsvPct", "MDSV%", "percentage"),
  metric("ldcf", "LDCF", "integer"),
  metric("ldca", "LDCA", "integer"),
  metric("ldcfPct", "LDCF%", "percentage"),
  metric("ldsf", "LDSF", "integer"),
  metric("ldsa", "LDSA", "integer"),
  metric("ldsfPct", "LDSF%", "percentage"),
  metric("ldgf", "LDGF", "integer"),
  metric("ldga", "LDGA", "integer"),
  metric("ldgfPct", "LDGF%", "percentage"),
  metric("ldshPct", "LDSH%", "percentage"),
  metric("ldsvPct", "LDSV%", "percentage"),
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
  metric("xgfPer60", "xGF/60", "per60"),
  metric("xgaPer60", "xGA/60", "per60"),
  metric("xgfPct", "xGF%", "percentage"),
  metric("scfPer60", "SCF/60", "per60"),
  metric("scaPer60", "SCA/60", "per60"),
  metric("scfPct", "SCF%", "percentage"),
  metric("scsfPer60", "SCSF/60", "per60"),
  metric("scsaPer60", "SCSA/60", "per60"),
  metric("scsfPct", "SCSF%", "percentage"),
  metric("scgfPer60", "SCGF/60", "per60"),
  metric("scgaPer60", "SCGA/60", "per60"),
  metric("scgfPct", "SCGF%", "percentage"),
  metric("scshPct", "SCSH%", "percentage"),
  metric("scsvPct", "SCSV%", "percentage"),
  metric("hdcfPer60", "HDCF/60", "per60"),
  metric("hdcaPer60", "HDCA/60", "per60"),
  metric("hdcfPct", "HDCF%", "percentage"),
  metric("hdsfPer60", "HDSF/60", "per60"),
  metric("hdsaPer60", "HDSA/60", "per60"),
  metric("hdsfPct", "HDSF%", "percentage"),
  metric("hdgfPer60", "HDGF/60", "per60"),
  metric("hdgaPer60", "HDGA/60", "per60"),
  metric("hdgfPct", "HDGF%", "percentage"),
  metric("hdshPct", "HDSH%", "percentage"),
  metric("hdsvPct", "HDSV%", "percentage"),
  metric("mdcfPer60", "MDCF/60", "per60"),
  metric("mdcaPer60", "MDCA/60", "per60"),
  metric("mdcfPct", "MDCF%", "percentage"),
  metric("mdsfPer60", "MDSF/60", "per60"),
  metric("mdsaPer60", "MDSA/60", "per60"),
  metric("mdsfPct", "MDSF%", "percentage"),
  metric("mdgfPer60", "MDGF/60", "per60"),
  metric("mdgaPer60", "MDGA/60", "per60"),
  metric("mdgfPct", "MDGF%", "percentage"),
  metric("mdshPct", "MDSH%", "percentage"),
  metric("mdsvPct", "MDSV%", "percentage"),
  metric("ldcfPer60", "LDCF/60", "per60"),
  metric("ldcaPer60", "LDCA/60", "per60"),
  metric("ldcfPct", "LDCF%", "percentage"),
  metric("ldsfPer60", "LDSF/60", "per60"),
  metric("ldsaPer60", "LDSA/60", "per60"),
  metric("ldsfPct", "LDSF%", "percentage"),
  metric("ldgfPer60", "LDGF/60", "per60"),
  metric("ldgaPer60", "LDGA/60", "per60"),
  metric("ldgfPct", "LDGF%", "percentage"),
  metric("ldshPct", "LDSH%", "percentage"),
  metric("ldsvPct", "LDSV%", "percentage"),
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

export function getTeamStatsColumns(
  family: TeamStatsTableFamily
): readonly PlayerStatsColumnDefinition[] {
  return TEAM_STATS_COLUMN_DEFINITIONS[family];
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