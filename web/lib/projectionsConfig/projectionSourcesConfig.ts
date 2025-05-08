// /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/projectionSourcesConfig.ts

import { StatDefinition } from "./statsMasterList";

export interface SourceStatMapping {
  /** Key from STATS_MASTER_LIST (e.g., 'GOALS') */
  key: StatDefinition["key"];
  /** Actual column name in this source's Supabase table (e.g., 'Goals', 'g') */
  dbColumnName: string;
  parser?: (value: any) => number | null;
}

export interface ProjectionSourceConfig {
  /** Unique string ID for this source (e.g., 'cullen_skaters') */
  id: string;
  /** User-friendly display name (e.g., "Cullen Skaters") */
  displayName: string;
  tableName: string;
  playerType: "skater" | "goalie";
  primaryPlayerIdKey: string; // Always 'player_id' for projection tables
  originalPlayerNameKey: string;
  teamKey?: string;
  positionKey?: string;
  statMappings: SourceStatMapping[];
  ignoreColumns?: string[];
}

export const PROJECTION_SOURCES_CONFIG: ProjectionSourceConfig[] = [
  {
    id: "apples_ginos",
    displayName: "Apples & Ginos",
    tableName: "projections_apples_ginos",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "GOALS", dbColumnName: "Goals" },
      { key: "ASSISTS", dbColumnName: "Assists" },
      { key: "POINTS", dbColumnName: "Points" },
      { key: "PP_POINTS", dbColumnName: "PP_Points" },
      { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" },
      { key: "HITS", dbColumnName: "Hits" },
      { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" },
      { key: "PENALTY_MINUTES", dbColumnName: "Penalty_Minutes" },
      {
        key: "TIME_ON_ICE_PER_GAME",
        dbColumnName: "Time_on_Ice_Per_Game"
      }
    ]
  },
  {
    id: "cullen_skaters",
    displayName: "Cullen (Skaters)",
    tableName: "projections_cullen",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id", "Rank"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "GOALS", dbColumnName: "Goals" },
      { key: "ASSISTS", dbColumnName: "Assists" },
      { key: "POINTS", dbColumnName: "Points" },
      { key: "PLUS_MINUS", dbColumnName: "Plus_Minus" },
      { key: "PP_POINTS", dbColumnName: "PP_Points" },
      { key: "PENALTY_MINUTES", dbColumnName: "Penalty_Minutes" },
      { key: "HITS", dbColumnName: "Hits" },
      { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" },
      { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" }
    ]
  },
  {
    id: "cullen_goalies",
    displayName: "Cullen (Goalies)",
    tableName: "projections_cullen_goalies",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Goalie", // Specific to this table
    teamKey: "Team_Abbreviation",
    ignoreColumns: ["upload_batch_id", "Rank"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "WINS_GOALIE", dbColumnName: "Wins_Goalie" },
      { key: "GOALS_AGAINST_AVERAGE", dbColumnName: "Goals_Against_Average" },
      { key: "SAVE_PERCENTAGE", dbColumnName: "Save_Percentage" },
      { key: "SHUTOUTS_GOALIE", dbColumnName: "Shutouts_Goalie" }
    ]
  },
  {
    id: "cullen_top_400", // Skaters
    displayName: "Cullen Top 400",
    tableName: "projections_cullen_top_400",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id", "Rank"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "GOALS", dbColumnName: "Goals" },
      { key: "ASSISTS", dbColumnName: "Assists" },
      { key: "POINTS", dbColumnName: "Points" }
    ]
  },
  {
    id: "dom_goalies",
    displayName: "Dom (Goalies)",
    tableName: "projections_dom_goalies",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    positionKey: "Position", // Has 'Position'
    ignoreColumns: ["upload_batch_id"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "WINS_GOALIE", dbColumnName: "Wins_Goalie" },
      { key: "LOSSES_GOALIE", dbColumnName: "Losses_Goalie" },
      { key: "GOALS_AGAINST_AVERAGE", dbColumnName: "Goals_Against_Average" },
      { key: "SAVE_PERCENTAGE", dbColumnName: "Save_Percentage" },
      { key: "SHUTOUTS_GOALIE", dbColumnName: "Shutouts_Goalie" },
      { key: "GOALS_AGAINST_GOALIE", dbColumnName: "Ga" }, // Maps to 'GA' in master list
      { key: "SAVES_GOALIE", dbColumnName: "Saves_Goalie" },
      { key: "SHOTS_AGAINST_GOALIE", dbColumnName: "Sa" } // Maps to 'SA' in master list
    ]
  },
  {
    id: "dom_skaters",
    displayName: "Dom (Skaters)",
    tableName: "projections_dom_skaters",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    // teamKey: undefined, // No Team_Abbreviation
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "GOALS", dbColumnName: "Goals" },
      { key: "ASSISTS", dbColumnName: "Assists" },
      { key: "POINTS", dbColumnName: "Points" },
      { key: "PLUS_MINUS", dbColumnName: "Plus_Minus" },
      { key: "PP_POINTS", dbColumnName: "PP_Points" },
      { key: "PENALTY_MINUTES", dbColumnName: "Penalty_Minutes" },
      { key: "HITS", dbColumnName: "Hits" },
      { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" },
      { key: "FACEOFFS_WON", dbColumnName: "Faceoffs_Won" },
      { key: "FACEOFFS_LOST", dbColumnName: "Faceoffs_Lost" },
      { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" }
    ]
  },
  {
    id: "dtz_goalies",
    displayName: "DTZ (Goalies)",
    tableName: "projections_dtz_goalies",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id", "Rank", "Vor", "Age", "Qs", "Rbs"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "WINS_GOALIE", dbColumnName: "Wins_Goalie" },
      { key: "LOSSES_GOALIE", dbColumnName: "Losses_Goalie" },
      { key: "OTL_GOALIE", dbColumnName: "Otl" },
      { key: "GOALS_AGAINST_GOALIE", dbColumnName: "Ga" },
      { key: "SHOTS_AGAINST_GOALIE", dbColumnName: "Sa" },
      { key: "SAVES_GOALIE", dbColumnName: "Saves_Goalie" },
      { key: "SAVE_PERCENTAGE", dbColumnName: "Save_Percentage" },
      { key: "GOALS_AGAINST_AVERAGE", dbColumnName: "Goals_Against_Average" },
      { key: "SHUTOUTS_GOALIE", dbColumnName: "Shutouts_Goalie" }
      // { key: 'QUALITY_STARTS_GOALIE', dbColumnName: 'Qs'}, // if 'Qs', 'rbs' and 'vor' are added to STATS_MASTER_LIST
      // { key: 'REALLY_BAD_STARTS_GOALIE', dbColumnName: 'Rbs'},
      // { key: 'VOR_GOALIE', dbColumnName: 'Vor' },
    ]
  },
  {
    id: "dtz_skaters",
    displayName: "DTZ (Skaters)",
    tableName: "projections_dtz_skaters",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id", "Rank", "Vor"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "TIME_ON_ICE_PER_GAME", dbColumnName: "Time_on_Ice_Per_Game" },
      { key: "GOALS", dbColumnName: "Goals" },
      { key: "ASSISTS", dbColumnName: "Assists" },
      { key: "POINTS", dbColumnName: "Points" },
      { key: "PP_GOALS", dbColumnName: "PP_Goals" },
      { key: "PP_ASSISTS", dbColumnName: "PP_Assists" },
      { key: "PP_POINTS", dbColumnName: "Pp_Points" },
      { key: "SH_POINTS", dbColumnName: "SH_Points" },
      { key: "HITS", dbColumnName: "Hits" },
      { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" },
      { key: "PENALTY_MINUTES", dbColumnName: "Penalty_Minutes" },
      { key: "FACEOFFS_WON", dbColumnName: "Faceoffs_Won" },
      { key: "FACEOFFS_LOST", dbColumnName: "Faceoffs_Lost" },
      { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" },
      { key: "VOR_SKATER", dbColumnName: "Vor" }
    ]
  }
];
