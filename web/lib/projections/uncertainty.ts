import {
  getDispersionFit,
  resolveDispersionAlpha,
  type DispersionStat,
  type ResolveDispersionOptions
} from "./dispersion";

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
  trendVolatilityMultiplier = 1,
  countModel?: CountModelOptions
) {
  const effectiveHorizon = Math.max(1, Math.floor(horizonGames));
  const scalars =
    perGameScalars?.length === effectiveHorizon
      ? perGameScalars
      : Array.from({ length: effectiveHorizon }, () => 1);
  const samples = UNCERTAINTY_CONFIG.simulationSamples;
  const totalScalar = scalars.reduce((acc, v) => acc + v, 0);
  const useNb = countModel?.negativeBinomial === true;
  const simToiCv = playerToiCv(u.toiEsSeconds, u.toiPpSeconds);
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

      // NB: one gamma multiplier shared by ES and PP shots keeps total SOG NB(mu, alpha).
      const shotsAlpha = useNb
        ? normalizeAlpha(
            simulationAlpha("sog", countModel?.position, shotsEsMean + shotsPpMean, simToiCv)
          )
        : 0;
      const shotsMultiplier = shotsAlpha > 0 ? sampleGammaMeanOne(1 / shotsAlpha, rand) : 1;
      const shotsEs = samplePoisson(shotsEsMean * shotsMultiplier, rand);
      const shotsPp = samplePoisson(shotsPpMean * shotsMultiplier, rand);
      const goalsEs = samplePoisson(goalsEsMean, rand);
      const goalsPp = samplePoisson(goalsPpMean, rand);
      const assistsEs = samplePoisson(assistsEsMean, rand);
      const assistsPp = samplePoisson(assistsPpMean, rand);

      const hitsMean = Math.max(0, u.hits) * scalar * toiScale;
      const blocksMean = Math.max(0, u.blocks) * scalar * toiScale;
      const hits = useNb
        ? sampleNegativeBinomial(
            hitsMean,
            simulationAlpha("hit", countModel?.position, hitsMean, simToiCv),
            rand
          )
        : samplePoisson(hitsMean, rand);
      const blocks = useNb
        ? sampleNegativeBinomial(
            blocksMean,
            simulationAlpha("blk", countModel?.position, blocksMean, simToiCv),
            rand
          )
        : samplePoisson(blocksMean, rand);

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
  }>,
  countModel?: CountModelOptions
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
      const shots =
        countModel?.negativeBinomial === true
          ? sampleNegativeBinomial(
              shotsMean,
              resolveDispersionAlpha("sa", countModel.position ?? "G", shotsMean),
              rand
            )
          : samplePoisson(shotsMean, rand);
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

// ---------------------------------------------------------------------------
// Count distributions: negative binomial with Poisson fallback (tasks 8.1/8.2).
// alpha is the NB2 dispersion (Var = mu + alpha * mu^2); alpha null/0 = Poisson.
// Fitted alphas come from ./dispersion (resolveDispersionAlpha).
// ---------------------------------------------------------------------------

const NB_MIN_ALPHA = 1e-9;

/**
 * Opt-in count model for buildPlayerUncertainty / buildGoalieUncertainty.
 * Default (omitted) keeps the legacy Poisson draws.
 */
export type CountModelOptions = {
  /** Draw SOG/hits/blocks (skaters) or shots against (goalies) from the fitted NB. */
  negativeBinomial?: boolean;
  /** F/C/L/R/D/G; unknown positions fall back to Poisson. */
  position?: string | null;
};

/**
 * Per-game alpha inside the simulation, where TOI is already drawn with CV
 * `simToiCv`: the TOI-conditional fit compounded with whatever empirical TOI
 * variance (fit.toiCv2) the simulated TOI noise does not cover.
 */
function simulationAlpha(
  stat: DispersionStat,
  position: string | null | undefined,
  perGameMean: number,
  simToiCv: number
): number | null {
  const fit = getDispersionFit(stat, position);
  if (!fit) return null;
  const residualCv = Math.sqrt(Math.max(0, fit.toiCv2 - simToiCv * simToiCv));
  return resolveDispersionAlpha(stat, position, perGameMean, { toiCv: residualCv });
}
const COUNT_TAIL_EPS = 1e-12;
const COUNT_MAX_SUPPORT = 20000;

