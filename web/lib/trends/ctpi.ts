type Numeric = number | null | undefined;

export type TeamGameRow = {
  team: string;
  date: string;
  xgf_per_60?: Numeric;
  hdcf_per_60?: Numeric;
  gf_per_60?: Numeric;
  xga_per_60?: Numeric;
  hdca_per_60?: Numeric;
  sat_pct?: Numeric;
  goals_against?: Numeric;
  xga?: Numeric;
  power_play_goals_for?: Numeric;
  powerPlayToi?: Numeric;
  pp_goals_against?: Numeric;
  toi_shorthanded?: Numeric;
  net_penalties_per_60?: Numeric;
  pdo?: Numeric;
};

export type TrendMetrics = {
  team: string;
  xgf_per_60: number;
  hdcf_per_60: number;
  gf_per_60: number;
  xga_per_60: number;
  hdca_per_60: number;
  sat_pct: number;
  gsaX: number;
  pp_eff: number;
  pk_supp: number;
  net_penalties_per_60: number;
  pdo: number;
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

export const buildWeights = (len: number, decay = 0.9) =>
  Array.from({ length: len }, (_, i) => decay ** i);

export function computeTrendMetrics(
  games: TeamGameRow[],
  weightDecay = 0.9,
  maxGames = 10
): TrendMetrics {
  const sorted = [...games]
    .filter((g) => g.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxGames);

  const weights = buildWeights(sorted.length, weightDecay);

  const gsaXVals = sorted.map((g) =>
    g.xga != null && g.goals_against != null
      ? (g.xga as number) - (g.goals_against as number)
      : null
  );
  const ppEffVals = sorted.map((g) =>
    g.power_play_goals_for != null && g.powerPlayToi
      ? ((g.power_play_goals_for as number) / (g.powerPlayToi as number)) * 3600
      : null
  );
  const pkSuppVals = sorted.map((g) =>
    g.pp_goals_against != null && g.toi_shorthanded
      ? ((g.pp_goals_against as number) / (g.toi_shorthanded as number)) * 3600
      : null
  );

  return {
    team: games[0]?.team ?? "",
    xgf_per_60: wma(
      sorted.map((g) => g.xgf_per_60 ?? null),
      weights
    ),
    hdcf_per_60: wma(
      sorted.map((g) => g.hdcf_per_60 ?? null),
      weights
    ),
    gf_per_60: wma(
      sorted.map((g) => g.gf_per_60 ?? null),
      weights
    ),
    xga_per_60: wma(
      sorted.map((g) => g.xga_per_60 ?? null),
      weights
    ),
    hdca_per_60: wma(
      sorted.map((g) => g.hdca_per_60 ?? null),
      weights
    ),
    sat_pct: wma(
      sorted.map((g) => g.sat_pct ?? null),
      weights
    ),
    gsaX: wma(gsaXVals, weights),
    pp_eff: wma(ppEffVals, weights),
    pk_supp: wma(pkSuppVals, weights),
    net_penalties_per_60: wma(
      sorted.map((g) => g.net_penalties_per_60 ?? null),
      weights
    ),
    pdo: sorted[0]?.pdo ?? 100
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
    sat: [mean(collect("sat_pct")), stdDev(collect("sat_pct"))],
    gsaX: [mean(collect("gsaX")), stdDev(collect("gsaX"))],
    pp: [mean(collect("pp_eff")), stdDev(collect("pp_eff"))],
    pk: [mean(collect("pk_supp")), stdDev(collect("pk_supp"))],
    netPens: [
      mean(collect("net_penalties_per_60")),
      stdDev(collect("net_penalties_per_60"))
    ]
  };

  return teams.map((t) => {
    const z = {
      xgf: zScore(t.xgf_per_60, ...mu_sd.xgf),
      hdcf: zScore(t.hdcf_per_60, ...mu_sd.hdcf),
      gf: zScore(t.gf_per_60, ...mu_sd.gf),
      xga: -zScore(t.xga_per_60, ...mu_sd.xga), // inverted
      hdca: -zScore(t.hdca_per_60, ...mu_sd.hdca), // inverted
      sat: zScore(t.sat_pct, ...mu_sd.sat),
      gsaX: zScore(t.gsaX, ...mu_sd.gsaX),
      pp: zScore(t.pp_eff, ...mu_sd.pp),
      pk: -zScore(t.pk_supp, ...mu_sd.pk), // inverted
      netPens: zScore(t.net_penalties_per_60, ...mu_sd.netPens)
    };

    const offense = 0.5 * z.xgf + 0.3 * z.hdcf + 0.2 * z.gf;
    const defense = 0.45 * z.xga + 0.35 * z.hdca + 0.2 * z.sat;
    const goaltending = z.gsaX; // full weight
    const specialTeams = 0.45 * z.pp + 0.45 * z.pk + 0.1 * z.netPens;
    const luck = 0.05 * (100.5 - (t.pdo ?? 100));

    const raw =
      0.35 * offense +
      0.3 * defense +
      0.2 * goaltending +
      0.1 * specialTeams +
      luck;

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
