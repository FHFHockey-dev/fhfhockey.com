// /lib/NHL/statsPageTypes.ts

export interface PlayerRow {
  id: number;
  sweater_number: number | null;
  position: string;
  image_url: string | null;
}

export type SkaterStat = {
  player_id: number;
  fullName: string;
  current_team_abbreviation: string;
  points: number;
  goals: number;
  pp_points: number;
  blocked_shots: number;
  shots: number;
  hits: number;
  bsh: number;
  total_primary_assists: number;
  total_secondary_assists: number;
  pp_goals: number;
  sh_goals: number;
  pp_primary_assists?: number;
  pp_secondary_assists?: number;
  image_url: string;
  sweater_number?: number | null;
  position?: string | null;
};

export interface GoaliePlayerRow {
  id: number;
  image_url: string | null;
  sweater_number: number | null;
}

export type GoalieStat = {
  goalie_id: number;
  fullName: string;
  current_team_abbreviation: string;
  wins: number;
  save_pct: number;
  goals_against_avg: number;
  quality_starts_pct: number;
  games_played: number;
  image_url: string;
  sweater_number?: number | null;
};

export type StatsProps = {
  pointsLeaders: SkaterStat[];
  goalsLeaders: SkaterStat[];
  pppLeaders: SkaterStat[];
  bshLeaders: SkaterStat[];
  goalieLeadersWins: GoalieStat[];
  goalieLeadersSavePct: GoalieStat[];
  goalieLeadersGAA: GoalieStat[];
  goalieLeadersQS: GoalieStat[];
};
