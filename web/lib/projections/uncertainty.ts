const Z_P10 = -1.2815515655446004;
const Z_P90 = 1.2815515655446004;

export const UNCERTAINTY_CONFIG = {
  // Team opportunity noise (minutes + shots) as proportional SDs.
  teamToiSdPct: 0.03,
  teamPpToiSdPct: 0.08,
  // Player usage/share noise (TOI) as proportional SDs.
  playerEsToiSdPct: 0.1,
  playerPpToiSdPct: 0.15,
  // Conversion noise is modeled via Poisson around mean rates.
  conversionModel: "poisson",
  // Goalie scenario noise (shots/GA/saves) as Poisson around mean.
  goalieModel: "poisson",
  simulationSamples: 400
} as const;

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function round3(n: number): number {
  return Number(n.toFixed(3));
}

function seedFromValues(values: number[]): number {
  let h = 2166136261;
  for (const v of values) {
    const n = Math.round((Number.isFinite(v) ? v : 0) * 1000);
    h ^= n;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleNormal(mean: number, sd: number, rand: () => number): number {
  if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) return mean;
  const u = Math.max(rand(), 1e-12);
  const v = Math.max(rand(), 1e-12);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * sd;
}

function samplePoisson(lambda: number, rand: () => number): number {
  const l = clampNonNegative(lambda);
  if (l === 0) return 0;
  if (l < 30) {
    const L = Math.exp(-l);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= rand();
    } while (p > L);
    return k - 1;
  }
  const normal = sampleNormal(l, Math.sqrt(l), rand);
  return Math.max(0, Math.round(normal));
}

