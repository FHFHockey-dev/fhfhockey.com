const Z_P10 = -1.2815515655446004;
const Z_P90 = 1.2815515655446004;

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function round3(n: number): number {
  return Number(n.toFixed(3));
}

// Cheap approximation for Poisson quantiles (good enough for MVP uncertainty scaffolding).
export function poissonQuantilesApprox(lambda: number): {
  p10: number;
  p50: number;
  p90: number;
} {
  const l = clampNonNegative(lambda);
  const sd = Math.sqrt(Math.max(l, 1e-9));
  const p10 = clampNonNegative(l + Z_P10 * sd);
  const p90 = clampNonNegative(l + Z_P90 * sd);
  return { p10: round3(p10), p50: round3(l), p90: round3(p90) };
}

export function normalBandQuantiles(
  mean: number,
  sd: number
): { p10: number; p50: number; p90: number } {
  const m = clampNonNegative(mean);
  const s = clampNonNegative(sd);
  const p10 = clampNonNegative(m + Z_P10 * s);
  const p90 = clampNonNegative(m + Z_P90 * s);
  return { p10: round3(p10), p50: round3(m), p90: round3(p90) };
}

export type PlayerUncertaintyInput = {
  toiEsSeconds: number;
  toiPpSeconds: number;
  shotsEs: number;
  shotsPp: number;
  goalsEs: number;
  goalsPp: number;
  assistsEs: number;
  assistsPp: number;
  hits: number;
  blocks: number;
};

export function buildPlayerUncertainty(u: PlayerUncertaintyInput) {
  // TOI: treat as roughly normal with ~10% std-dev (placeholder until we model share volatility explicitly).
  const toiEs = normalBandQuantiles(u.toiEsSeconds, 0.1 * u.toiEsSeconds);
  const toiPp = normalBandQuantiles(u.toiPpSeconds, 0.15 * u.toiPpSeconds);

  // Rate stats: treat as Poisson-ish around the mean.
  const shotsEs = poissonQuantilesApprox(u.shotsEs);
  const shotsPp = poissonQuantilesApprox(u.shotsPp);
  const goalsEs = poissonQuantilesApprox(u.goalsEs);
  const goalsPp = poissonQuantilesApprox(u.goalsPp);
  const assistsEs = poissonQuantilesApprox(u.assistsEs);
  const assistsPp = poissonQuantilesApprox(u.assistsPp);
  const hits = poissonQuantilesApprox(u.hits);
  const blocks = poissonQuantilesApprox(u.blocks);

  // Aggregates for UI
  const totalGoals = u.goalsEs + u.goalsPp;
  const totalAssists = u.assistsEs + u.assistsPp;
  const totalPoints = totalGoals + totalAssists;
  const totalShots = u.shotsEs + u.shotsPp;
  const totalPpp = u.goalsPp + u.assistsPp;

  return {
    toi_es_seconds: toiEs,
    toi_pp_seconds: toiPp,
    shots_es: shotsEs,
    shots_pp: shotsPp,
    goals_es: goalsEs,
    goals_pp: goalsPp,
    assists_es: assistsEs,
    assists_pp: assistsPp,
    hit: hits,
    blk: blocks,
    g: poissonQuantilesApprox(totalGoals),
    a: poissonQuantilesApprox(totalAssists),
    pts: poissonQuantilesApprox(totalPoints),
    sog: poissonQuantilesApprox(totalShots),
    ppp: poissonQuantilesApprox(totalPpp)
  };
}

export function buildTeamUncertainty(u: {
  toiEsSeconds: number;
  toiPpSeconds: number;
  shotsEs: number;
  shotsPp: number;
  goalsEs: number;
  goalsPp: number;
}) {
  return {
    toi_es_seconds: normalBandQuantiles(u.toiEsSeconds, 0.03 * u.toiEsSeconds),
    toi_pp_seconds: normalBandQuantiles(u.toiPpSeconds, 0.08 * u.toiPpSeconds),
    shots_es: poissonQuantilesApprox(u.shotsEs),
    shots_pp: poissonQuantilesApprox(u.shotsPp),
    goals_es: poissonQuantilesApprox(u.goalsEs),
    goals_pp: poissonQuantilesApprox(u.goalsPp)
  };
}

export function buildGoalieUncertainty(u: {
  shotsAgainst: number;
  goalsAllowed: number;
  saves: number;
}) {
  return {
    shots_against: poissonQuantilesApprox(u.shotsAgainst),
    goals_allowed: poissonQuantilesApprox(u.goalsAllowed),
    saves: poissonQuantilesApprox(u.saves)
  };
}
