// Offline golden tests for metrics.mjs: node --test metrics.test.mjs (no network, no DB, synthetic rows only).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalHash } from "./check-readbacks.mjs";
import { clusteredBootstrap, deriveBaseSeedHex, deriveStreamSeedHex, lookPlan, quantile7, seasonRateBaseline, seedFromHex,
  seededGenerator, settledCounts, splitmix64, targetMetrics, uniformIndex, xoshiro256starstar } from "./metrics.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const real = JSON.parse(readFileSync(join(here, "..", "SCOPE-AMENDED.json"), "utf8"));
const TWO64 = 1n << 64n;

// ------------------------------------------------------------ RNG, anchored on published vectors

test("xoshiro256** from the raw state [1,2,3,4] matches the reference outputs", () => {
  const next = xoshiro256starstar([1n, 2n, 3n, 4n]);
  // rand_xoshiro's reference test for Xoshiro256StarStar with s = [1, 2, 3, 4].
  assert.deepEqual(Array.from({ length: 10 }, () => next()), [11520n, 0n, 1509978240n, 1215971899390074240n, 1216172134540287360n,
    607988272756665600n, 16172922978634559625n, 8476171486693032832n, 10595114339597558777n, 2904607092377533576n]);
});

test("splitmix64 from seed 1234567 matches the reference outputs", () => {
  const next = splitmix64(1234567n);
  assert.deepEqual(Array.from({ length: 5 }, () => next()),
    [6457827717110365317n, 3203168211198807973n, 9817491932198370423n, 4593380528125082431n, 16408922859458223821n]);
});

test("the base seed re-derives from the protocol and its first xoshiro256** outputs are pinned", () => {
  const seed = real.protocol.bootstrap.seed;
  // The protocol (bootstrap included) hashes to protocolHash; the pre-bootstrap hash is the same protocol without it.
  assert.equal(canonicalHash(real.protocol), real.protocolHash);
  const { bootstrap, ...preBootstrap } = real.protocol;
  assert.equal(canonicalHash(preBootstrap), seed.preBootstrapProtocolHash);
  assert.equal(deriveBaseSeedHex(seed.preBootstrapProtocolHash), "7f8b18a3b1d413c5");
  assert.equal(seed.baseSeedHex, "7f8b18a3b1d413c5");
  assert.equal(seedFromHex(seed.baseSeedHex), 9190466555921830853n);
  const next = seededGenerator(seedFromHex(seed.baseSeedHex));
  assert.deepEqual(Array.from({ length: 4 }, () => next()),
    [14711278902564421245n, 9275214978711906956n, 1258636184875957466n, 18326364970880889777n]);
  // Streams are per (target, look) and independent of order.
  assert.equal(deriveStreamSeedHex(seed.baseSeedHex, "SHOTS_ON_GOAL", "final"), "3ae44628119d86d3");
  const streams = new Set(Object.keys(real.protocol.targets).flatMap(t => ["look1", "final"].map(l => deriveStreamSeedHex(seed.baseSeedHex, t, l))));
  assert.equal(streams.size, 12);
});

test("uniformIndex rejects at 2^64 - (2^64 mod n) and never loops when n divides 2^64", () => {
  const scripted = values => { const queue = [...values]; return () => queue.shift(); };
  // n = 10: 2^64 mod 10 = 6, so 2^64 - 6 is rejected and 2^64 - 7 gives (2^64 - 7) mod 10 = 9.
  assert.equal(uniformIndex(scripted([TWO64 - 6n, TWO64 - 7n]), 10), 9);
  assert.equal(uniformIndex(scripted([TWO64 - 1n, 5n]), 10), 5);
  // n = 1, 2, 4 divide 2^64: the threshold is 2^64 itself, so 2^64 - 1 is accepted as (n - 1).
  for (const n of [1, 2, 4]) assert.equal(uniformIndex(scripted([TWO64 - 1n]), n), n - 1);
  assert.throws(() => uniformIndex(scripted([1n]), 0));
});

// ------------------------------------------------------------ point metrics (hand-computed)

