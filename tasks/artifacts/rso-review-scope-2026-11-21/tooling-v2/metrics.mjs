// FORGE-QUAL v2 metrics (forge-qual-scope-v2, protocol.bootstrap forge-qual-bootstrap-v1). Pure and offline.
//
// Arithmetic is pinned so a report re-derives bit for bit: IEEE-754 doubles, every sum taken over rows sorted by
// (gameId, playerId) ascending, squared errors written as w * (d * d) (never ** or Math.pow), and the unweighted point
// estimate computed by the same code with w = 1 (1 * x === x exactly).

import { createHash } from "node:crypto";

export const BOOTSTRAP_VERSION = "forge-qual-bootstrap-v1";
export const LOOK_IDS = { 1: "look1", final: "final" };
const MASK64 = (1n << 64n) - 1n;
const TWO64 = 1n << 64n;

// ---------------------------------------------------------------- RNG (protocol.bootstrap.rng)

/** splitmix64 (Steele, Lea and Flood 2014; Vigna's reference). Returns a function giving successive u64 BigInts. */
export function splitmix64(seed) {
  let state = BigInt.asUintN(64, BigInt(seed));
  return () => {
    state = (state + 0x9E3779B97F4A7C15n) & MASK64;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK64;
    return z ^ (z >> 31n);
  };
}

const rotl = (x, k) => ((x << k) | (x >> (64n - k))) & MASK64;

/** xoshiro256** (Blackman and Vigna 2018) from an explicit four-word state. Returns successive u64 BigInts. */
export function xoshiro256starstar(state) {
  let [s0, s1, s2, s3] = state.map(word => BigInt.asUintN(64, BigInt(word)));
  if (s0 === 0n && s1 === 0n && s2 === 0n && s3 === 0n) throw new Error("xoshiro256** state must not be all zero");
  return () => {
    const result = (rotl((s1 * 5n) & MASK64, 7n) * 9n) & MASK64;
    const t = (s1 << 17n) & MASK64;
    s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t; s3 = rotl(s3, 45n);
    return result;
  };
}

/** The protocol's generator: xoshiro256** whose state is four successive splitmix64 outputs from the stream seed. */
export function seededGenerator(seed) {
  const next = splitmix64(seed);
  return xoshiro256starstar([next(), next(), next(), next()]);
}

/** Unbiased index in [0, n): reject while x >= 2^64 - (2^64 mod n). The threshold is kept unbounded, so when n divides
 * 2^64 it is 2^64 itself and nothing is rejected (masking it to 64 bits would make it 0 and reject forever). */
export function uniformIndex(nextU64, n) {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`uniformIndex needs a positive integer n, got ${n}`);
  const size = BigInt(n), threshold = TWO64 - (TWO64 % size);
  for (;;) {
    const x = nextU64();
    if (x < threshold) return Number(x % size);
  }
}

const first16 = text => createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
/** baseSeed: first 16 hex of sha256(utf8(version + ':' + the pre-bootstrap protocolHash)). */
export const deriveBaseSeedHex = preBootstrapProtocolHash => first16(`${BOOTSTRAP_VERSION}:${preBootstrapProtocolHash}`);
/** Per (target, look) stream seed; lookId is 'look1' or 'final'. */
export const deriveStreamSeedHex = (baseSeedHex, targetKey, lookId) => first16(`${BOOTSTRAP_VERSION}:${baseSeedHex}:${targetKey}:${lookId}`);
export const seedFromHex = hex => BigInt(`0x${hex}`);

// ---------------------------------------------------------------- statistics

/** Rows sorted by (gameId, playerId) ascending numerically; a fresh array. */
export const sortRows = rows => [...rows].sort((a, b) => a.gameId - b.gameId || a.playerId - b.playerId);

/** Weighted sums over sorted rows. `weights` null means every row has weight 1. Rows of weight 0 are skipped, which
 * leaves every sum bit-identical (x + 0 === x). Returns null-valued statistics where a denominator is 0. */
export function weightedStatistics(rows, weights = null) {
  let W = 0, sumError = 0, sumActual = 0, sumPredicted = 0, sumSqForge = 0, sumSqBaseline = 0;
  for (let i = 0; i < rows.length; i++) {
    const w = weights ? weights[i] : 1;
    if (w === 0) continue;
    const row = rows[i], dF = row.predicted - row.actual, dB = row.baseline - row.actual;
    W += w;
    sumError += w * dF;
    sumActual += w * row.actual;
    sumPredicted += w * row.predicted;
    sumSqForge += w * (dF * dF);
    sumSqBaseline += w * (dB * dB);
  }
  const meanActual = W > 0 ? sumActual / W : null, meanPredicted = W > 0 ? sumPredicted / W : null;
  // bias = mean(predicted - actual) / mean(actual)
  const bias = W > 0 && sumActual !== 0 ? (sumError / W) / (sumActual / W) : null;
  // OLS slope of actual on predicted, two-pass about the weighted means.
  let sxy = 0, sxx = 0;
  if (W > 0) for (let i = 0; i < rows.length; i++) {
    const w = weights ? weights[i] : 1;
    if (w === 0) continue;
    const dp = rows[i].predicted - meanPredicted, da = rows[i].actual - meanActual;
    sxy += w * (dp * da);
    sxx += w * (dp * dp);
  }
  const slope = W > 0 && sxx !== 0 ? sxy / sxx : null;
  const deltaMseRel = sumSqBaseline !== 0 ? (sumSqForge - sumSqBaseline) / sumSqBaseline : null;
  return { W, sumSqForge, sumSqBaseline, bias, slope, deltaMseRel, meanActual, meanPredicted };
}

