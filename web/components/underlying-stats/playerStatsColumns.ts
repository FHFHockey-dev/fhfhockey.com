import type {
  PlayerStatsDisplayMode,
  PlayerStatsMode,
  PlayerStatsTableFamily,
} from "lib/underlying-stats/playerStatsTypes";
import { PLAYER_STATS_TABLE_FAMILIES } from "lib/underlying-stats/playerStatsTypes";

export type PlayerStatsColumnAlignment = "left" | "center" | "right";

export type PlayerStatsColumnFormat =
  | "text"
  | "team"
  | "position"
  | "date"
  | "integer"
  | "decimal"
  | "percentage"
  | "toi"
  | "toiPerGame"
  | "per60"
  | "distance";

export type PlayerStatsColumnDefinition = {
  key: string;
  label: string;
  sortKey: string;
  format: PlayerStatsColumnFormat;
  align: PlayerStatsColumnAlignment;
  isIdentity?: boolean;
};

export const PLAYER_STATS_IDENTITY_COLUMNS = {
  player: {
    key: "playerName",
    label: "Player",
    sortKey: "playerName",
    format: "text",
    align: "left",
    isIdentity: true,
  },
  team: {
    key: "teamLabel",
    label: "Team",
    sortKey: "teamLabel",
    format: "team",
    align: "left",
    isIdentity: true,
  },
  position: {
    key: "positionCode",
    label: "Position",
    sortKey: "positionCode",
    format: "position",
    align: "center",
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
  },
} as const satisfies Record<string, PlayerStatsColumnDefinition>;

export const PLAYER_STATS_SHARED_IDENTITY_COLUMN_KEYS = [
  "player",
  "team",
  "gp",
  "toi",
] as const;

export const PLAYER_STATS_SKATER_IDENTITY_COLUMN_KEYS = [
  "player",
  "team",
  "position",
  "gp",
  "toi",
] as const;

export const PLAYER_STATS_GOALIE_IDENTITY_COLUMN_KEYS = [
  "player",
  "team",
  "gp",
  "toi",
] as const;

type PlayerStatsIdentityColumnKey = keyof typeof PLAYER_STATS_IDENTITY_COLUMNS;

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

const INDIVIDUAL_COUNTS_COLUMNS: readonly PlayerStatsColumnDefinition[] = [
  PLAYER_STATS_IDENTITY_COLUMNS.player,
  PLAYER_STATS_IDENTITY_COLUMNS.team,
  PLAYER_STATS_IDENTITY_COLUMNS.position,
  PLAYER_STATS_IDENTITY_COLUMNS.gp,
  PLAYER_STATS_IDENTITY_COLUMNS.toi,
  metric("goals", "Goals", "integer"),
  metric("totalAssists", "Total Assists", "integer"),
  metric("firstAssists", "First Assists", "integer"),
  metric("secondAssists", "Second Assists", "integer"),
  metric("totalPoints", "Total Points", "integer"),
  metric("ipp", "IPP", "percentage"),
  metric("shots", "Shots", "integer"),
  metric("shootingPct", "SH%", "percentage"),
  metric("ixg", "ixG", "decimal"),
  metric("iCf", "iCF", "integer"),
  metric("iFf", "iFF", "integer"),
  metric("iScf", "iSCF", "integer"),
  metric("iHdcf", "iHDCF", "integer"),
  metric("rushAttempts", "Rush Attempts", "integer"),
  metric("reboundsCreated", "Rebounds Created", "integer"),
  metric("pim", "PIM", "integer"),
  metric("totalPenalties", "Total Penalties", "integer"),
  metric("minorPenalties", "Minor", "integer"),
  metric("majorPenalties", "Major", "integer"),
  metric("misconductPenalties", "Misconduct", "integer"),
  metric("penaltiesDrawn", "Penalties Drawn", "integer"),
  metric("giveaways", "Giveaways", "integer"),
  metric("takeaways", "Takeaways", "integer"),
  metric("hits", "Hits", "integer"),
  metric("hitsTaken", "Hits Taken", "integer"),
  metric("shotsBlocked", "Shots Blocked", "integer"),
  metric("faceoffsWon", "Faceoffs Won", "integer"),
  metric("faceoffsLost", "Faceoffs Lost", "integer"),
  metric("faceoffPct", "Faceoffs %", "percentage"),
] as const;