// g1/p1 pred 2 base 1 act 1; g1/p2 pred 1 base 2 act 3; g2/p1 pred 3 base 2 act 2; g2/p2 pred 1 base 1 act 0.
const HAND = [
  { gameId: 2, playerId: 20, predicted: 1, baseline: 1, actual: 0 },
  { gameId: 1, playerId: 10, predicted: 2, baseline: 1, actual: 1 },
  { gameId: 2, playerId: 10, predicted: 3, baseline: 2, actual: 2 },
  { gameId: 1, playerId: 20, predicted: 1, baseline: 2, actual: 3 },
];

test("targetMetrics: bias, OLS slope, MSE, relative dMSE and MAE by hand", () => {
  const m = targetMetrics(HAND);
  // errors 1, -2, 1, 1 -> mean 0.25; mean actual 1.5; bias = 0.25 / 1.5 = 1/6
  assert.equal(m.bias, 1 / 6);
  // predicted mean 1.75, actual mean 1.5: Sxy = 0.5, Sxx = 2.75 -> 2/11
  assert.equal(m.calibrationSlope, 2 / 11);
  // FORGE squared errors 1+4+1+1 = 7, baseline 0+1+0+1 = 2
  assert.equal(m.mseForge, 1.75);
  assert.equal(m.mseBaseline, 0.5);
  assert.equal(m.deltaMseRel, 2.5);
  assert.equal(m.maeForge, 1.25);
  assert.equal(m.maeBaseline, 0.5);
  assert.equal(m.n, 4);
});

test("targetMetrics returns null where a denominator is zero", () => {
  const zero = targetMetrics([{ gameId: 1, playerId: 1, predicted: 1, baseline: 0, actual: 0 }, { gameId: 1, playerId: 2, predicted: 1, baseline: 0, actual: 0 }]);
  assert.equal(zero.bias, null);
  assert.equal(zero.calibrationSlope, null);
  assert.equal(zero.deltaMseRel, null);
  assert.equal(targetMetrics([]).mseForge, null);
});

test("quantile7 interpolates at h = (m - 1) q", () => {
  assert.equal(quantile7([1.5, 2.5, 4], 0.025), 1.55);
  assert.ok(Math.abs(quantile7([1.5, 2.5, 4], 0.975) - 3.925) < 1e-12);
  assert.equal(quantile7([7], 0.975), 7);
  assert.equal(quantile7([0, 10], 0.5), 5);
  assert.equal(quantile7([], 0.5), null);
});

// ------------------------------------------------------------ bootstrap (scripted draws, hand-computed)

/** Index seam that replays scripted cluster draws: one [games, players] pair per replicate. */
const scriptedIndex = replicates => { const queue = replicates.flatMap(([games, players]) => [...games, ...players]); return () => queue.shift(); };

test("clusteredBootstrap: weights, statistic, non-finite exclusion and type-7 interval by hand", () => {
  // Clusters sorted: games [1, 2], players [10, 20].
  const result = clusteredBootstrap(HAND, { replicates: 4, nextU64: () => 0n, index: scriptedIndex([
    // games drawn [1,1] (counts 2,0), players [20,10] (1,1): g1 rows weight 2 -> sF 2*1+2*4 = 10, sB 2*0+2*1 = 2 -> 4
    [[0, 0], [1, 0]],
    // games [2,2], players [10,10]: only g2/p10 (weight 4), baseline error 0 -> sB 0 -> non-finite
    [[1, 1], [0, 0]],
    // games [1,2], players [10,20]: every weight 1 -> the point estimate 2.5
    [[0, 1], [0, 1]],
    // games [2,1], players [20,20]: p20 rows weight 2 -> sF 2*4+2*1 = 10, sB 2*1+2*1 = 4 -> 1.5
    [[1, 0], [1, 1]],
  ]) });
  assert.equal(result.games, 2);
  assert.equal(result.players, 2);
  assert.equal(result.nonFinite, 1);
  assert.equal(result.nonFiniteShare, 0.25);
  assert.equal(result.inconclusive, true);
  assert.equal(result.deltaMseRel.finite, 3);
  assert.equal(result.deltaMseRel.lower, quantile7([1.5, 2.5, 4], 0.025));
  assert.equal(result.deltaMseRel.upper, quantile7([1.5, 2.5, 4], 0.975));
  assert.equal(result.deltaMseRel.lower, 1.55);
});