/** Full-sample (unweighted) metrics for one target: bias, OLS slope, MSE and MAE for FORGE and the baseline, relative ΔMSE. */
export function targetMetrics(rows) {
  const sorted = sortRows(rows), n = sorted.length;
  const point = weightedStatistics(sorted);
  let absForge = 0, absBaseline = 0;
  for (const row of sorted) { absForge += Math.abs(row.predicted - row.actual); absBaseline += Math.abs(row.baseline - row.actual); }
  return {
    n,
    meanActual: point.meanActual,
    meanPredicted: point.meanPredicted,
    bias: point.bias,
    calibrationSlope: point.slope,
    mseForge: n ? point.sumSqForge / n : null,
    mseBaseline: n ? point.sumSqBaseline / n : null,
    deltaMseRel: point.deltaMseRel,
    maeForge: n ? absForge / n : null,
    maeBaseline: n ? absBaseline / n : null,
  };
}

/** Hyndman-Fan type 7 on values already sorted ascending: linear interpolation at h = (m - 1) * q. */
export function quantile7(sorted, q) {
  const m = sorted.length;
  if (m === 0) return null;
  const h = (m - 1) * q, lo = Math.floor(h), hi = Math.min(lo + 1, m - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

const interval = (values, quantiles) => {
  const sorted = Float64Array.from(values).sort();
  return { finite: sorted.length, lower: quantile7(sorted, quantiles[0]), upper: quantile7(sorted, quantiles[1]) };
};

/**
 * Two-way crossed pigeonhole bootstrap (game x player, Owen 2007), exactly as protocol.bootstrap specifies. Each replicate
 * draws G game indices then P player indices with replacement; a row's weight = (times its game drawn) x (times its player
 * drawn). The gate statistic is relative ΔMSE; bias and slope from the same draws are descriptive.
 *
 * Seams for tests: `nextU64` (default: the seeded generator) and `index` (default: uniformIndex).
 */
export function clusteredBootstrap(rows, { replicates, seed = null, nextU64 = null, index = uniformIndex,
  quantiles = [0.025, 0.975], nonFiniteMaxShare = 0.01 } = {}) {
  if (!Number.isSafeInteger(replicates) || replicates < 1) throw new Error("replicates must be a positive integer");
  const draw = nextU64 ?? seededGenerator(seed);
  const sorted = sortRows(rows);
  const games = [...new Set(sorted.map(row => row.gameId))].sort((a, b) => a - b);
  const players = [...new Set(sorted.map(row => row.playerId))].sort((a, b) => a - b);
  const gameAt = new Map(games.map((id, i) => [id, i])), playerAt = new Map(players.map((id, i) => [id, i]));
  const rowGame = sorted.map(row => gameAt.get(row.gameId)), rowPlayer = sorted.map(row => playerAt.get(row.playerId));
  const G = games.length, P = players.length;
  const weights = new Float64Array(sorted.length);
  const dmse = [], bias = [], slope = [];
  let nonFinite = 0, biasNonFinite = 0, slopeNonFinite = 0;
  if (G === 0) return { replicates, games: 0, players: 0, nonFinite: replicates, nonFiniteShare: 1, inconclusive: true,
    deltaMseRel: { finite: 0, lower: null, upper: null }, bias: null, calibrationSlope: null };
  const gameCount = new Int32Array(G), playerCount = new Int32Array(P);
  for (let r = 0; r < replicates; r++) {
    gameCount.fill(0); playerCount.fill(0);
    for (let i = 0; i < G; i++) gameCount[index(draw, G)]++;
    for (let i = 0; i < P; i++) playerCount[index(draw, P)]++;
    for (let i = 0; i < sorted.length; i++) weights[i] = gameCount[rowGame[i]] * playerCount[rowPlayer[i]];
    const stats = weightedStatistics(sorted, weights);
    if (stats.sumSqBaseline === 0 || stats.deltaMseRel === null || !Number.isFinite(stats.deltaMseRel)) nonFinite++;
    else dmse.push(stats.deltaMseRel);
    if (stats.bias === null || !Number.isFinite(stats.bias)) biasNonFinite++; else bias.push(stats.bias);
    if (stats.slope === null || !Number.isFinite(stats.slope)) slopeNonFinite++; else slope.push(stats.slope);
  }
  const nonFiniteShare = nonFinite / replicates;
  return {
    replicates, games: G, players: P, nonFinite, nonFiniteShare, inconclusive: nonFiniteShare > nonFiniteMaxShare,
    deltaMseRel: interval(dmse, quantiles),
    bias: { ...interval(bias, quantiles), nonFinite: biasNonFinite, descriptive: true },
    calibrationSlope: { ...interval(slope, quantiles), nonFinite: slopeNonFinite, descriptive: true },
  };
}

// ---------------------------------------------------------------- baseline (B8), counts (B3), looks (B4)

export const BASELINE_MIN_GAMES = 5;
const playingIndicator = basis => (typeof basis === "string" && basis.endsWith("_playing") ? 1 : 0);

/**
 * season_rate baseline (A10 + B8): the player's season-to-date per-game rate at the revision cutoff, or his position
 * group's (F/D) rate when he has fewer than 5 games played, times the overlay indicator the row was served with.
 * `playerRates` is keyed `playerId|gameId|target`, `groupRates` `gameId|positionGroup|target`; each entry carries
 * { cutoffAt, gamesPlayed, seasonTotal } (players also positionGroup). Returns { value, source, rate } or { error }.
 */
export function seasonRateBaseline(row, playerRates, groupRates) {
  const entry = playerRates.get(`${row.playerId}|${row.gameId}|${row.target}`);
  if (!entry) return { error: "baseline_missing", reason: "no player entry" };
  const counts = item => Number.isSafeInteger(item?.gamesPlayed) && item.gamesPlayed >= 0
    && typeof item.seasonTotal === "number" && Number.isFinite(item.seasonTotal) && item.seasonTotal >= 0;
  if (!counts(entry) || !["F", "D"].includes(entry.positionGroup)) return { error: "baseline_invalid", reason: "player entry malformed" };
  if (entry.cutoffAt !== row.cutoffAt) return { error: "baseline_invalid", reason: "player entry not at the revision cutoff" };
  let rate, source;
  if (entry.gamesPlayed >= BASELINE_MIN_GAMES) { rate = entry.seasonTotal / entry.gamesPlayed; source = "player"; }
  else {
    const group = groupRates.get(`${row.gameId}|${entry.positionGroup}|${row.target}`);
    if (!group) return { error: "baseline_missing", reason: `no ${entry.positionGroup} group entry` };
    if (!counts(group) || group.gamesPlayed === 0) return { error: "baseline_invalid", reason: "group entry malformed" };
    if (group.cutoffAt !== row.cutoffAt) return { error: "baseline_invalid", reason: "group entry not at the revision cutoff" };
    rate = group.seasonTotal / group.gamesPlayed; source = `group_${entry.positionGroup}`;
  }
  return { value: rate * playingIndicator(row.basis), rate, source };
}

/** Settled scored rows per target per slate (non-cumulative), slates given as ascending dates. */
export function settledCounts(scoredRows, slates, targetKeys) {
  const at = new Map(slates.map((date, i) => [date, i]));
  const counts = Object.fromEntries(targetKeys.map(target => [target, slates.map(() => 0)]));
  for (const row of scoredRows) if (counts[row.target] && at.has(row.slate)) counts[row.target][at.get(row.slate)]++;
  return counts;
}

export const LOOK_ONE_SLATE = 7, FINAL_MIN_SLATE = 14, FINAL_CAP_SLATE = 28;

/**
 * B4 look plan. Look 1 is slate 7. The final look is the first slate >= 14 at which every target still running
 * (not stopped at look 1) has reached its minSettledRows; a running target still short at slate 28 ends inconclusive and
 * the final look is slate 28. Slates are 1-based ordinals over the ascending slate dates.
 */
export function lookPlan(slates, perSlateCounts, targets, { stoppedAtLookOne = [] } = {}) {
  const cumulative = Object.fromEntries(Object.entries(perSlateCounts).map(([target, counts]) => {
    let sum = 0; return [target, counts.map(count => (sum += count))];
  }));
  const reached = (target, k) => (cumulative[target]?.[k - 1] ?? 0) >= targets[target].minSettledRows;
  const lookOne = slates.length >= LOOK_ONE_SLATE ? { slate: LOOK_ONE_SLATE, date: slates[LOOK_ONE_SLATE - 1], reached: true }
    : { slate: LOOK_ONE_SLATE, date: null, reached: false };
  const running = Object.keys(targets).filter(target => !stoppedAtLookOne.includes(target));
  const progress = Object.fromEntries(Object.keys(targets).map(target => [target,
    { settled: cumulative[target]?.at(-1) ?? 0, minSettledRows: targets[target].minSettledRows }]));
  let final = null;
  for (let k = FINAL_MIN_SLATE; k <= Math.min(FINAL_CAP_SLATE, slates.length); k++)
    if (running.every(target => reached(target, k))) { final = { slate: k, date: slates[k - 1], reached: true, short: [] }; break; }
  if (!final && slates.length >= FINAL_CAP_SLATE)
    final = { slate: FINAL_CAP_SLATE, date: slates[FINAL_CAP_SLATE - 1], reached: true,
      short: running.filter(target => !reached(target, FINAL_CAP_SLATE)) };
  if (!final) final = { slate: null, date: null, reached: false, short: [] };
  return { slates: slates.length, lookOne, final, running, progress };
}