function normalizeAlpha(alpha: number | null | undefined): number {
  if (alpha == null || !Number.isFinite(alpha) || alpha < NB_MIN_ALPHA) return 0;
  return alpha;
}

/** Probability mass over 0..K, truncated once the remaining tail is below 1e-12. */
export function countPmf(mean: number, alpha?: number | null): number[] {
  const mu = clampNonNegative(mean);
  if (mu === 0) return [1];
  const a = normalizeAlpha(alpha);
  const r = a > 0 ? 1 / a : Infinity;
  // log P(0) and the log ratio P(k+1)/P(k).
  let logP = a > 0 ? -r * Math.log1p(mu / r) : -mu;
  const logQ = a > 0 ? Math.log(mu / (r + mu)) : Math.log(mu);
  const pmf: number[] = [];
  let cumulative = 0;
  for (let k = 0; k < COUNT_MAX_SUPPORT; k += 1) {
    const p = Math.exp(logP);
    pmf.push(p);
    cumulative += p;
    if (k >= mu && 1 - cumulative < COUNT_TAIL_EPS) break;
    logP += a > 0 ? Math.log((k + r) / (k + 1)) + logQ : logQ - Math.log(k + 1);
  }
  return pmf;
}

export function countVariance(mean: number, alpha?: number | null): number {
  const mu = clampNonNegative(mean);
  return mu + normalizeAlpha(alpha) * mu * mu;
}

/** P(X <= k). */
export function countCdf(k: number, mean: number, alpha?: number | null): number {
  if (!Number.isFinite(k) || k < 0) return 0;
  const pmf = countPmf(mean, alpha);
  const upper = Math.min(Math.floor(k), pmf.length - 1);
  let total = 0;
  for (let i = 0; i <= upper; i += 1) total += pmf[i];
  return Math.min(1, total);
}

/** P(X >= k). */
export function countProbabilityAtLeast(
  k: number,
  mean: number,
  alpha?: number | null
): number {
  if (!Number.isFinite(k) || k <= 0) return 1;
  return Math.max(0, 1 - countCdf(Math.ceil(k) - 1, mean, alpha));
}

/** Smallest integer k with P(X <= k) >= p. */
export function countQuantile(p: number, mean: number, alpha?: number | null): number {
  const pmf = countPmf(mean, alpha);
  const target = Math.max(0, Math.min(1, p));
  let total = 0;
  for (let k = 0; k < pmf.length; k += 1) {
    total += pmf[k];
    if (total >= target - 1e-12) return k;
  }
  return pmf.length - 1;
}

export type CountDistributionSummary = {
  mean: number;
  /** NB dispersion used; 0 means Poisson. */
  alpha: number;
  model: "negative_binomial" | "poisson";
  variance: number;
  /** P(X >= k) keyed by k. */
  pAtLeast: Record<number, number>;
  quantiles: { p10: number; p50: number; p90: number };
};

export function summarizeCountDistribution(
  mean: number,
  alpha?: number | null,
  atLeast: number[] = [1, 2, 3, 4, 5]
): CountDistributionSummary {
  const mu = clampNonNegative(mean);
  const a = normalizeAlpha(alpha);
  const pmf = countPmf(mu, a);
  const cdf: number[] = [];
  pmf.reduce((acc, p, k) => (cdf[k] = acc + p), 0);
  const cdfAt = (k: number) => (k < 0 ? 0 : Math.min(1, cdf[Math.min(k, cdf.length - 1)]));
  const quantileAt = (p: number) => {
    const k = cdf.findIndex((c) => c >= p - 1e-12);
    return k < 0 ? cdf.length - 1 : k;
  };
  const pAtLeast: Record<number, number> = {};
  for (const k of atLeast) {
    if (!Number.isFinite(k)) continue;
    const kk = Math.max(0, Math.ceil(k));
    pAtLeast[kk] = round6(kk === 0 ? 1 : Math.max(0, 1 - cdfAt(kk - 1)));
  }
  return {
    mean: round3(mu),
    alpha: round6(a),
    model: a > 0 ? "negative_binomial" : "poisson",
    variance: round3(countVariance(mu, a)),
    pAtLeast,
    quantiles: { p10: quantileAt(0.1), p50: quantileAt(0.5), p90: quantileAt(0.9) }
  };
}

