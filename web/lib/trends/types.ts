export type BaselineDensityPoint = {
  x: number;
  y: number;
};

export type TimeSeriesPoint = {
  date: string; // ISO string for serialization
  sko: number;
  streak: "hot" | "cold" | null;
  ewma?: number;
  components: {
    shots_z: number;
    ixg_z: number;
    ixg_per_60_z: number;
    toi_z: number;
    pp_toi_z: number;
    oz_fo_pct_z: number;
    onice_sh_pct_z: number;
    shooting_pct_z: number;
  };
};

export type PlayerSeries = {
  playerId: number;
  playerName: string;
  position: "F" | "D";
  season: string;
  baseline: {
    mu0: number;
    sigma0: number;
    nTrain: number;
    density: BaselineDensityPoint[];
  };
  timeSeries: TimeSeriesPoint[];
};
