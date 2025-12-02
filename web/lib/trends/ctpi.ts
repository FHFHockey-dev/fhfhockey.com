type Numeric = number | null | undefined;

export type TeamGameRow = {
  team: string;
  date: string;
  xgf_per_60?: Numeric;
  hdcf_per_60?: Numeric;
  gf_per_60?: Numeric;
  xga_per_60?: Numeric;
  hdca_per_60?: Numeric;
  ca_per_60?: Numeric; // Added
  sat_pct?: Numeric;
  goals_against?: Numeric;
  xga?: Numeric;
  power_play_goals_for?: Numeric;
  powerPlayToi?: Numeric;
  pp_xgf?: Numeric; // Added
  pp_goals_against?: Numeric;
  toi_shorthanded?: Numeric;
  pk_xga?: Numeric; // Added
  net_penalties_per_60?: Numeric;
  pdo?: Numeric;
  toi_all_seconds?: Numeric; // Added
};

export type TrendMetrics = {
  team: string;
  // Offense
  xgf_per_60: number;
  hdcf_per_60: number;
  gf_per_60: number;
  // Defense
  xga_per_60: number;
  hdca_per_60: number;
  ca_per_60: number; // Replaces sat_pct in formula, though sat_pct might still be useful
  // Special Teams
  pp_xgf_per_60: number;
  pk_xga_per_60: number;
  // Goaltending
  gsax_per_60_season: number;
  gsax_per_60_last10: number;
  // Luck
  pdo: number;
  // Legacy/Extra (keeping for safety if used elsewhere, or remove if sure)
  sat_pct: number;
  gsaX: number; // This was trend-weighted GSAx
  pp_eff: number;
  pk_supp: number;
  net_penalties_per_60: number;
};

export type CtpiScore = {
  team: string;
  offense: number;
  defense: number;
  goaltending: number;
  specialTeams: number;
  luck: number;
  ctpi_raw: number;
  ctpi_0_to_100: number;
  z: Record<string, number>;
  sparkSeries?: Array<{ date: string; value: number }>;
};

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const mean = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);
const stdDev = (arr: number[]) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(variance);
};

export const zScore = (val: Numeric, mu: number, sd: number) =>
  val == null || !Number.isFinite(val as number) || sd === 0
    ? 0
    : ((val as number) - mu) / sd;

const wma = (values: Numeric[], weights: number[]) => {
  const valid = values
    .map((v, i) => ({ v: v as number, w: weights[i] }))
    .filter((x) => Number.isFinite(x.v) && Number.isFinite(x.w));
  if (!valid.length) return 0;
  const num = valid.reduce((acc, x) => acc + x.v * x.w, 0);
  const den = valid.reduce((acc, x) => acc + x.w, 0);
  return den === 0 ? 0 : num / den;
};

// Linear weights: 1.0, 0.9, ..., 0.1
export const buildLinearWeights = (len: number) => {
  const weights: number[] = [];
  for (let i = 0; i < len; i++) {
    const w = 1.0 - i * 0.1;
    if (w <= 0.05) break; // Stop if weight is too small or negative
    weights.push(w);
  }
  return weights;
};

