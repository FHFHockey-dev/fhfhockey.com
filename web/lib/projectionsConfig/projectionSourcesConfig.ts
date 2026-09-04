import { StatDefinition } from "./statsMasterList";
import { formatToMMSS } from "./formatToMMSS";

export interface SourceStatMapping {
  key: StatDefinition["key"];
  dbColumnName: string;
  parser?: (value: any) => number | null;
  formatter?: (value: number | null | undefined) => string;
}

export interface ProjectionSourceConfig {
  id: string;
  displayName: string;
  tableName: string;
  playerType: "skater" | "goalie";
  primaryPlayerIdKey: string;
  originalPlayerNameKey: string;
  teamKey?: string;
  positionKey?: string;
  statMappings: SourceStatMapping[];
  ignoreColumns?: string[];
  defaultSelected?: boolean;
}

const SKATER_STAT_MAPPINGS: SourceStatMapping[] = [
  { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
  { key: "GOALS", dbColumnName: "Goals" },
  { key: "ASSISTS", dbColumnName: "Assists" },
  { key: "POINTS", dbColumnName: "Points" },
  { key: "PLUS_MINUS", dbColumnName: "Plus_Minus" },
  { key: "PENALTY_MINUTES", dbColumnName: "Penalty_Minutes" },
  { key: "PP_GOALS", dbColumnName: "PP_Goals" },
  { key: "PP_ASSISTS", dbColumnName: "PP_Assists" },
  { key: "PP_POINTS", dbColumnName: "PP_Points" },
  { key: "SH_GOALS", dbColumnName: "SH_Goals" },
  { key: "SH_ASSISTS", dbColumnName: "SH_Assists" },
  { key: "SH_POINTS", dbColumnName: "SH_Points" },
  { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" },
  { key: "SHOOTING_PERCENTAGE", dbColumnName: "Shooting_Percentage" },
  { key: "GAME_WINNING_GOALS", dbColumnName: "Game_Winning_Goals" },
  { key: "HITS", dbColumnName: "Hits" },
  { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" },
  { key: "FACEOFFS_WON", dbColumnName: "Faceoffs_Won" },
  { key: "FACEOFFS_LOST", dbColumnName: "Faceoffs_Lost" },
  { key: "FACEOFF_PERCENTAGE", dbColumnName: "Faceoff_Percentage" },
  { key: "TIME_ON_ICE_PER_GAME", dbColumnName: "Time_on_Ice_Per_Game", formatter: formatToMMSS },
];

const GOALIE_STAT_MAPPINGS: SourceStatMapping[] = [
  { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
  { key: "GAMES_STARTED_GOALIE", dbColumnName: "Games_Started_Goalie" },
  { key: "WINS_GOALIE", dbColumnName: "Wins_Goalie" },
  { key: "LOSSES_GOALIE", dbColumnName: "Losses_Goalie" },
  { key: "OTL_GOALIE", dbColumnName: "Overtime_Losses_Goalie" },
  { key: "SHUTOUTS_GOALIE", dbColumnName: "Shutouts_Goalie" },
  { key: "SAVES_GOALIE", dbColumnName: "Saves_Goalie" },
  { key: "GOALS_AGAINST_GOALIE", dbColumnName: "Goals_Against_Goalie" },
  { key: "SHOTS_AGAINST_GOALIE", dbColumnName: "Shots_Against" },
  { key: "SAVE_PERCENTAGE", dbColumnName: "Save_Percentage" },
  { key: "GOALS_AGAINST_AVERAGE", dbColumnName: "Goals_Against_Average" },
];

// Public dashboard sources only. Dom and Dobber are paid/private imports.
// The A&G aggregate replaces its components in the default blend.
export const PROJECTION_SOURCES_CONFIG: ProjectionSourceConfig[] = [
  {
    id: "ag_skaters",
    displayName: "Apples & Ginos",
    tableName: "PROJECTIONS_20262027_AG_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS,
  },
  {
    id: "blake_ag_skaters",
    displayName: "Blake A&G (component)",
    tableName: "PROJECTIONS_20262027_BLAKE_AG_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS,
    defaultSelected: false,
  },
  {
    id: "nate_ag_skaters",
    displayName: "Nate A&G (component)",
    tableName: "PROJECTIONS_20262027_NATE_AG_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS,
    defaultSelected: false,
  },
  {
    id: "dtz_skaters",
    displayName: "DTZ",
    tableName: "PROJECTIONS_20262027_DTZ_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS,
  },
  {
    id: "dtz_goalies",
    displayName: "DTZ",
    tableName: "PROJECTIONS_20262027_DTZ_GOALIES",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: GOALIE_STAT_MAPPINGS,
  },
  {
    id: "lineupexperts_skaters",
    displayName: "LineupExperts",
    tableName: "PROJECTIONS_20262027_LINEUPEXPERTS_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS,
  },
  {
    id: "lineupexperts_goalies",
    displayName: "LineupExperts",
    tableName: "PROJECTIONS_20262027_LINEUPEXPERTS_GOALIES",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: GOALIE_STAT_MAPPINGS,
  },
  {
    id: "5v5_skaters",
    displayName: "5v5",
    tableName: "PROJECTIONS_20262027_5V5_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: SKATER_STAT_MAPPINGS,
  },
  {
    id: "5v5_goalies",
    displayName: "5v5",
    tableName: "PROJECTIONS_20262027_5V5_GOALIES",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: GOALIE_STAT_MAPPINGS,
  },
];
