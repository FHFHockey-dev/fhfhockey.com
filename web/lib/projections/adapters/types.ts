export type Game = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

export type ShiftChartRow = {
  game_id: number;
  player_id: number | null;
  team_id: number | null;
  opponent_team_id: number | null;
  game_date: string | null;
  total_es_toi: string | null;
  total_pp_toi: string | null;
};

export type PbpPlayRow = {
  gameid: number;
  game_date: string | null;
  sortorder: number | null;
  situationcode: string | null;
  typedesckey: string | null;
  typecode: number | null;
  shootingplayerid: number | null;
  scoringplayerid: number | null;
  assist1playerid: number | null;
  assist2playerid: number | null;
  eventownerteamid: number | null;
};

export type GoalieGameStatsRow = {
  gameId: number;
  playerId: number;
  goalsAgainst: number;
  saveShotsAgainst: string;
  toi: string | null;
};

export interface ScheduleAdapter {
  listGamesByDate(date: string): Promise<Game[]>;
  listGamesInDateRange(startDate: string, endDate: string): Promise<Game[]>;
}

export interface ShiftsAdapter {
  listShiftChartsByGame(gameId: number): Promise<ShiftChartRow[]>;
}

export interface PlayByPlayAdapter {
  listPlaysByGame(gameId: number): Promise<PbpPlayRow[]>;
}

export interface GoalieStatsAdapter {
  listGoalieGameStatsByGame(gameId: number): Promise<GoalieGameStatsRow[]>;
}

export type IngestedDataAdapters = {
  schedule: ScheduleAdapter;
  shifts: ShiftsAdapter;
  pbp: PlayByPlayAdapter;
  goalie: GoalieStatsAdapter;
};

