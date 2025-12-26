export type Strength = "es" | "pp";

export type TeamStrengthTargets = {
  toiEsSeconds: number;
  toiPpSeconds: number;
  shotsEs: number;
  shotsPp: number;
};

export type PlayerStrengthProjection = {
  playerId: number;
  toiEsSeconds: number;
  toiPpSeconds: number;
  shotsEs: number;
  shotsPp: number;
};

export type ReconciliationReport = {
  toiEs: { target: number; before: number; after: number; scaleApplied: number | null };
  toiPp: { target: number; before: number; after: number; scaleApplied: number | null };
  shotsEs: { target: number; before: number; after: number; scaleApplied: number | null };
  shotsPp: { target: number; before: number; after: number; scaleApplied: number | null };
};

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function sum(nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

function reconcileIntegerTotalByWeight(opts: {
  targetTotal: number;
  weights: Array<{ key: number; weight: number }>;
}): Map<number, number> {
  const targetTotal = Math.round(clampNonNegative(opts.targetTotal));
  const weights = opts.weights.map((w) => ({
    key: w.key,
    weight: clampNonNegative(w.weight)
  }));

  const totalWeight = sum(weights.map((w) => w.weight));
  if (weights.length === 0) return new Map();

  const scaled = weights.map((w) => {
    const raw = totalWeight > 0 ? (w.weight / totalWeight) * targetTotal : targetTotal / weights.length;
    const floored = Math.floor(raw);
    return { key: w.key, raw, floored, frac: raw - floored };
  });

  let remainder = targetTotal - sum(scaled.map((s) => s.floored));
  if (remainder < 0) remainder = 0;

  scaled.sort((a, b) => (b.frac - a.frac) || (a.key - b.key));
  for (let i = 0; i < remainder; i++) {
    scaled[i % scaled.length].floored += 1;
  }

  const out = new Map<number, number>();
  for (const s of scaled) out.set(s.key, s.floored);
  return out;
}

function reconcileFloatTotalByWeight(opts: {
  targetTotal: number;
  values: Array<{ key: number; value: number }>;
  fallbackWeights: Array<{ key: number; weight: number }>;
}): { reconciled: Map<number, number>; scaleApplied: number | null } {
  const targetTotal = clampNonNegative(opts.targetTotal);
  const values = opts.values.map((v) => ({ key: v.key, value: clampNonNegative(v.value) }));

  if (values.length === 0) return { reconciled: new Map(), scaleApplied: null };

  const currentTotal = sum(values.map((v) => v.value));
  if (currentTotal > 0) {
    const scale = targetTotal / currentTotal;
    const out = new Map<number, number>();
    for (const v of values) out.set(v.key, v.value * scale);
    return { reconciled: out, scaleApplied: scale };
  }

  const weights = opts.fallbackWeights.map((w) => ({ key: w.key, weight: clampNonNegative(w.weight) }));
  const totalWeight = sum(weights.map((w) => w.weight));
  const out = new Map<number, number>();

  for (const v of values) {
    const w = weights.find((x) => x.key === v.key)?.weight ?? 0;
    const share = totalWeight > 0 ? w / totalWeight : 1 / values.length;
    out.set(v.key, share * targetTotal);
  }

  return { reconciled: out, scaleApplied: null };
}

export function reconcileTeamToPlayers(opts: {
  players: PlayerStrengthProjection[];
  targets: TeamStrengthTargets;
}): { players: PlayerStrengthProjection[]; report: ReconciliationReport } {
  const players = opts.players.map((p) => ({
    playerId: p.playerId,
    toiEsSeconds: clampNonNegative(p.toiEsSeconds),
    toiPpSeconds: clampNonNegative(p.toiPpSeconds),
    shotsEs: clampNonNegative(p.shotsEs),
    shotsPp: clampNonNegative(p.shotsPp)
  }));

  const toiEsBefore = sum(players.map((p) => p.toiEsSeconds));
  const toiPpBefore = sum(players.map((p) => p.toiPpSeconds));
  const shotsEsBefore = sum(players.map((p) => p.shotsEs));
  const shotsPpBefore = sum(players.map((p) => p.shotsPp));

  const toiEsTarget = Math.round(clampNonNegative(opts.targets.toiEsSeconds));
  const toiPpTarget = Math.round(clampNonNegative(opts.targets.toiPpSeconds));
  const shotsEsTarget = clampNonNegative(opts.targets.shotsEs);
  const shotsPpTarget = clampNonNegative(opts.targets.shotsPp);

  const esToi = reconcileIntegerTotalByWeight({
    targetTotal: toiEsTarget,
    weights: players.map((p) => ({ key: p.playerId, weight: p.toiEsSeconds }))
  });
  const ppToi = reconcileIntegerTotalByWeight({
    targetTotal: toiPpTarget,
    weights: players.map((p) => ({ key: p.playerId, weight: p.toiPpSeconds }))
  });

  for (const p of players) {
    p.toiEsSeconds = esToi.get(p.playerId) ?? 0;
    p.toiPpSeconds = ppToi.get(p.playerId) ?? 0;
  }

  const { reconciled: esShots, scaleApplied: esShotScale } = reconcileFloatTotalByWeight({
    targetTotal: shotsEsTarget,
    values: players.map((p) => ({ key: p.playerId, value: p.shotsEs })),
    fallbackWeights: players.map((p) => ({ key: p.playerId, weight: p.toiEsSeconds }))
  });
  const { reconciled: ppShots, scaleApplied: ppShotScale } = reconcileFloatTotalByWeight({
    targetTotal: shotsPpTarget,
    values: players.map((p) => ({ key: p.playerId, value: p.shotsPp })),
    fallbackWeights: players.map((p) => ({ key: p.playerId, weight: p.toiPpSeconds }))
  });

  for (const p of players) {
    p.shotsEs = esShots.get(p.playerId) ?? 0;
    p.shotsPp = ppShots.get(p.playerId) ?? 0;
  }

  const toiEsAfter = sum(players.map((p) => p.toiEsSeconds));
  const toiPpAfter = sum(players.map((p) => p.toiPpSeconds));
  const shotsEsAfter = sum(players.map((p) => p.shotsEs));
  const shotsPpAfter = sum(players.map((p) => p.shotsPp));

  return {
    players,
    report: {
      toiEs: {
        target: toiEsTarget,
        before: toiEsBefore,
        after: toiEsAfter,
        scaleApplied: toiEsBefore > 0 ? toiEsTarget / toiEsBefore : null
      },
      toiPp: {
        target: toiPpTarget,
        before: toiPpBefore,
        after: toiPpAfter,
        scaleApplied: toiPpBefore > 0 ? toiPpTarget / toiPpBefore : null
      },
      shotsEs: {
        target: shotsEsTarget,
        before: shotsEsBefore,
        after: shotsEsAfter,
        scaleApplied: esShotScale
      },
      shotsPp: {
        target: shotsPpTarget,
        before: shotsPpBefore,
        after: shotsPpAfter,
        scaleApplied: ppShotScale
      }
    }
  };
}