const INDIVIDUAL_RATES_COLUMNS: readonly PlayerStatsColumnDefinition[] = [
  PLAYER_STATS_IDENTITY_COLUMNS.player,
  PLAYER_STATS_IDENTITY_COLUMNS.team,
  PLAYER_STATS_IDENTITY_COLUMNS.position,
  PLAYER_STATS_IDENTITY_COLUMNS.gp,
  PLAYER_STATS_IDENTITY_COLUMNS.toi,
  PLAYER_STATS_IDENTITY_COLUMNS.toiPerGame,
  metric("goalsPer60", "Goals/60", "per60"),
  metric("totalAssistsPer60", "Total Assists/60", "per60"),
  metric("firstAssistsPer60", "First Assists/60", "per60"),
  metric("secondAssistsPer60", "Second Assists/60", "per60"),
  metric("totalPointsPer60", "Total Points/60", "per60"),
  metric("ipp", "IPP", "percentage"),
  metric("shotsPer60", "Shots/60", "per60"),
  metric("shootingPct", "SH%", "percentage"),
  metric("ixgPer60", "ixG/60", "per60"),
  metric("iCfPer60", "iCF/60", "per60"),
  metric("iFfPer60", "iFF/60", "per60"),
  metric("iScfPer60", "iSCF/60", "per60"),
  metric("iHdcfPer60", "iHDCF/60", "per60"),
  metric("rushAttemptsPer60", "Rush Attempts/60", "per60"),
  metric("reboundsCreatedPer60", "Rebounds Created/60", "per60"),
  metric("pimPer60", "PIM/60", "per60"),
  metric("totalPenaltiesPer60", "Total Penalties/60", "per60"),
  metric("minorPenaltiesPer60", "Minor/60", "per60"),
  metric("majorPenaltiesPer60", "Major/60", "per60"),
  metric("misconductPenaltiesPer60", "Misconduct/60", "per60"),
  metric("penaltiesDrawnPer60", "Penalties Drawn/60", "per60"),
  metric("giveawaysPer60", "Giveaways/60", "per60"),
  metric("takeawaysPer60", "Takeaways/60", "per60"),
  metric("hitsPer60", "Hits/60", "per60"),
  metric("hitsTakenPer60", "Hits Taken/60", "per60"),
  metric("shotsBlockedPer60", "Shots Blocked/60", "per60"),
  metric("faceoffsWonPer60", "Faceoffs Won/60", "per60"),
  metric("faceoffsLostPer60", "Faceoffs Lost/60", "per60"),
  metric("faceoffPct", "Faceoffs %", "percentage"),
] as const;

const ON_ICE_COUNTS_COLUMNS: readonly PlayerStatsColumnDefinition[] = [
  PLAYER_STATS_IDENTITY_COLUMNS.player,
  PLAYER_STATS_IDENTITY_COLUMNS.team,
  PLAYER_STATS_IDENTITY_COLUMNS.position,
  PLAYER_STATS_IDENTITY_COLUMNS.gp,
  PLAYER_STATS_IDENTITY_COLUMNS.toi,
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
  metric("hdcf", "HDCF", "integer"),
  metric("hdca", "HDCA", "integer"),
  metric("hdcfPct", "HDCF%", "percentage"),
  metric("hdgf", "HDGF", "integer"),
  metric("hdga", "HDGA", "integer"),
  metric("hdgfPct", "HDGF%", "percentage"),
  metric("mdcf", "MDCF", "integer"),
  metric("mdca", "MDCA", "integer"),
  metric("mdcfPct", "MDCF%", "percentage"),
  metric("mdgf", "MDGF", "integer"),
  metric("mdga", "MDGA", "integer"),
  metric("mdgfPct", "MDGF%", "percentage"),
  metric("ldcf", "LDCF", "integer"),
] as const;

