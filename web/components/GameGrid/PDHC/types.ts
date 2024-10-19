// components/GameGrid/PDHC/types.ts

export enum StrengthEnum {
  ALL = "all",
  FIVE_V_FIVE = "5v5",
  PP = "pp",
  PK = "pk",
}

export type TeamsState = {
  [key: number]: {
    // Changed from string to number
    general: {
      team_abbreviation: string;
      team_name: string;
      gp: number;
      w_per_game: number;
      l_per_game: number;
      otl_per_game: number;
      points_per_game: number;
      logo: string;
    };
    attScores: Record<StrengthEnum, number>;
    defScores: Record<StrengthEnum, number>;
    toi_diff: Record<StrengthEnum, number>;
  };
};

export type TeamScores = {
  team_id: number;
  team_abbreviation: string;
  team_name: string;
  gp: number;
  w_per_game: number;
  l_per_game: number;
  otl_per_game: number;
  points_per_game: number;
  att_score_all: number;
  def_score_all: number;
  att_score_5v5: number;
  def_score_5v5: number;
  att_score_pp: number;
  def_score_pp: number;
  att_score_pk: number;
  def_score_pk: number;
  all_toi_diff: number;
  "5v5_toi_diff": number;
  pp_toi_diff: number;
  pk_toi_diff: number;
  logo: string;
};