function round6(n: number): number {
  return Number(n.toFixed(6));
}

export type StatDistributionOptions = ResolveDispersionOptions & {
  /** Overrides the fitted alpha (null forces Poisson). */
  alphaOverride?: number | null;
  atLeast?: number[];
};

function statAlpha(
  stat: DispersionStat,
  position: string | null | undefined,
  mean: number,
  options: StatDistributionOptions
): number | null {
  if (options.alphaOverride !== undefined) return options.alphaOverride;
  return resolveDispersionAlpha(stat, position, mean, options);
}

/** Mean, P(X >= k) and quantiles for a projected stat total; Poisson when no alpha is fitted. */
export function summarizeStatDistribution(
  stat: DispersionStat,
  position: string | null | undefined,
  mean: number,
  options: StatDistributionOptions = {}
): CountDistributionSummary {
  return summarizeCountDistribution(
    mean,
    statAlpha(stat, position, mean, options),
    options.atLeast
  );
}

export type OverUnderPush = { over: number; under: number; push: number };

/** Over = X > line, under = X < line, push = X == line (integer lines only). */
export function overUnderPushProbabilities(
  mean: number,
  alpha: number | null | undefined,
  line: number
): OverUnderPush {
  if (!Number.isFinite(line)) return { over: 0, under: 0, push: 0 };
  if (line < 0) return { over: 1, under: 0, push: 0 };
  const pmf = countPmf(mean, alpha);
  const pAt = (k: number) => (k >= 0 && k < pmf.length ? pmf[k] : 0);
  let cdfFloor = 0;
  for (let k = 0; k <= Math.min(Math.floor(line), pmf.length - 1); k += 1) cdfFloor += pmf[k];
  cdfFloor = Math.min(1, cdfFloor);
  const isInteger = Math.abs(line - Math.round(line)) < 1e-9;
  const push = isInteger ? pAt(Math.round(line)) : 0;
  return {
    over: Math.max(0, 1 - cdfFloor),
    under: Math.max(0, cdfFloor - push),
    push
  };
}

/**
 * P(over `line`) for a projected stat total, e.g. P(SOG > 2.5). Integer lines
 * exclude the push (X == line); divide by (over + under) for a no-push price.
 * Falls back to Poisson when no dispersion is fitted for (stat, position).
 */
export function probabilityOverLine(
  stat: DispersionStat,
  position: string | null | undefined,
  mean: number,
  line: number,
  options: StatDistributionOptions = {}
): number {
  return overUnderPushProbabilities(mean, statAlpha(stat, position, mean, options), line).over;
}

/** Per-game TOI CV implied by the ES/PP TOI noise used in buildPlayerUncertainty. */
export function playerToiCv(
  toiEsSeconds: number,
  toiPpSeconds: number,
  esSdPct: number = UNCERTAINTY_CONFIG.playerEsToiSdPct,
  ppSdPct: number = UNCERTAINTY_CONFIG.playerPpToiSdPct
): number {
  const es = clampNonNegative(toiEsSeconds);
  const pp = clampNonNegative(toiPpSeconds);
  const total = es + pp;
  if (total <= 0) return 0;
  return Math.sqrt((es * esSdPct) ** 2 + (pp * ppSdPct) ** 2) / total;
}

/** Gamma(shape, scale = 1/shape) multiplier with mean 1 and variance 1/shape (Marsaglia-Tsang). */
function sampleGammaMeanOne(shape: number, rand: () => number): number {
  if (!Number.isFinite(shape) || shape <= 0) return 1;
  if (shape < 1) {
    const u = Math.max(rand(), 1e-12);
    return sampleGammaMeanOne(shape + 1, rand) * ((shape + 1) / shape) * u ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let i = 0; i < 100; i += 1) {
    const x = sampleNormal(0, 1, rand);
    const v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = Math.max(rand(), 1e-12);
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return (d * v) / shape;
  }
  return 1;
}

/** Gamma-Poisson draw: X ~ NB(mean, alpha); alpha 0/null draws Poisson. */
export function sampleNegativeBinomial(
  mean: number,
  alpha: number | null | undefined,
  rand: () => number
): number {
  const a = normalizeAlpha(alpha);
  if (a === 0) return samplePoisson(mean, rand);
  return samplePoisson(clampNonNegative(mean) * sampleGammaMeanOne(1 / a, rand), rand);
}
