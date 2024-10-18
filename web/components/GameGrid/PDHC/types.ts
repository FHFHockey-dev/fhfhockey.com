// components/GameGrid/PDHC/types.ts

export type TeamsState = {
  [key: string]: {
    general: {
      team_abbreviation: string;
      team_name: string;
      gp: number;
      w_per_game: number;
      l_per_game: number;
      otl_per_game: number;
      points_per_game: number;
    };
    attScores: Record<StrengthEnum, number>;
    defScores: Record<StrengthEnum, number>;
    toi: Record<StrengthEnum, number>;
  };
};

// Enums for Strength and Metrics
export enum StrengthEnum {
  ALL = "all",
  FIVE_V_FIVE = "5v5",
  PP = "pp",
  PK = "pk",
}

// Define TeamStats type
export type TeamStats = {
  team_abbreviation: string;
  team_name: string;
  gp: number;
  w_per_game: number;
  l_per_game: number;
  otl_per_game: number;
  points_per_game: number;
  toi_per_game: number;
  cf_per_game: number;
  ca_per_game: number;
  cf_pct: number;
  ff_per_game: number;
  fa_per_game: number;
  ff_pct: number;
  sf_per_game: number;
  sa_per_game: number;
  sf_pct: number;
  gf_per_game: number;
  ga_per_game: number;
  gf_pct: number;
  xgf_per_game: number;
  xga_per_game: number;
  xgf_pct: number;
  scf_per_game: number;
  sca_per_game: number;
  scf_pct: number;
  hdcf_per_game: number;
  hdca_per_game: number;
  hdcf_pct: number;
  hdsf_per_game: number;
  hdsa_per_game: number;
  hdsf_pct: number;
  hdgf_per_game: number;
  hdga_per_game: number;
  hdgf_pct: number;
  sh_pct: number;
  sv_pct: number;
  pdo: number;
  // Removed differentials from TeamStats
};