const ON_ICE_RATES_COLUMNS: readonly PlayerStatsColumnDefinition[] = [
  PLAYER_STATS_IDENTITY_COLUMNS.player,
  PLAYER_STATS_IDENTITY_COLUMNS.team,
  PLAYER_STATS_IDENTITY_COLUMNS.position,
  PLAYER_STATS_IDENTITY_COLUMNS.gp,
  PLAYER_STATS_IDENTITY_COLUMNS.toi,
  PLAYER_STATS_IDENTITY_COLUMNS.toiPerGame,
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
  metric("hdcfPer60", "HDCF/60", "per60"),
  metric("hdcaPer60", "HDCA/60", "per60"),
  metric("hdcfPct", "HDCF%", "percentage"),
  metric("hdgfPer60", "HDGF/60", "per60"),
  metric("hdgaPer60", "HDGA/60", "per60"),
  metric("hdgfPct", "HDGF%", "percentage"),
  metric("mdcfPer60", "MDCF/60", "per60"),
  metric("mdcaPer60", "MDCA/60", "per60"),
  metric("mdcfPct", "MDCF%", "percentage"),
  metric("mdgfPer60", "MDGF/60", "per60"),
  metric("mdgaPer60", "MDGA/60", "per60"),
  metric("mdgfPct", "MDGF%", "percentage"),
] as const;

const GOALIE_COUNTS_COLUMNS: readonly PlayerStatsColumnDefinition[] = [
  PLAYER_STATS_IDENTITY_COLUMNS.player,
  PLAYER_STATS_IDENTITY_COLUMNS.team,
  PLAYER_STATS_IDENTITY_COLUMNS.gp,
  PLAYER_STATS_IDENTITY_COLUMNS.toi,
  metric("shotsAgainst", "Shots Against", "integer"),
  metric("saves", "Saves", "integer"),
  metric("goalsAgainst", "Goals Against", "integer"),
  metric("savePct", "SV%", "percentage"),
  metric("gaa", "GAA", "decimal"),
  metric("gsaa", "GSAA", "decimal"),
  metric("xgAgainst", "xGA", "decimal"),
  metric("hdShotsAgainst", "HD Shots Against", "integer"),
  metric("hdSaves", "HD Saves", "integer"),
  metric("hdGoalsAgainst", "HD Goals Against", "integer"),
  metric("hdSavePct", "HD SV%", "percentage"),
  metric("hdGaa", "HD GAA", "decimal"),
  metric("hdGsaa", "HD GSAA", "decimal"),
  metric("mdShotsAgainst", "MD Shots Against", "integer"),
  metric("mdSaves", "MD Saves", "integer"),
  metric("mdGoalsAgainst", "MD Goals Against", "integer"),
  metric("mdSavePct", "MD SV%", "percentage"),
  metric("mdGaa", "MD GAA", "decimal"),
  metric("mdGsaa", "MD GSAA", "decimal"),
  metric("ldShotsAgainst", "LD Shots Against", "integer"),
  metric("ldSaves", "LD Saves", "integer"),
  metric("ldGoalsAgainst", "LD Goals Against", "integer"),
  metric("ldSavePct", "LD SV%", "percentage"),
  metric("ldGaa", "LD GAA", "decimal"),
  metric("ldGsaa", "LD GSAA", "decimal"),
  metric("rushAttemptsAgainst", "Rush Attempts Against", "integer"),
  metric("reboundAttemptsAgainst", "Rebound Attempts Against", "integer"),
  metric("avgShotDistance", "Avg Shot Distance", "distance"),
  metric("avgGoalDistance", "Avg Goal Distance", "distance"),
] as const;

