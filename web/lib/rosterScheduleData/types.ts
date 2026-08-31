export type YahooMatchupWeekRow = {
  id: number;
  game_key: string;
  season: string;
  week: number;
  start_date: string | null;
  end_date: string | null;
};

export type NhlScheduleTeam = {
  id: number;
  abbrev: string;
};

export type NhlScheduleGame = {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  startTimeUTC?: string | null;
  gameState?: string | null;
  gameScheduleState?: string | null;
  awayTeam: NhlScheduleTeam;
  homeTeam: NhlScheduleTeam;
  venue?: { default?: string | null } | null;
  venueUTCOffset?: string | null;
  easternUTCOffset?: string | null;
  lastUpdatedUTC?: string | null;
};

export type FetchedNhlScheduleGame = {
  game: NhlScheduleGame;
  sourceUrl: string;
};

export type MatchupWeekMapping =
  | { status: "mapped"; week: YahooMatchupWeekRow }
  | { status: "unmapped"; reason: string };

export type RosterOptimizerTeamGameUpsert = {
  yahoo_matchup_week_id: number | null;
  game_key: string;
  season: string;
  week: number | null;
  source_game_id: number;
  source_season_id: number;
  game_date: string;
  start_time: string | null;
  game_type: number;
  game_status: string;
  schedule_status: string;
  mapping_status: MatchupWeekMapping["status"];
  is_countable: boolean;
  team_id: number;
  team_abbreviation: string;
  opponent_team_id: number;
  opponent_abbreviation: string;
  home_away: "home" | "away";
  source_url: string;
  source_updated_at: string | null;
  source_metadata: Record<string, unknown>;
  fetched_at: string;
};

export type RosterOptimizerTeamGameRecord =
  RosterOptimizerTeamGameUpsert & {
    id: number;
    inserted_at: string;
    updated_at: string;
  };

export type RosterScheduleReadFilter = {
  gameKey: string;
  startWeek: number;
  endWeek: number;
};

