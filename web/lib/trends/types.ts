export type BaselineDensityPoint = {
  x: number;
  y: number;
};

export type TimeSeriesPoint = {
  seasonId: number | null;
  gameId: number | null;
  date: string;
  sko: number;
  skoRaw: number;
  streak: "hot" | "cold" | null;
  ewma?: number | null;
  hotFlag?: boolean;
  coldFlag?: boolean;
  hotStreakId?: number | null;
  coldStreakId?: number | null;
  components: {
    shots_z: number | null;
    ixg_z: number | null;
    ixg_per_60_z: number | null;
    toi_z: number | null;
    pp_toi_z: number | null;
    oz_fo_pct_z: number | null;
    onice_sh_pct_z: number | null;
    shooting_pct_z: number | null;
  };
};

export type PlayerSeries = {
  playerId: number;
  playerName: string | null;
  position: "F" | "D";
  season: string;
  baseline: {
    mu0: number;
    sigma0: number;
    nTrain: number;
    density: BaselineDensityPoint[];
  };
  timeSeries: TimeSeriesPoint[];
  isMock?: boolean;
};

export type RpcSeriesFeatureVector = {
  shots_z: number | null;
  ixg_z: number | null;
  ixg_per_60_z: number | null;
  toi_z: number | null;
  pp_toi_z: number | null;
  oz_fo_pct_z: number | null;
  onice_sh_pct_z: number | null;
  shooting_pct_z: number | null;
};

export type RpcSeriesEntry = {
  season_id: number | null;
  game_id: number | null;
  date: string;
  sko: number;
  sko_raw: number;
  ewma: number | null;
  hot_flag: number | null;
  cold_flag: number | null;
  hot_streak_id: number | null;
  cold_streak_id: number | null;
  features: RpcSeriesFeatureVector | null;
};

export type RpcPayload = {
  player_id: number;
  player_name: string | null;
  position_code: string | null;
  baseline: {
    mu0: number | null;
    sigma0: number | null;
    n_train: number | null;
  } | null;
  series: RpcSeriesEntry[] | null;
};

export type RpcControlOptions = {
  span?: number;
  lambdaHot?: number;
  lambdaCold?: number;
  lHot?: number;
  lCold?: number;
};