export function computeTrendMetrics(
  games: TeamGameRow[],
  _weightDecay = 0.9,
  maxGames = 10
): TrendMetrics {
  const allSorted = [...games]
    .filter((g) => g.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const trendSlice = allSorted.slice(0, maxGames);
  const trendWeights = buildLinearWeights(trendSlice.length);

  const getTrendValue = (key: keyof TeamGameRow) =>
    wma(
      trendSlice.map((g) => g[key] as Numeric),
      trendWeights
    );

  const getDerivedTrendValue = (
    numeratorKey: keyof TeamGameRow,
    denominatorKey: keyof TeamGameRow,
    scale = 1
  ) => {
    const values = trendSlice.map((g) => {
      const n = g[numeratorKey] as number;
      const d = g[denominatorKey] as number;
      return n != null && d ? (n / d) * scale : null;
    });
    return wma(values, trendWeights);
  };

  const validSeasonGames = allSorted.filter(
    (g) => g.xga != null && g.goals_against != null
  );

  let seasonGsax = 0;
  let seasonToi = 0;
  validSeasonGames.forEach((g) => {
    if (g.toi_all_seconds) {
      seasonGsax += (g.xga as number) - (g.goals_against as number);
      seasonToi += g.toi_all_seconds as number;
    }
  });
  const gsaxSeason = seasonToi > 0 ? (seasonGsax * 3600) / seasonToi : 0;

  const getPerGameGsaxPer60 = (g: TeamGameRow) => {
    if (g.xga != null && g.goals_against != null && g.toi_all_seconds) {
      return (
        (((g.xga as number) - (g.goals_against as number)) * 3600) /
        (g.toi_all_seconds as number)
      );
    }
    return null;
  };

  const gsaxPer60Values = trendSlice.map(getPerGameGsaxPer60);
  const gsaxLast10 = wma(gsaxPer60Values, trendWeights);

  const ppXgfPer60 = getDerivedTrendValue("pp_xgf", "powerPlayToi", 3600);
  const pkXgaPer60 = getDerivedTrendValue("pk_xga", "toi_shorthanded", 3600);

  return {
    team: games[0]?.team ?? "",
    xgf_per_60: getTrendValue("xgf_per_60"),
    hdcf_per_60: getTrendValue("hdcf_per_60"),
    gf_per_60: getTrendValue("gf_per_60"),
    xga_per_60: getTrendValue("xga_per_60"),
    hdca_per_60: getTrendValue("hdca_per_60"),
    ca_per_60: getTrendValue("ca_per_60"),

    pp_xgf_per_60: ppXgfPer60,
    pk_xga_per_60: pkXgaPer60,

    gsax_per_60_season: gsaxSeason,
    gsax_per_60_last10: gsaxLast10,

    pdo:
      wma(
        trendSlice.map((g) => {
          const val = g.pdo as number | null | undefined;
          if (val == null) return null;
          // Normalize PDO to 0-100 scale if it's 0-1
          return val < 2 ? val * 100 : val;
        }),
        trendWeights
      ) ?? 100,

    sat_pct: getTrendValue("sat_pct"),
    gsaX: gsaxLast10,
    pp_eff: 0,
    pk_supp: 0,
    net_penalties_per_60: getTrendValue("net_penalties_per_60")
  };
}

export function computeCtpi(teams: TrendMetrics[]): CtpiScore[] {
  const collect = (k: keyof TrendMetrics) =>
    teams.map((t) => t[k] as number).filter((v) => Number.isFinite(v));

  const mu_sd: Record<string, [number, number]> = {
    xgf: [mean(collect("xgf_per_60")), stdDev(collect("xgf_per_60"))],
    hdcf: [mean(collect("hdcf_per_60")), stdDev(collect("hdcf_per_60"))],
    gf: [mean(collect("gf_per_60")), stdDev(collect("gf_per_60"))],

    xga: [mean(collect("xga_per_60")), stdDev(collect("xga_per_60"))],
    hdca: [mean(collect("hdca_per_60")), stdDev(collect("hdca_per_60"))],
    ca: [mean(collect("ca_per_60")), stdDev(collect("ca_per_60"))],

    pp_xgf: [mean(collect("pp_xgf_per_60")), stdDev(collect("pp_xgf_per_60"))],
    pk_xga: [mean(collect("pk_xga_per_60")), stdDev(collect("pk_xga_per_60"))],

    gsax_season: [
      mean(collect("gsax_per_60_season")),
      stdDev(collect("gsax_per_60_season"))
    ],
    gsax_last10: [
      mean(collect("gsax_per_60_last10")),
      stdDev(collect("gsax_per_60_last10"))
    ],
    pdo: [mean(collect("pdo")), stdDev(collect("pdo"))]
  };

  return teams.map((t) => {
    const z = {
      xgf: zScore(t.xgf_per_60, ...mu_sd.xgf),
      hdcf: zScore(t.hdcf_per_60, ...mu_sd.hdcf),
      gf: zScore(t.gf_per_60, ...mu_sd.gf),

      xga: zScore(t.xga_per_60, ...mu_sd.xga),
      hdca: zScore(t.hdca_per_60, ...mu_sd.hdca),
      ca: zScore(t.ca_per_60, ...mu_sd.ca),

      pp_xgf: zScore(t.pp_xgf_per_60, ...mu_sd.pp_xgf),
      pk_xga: zScore(t.pk_xga_per_60, ...mu_sd.pk_xga),

      gsax_season: zScore(t.gsax_per_60_season, ...mu_sd.gsax_season),
      gsax_last10: zScore(t.gsax_per_60_last10, ...mu_sd.gsax_last10),
      pdo: zScore(t.pdo ?? 100, ...mu_sd.pdo)
    };

    const offense = 0.5 * z.xgf + 0.3 * z.hdcf + 0.2 * z.gf;
    const defense = 0.5 * -z.xga + 0.3 * -z.hdca + 0.2 * -z.ca;
    const specialTeams = 0.55 * z.pp_xgf + 0.45 * -z.pk_xga;
    const goaltending = 0.4 * z.gsax_season + 0.6 * z.gsax_last10;

    // Luck: Z-score of PDO.
    // Positive Z-score = High PDO (Lucky). Negative Z-score = Low PDO (Unlucky).
    // We use the Z-score so it is on the same scale as other metrics (~ -3 to +3).
    const luck = z.pdo;

    const raw =
      0.35 * offense +
      0.3 * defense +
      0.2 * goaltending +
      0.15 * specialTeams +
      0.1 * luck;

    return {
      team: t.team,
      offense,
      defense,
      goaltending,
      specialTeams,
      luck,
      ctpi_raw: raw,
      ctpi_0_to_100: 50 + 15 * raw,
      z
    };
  });
}