test("the 1% non-finite rule: 1 of 100 is conclusive, 2 of 100 is inconclusive", () => {
  const finiteDraw = [[0, 1], [0, 1]], nonFiniteDraw = [[1, 1], [0, 0]];
  for (const [bad, inconclusive] of [[1, false], [2, true]]) {
    const plan = Array.from({ length: 100 }, (_, i) => (i < bad ? nonFiniteDraw : finiteDraw));
    const result = clusteredBootstrap(HAND, { replicates: 100, nextU64: () => 0n, index: scriptedIndex(plan) });
    assert.equal(result.nonFinite, bad);
    assert.equal(result.inconclusive, inconclusive);
    assert.equal(result.deltaMseRel.lower, 2.5);
  }
});

test("clusteredBootstrap draws games then players from the seeded stream through uniformIndex", () => {
  const seed = 0x3ae44628119d86d3n, draws = [];
  const reference = seededGenerator(seed);
  const expected = [uniformIndex(reference, 2), uniformIndex(reference, 2), uniformIndex(reference, 2), uniformIndex(reference, 2)];
  clusteredBootstrap(HAND, { replicates: 1, seed, index: (next, n) => { const i = uniformIndex(next, n); draws.push([n, i]); return i; } });
  assert.deepEqual(draws.map(([, i]) => i), expected);
  assert.deepEqual(draws.map(([n]) => n), [2, 2, 2, 2]);
});

// Cross-check dataset; goldens printed by reference_bootstrap.py (an independent implementation of the protocol text).
const CROSS = [
  { gameId: 2026020103, playerId: 8470003, predicted: 0.4, baseline: 0.3, actual: 1 },
  { gameId: 2026020101, playerId: 8470001, predicted: 2.6, baseline: 2.1, actual: 3 },
  { gameId: 2026020101, playerId: 8470002, predicted: 1.2, baseline: 1.5, actual: 0 },
  { gameId: 2026020101, playerId: 8470003, predicted: 0.9, baseline: 0.8, actual: 2 },
  { gameId: 2026020102, playerId: 8470001, predicted: 2.2, baseline: 2.0, actual: 1 },
  { gameId: 2026020102, playerId: 8470002, predicted: 1.7, baseline: 1.4, actual: 2 },
  { gameId: 2026020102, playerId: 8470003, predicted: 0.5, baseline: 0.9, actual: 0 },
  { gameId: 2026020103, playerId: 8470001, predicted: 3.1, baseline: 2.4, actual: 4 },
  { gameId: 2026020103, playerId: 8470002, predicted: 1.0, baseline: 1.1, actual: 1 },
];

test("10,000 protocol replicates match the Python reference bit for bit, whatever the row order", () => {
  const seed = seedFromHex(deriveStreamSeedHex(real.protocol.bootstrap.seed.baseSeedHex, "SHOTS_ON_GOAL", "final"));
  const forward = clusteredBootstrap(CROSS, { replicates: 10000, seed });
  assert.equal(forward.nonFinite, 0);
  assert.equal(forward.deltaMseRel.finite, 10000);
  assert.equal(forward.deltaMseRel.lower, -0.6998313659359191);
  assert.equal(forward.deltaMseRel.upper, -0.10253456221198133);
  const reversed = clusteredBootstrap([...CROSS].reverse(), { replicates: 10000, seed });
  assert.deepEqual(reversed, forward);
});

// ------------------------------------------------------------ baseline (B8), counts (B3), look plan (B4)

