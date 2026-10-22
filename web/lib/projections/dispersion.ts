/**
 * Fitted count-dispersion constants for FORGE per-game stat distributions.
 *
 * Model: a per-game count X with predictive mean mu has
 *   Var(X) = mu + b * mu + a * mu^2,
 * served as a negative binomial moment-matched with alpha(mu) = a + b / mu
 * (NB2 when b = 0; the b term adds NB1-style dispersion that matters most at
 * low means). a = b = 0 is Poisson.
 *
 * Fit (web/scripts/fit-forge-dispersion.ts, run 2026-10-22):
 * - Data: wgo_skater_stats (games_played = 1, TOI > 0) and wgo_goalie_stats
 *   (games_started = 1), regular seasons 2023-24 and 2024-25 (Oct 1 - Apr 30),
 *   player-seasons with >= 20 games. F = C/L/R. n = 60,734 F games,
 *   30,861 D games, 4,783 goalie starts.
 * - Method: method of moments inside each player-season (so between-player
 *   rate differences are not counted as overdispersion), summed within six
 *   bins of the player-season mean; Var - mu = a mu^2 + b mu fitted by
 *   non-negative least squares through the origin across bins x seasons.
 *   "toiConditional" uses mu_g = player-season rate per second x game TOI.
 * - Goalies: the player-season means span only ~20-34, so a and b are not
 *   separately identified; the pooled NB2 alpha (b = 0) is used instead.
 * - Goals and assists: pooled alpha is negative (mildly underdispersed:
 *   G F -0.023, G D -0.059, A F -0.025, A D -0.004), so they stay Poisson.
 * - Check: unconditional ~= toiConditional (1 + c^2) + c^2 with the measured
 *   TOI CV^2 (e.g. SOG F 0.0219 * 1.025 + 0.0247 = 0.047 vs 0.047 fitted).
 * - Holdout 2025-26 (prior up-to-40-game mean as predictive mean): NB beats
 *   Poisson on log score, RPS and PIT flatness for every SOG/hit/block/save
 *   stratum; goals and assists show no gain. See the script output in the
 *   Lane C report for the full tables.
 */

export type DispersionStat = "sog" | "hit" | "blk" | "g" | "a" | "sv" | "sa";
export type DispersionPosition = "F" | "D" | "G";

export type DispersionCoefficients = {
  /** NB2 (quadratic) dispersion: Var gains a * mu^2. */
  a: number;
  /** NB1 (linear) dispersion: Var gains b * mu. */
  b: number;
};

export type DispersionFit = {
  /** Per game, game-to-game TOI variation included. Use when the mean carries no TOI spread. */
  unconditional: DispersionCoefficients;
  /** Per game, given the realized TOI. Use when TOI is simulated or carries its own spread. */
  toiConditional: DispersionCoefficients;
  /** Empirical game-to-game TOI CV^2 within player-season (diagnostic). */
  toiCv2: number;
};

export type DispersionKey = `${DispersionStat}:${DispersionPosition}`;

const POISSON: DispersionCoefficients = { a: 0, b: 0 };

