// lib/config/yahooConfig.ts
import { StatDefinition } from "lib/projectionsConfig/statsMasterList";

export const YAHOO_DRAFT_ANALYSIS_KEYS = {
  ALL: {
    // Keys within the draft_analysis JSON object
    avgPick: "average_pick",
    avgRound: "average_round",
    pctDrafted: "percent_drafted"
  },
  PRESEASON: {
    avgPick: "preseason_average_pick",
    avgRound: "preseason_average_round",
    pctDrafted: "preseason_percent_drafted"
  }
} as const;

export interface YahooDirectStat {
  key: string;
  dbColumnName: string;
  statDefinition: StatDefinition["key"];
}

export const YAHOO_DIRECT_STATS_CONFIG: YahooDirectStat[] = [
  // {
  //   key: 'YAHOO_OWNERSHIP_PCT',
  //   dbColumnName: 'percent_ownership',
  //   statDefinition: 'YAHOO_OWNERSHIP_PCT'
  // },
  // {
  //   key: 'YAHOO_PLAYER_STATUS',
  //   dbColumnName: 'status_full',
  //   statDefinition: 'YAHOO_PLAYER_STATUS'
  // },
];

export const YAHOO_PLAYER_MAP_KEYS = {
  nhlPlayerId: "nhl_player_id",
  yahooPlayerId: "yahoo_player_id",
  teamAbbreviation: "nhl_team_abbreviation",
  position: "mapped_position",
  nhlPlayerName: "nhl_player_name", // Name as per NHL (used by projections)
  yahooPlayerNameInMap: "yahoo_player_name" // Name as per Yahoo, in the mapping table
};

// Column names in your `yahoo_players` table
export const YAHOO_PLAYERS_TABLE_KEYS = {
  primaryKey: "player_key",
  yahooSpecificPlayerId: "player_id",
  fullName: "full_name", // Yahoo's version of the player's full name
  draftAnalysis: "draft_analysis", // JSONB
  editorialTeamAbbreviation: "editorial_team_abbreviation",
  displayPosition: "display_position",
  eligiblePositions: "eligible_positions"
};
