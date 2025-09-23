// =============================
// /web/lib/trends/utils.ts
// =============================

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

export function zscore(x: number, m: number, s: number): number {
  if (s === 0) return 0;
  return (x - m) / s;
}

export function percentile(xs: number[], x: number): number {
  if (!xs.length) return 50;
  const sorted = [...xs].sort((a, b) => a - b);
  let idx = sorted.findIndex((v) => x <= v);
  if (idx === -1) idx = sorted.length - 1;
  return (idx / (sorted.length - 1)) * 100;
}

export function winsorize(xs: number[], p = 0.01): number[] {
  if (!xs.length) return xs;
  const sorted = [...xs].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * p)];
  const hi = sorted[Math.ceil(sorted.length * (1 - p)) - 1];
  return xs.map((x) => Math.min(Math.max(x, lo), hi));
}

export function pearson(x: number[], y: number[]): { r: number; r2: number } {
  if (x.length !== y.length) throw new Error("pearson: length mismatch");
  const n = x.length;
  if (n < 3) return { r: 0, r2: 0 };
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  const r = den === 0 ? 0 : num / den;
  return { r, r2: r * r };
}

export function linearRegression(x: number[], y: number[]) {
  if (x.length !== y.length) throw new Error("linreg: length mismatch");
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  const yhat = x.map((xi) => slope * xi + intercept);
  const { r2 } = pearson(y, yhat);
  return { slope, intercept, r2 };
}

export function scale01(x: number, min: number, max: number) {
  if (max === min) return 0.5;
  return (x - min) / (max - min);
}

export function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

// Luck components (signs chosen so higher = more luck / less sustainable)
export function computeLuck({
  goals,
  xg,
  onIceSH,
  pdo,
  ipp,
  ippBaseline
}: {
  goals?: number; // individual goals
  xg?: number; // individual expected goals
  onIceSH?: number; // team SH% while on ice
  pdo?: number; // on-ice
  ipp?: number; // individual points %
  ippBaseline?: number; // league-pos baseline
}) {
  const deltas: Record<string, number | undefined> = {};
  if (goals != null && xg != null) deltas.xG_minus_G = xg - goals; // + underperforming
  if (onIceSH != null) deltas.onIceSH_delta = onIceSH - 0.08; // 8% typical baseline ES
  if (pdo != null) deltas.PDO_delta = pdo - 1.0; // normalized 1.0 baseline
  if (ipp != null && ippBaseline != null) deltas.IPP_delta = ipp - ippBaseline;
  return deltas;
}

export function combineSKO({
  skillOffense01,
  skillDefense01,
  onIceImpact01,
  luckInflation01,
  weights = { skillOff: 0.45, skillDef: 0.25, onIce: 0.3, luck: 0.35 }
}: {
  skillOffense01: number;
  skillDefense01: number;
  onIceImpact01: number;
  luckInflation01: number; // 0..1 where higher => more luck
  weights?: { skillOff: number; skillDef: number; onIce: number; luck: number };
}) {
  const sustainable =
    weights.skillOff * skillOffense01 +
    weights.skillDef * skillDefense01 +
    weights.onIce * onIceImpact01 -
    weights.luck * luckInflation01; // subtract luck inflation
  const s01 = clamp01(sustainable);
  const to100 = (v: number) => Math.round(v * 100);
  return {
    skillOffense: to100(skillOffense01),
    skillDefense: to100(skillDefense01),
    onIceImpact: to100(onIceImpact01),
    luckInflation: to100(luckInflation01),
    sustainability: to100(s01)
  };
}

export function classifyRole({
  driverSignal,
  makerSignal,
  defenseSignal
}: {
  driverSignal: number; // z or 0..1
  makerSignal: number; // z or 0..1
  defenseSignal: number; // z or 0..1
}):
  | "Play Driver"
  | "Play Maker"
  | "Balanced"
  | "Two-Way"
  | "Defensive Specialist" {
  const d = driverSignal;
  const m = makerSignal;
  const df = defenseSignal;
  if (df > 0.8 && (d > 0.6 || m > 0.6)) return "Two-Way";
  if (d - m > 0.25) return "Play Driver";
  if (m - d > 0.25) return "Play Maker";
  if (df > 0.8) return "Defensive Specialist";
  return "Balanced";
}
