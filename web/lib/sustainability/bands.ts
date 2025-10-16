import { WindowCode } from "lib/sustainability/windows";

/**
 * Supported sustainability metric identifiers.
 * Align with backend column names so we can persist without translation.
 */
export const SUSTAINABILITY_METRICS = [
  "shots_per_60",
  "icf_per_60",
  "ixg_per_60",
  "iscf_per_60",
  "ihdcf_per_60",
  "pp_toi_pct",
  "xgf_pct",
  "scf_pct",
  "hdcf_pct",
  "ipp",
  "sh_pct",
  "sh_pct_5v5",
  "pp_sh_pct",
  "on_ice_sh_pct",
  "on_ice_sv_pct",
  "pdo",
  "points_per_60_5v5",
  "pp_goals_per_60",
  "pp_points_per_60",
  "hits_per_60",
  "blocks_per_60",
  "fantasy_score"
] as const;

export type SustainabilityMetricKey = (typeof SUSTAINABILITY_METRICS)[number];

export type ExposureType =
  | "shots"
  | "onIceShotsFor"
  | "onIceShotsAgainst"
  | "onIceGoalsFor"
  | "minutes"
  | "ppMinutes"
  | "games";

export type DistributionKind = "beta" | "gamma" | "normal";

export interface MetricSpec {
  key: SustainabilityMetricKey;
  label: string;
  exposure: ExposureType;
  distribution: DistributionKind;
  halfLifeGames: number;
  priorStrength: number;
  defaultWindows: readonly WindowCode[];
}