// Pooled unconditional NB2 alpha per stratum (2023-24 / 2024-25) for reference:
// SOG F 0.047 (0.041/0.055), SOG D 0.044 (0.039/0.048), HIT F 0.108
// (0.121/0.096), HIT D 0.116 (0.117/0.114), BLK F 0.113 (0.118/0.109),
// BLK D 0.064 (0.062/0.066), SV G 0.040 (0.041/0.039), SA G 0.029 (0.030/0.028).
export const FORGE_DISPERSION: Partial<Record<DispersionKey, DispersionFit>> = {
  "sog:F": {
    unconditional: { a: 0.0012, b: 0.0983 },
    toiConditional: { a: 0, b: 0.0458 },
    toiCv2: 0.0247
  },
  "sog:D": {
    unconditional: { a: 0.0211, b: 0.0345 },
    toiConditional: { a: 0.016, b: 0.0158 },
    toiCv2: 0.0213
  },
  "hit:F": {
    unconditional: { a: 0.0069, b: 0.1842 },
    toiConditional: { a: 0, b: 0.1846 },
    toiCv2: 0.0224
  },
  "hit:D": {
    unconditional: { a: 0.0162, b: 0.1728 },
    toiConditional: { a: 0, b: 0.1781 },
    toiCv2: 0.0198
  },
  "blk:F": {
    unconditional: { a: 0.0952, b: 0.0111 },
    toiConditional: { a: 0.0587, b: 0.0182 },
    toiCv2: 0.0223
  },
  "blk:D": {
    unconditional: { a: 0.0306, b: 0.0547 },
    toiConditional: { a: 0.0136, b: 0.0379 },
    toiCv2: 0.0205
  },
  "g:F": { unconditional: POISSON, toiConditional: POISSON, toiCv2: 0.0247 },
  "g:D": { unconditional: POISSON, toiConditional: POISSON, toiCv2: 0.0207 },
  "a:F": { unconditional: POISSON, toiConditional: POISSON, toiCv2: 0.025 },
  "a:D": { unconditional: POISSON, toiConditional: POISSON, toiCv2: 0.0214 },
  "sv:G": {
    unconditional: { a: 0.0401, b: 0 },
    toiConditional: { a: 0.019, b: 0 },
    toiCv2: 0.019
  },
  "sa:G": {
    unconditional: { a: 0.0291, b: 0 },
    toiConditional: { a: 0.0134, b: 0 },
    toiCv2: 0.019
  }
};

export function normalizeDispersionPosition(
  position: string | null | undefined
): DispersionPosition | null {
  const p = (position ?? "").trim().toUpperCase();
  if (p === "D") return "D";
  if (p === "G") return "G";
  if (p === "F" || p === "C" || p === "L" || p === "R" || p === "LW" || p === "RW")
    return "F";
  return null;
}

export function getDispersionFit(
  stat: DispersionStat,
  position: string | null | undefined
): DispersionFit | null {
  const pos = normalizeDispersionPosition(position);
  if (!pos) return null;
  return FORGE_DISPERSION[`${stat}:${pos}`] ?? null;
}

/**
 * Compound TOI-conditional dispersion with independent per-game TOI noise of
 * coefficient of variation `toiCv` (counts scale with TOI):
 *   Var = E[Var(X|T)] + Var(E[X|T]) = mu(1+b) + a mu^2 (1+c^2) + c^2 mu^2.
 */
export function compoundToiDispersion(
  coefficients: DispersionCoefficients,
  toiCv: number
): DispersionCoefficients {
  const c2 = Number.isFinite(toiCv) ? Math.max(0, toiCv) ** 2 : 0;
  return {
    a: Math.max(0, coefficients.a) * (1 + c2) + c2,
    b: Math.max(0, coefficients.b)
  };
}

export type ResolveDispersionOptions = {
  /** Per-game TOI CV carried by the projection; switches to the TOI-conditional fit compounded with it. */
  toiCv?: number | null;
  /** Number of iid games summed into `mean` (sum of NB with shared p stays NB). */
  horizonGames?: number;
};

/**
 * NB alpha for a projected total `mean` of `stat` for `position`, or null when
 * no fit exists (callers fall back to Poisson). With horizonGames = H and a
 * total mean M = H * m, the summed variance is M(1+b) + a M^2 / H, so
 * alpha = a / H + b / M.
 */
export function resolveDispersionAlpha(
  stat: DispersionStat,
  position: string | null | undefined,
  mean: number,
  options: ResolveDispersionOptions = {}
): number | null {
  const fit = getDispersionFit(stat, position);
  if (!fit) return null;
  if (!Number.isFinite(mean) || mean <= 0) return 0;
  const coefficients =
    options.toiCv != null && Number.isFinite(options.toiCv)
      ? compoundToiDispersion(fit.toiConditional, options.toiCv)
      : fit.unconditional;
  const horizon = Math.max(1, Math.floor(options.horizonGames ?? 1));
  const alpha = Math.max(0, coefficients.a) / horizon + Math.max(0, coefficients.b) / mean;
  return Number.isFinite(alpha) ? alpha : null;
}