test("seasonRateBaseline: player rate at 5+ GP, F/D group rate below, times the served indicator", () => {
  const players = new Map([
    ["1|9|GOALS", { cutoffAt: "c", gamesPlayed: 5, seasonTotal: 2, positionGroup: "F" }],
    ["2|9|GOALS", { cutoffAt: "c", gamesPlayed: 4, seasonTotal: 4, positionGroup: "D" }],
    ["3|9|GOALS", { cutoffAt: "other", gamesPlayed: 9, seasonTotal: 1, positionGroup: "F" }],
    ["4|9|GOALS", { cutoffAt: "c", gamesPlayed: 0, seasonTotal: 0, positionGroup: "F" }],
    ["5|9|GOALS", { cutoffAt: "c", gamesPlayed: 2, seasonTotal: 0, positionGroup: "X" }],
  ]);
  const groups = new Map([["9|D|GOALS", { cutoffAt: "c", gamesPlayed: 200, seasonTotal: 10 }]]);
  const row = (playerId, basis) => ({ playerId, gameId: 9, target: "GOALS", cutoffAt: "c", basis });
  assert.deepEqual(seasonRateBaseline(row(1, "assumed_playing"), players, groups), { value: 0.4, rate: 0.4, source: "player" });
  assert.deepEqual(seasonRateBaseline(row(1, "confirmed_out"), players, groups), { value: 0, rate: 0.4, source: "player" });
  assert.deepEqual(seasonRateBaseline(row(2, "confirmed_playing"), players, groups), { value: 0.05, rate: 0.05, source: "group_D" });
  assert.equal(seasonRateBaseline(row(3, "assumed_playing"), players, groups).error, "baseline_invalid");
  assert.equal(seasonRateBaseline(row(4, "assumed_playing"), players, groups).error, "baseline_missing");
  assert.equal(seasonRateBaseline(row(5, "assumed_playing"), players, groups).error, "baseline_invalid");
  assert.equal(seasonRateBaseline(row(6, "assumed_playing"), players, groups).error, "baseline_missing");
});

const TARGETS = { A: { minSettledRows: 30 }, B: { minSettledRows: 50 } };
const dates = n => Array.from({ length: n }, (_, i) => `2026-12-${String(i + 1).padStart(2, "0")}`);

test("settledCounts counts scored rows per target and slate", () => {
  const counts = settledCounts([{ target: "A", slate: "2026-12-02" }, { target: "A", slate: "2026-12-02" }, { target: "B", slate: "2026-12-01" },
    { target: "B", slate: "2027-01-01" }], dates(3), ["A", "B"]);
  assert.deepEqual(counts, { A: [0, 2, 0], B: [1, 0, 0] });
});

test("lookPlan: look 1 at slate 7; final at the first slate >= 14 where every running target has its minimum", () => {
  // A: 3 a slate (30 by slate 10); B: 3 a slate (50 at slate 17).
  const plan = lookPlan(dates(30), { A: Array(30).fill(3), B: Array(30).fill(3) }, TARGETS);
  assert.deepEqual(plan.lookOne, { slate: 7, date: "2026-12-07", reached: true });
  assert.deepEqual(plan.final, { slate: 17, date: "2026-12-17", reached: true, short: [] });
  // Both met early: the final look is still slate 14.
  assert.equal(lookPlan(dates(30), { A: Array(30).fill(9), B: Array(30).fill(9) }, TARGETS).final.slate, 14);
  // B stopped at look 1: only A must reach its minimum.
  assert.equal(lookPlan(dates(30), { A: Array(30).fill(3), B: Array(30).fill(0) }, TARGETS, { stoppedAtLookOne: ["B"] }).final.slate, 14);
});

test("lookPlan: a target short at slate 28 ends inconclusive and the final look is slate 28; fewer slates is not reached", () => {
  const capped = lookPlan(dates(30), { A: Array(30).fill(3), B: Array(30).fill(1) }, TARGETS);
  assert.deepEqual(capped.final, { slate: 28, date: "2026-12-28", reached: true, short: ["B"] });
  const early = lookPlan(dates(6), { A: Array(6).fill(9), B: Array(6).fill(9) }, TARGETS);
  assert.equal(early.lookOne.reached, false);
  assert.equal(early.final.reached, false);
  const pending = lookPlan(dates(20), { A: Array(20).fill(3), B: Array(20).fill(1) }, TARGETS);
  assert.deepEqual(pending.final, { slate: null, date: null, reached: false, short: [] });
  assert.deepEqual(pending.progress.B, { settled: 20, minSettledRows: 50 });
});
