// /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/projectionSourcesConfig.ts

// Next I would like to figure out how we could flatten all skaters to an 82 games played field.

// If the user would like to forego the projected # of games played that the source has provided, and assume all players are going to play all 82 games (goalies excluded)

import { StatDefinition } from "./statsMasterList";
import { formatToMMSS } from "./formatToMMSS";

export interface SourceStatMapping {
  /** Key from STATS_MASTER_LIST (e.g., 'GOALS') */
  key: StatDefinition["key"];
  /** Actual column name in this source's Supabase table (e.g., 'Goals', 'g') */
  dbColumnName: string;
  parser?: (value: any) => number | null;
  formatter?: (value: number | null | undefined) => string;
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
  // Apples & Ginos (Skaters)
  {
    id: "ag_skaters",
    displayName: "Apples & Ginos",
    tableName: "PROJECTIONS_20252026_AG_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    ignoreColumns: ["upload_batch_id", "S"],
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
        dbColumnName: "Time_on_Ice_Per_Game",
        formatter: formatToMMSS
      }
    ]
  },

  // Cullen (Skaters)
  {
    id: "cullen_skaters",
    displayName: "Cullen",
    tableName: "PROJECTIONS_20252026_CULLEN_SKATERS",
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

  // Cullen (Goalies)
  {
    id: "cullen_goalies",
    displayName: "Cullen",
    tableName: "PROJECTIONS_20252026_CULLEN_GOALIES",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Goalie",
    teamKey: "Team_Abbreviation",
    ignoreColumns: ["upload_batch_id", "Rank"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "WINS_GOALIE", dbColumnName: "Wins_Goalie" },
      { key: "GOALS_AGAINST_AVERAGE", dbColumnName: "Goals_Against_Average" },
      { key: "SAVE_PERCENTAGE", dbColumnName: "Sv_Pct" },
      { key: "SHUTOUTS_GOALIE", dbColumnName: "Shutouts_Goalie" }
    ]
  },

  // DFO (Skaters)
  {
    id: "dfo_skaters",
    displayName: "DFO",
    tableName: "PROJECTIONS_20252026_DFO_SKATERS",
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
      { key: "PLUS_MINUS", dbColumnName: "Plus_Minus" },
      { key: "PP_GOALS", dbColumnName: "PP_Goals" },
      { key: "PP_ASSISTS", dbColumnName: "PP_Assists" },
      { key: "PP_POINTS", dbColumnName: "PP_Points" },
      { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" },
      { key: "TIME_ON_ICE_PER_GAME", dbColumnName: "Time_on_Ice_Per_Game" },
      { key: "FACEOFFS_WON", dbColumnName: "Faceoffs_Won" },
      { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" },
      { key: "HITS", dbColumnName: "Hits" }
    ]
  },

  // DFO (Goalies)
  {
    id: "dfo_goalies",
    displayName: "DFO",
    tableName: "PROJECTIONS_20252026_DFO_GOALIES",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Started_Goalie" },
      { key: "WINS_GOALIE", dbColumnName: "Wins_Goalie" },
      { key: "LOSSES_GOALIE", dbColumnName: "Losses_Goalie" },
      { key: "OTL_GOALIE", dbColumnName: "OTL" },
      { key: "GOALS_AGAINST_GOALIE", dbColumnName: "Ga" },
      { key: "SHOTS_AGAINST_GOALIE", dbColumnName: "Sa" },
      { key: "SAVES_GOALIE", dbColumnName: "Saves_Goalie" },
      { key: "SAVE_PERCENTAGE", dbColumnName: "Save_Percentage" },
      { key: "GOALS_AGAINST_AVERAGE", dbColumnName: "Goals_Against_Average" },
      { key: "SHUTOUTS_GOALIE", dbColumnName: "Shutouts_Goalie" }
    ]
  },

  // DTZ (Skaters)
  {
    id: "dtz_skaters",
    displayName: "DTZ",
    tableName: "PROJECTIONS_20252026_DTZ_Skaters",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: [
      "upload_batch_id",
      "Rank",
      "Vor",
      "Age",
      "Salary",
      "Toi_Org_Es",
      "Toi_Org_Pp",
      "Toi_Org_Pk",
      "Gp_Org",
      "Toi_Es",
      "Toi_Pp",
      "Toi_Pk",
      "Total_Toi",
      "Unadj_Vor",
      "Playerid"
    ],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "TIME_ON_ICE_PER_GAME", dbColumnName: "Total_Toi" },
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
      { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" }
    ]
  },

  // DTZ (Goalies)
  {
    id: "dtz_goalies",
    displayName: "DTZ",
    tableName: "PROJECTIONS_20252026_DTZ_GOALIES",
    playerType: "goalie",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    teamKey: "Team_Abbreviation",
    positionKey: "Position",
    ignoreColumns: [
      "upload_batch_id",
      "Rank",
      "Vor",
      "Age",
      "Qs",
      "Rbs",
      "Salary",
      "Gp_Org",
      "Playerid"
    ],
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
    ]
  },

  // FHFH (Skaters)
  {
    id: "fhfh_skaters",
    displayName: "FHFH",
    tableName: "PROJECTIONS_20252026_FHFH_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    positionKey: "Position",
    ignoreColumns: ["upload_batch_id", "Adj", "Ptsgp", "S", "PP_TOI"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "TIME_ON_ICE_PER_GAME", dbColumnName: "Time_on_Ice_Per_Game" },
      { key: "GOALS", dbColumnName: "Goals" },
      { key: "ASSISTS", dbColumnName: "Assists" },
      { key: "POINTS", dbColumnName: "Points" },
      { key: "PP_GOALS", dbColumnName: "PP_Goals" },
      { key: "PP_ASSISTS", dbColumnName: "PP_Assists" },
      { key: "PP_POINTS", dbColumnName: "PP_Points" },
      { key: "SH_POINTS", dbColumnName: "SH_Points" },
      { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" },
      { key: "HITS", dbColumnName: "Hits" },
      { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" },
      { key: "PENALTY_MINUTES", dbColumnName: "Penalty_Minutes" },
      { key: "FACEOFFS_WON", dbColumnName: "Faceoffs_Won" },
      { key: "FACEOFFS_LOST", dbColumnName: "Faceoffs_Lost" },
      { key: "PLUS_MINUS", dbColumnName: "Plus_Minus" }
    ]
  },

  // Kubota (Skaters)
  {
    id: "kubota_skaters",
    displayName: "Kubota",
    tableName: "PROJECTIONS_20252026_KUBOTA_SKATERS",
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
      { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" },
      { key: "PENALTY_MINUTES", dbColumnName: "Penalty_Minutes" },
      { key: "PLUS_MINUS", dbColumnName: "Plus_Minus" },
      { key: "PP_GOALS", dbColumnName: "PP_Goals" },
      { key: "PP_ASSISTS", dbColumnName: "PP_Assists" },
      { key: "PP_POINTS", dbColumnName: "PP_Points" },
      { key: "SH_POINTS", dbColumnName: "SH_Points" },
      { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" },
      { key: "HITS", dbColumnName: "Hits" },
      { key: "FACEOFFS_LOST", dbColumnName: "Faceoffs_Lost" },
      { key: "FACEOFFS_WON", dbColumnName: "Faceoffs_Won" }
    ]
  },

  // Laidlaw (Skaters)
  {
    id: "laidlaw_skaters",
    displayName: "Laidlaw",
    tableName: "PROJECTIONS_20252026_LAIDLAW_SKATERS",
    playerType: "skater",
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    ignoreColumns: ["upload_batch_id"],
    statMappings: [
      { key: "GAMES_PLAYED", dbColumnName: "Games_Played" },
      { key: "GOALS", dbColumnName: "Goals" },
      { key: "ASSISTS", dbColumnName: "Assists" },
      { key: "POINTS", dbColumnName: "Points" },
      { key: "PP_POINTS", dbColumnName: "PP_Points" },
      { key: "SHOTS_ON_GOAL", dbColumnName: "Shots_on_Goal" },
      { key: "HITS", dbColumnName: "Hits" },
      { key: "BLOCKED_SHOTS", dbColumnName: "Blocked_Shots" }
    ]
  }
];