const GOALIE_RATES_COLUMNS: readonly PlayerStatsColumnDefinition[] = [
  PLAYER_STATS_IDENTITY_COLUMNS.player,
  PLAYER_STATS_IDENTITY_COLUMNS.team,
  PLAYER_STATS_IDENTITY_COLUMNS.gp,
  PLAYER_STATS_IDENTITY_COLUMNS.toi,
  PLAYER_STATS_IDENTITY_COLUMNS.toiPerGame,
  metric("shotsAgainstPer60", "Shots Against/60", "per60"),
  metric("savesPer60", "Saves/60", "per60"),
  metric("savePct", "SV%", "percentage"),
  metric("gaa", "GAA", "decimal"),
  metric("gsaaPer60", "GSAA/60", "per60"),
  metric("xgAgainstPer60", "xGA/60", "per60"),
  metric("hdShotsAgainstPer60", "HD Shots Against/60", "per60"),
  metric("hdSavesPer60", "HD Saves/60", "per60"),
  metric("hdSavePct", "HD SV%", "percentage"),
  metric("hdGaa", "HD GAA", "decimal"),
  metric("hdGsaaPer60", "HD GSAA/60", "per60"),
  metric("mdShotsAgainstPer60", "MD Shots Against/60", "per60"),
  metric("mdSavesPer60", "MD Saves/60", "per60"),
  metric("mdSavePct", "MD SV%", "percentage"),
  metric("mdGaa", "MD GAA", "decimal"),
  metric("mdGsaaPer60", "MD GSAA/60", "per60"),
  metric("ldShotsAgainstPer60", "LD Shots Against/60", "per60"),
  metric("ldSavesPer60", "LD Saves/60", "per60"),
  metric("ldSavePct", "LD SV%", "percentage"),
  metric("ldGaa", "LD GAA", "decimal"),
  metric("ldGsaaPer60", "LD GSAA/60", "per60"),
  metric("rushAttemptsAgainstPer60", "Rush Attempts Against/60", "per60"),
  metric("reboundAttemptsAgainstPer60", "Rebound Attempts Against/60", "per60"),
  metric("avgShotDistance", "Avg Shot Distance", "distance"),
  metric("avgGoalDistance", "Avg Goal Distance", "distance"),
] as const;

export const PLAYER_STATS_COLUMN_DEFINITIONS: Record<
  PlayerStatsTableFamily,
  readonly PlayerStatsColumnDefinition[]
> = {
  individualCounts: INDIVIDUAL_COUNTS_COLUMNS,
  individualRates: INDIVIDUAL_RATES_COLUMNS,
  onIceCounts: ON_ICE_COUNTS_COLUMNS,
  onIceRates: ON_ICE_RATES_COLUMNS,
  goalieCounts: GOALIE_COUNTS_COLUMNS,
  goalieRates: GOALIE_RATES_COLUMNS,
};

export const PLAYER_STATS_DEFAULT_SORTS: Record<
  PlayerStatsTableFamily,
  { sortKey: string; direction: "asc" | "desc" }
> = {
  individualCounts: { sortKey: "totalPoints", direction: "desc" },
  individualRates: { sortKey: "totalPointsPer60", direction: "desc" },
  onIceCounts: { sortKey: "xgfPct", direction: "desc" },
  onIceRates: { sortKey: "xgfPct", direction: "desc" },
  goalieCounts: { sortKey: "savePct", direction: "desc" },
  goalieRates: { sortKey: "savePct", direction: "desc" },
};

export function resolvePlayerStatsTableFamily(
  statMode: PlayerStatsMode,
  displayMode: PlayerStatsDisplayMode
): PlayerStatsTableFamily {
  if (statMode === "individual") {
    return displayMode === "counts" ? "individualCounts" : "individualRates";
  }

  if (statMode === "goalies") {
    return displayMode === "counts" ? "goalieCounts" : "goalieRates";
  }

  return displayMode === "counts" ? "onIceCounts" : "onIceRates";
}

export function getPlayerStatsColumns(
  family: PlayerStatsTableFamily
): readonly PlayerStatsColumnDefinition[] {
  return PLAYER_STATS_COLUMN_DEFINITIONS[family];
}

export function getPlayerStatsIdentityColumns(
  family: PlayerStatsTableFamily
): readonly PlayerStatsColumnDefinition[] {
  const keys =
    family === "goalieCounts" || family === "goalieRates"
      ? PLAYER_STATS_GOALIE_IDENTITY_COLUMN_KEYS
      : PLAYER_STATS_SKATER_IDENTITY_COLUMN_KEYS;

  return keys.map(
    (key) => PLAYER_STATS_IDENTITY_COLUMNS[key as PlayerStatsIdentityColumnKey]
  );
}

export function getPlayerStatsDefaultSortForFamily(
  family: PlayerStatsTableFamily
) {
  return PLAYER_STATS_DEFAULT_SORTS[family];
}

export function getPlayerStatsColumnByKey(
  family: PlayerStatsTableFamily,
  key: string
): PlayerStatsColumnDefinition | undefined {
  return PLAYER_STATS_COLUMN_DEFINITIONS[family].find((column) => column.key === key);
}

export function getAllPlayerStatsTableFamilies(): readonly PlayerStatsTableFamily[] {
  return PLAYER_STATS_TABLE_FAMILIES;
}