function quantilesFromSamples(samples: number[]): {
  p10: number;
  p50: number;
  p90: number;
} {
  if (samples.length === 0) return { p10: 0, p50: 0, p90: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = (p: number) =>
    Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
  return {
    p10: round3(sorted[idx(0.1)]),
    p50: round3(sorted[idx(0.5)]),
    p90: round3(sorted[idx(0.9)])
  };
}

type QuantileTriple = {
  p10: number;
  p50: number;
  p90: number;
};

function widenQuantiles(q: QuantileTriple, spreadMultiplier: number): QuantileTriple {
  const mult = Math.max(0.75, Math.min(1.8, spreadMultiplier));
  if (Math.abs(mult - 1) < 1e-6) return q;
  const lowSpread = Math.max(0, q.p50 - q.p10);
  const highSpread = Math.max(0, q.p90 - q.p50);
  const p10 = clampNonNegative(q.p50 - lowSpread * mult);
  const p90 = Math.max(q.p50, q.p50 + highSpread * mult);
  return {
    p10: round3(p10),
    p50: round3(q.p50),
    p90: round3(p90)
  };
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

export function buildPlayerUncertainty(
  u: PlayerUncertaintyInput,
  horizonGames = 1,
  perGameScalars?: number[],
  scenarioMixture?: Array<{
    weight: number;
    goalsEs?: number;
    goalsPp?: number;
    assistsEs?: number;
    assistsPp?: number;
    shotsEs?: number;
    shotsPp?: number;
  }>,
  trendVolatilityMultiplier = 1
) {
  const effectiveHorizon = Math.max(1, Math.floor(horizonGames));
  const scalars =
    perGameScalars?.length === effectiveHorizon
      ? perGameScalars
      : Array.from({ length: effectiveHorizon }, () => 1);
  const samples = UNCERTAINTY_CONFIG.simulationSamples;
  const totalScalar = scalars.reduce((acc, v) => acc + v, 0);
  const volatilityMultiplier = Math.max(
    0.75,
    Math.min(1.8, trendVolatilityMultiplier)
  );
  const applyVolatility = (q: QuantileTriple) =>
    widenQuantiles(q, volatilityMultiplier);
  if (samples <= 1) {
    return {
      toi_es_seconds: applyVolatility(
        normalBandQuantiles(
          u.toiEsSeconds * totalScalar,
          UNCERTAINTY_CONFIG.playerEsToiSdPct *
            u.toiEsSeconds *
            Math.sqrt(totalScalar)
        )
      ),
      toi_pp_seconds: applyVolatility(
        normalBandQuantiles(
          u.toiPpSeconds * totalScalar,
          UNCERTAINTY_CONFIG.playerPpToiSdPct *
            u.toiPpSeconds *
            Math.sqrt(totalScalar)
        )
      ),
      shots_es: applyVolatility(poissonQuantilesApprox(u.shotsEs * totalScalar)),
      shots_pp: applyVolatility(poissonQuantilesApprox(u.shotsPp * totalScalar)),
      goals_es: applyVolatility(poissonQuantilesApprox(u.goalsEs * totalScalar)),
      goals_pp: applyVolatility(poissonQuantilesApprox(u.goalsPp * totalScalar)),
      assists_es: applyVolatility(
        poissonQuantilesApprox(u.assistsEs * totalScalar)
      ),
      assists_pp: applyVolatility(
        poissonQuantilesApprox(u.assistsPp * totalScalar)
      ),
      hit: applyVolatility(poissonQuantilesApprox(u.hits * totalScalar)),
      blk: applyVolatility(poissonQuantilesApprox(u.blocks * totalScalar)),
      g: applyVolatility(
        poissonQuantilesApprox((u.goalsEs + u.goalsPp) * totalScalar)
      ),
      a: applyVolatility(
        poissonQuantilesApprox((u.assistsEs + u.assistsPp) * totalScalar)
      ),
      pts: applyVolatility(
        poissonQuantilesApprox(
          (u.goalsEs + u.goalsPp + u.assistsEs + u.assistsPp) * totalScalar
        )
      ),
      sog: applyVolatility(
        poissonQuantilesApprox((u.shotsEs + u.shotsPp) * totalScalar)
      ),
      ppp: applyVolatility(
        poissonQuantilesApprox((u.goalsPp + u.assistsPp) * totalScalar)
      )
    };
  }

  const rand = createRng(
    seedFromValues([
      u.toiEsSeconds,
      u.toiPpSeconds,
      u.shotsEs,
      u.shotsPp,
      u.goalsEs,
      u.goalsPp,
      u.assistsEs,
      u.assistsPp,
      u.hits,
      u.blocks,
      ...(scenarioMixture ?? []).flatMap((s) => [
        s.weight,
        s.goalsEs ?? 0,
        s.goalsPp ?? 0,
        s.assistsEs ?? 0,
        s.assistsPp ?? 0,
        s.shotsEs ?? 0,
        s.shotsPp ?? 0
      ])
    ])
  );

  const baseToiTotal = Math.max(1e-6, u.toiEsSeconds + u.toiPpSeconds);
  const baseShotsEs = Math.max(0, u.shotsEs);
  const baseShotsPp = Math.max(0, u.shotsPp);
  const baseGoalsEs = Math.max(0, u.goalsEs);
  const baseGoalsPp = Math.max(0, u.goalsPp);
  const baseAssistsEs = Math.max(0, u.assistsEs);
  const baseAssistsPp = Math.max(0, u.assistsPp);
  const validMixture =
    scenarioMixture
      ?.map((s) => ({
        weight: clampNonNegative(s.weight),
        goalsEs: Math.max(0, s.goalsEs ?? baseGoalsEs),
        goalsPp: Math.max(0, s.goalsPp ?? baseGoalsPp),
        assistsEs: Math.max(0, s.assistsEs ?? baseAssistsEs),
        assistsPp: Math.max(0, s.assistsPp ?? baseAssistsPp),
        shotsEs: Math.max(0, s.shotsEs ?? baseShotsEs),
        shotsPp: Math.max(0, s.shotsPp ?? baseShotsPp)
      }))
      .filter((s) => s.weight > 0) ?? [];
  const mixtureWeightTotal = validMixture.reduce((sum, s) => sum + s.weight, 0);
  const normalizedMixture =
    mixtureWeightTotal > 0
      ? validMixture.map((s) => ({
          ...s,
          weight: s.weight / mixtureWeightTotal
        }))
      : [];

  const samplesToiEs: number[] = [];
  const samplesToiPp: number[] = [];
  const samplesShotsEs: number[] = [];
  const samplesShotsPp: number[] = [];
  const samplesGoalsEs: number[] = [];
  const samplesGoalsPp: number[] = [];
  const samplesAssistsEs: number[] = [];
  const samplesAssistsPp: number[] = [];
  const samplesHits: number[] = [];
  const samplesBlocks: number[] = [];
  const samplesGoals: number[] = [];
  const samplesAssists: number[] = [];
  const samplesPoints: number[] = [];
  const samplesShots: number[] = [];
  const samplesPpp: number[] = [];

  for (let i = 0; i < samples; i += 1) {
    let totalToiEs = 0;
    let totalToiPp = 0;
    let totalShotsEs = 0;
    let totalShotsPp = 0;
    let totalGoalsEs = 0;
    let totalGoalsPp = 0;
    let totalAssistsEs = 0;
    let totalAssistsPp = 0;
    let totalHits = 0;
    let totalBlocks = 0;
    const sampledScenario = (() => {
      if (normalizedMixture.length === 0) return null;
      const r = rand();
      let cumulative = 0;
      for (const s of normalizedMixture) {
        cumulative += s.weight;
        if (r <= cumulative) return s;
      }
      return normalizedMixture[normalizedMixture.length - 1] ?? null;
    })();
    const scenarioShotsEs = sampledScenario?.shotsEs ?? baseShotsEs;
    const scenarioShotsPp = sampledScenario?.shotsPp ?? baseShotsPp;
    const scenarioGoalsEs = sampledScenario?.goalsEs ?? baseGoalsEs;
    const scenarioGoalsPp = sampledScenario?.goalsPp ?? baseGoalsPp;
    const scenarioAssistsEs = sampledScenario?.assistsEs ?? baseAssistsEs;
    const scenarioAssistsPp = sampledScenario?.assistsPp ?? baseAssistsPp;

    for (let g = 0; g < effectiveHorizon; g += 1) {
      const scalar = scalars[g] ?? 1;
      const toiEs = Math.max(
        0,
        sampleNormal(
          u.toiEsSeconds * scalar,
          UNCERTAINTY_CONFIG.playerEsToiSdPct * u.toiEsSeconds * scalar,
          rand
        )
      );
      const toiPp = Math.max(
        0,
        sampleNormal(
          u.toiPpSeconds * scalar,
          UNCERTAINTY_CONFIG.playerPpToiSdPct * u.toiPpSeconds * scalar,
          rand
        )
      );
      const baseToiScaled = baseToiTotal * scalar;
      const toiScale =
        baseToiScaled > 0 ? (toiEs + toiPp) / baseToiScaled : 1;

      const shotsEsMean = scenarioShotsEs * scalar * toiScale;
      const shotsPpMean = scenarioShotsPp * scalar * toiScale;
      const goalsEsMean =
        scenarioShotsEs > 0
          ? scenarioGoalsEs * scalar * (shotsEsMean / (scenarioShotsEs * scalar))
          : 0;
      const goalsPpMean =
        scenarioShotsPp > 0
          ? scenarioGoalsPp * scalar * (shotsPpMean / (scenarioShotsPp * scalar))
          : 0;
      const assistsEsMean =
        scenarioGoalsEs > 0
          ? scenarioAssistsEs * scalar * (goalsEsMean / (scenarioGoalsEs * scalar))
          : 0;
      const assistsPpMean =
        scenarioGoalsPp > 0
          ? scenarioAssistsPp * scalar * (goalsPpMean / (scenarioGoalsPp * scalar))
          : 0;

      const shotsEs = samplePoisson(shotsEsMean, rand);
      const shotsPp = samplePoisson(shotsPpMean, rand);
      const goalsEs = samplePoisson(goalsEsMean, rand);
      const goalsPp = samplePoisson(goalsPpMean, rand);
      const assistsEs = samplePoisson(assistsEsMean, rand);
      const assistsPp = samplePoisson(assistsPpMean, rand);

      const hitsMean = Math.max(0, u.hits) * scalar * toiScale;
      const blocksMean = Math.max(0, u.blocks) * scalar * toiScale;
      const hits = samplePoisson(hitsMean, rand);
      const blocks = samplePoisson(blocksMean, rand);

      totalToiEs += toiEs;
      totalToiPp += toiPp;
      totalShotsEs += shotsEs;
      totalShotsPp += shotsPp;
      totalGoalsEs += goalsEs;
      totalGoalsPp += goalsPp;
      totalAssistsEs += assistsEs;
      totalAssistsPp += assistsPp;
      totalHits += hits;
      totalBlocks += blocks;
    }

    const totalGoals = totalGoalsEs + totalGoalsPp;
    const totalAssists = totalAssistsEs + totalAssistsPp;
    const totalPoints = totalGoals + totalAssists;
    const totalShots = totalShotsEs + totalShotsPp;
    const totalPpp = totalGoalsPp + totalAssistsPp;

    samplesToiEs.push(totalToiEs);
    samplesToiPp.push(totalToiPp);
    samplesShotsEs.push(totalShotsEs);
    samplesShotsPp.push(totalShotsPp);
    samplesGoalsEs.push(totalGoalsEs);
    samplesGoalsPp.push(totalGoalsPp);
    samplesAssistsEs.push(totalAssistsEs);
    samplesAssistsPp.push(totalAssistsPp);
    samplesHits.push(totalHits);
    samplesBlocks.push(totalBlocks);
    samplesGoals.push(totalGoals);
    samplesAssists.push(totalAssists);
    samplesPoints.push(totalPoints);
    samplesShots.push(totalShots);
    samplesPpp.push(totalPpp);
  }

  return {
    toi_es_seconds: applyVolatility(quantilesFromSamples(samplesToiEs)),
    toi_pp_seconds: applyVolatility(quantilesFromSamples(samplesToiPp)),
    shots_es: applyVolatility(quantilesFromSamples(samplesShotsEs)),
    shots_pp: applyVolatility(quantilesFromSamples(samplesShotsPp)),
    goals_es: applyVolatility(quantilesFromSamples(samplesGoalsEs)),
    goals_pp: applyVolatility(quantilesFromSamples(samplesGoalsPp)),
    assists_es: applyVolatility(quantilesFromSamples(samplesAssistsEs)),
    assists_pp: applyVolatility(quantilesFromSamples(samplesAssistsPp)),
    hit: applyVolatility(quantilesFromSamples(samplesHits)),
    blk: applyVolatility(quantilesFromSamples(samplesBlocks)),
    g: applyVolatility(quantilesFromSamples(samplesGoals)),
    a: applyVolatility(quantilesFromSamples(samplesAssists)),
    pts: applyVolatility(quantilesFromSamples(samplesPoints)),
    sog: applyVolatility(quantilesFromSamples(samplesShots)),
    ppp: applyVolatility(quantilesFromSamples(samplesPpp))
  };
}

export function buildTeamUncertainty(
  u: {
  toiEsSeconds: number;
  toiPpSeconds: number;
  shotsEs: number;
  shotsPp: number;
  goalsEs: number;
  goalsPp: number;
  },
  horizonGames = 1,
  perGameScalars?: number[]
) {
  const effectiveHorizon = Math.max(1, Math.floor(horizonGames));
  const scalars =
    perGameScalars?.length === effectiveHorizon
      ? perGameScalars
      : Array.from({ length: effectiveHorizon }, () => 1);
  const samples = UNCERTAINTY_CONFIG.simulationSamples;
  const totalScalar = scalars.reduce((acc, v) => acc + v, 0);
  if (samples <= 1) {
    return {
      toi_es_seconds: normalBandQuantiles(
        u.toiEsSeconds * totalScalar,
        UNCERTAINTY_CONFIG.teamToiSdPct *
          u.toiEsSeconds *
          Math.sqrt(totalScalar)
      ),
      toi_pp_seconds: normalBandQuantiles(
        u.toiPpSeconds * totalScalar,
        UNCERTAINTY_CONFIG.teamPpToiSdPct *
          u.toiPpSeconds *
          Math.sqrt(totalScalar)
      ),
      shots_es: poissonQuantilesApprox(u.shotsEs * totalScalar),
      shots_pp: poissonQuantilesApprox(u.shotsPp * totalScalar),
      goals_es: poissonQuantilesApprox(u.goalsEs * totalScalar),
      goals_pp: poissonQuantilesApprox(u.goalsPp * totalScalar)
    };
  }

  const rand = createRng(
    seedFromValues([
      u.toiEsSeconds,
      u.toiPpSeconds,
      u.shotsEs,
      u.shotsPp,
      u.goalsEs,
      u.goalsPp
    ])
  );

  const baseToiTotal = Math.max(1e-6, u.toiEsSeconds + u.toiPpSeconds);
  const baseShotsEs = Math.max(0, u.shotsEs);
  const baseShotsPp = Math.max(0, u.shotsPp);
  const baseGoalsEs = Math.max(0, u.goalsEs);
  const baseGoalsPp = Math.max(0, u.goalsPp);

  const samplesToiEs: number[] = [];
  const samplesToiPp: number[] = [];
  const samplesShotsEs: number[] = [];
  const samplesShotsPp: number[] = [];
  const samplesGoalsEs: number[] = [];
  const samplesGoalsPp: number[] = [];

  for (let i = 0; i < samples; i += 1) {
    let totalToiEs = 0;
    let totalToiPp = 0;
    let totalShotsEs = 0;
    let totalShotsPp = 0;
    let totalGoalsEs = 0;
    let totalGoalsPp = 0;

    for (let g = 0; g < effectiveHorizon; g += 1) {
      const scalar = scalars[g] ?? 1;
      const toiEs = Math.max(
        0,
        sampleNormal(
          u.toiEsSeconds * scalar,
          UNCERTAINTY_CONFIG.teamToiSdPct * u.toiEsSeconds * scalar,
          rand
        )
      );
      const toiPp = Math.max(
        0,
        sampleNormal(
          u.toiPpSeconds * scalar,
          UNCERTAINTY_CONFIG.teamPpToiSdPct * u.toiPpSeconds * scalar,
          rand
        )
      );
      const baseToiScaled = baseToiTotal * scalar;
      const toiScale =
        baseToiScaled > 0 ? (toiEs + toiPp) / baseToiScaled : 1;

      const shotsEsMean = baseShotsEs * scalar * toiScale;
      const shotsPpMean = baseShotsPp * scalar * toiScale;
      const goalsEsMean =
        baseShotsEs > 0 ? baseGoalsEs * scalar * (shotsEsMean / (baseShotsEs * scalar)) : 0;
      const goalsPpMean =
        baseShotsPp > 0 ? baseGoalsPp * scalar * (shotsPpMean / (baseShotsPp * scalar)) : 0;

      const shotsEs = samplePoisson(shotsEsMean, rand);
      const shotsPp = samplePoisson(shotsPpMean, rand);
      const goalsEs = samplePoisson(goalsEsMean, rand);
      const goalsPp = samplePoisson(goalsPpMean, rand);

      totalToiEs += toiEs;
      totalToiPp += toiPp;
      totalShotsEs += shotsEs;
      totalShotsPp += shotsPp;
      totalGoalsEs += goalsEs;
      totalGoalsPp += goalsPp;
    }

    samplesToiEs.push(totalToiEs);
    samplesToiPp.push(totalToiPp);
    samplesShotsEs.push(totalShotsEs);
    samplesShotsPp.push(totalShotsPp);
    samplesGoalsEs.push(totalGoalsEs);
    samplesGoalsPp.push(totalGoalsPp);
  }

  return {
    toi_es_seconds: quantilesFromSamples(samplesToiEs),
    toi_pp_seconds: quantilesFromSamples(samplesToiPp),
    shots_es: quantilesFromSamples(samplesShotsEs),
    shots_pp: quantilesFromSamples(samplesShotsPp),
    goals_es: quantilesFromSamples(samplesGoalsEs),
    goals_pp: quantilesFromSamples(samplesGoalsPp)
  };
}

export function buildGoalieUncertainty(
  u: {
    shotsAgainst: number;
    goalsAllowed: number;
    saves: number;
  },
  horizonGames = 1,
  perGameScalars?: number[],
  scenarioMixture?: Array<{
    weight: number;
    shotsAgainst: number;
    goalsAllowed: number;
    saves: number;
  }>
) {
  const effectiveHorizon = Math.max(1, Math.floor(horizonGames));
  const scalars =
    perGameScalars?.length === effectiveHorizon
      ? perGameScalars
      : Array.from({ length: effectiveHorizon }, () => 1);
  const samples = UNCERTAINTY_CONFIG.simulationSamples;
  const totalScalar = scalars.reduce((acc, v) => acc + v, 0);
  if (samples <= 1) {
    return {
      shots_against: poissonQuantilesApprox(u.shotsAgainst * totalScalar),
      goals_allowed: poissonQuantilesApprox(u.goalsAllowed * totalScalar),
      saves: poissonQuantilesApprox(u.saves * totalScalar)
    };
  }

  const rand = createRng(
    seedFromValues([
      u.shotsAgainst,
      u.goalsAllowed,
      u.saves,
      ...(scenarioMixture ?? []).flatMap((s) => [
        s.weight,
        s.shotsAgainst,
        s.goalsAllowed,
        s.saves
      ])
    ])
  );
  const baseShots = Math.max(0, u.shotsAgainst);
  const baseGoals = Math.max(0, u.goalsAllowed);
  const baseSaves = Math.max(0, u.saves);
  const validMixture =
    scenarioMixture
      ?.map((s) => ({
        weight: clampNonNegative(s.weight),
        shotsAgainst: Math.max(0, s.shotsAgainst),
        goalsAllowed: Math.max(0, s.goalsAllowed),
        saves: Math.max(0, s.saves)
      }))
      .filter((s) => s.weight > 0) ?? [];
  const mixtureWeightTotal = validMixture.reduce((sum, s) => sum + s.weight, 0);
  const normalizedMixture =
    mixtureWeightTotal > 0
      ? validMixture.map((s) => ({
          ...s,
          weight: s.weight / mixtureWeightTotal
        }))
      : [];

  const samplesShots: number[] = [];
  const samplesGoals: number[] = [];
  const samplesSaves: number[] = [];

  for (let i = 0; i < samples; i += 1) {
    let totalShots = 0;
    let totalGoals = 0;
    let totalSaves = 0;
    const sampledScenario = (() => {
      if (normalizedMixture.length === 0) return null;
      const r = rand();
      let cumulative = 0;
      for (const s of normalizedMixture) {
        cumulative += s.weight;
        if (r <= cumulative) return s;
      }
      return normalizedMixture[normalizedMixture.length - 1] ?? null;
    })();
    const scenarioShots = sampledScenario?.shotsAgainst ?? baseShots;
    const scenarioGoals = sampledScenario?.goalsAllowed ?? baseGoals;
    const scenarioSaves = sampledScenario?.saves ?? baseSaves;

    for (let g = 0; g < effectiveHorizon; g += 1) {
      const scalar = scalars[g] ?? 1;
      const shotsMean = scenarioShots * scalar;
      const shots = samplePoisson(shotsMean, rand);
      const baseShotsScaled = scenarioShots * scalar;
      const goalsMean =
        baseShotsScaled > 0
          ? scenarioGoals * scalar * (shots / baseShotsScaled)
          : scenarioGoals * scalar;
      const goals = samplePoisson(goalsMean, rand);
      const saves = Math.max(0, shots - goals);

      totalShots += shots;
      totalGoals += goals;
      totalSaves += scenarioSaves > 0 ? saves : Math.max(0, shots - goals);
    }

    samplesShots.push(totalShots);
    samplesGoals.push(totalGoals);
    samplesSaves.push(totalSaves);
  }

  return {
    shots_against: quantilesFromSamples(samplesShots),
    goals_allowed: quantilesFromSamples(samplesGoals),
    saves: quantilesFromSamples(samplesSaves)
  };
}