export const METRIC_SPECS: Record<SustainabilityMetricKey, MetricSpec> = {
  shots_per_60: {
    key: "shots_per_60",
    label: "Shots / 60",
    exposure: "minutes",
    distribution: "gamma",
    halfLifeGames: 5,
    priorStrength: 360, // minutes
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  icf_per_60: {
    key: "icf_per_60",
    label: "iCF / 60",
    exposure: "minutes",
    distribution: "gamma",
    halfLifeGames: 5,
    priorStrength: 360,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  ixg_per_60: {
    key: "ixg_per_60",
    label: "ixG / 60",
    exposure: "minutes",
    distribution: "gamma",
    halfLifeGames: 5,
    priorStrength: 360,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  iscf_per_60: {
    key: "iscf_per_60",
    label: "iSCF / 60",
    exposure: "minutes",
    distribution: "gamma",
    halfLifeGames: 5,
    priorStrength: 360,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  ihdcf_per_60: {
    key: "ihdcf_per_60",
    label: "iHDCF / 60",
    exposure: "minutes",
    distribution: "gamma",
    halfLifeGames: 5,
    priorStrength: 360,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  pp_toi_pct: {
    key: "pp_toi_pct",
    label: "PP TOI %",
    exposure: "games",
    distribution: "normal",
    halfLifeGames: 5,
    priorStrength: 15,
    defaultWindows: ["l3", "l5", "l10"]
  },
  xgf_pct: {
    key: "xgf_pct",
    label: "xGF%",
    exposure: "onIceShotsFor",
    distribution: "beta",
    halfLifeGames: 7,
    priorStrength: 550,
    defaultWindows: ["l5", "l10", "l20"]
  },
  scf_pct: {
    key: "scf_pct",
    label: "SCF%",
    exposure: "onIceShotsFor",
    distribution: "beta",
    halfLifeGames: 7,
    priorStrength: 550,
    defaultWindows: ["l5", "l10", "l20"]
  },
  hdcf_pct: {
    key: "hdcf_pct",
    label: "HDCF%",
    exposure: "onIceShotsFor",
    distribution: "beta",
    halfLifeGames: 7,
    priorStrength: 550,
    defaultWindows: ["l5", "l10", "l20"]
  },
  ipp: {
    key: "ipp",
    label: "IPP",
    exposure: "onIceGoalsFor",
    distribution: "beta",
    halfLifeGames: 9,
    priorStrength: 50,
    defaultWindows: ["l5", "l10", "l20"]
  },
  sh_pct: {
    key: "sh_pct",
    label: "SH%",
    exposure: "shots",
    distribution: "beta",
    halfLifeGames: 11,
    priorStrength: 100,
    defaultWindows: ["l5", "l10", "l20"]
  },
  sh_pct_5v5: {
    key: "sh_pct_5v5",
    label: "SH% (5v5)",
    exposure: "shots",
    distribution: "beta",
    halfLifeGames: 11,
    priorStrength: 100,
    defaultWindows: ["l5", "l10", "l20"]
  },
  pp_sh_pct: {
    key: "pp_sh_pct",
    label: "PP SH%",
    exposure: "shots",
    distribution: "beta",
    halfLifeGames: 11,
    priorStrength: 90,
    defaultWindows: ["l5", "l10"]
  },
  on_ice_sh_pct: {
    key: "on_ice_sh_pct",
    label: "On-Ice SH%",
    exposure: "onIceShotsFor",
    distribution: "beta",
    halfLifeGames: 8,
    priorStrength: 300,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  on_ice_sv_pct: {
    key: "on_ice_sv_pct",
    label: "On-Ice SV%",
    exposure: "onIceShotsAgainst",
    distribution: "beta",
    halfLifeGames: 8,
    priorStrength: 300,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  pdo: {
    key: "pdo",
    label: "PDO",
    exposure: "onIceShotsFor",
    distribution: "normal",
    halfLifeGames: 8,
    priorStrength: 300,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  points_per_60_5v5: {
    key: "points_per_60_5v5",
    label: "Points / 60 (5v5)",
    exposure: "minutes",
    distribution: "gamma",
    halfLifeGames: 6,
    priorStrength: 320,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  pp_goals_per_60: {
    key: "pp_goals_per_60",
    label: "PP Goals / 60",
    exposure: "ppMinutes",
    distribution: "gamma",
    halfLifeGames: 6,
    priorStrength: 180,
    defaultWindows: ["l3", "l5", "l10"]
  },
  pp_points_per_60: {
    key: "pp_points_per_60",
    label: "PP Points / 60",
    exposure: "ppMinutes",
    distribution: "gamma",
    halfLifeGames: 6,
    priorStrength: 180,
    defaultWindows: ["l3", "l5", "l10"]
  },
  hits_per_60: {
    key: "hits_per_60",
    label: "Hits / 60",
    exposure: "minutes",
    distribution: "gamma",
    halfLifeGames: 5,
    priorStrength: 360,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  blocks_per_60: {
    key: "blocks_per_60",
    label: "Blocks / 60",
    exposure: "minutes",
    distribution: "gamma",
    halfLifeGames: 5,
    priorStrength: 360,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  },
  fantasy_score: {
    key: "fantasy_score",
    label: "Fantasy Score",
    exposure: "games",
    distribution: "normal",
    halfLifeGames: 5,
    priorStrength: 20,
    defaultWindows: ["l3", "l5", "l10", "l20"]
  }
};

export function halfLifeWeight(
  gamesAgo: number,
  halfLifeGames: number
): number {
  if (gamesAgo <= 0) return 1;
  return Math.exp((-Math.log(2) * gamesAgo) / Math.max(halfLifeGames, 1e-6));
}

export function ewma(
  values: Array<{ value: number; gamesAgo: number; weight?: number }>
): { value: number; totalWeight: number } {
  let num = 0;
  let den = 0;
  for (const sample of values) {
    const w = sample.weight ?? 1;
    num += sample.value * w;
    den += w;
  }
  const value = den > 0 ? num / den : 0;
  return { value, totalWeight: den };
}

export function blendWithPrior({
  ewmaEstimate,
  baseline,
  nEff,
  priorStrength
}: {
  ewmaEstimate: number;
  baseline: number;
  nEff: number;
  priorStrength: number;
}): { value: number; total: number } {
  const n = Math.max(nEff, 0);
  const k = Math.max(priorStrength, 0);
  if (n === 0 && k === 0) {
    return { value: ewmaEstimate, total: 0 };
  }
  if (k === 0) {
    return { value: ewmaEstimate, total: n };
  }
  if (n === 0) {
    return { value: baseline, total: k };
  }
  const value = (n * ewmaEstimate + k * baseline) / (n + k);
  return { value, total: n + k };
}

export function betaPosterior(
  alpha0: number,
  beta0: number,
  successes: number,
  trials: number
): { alpha: number; beta: number } {
  const alpha = alpha0 + successes;
  const beta = beta0 + (trials - successes);
  return { alpha: Math.max(alpha, 1e-6), beta: Math.max(beta, 1e-6) };
}

export function betaCredibleInterval(
  alpha: number,
  beta: number,
  confidence = 0.8
): { mean: number; lower: number; upper: number } {
  const mean = alpha / (alpha + beta);
  const lowerQuantile = (1 - confidence) / 2;
  const upperQuantile = 1 - lowerQuantile;
  return {
    mean,
    lower: betaQuantile(lowerQuantile, alpha, beta),
    upper: betaQuantile(upperQuantile, alpha, beta)
  };
}

export function gammaPosterior(
  shape0: number,
  rate0: number,
  sum: number,
  exposure: number
): { shape: number; rate: number } {
  const shape = shape0 + sum;
  const rate = rate0 + exposure;
  return { shape: Math.max(shape, 1e-6), rate: Math.max(rate, 1e-6) };
}

export function gammaCredibleInterval(
  shape: number,
  rate: number,
  confidence = 0.8
): { mean: number; lower: number; upper: number } {
  const mean = shape / rate;
  const lowerQuantile = (1 - confidence) / 2;
  const upperQuantile = 1 - lowerQuantile;
  return {
    mean,
    lower: gammaQuantile(lowerQuantile, shape, rate),
    upper: gammaQuantile(upperQuantile, shape, rate)
  };
}

/**
 * Beta quantile approximation (Clopper-Pearson) via inverse incomplete beta.
 * Uses a simple binary search since we only need nightly batch precision.
 */
export function betaQuantile(p: number, alpha: number, beta: number): number {
  let lo = 0;
  let hi = 1;
  let mid = 0.5;
  for (let i = 0; i < 40; i += 1) {
    mid = (lo + hi) / 2;
    const cdf = incompleteBeta(mid, alpha, beta);
    if (cdf > p) hi = mid;
    else lo = mid;
  }
  return mid;
}

/**
 * Gamma quantile using binary search and incomplete gamma CDF.
 */
export function gammaQuantile(p: number, shape: number, rate: number): number {
  let lo = 0;
  let hi = Math.max(10, (shape / rate) * 10);
  let mid = hi / 2;
  for (let i = 0; i < 40; i += 1) {
    mid = (lo + hi) / 2;
    const cdf = incompleteGamma(rate * mid, shape);
    if (cdf > p) hi = mid;
    else lo = mid;
  }
  return mid;
}

function incompleteBeta(x: number, a: number, b: number): number {
  const bt =
    x === 0 || x === 1
      ? 0
      : Math.exp(
          logGamma(a + b) -
            logGamma(a) -
            logGamma(b) +
            a * Math.log(x) +
            b * Math.log(1 - x)
        );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(x, a, b)) / a;
  }
  return 1 - (bt * betacf(1 - x, b, a)) / b;
}

function betacf(x: number, a: number, b: number): number {
  const MAX_ITER = 100;
  const EPS = 1e-12;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < EPS) d = EPS;
  d = 1 / d;
  let h = d;
  for (let m = 1, m2 = 2; m <= MAX_ITER; m += 1, m2 += 2) {
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < EPS) d = EPS;
    c = 1 + aa / c;
    if (Math.abs(c) < EPS) c = EPS;
    d = 1 / d;
    h *= d * c;
    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < EPS) d = EPS;
    c = 1 + aa / c;
    if (Math.abs(c) < EPS) c = EPS;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function incompleteGamma(x: number, a: number): number {
  if (x <= 0) return 0;
  const gln = logGamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 100; n += 1) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 100; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  return 1 - h * Math.exp(-x + a * Math.log(x) - gln);
}

function logGamma(z: number): number {
  const coefficients = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < coefficients.length; j += 1) {
    y += 1;
    ser += coefficients[j] / y;
  }
  return Math.log((2.5066282746310005 * ser) / z) - tmp;
}
