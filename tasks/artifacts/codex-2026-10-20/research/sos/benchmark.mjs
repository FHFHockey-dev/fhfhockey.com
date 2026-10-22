// Offline, deterministic synthetic characterization. No production imports/I/O.
// Run from repository root: node tasks/artifacts/codex-2026-10-20/research/sos/benchmark.mjs > tasks/artifacts/codex-2026-10-20/research/sos/results.json
import assert from "node:assert/strict";

const teams = ["A", "B", "C", "D", "E", "F", "G"];
const latent = [1.2, 0.8, 0.3, -0.3, -0.8, -1.2, 0];
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const cutoff = 1000;
let seed = 20261020;
function random() {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
const pairs = [];
for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) pairs.push([i, j]);
function makeGames(pairList, rounds, start, separated = false) {
  const games = [];
  for (let round = 0; round < rounds; round++) for (const [a, b] of pairList) {
    const p = sigmoid(latent[a] - latent[b]);
    games.push({ a, b, y: separated ? 1 : Number(random() < p), p,
      overtime: games.length % 5 === 0, completedAt: start + games.length,
      knownAt: start + games.length + 0.5 });
  }
  return games;
}
function eligible(games) {
  return games.filter((game) => game.completedAt < cutoff && game.knownAt < cutoff);
}
function percentage(games, team, excluded = new Set(), points = false) {
  let earned = 0; let count = 0;
  for (const game of games) {
    if (excluded.has(game.a) || excluded.has(game.b) || (game.a !== team && game.b !== team)) continue;
    count++;
    const won = game.a === team ? game.y === 1 : game.y === 0;
    earned += won ? 1 : points && game.overtime ? 0.5 : 0;
  }
  return count ? earned / count : null;
}
const meanComplete = (values) => values.length && values.every((value) => value !== null)
  ? values.reduce((a, b) => a + b, 0) / values.length : null;
function rpi(games, points = false) {
  return teams.map((_, team) => {
    const meetings = games.filter((game) => game.a === team || game.b === team);
    const opponent = (game, focal) => game.a === focal ? game.b : game.a;
    const owp = meanComplete(meetings.map((game) =>
      percentage(games, opponent(game, team), new Set([team]), points)));
    const oowp = meanComplete(meetings.map((game) => {
      const j = opponent(game, team);
      const history = games.filter((g) => (g.a === j || g.b === j) && g.a !== team && g.b !== team);
      return meanComplete(history.map((g) => percentage(games, opponent(g, j), new Set([team, j]), points)));
    }));
    const wp = percentage(games, team, new Set(), points);
    return { wp, owp, oowp,
      rpi: wp !== null && owp !== null && oowp !== null ? 0.25 * wp + 0.5 * owp + 0.25 * oowp : null,
      scheduleBlend: owp !== null && oowp !== null ? (2 * owp + oowp) / 3 : null };
  });
}
function components(games) {
  const labels = teams.map((_, i) => i);
  for (const { a, b } of games) {
    const old = labels[b]; const next = labels[a];
    for (let i = 0; i < labels.length; i++) if (labels[i] === old) labels[i] = next;
  }
  return labels;
}
function bradleyTerry(games) {
  const lambda = 1; // Predeclared ridge, no data tuning; includes isolated teams.
  const theta = teams.map(() => 0);
  const counts = teams.map((_, i) => games.filter((g) => g.a === i || g.b === i).length);
  const step = 1 / (lambda + 0.5 * Math.max(0, ...counts));
  let maxGradient = Infinity; let iterations = 0;
  for (; iterations < 20000; iterations++) {
    const gradient = theta.map((value) => lambda * value);
    for (const { a, b, y } of games) {
      const residual = sigmoid(theta[a] - theta[b]) - y;
      gradient[a] += residual; gradient[b] -= residual;
    }
    maxGradient = Math.max(...gradient.map(Math.abs));
    if (maxGradient < 1e-10) break;
    theta.forEach((_, i) => { theta[i] -= step * gradient[i]; });
  }
  assert(maxGradient < 1e-10, "Bradley-Terry did not converge");
  return { theta, iterations, maxGradient, lambda };
}
function colley(games) {
  assert(games.length <= 2000 && teams.length <= 32, "Colley research bound exceeded");
  const c = teams.map((_, i) => teams.map((_, j) => i === j ? 2 : 0));
  const b = teams.map(() => 1);
  for (const { a, b: j, y } of games) {
    c[a][a]++; c[j][j]++; c[a][j]--; c[j][a]--;
    b[a] += y - 0.5; b[j] += 0.5 - y;
  }
  const augmented = c.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < teams.length; k++) {
    const pivot = augmented[k][k];
    assert(Math.abs(pivot) > 1e-12);
    for (let j = k; j <= teams.length; j++) augmented[k][j] /= pivot;
    for (let i = 0; i < teams.length; i++) if (i !== k) {
      const factor = augmented[i][k];
      for (let j = k; j <= teams.length; j++) augmented[i][j] -= factor * augmented[k][j];
    }
  }
  const rating = augmented.map((row) => row.at(-1));
  const maxResidual = Math.max(...c.map((row, i) => Math.abs(row.reduce((s, value, j) => s + value * rating[j], 0) - b[i])));
  assert(maxResidual < 1e-10);
  assert(rating.every((value) => value >= 0 && value <= 1));
  return { rating, maxResidual };
}
function score(games, predict) {
  const observed = games.map((game) => ({ ...game, prediction: predict(game.a, game.b) }))
    .filter((game) => game.prediction !== null);
  if (!observed.length) return { supported: 0, total: games.length, brier: null, logLoss: null, generatorProbabilityRmse: null };
  return { supported: observed.length, total: games.length,
    brier: observed.reduce((s, g) => s + (g.prediction - g.y) ** 2, 0) / observed.length,
    logLoss: -observed.reduce((s, g) => s + g.y * Math.log(g.prediction) + (1 - g.y) * Math.log(1 - g.prediction), 0) / observed.length,
    generatorProbabilityRmse: Math.sqrt(observed.reduce((s, g) => s + (g.prediction - g.p) ** 2, 0) / observed.length) };
}
function benchmark(name, train, test) {
  const games = eligible(train);
  const labels = components(games);
  const win = rpi(games); const points = rpi(games, true);
  const bt = bradleyTerry(games); const cm = colley(games);
  const fields = {
    owpWin: win.map((r) => r.owp), rpiWin: win.map((r) => r.rpi),
    scheduleBlendWin: win.map((r) => r.scheduleBlend), rpiPoints: points.map((r) => r.rpi),
    colley: cm.rating,
  };
  const predictions = Object.fromEntries(Object.entries(fields).map(([key, values]) => [key,
    score(test, (a, b) => labels[a] !== labels[b] || values[a] === null || values[b] === null ? null
      : sigmoid(4 * (values[a] - values[b])))]));
  predictions.bradleyTerry = score(test, (a, b) => labels[a] !== labels[b] ? null : sigmoid(bt.theta[a] - bt.theta[b]));
  const comparisonIds = test.filter((g) => labels[g.a] === labels[g.b] &&
    Object.values(fields).every((values) => values[g.a] !== null && values[g.b] !== null));
  const commonSupportScores = Object.fromEntries(Object.entries(fields).map(([key, values]) => [key,
    score(comparisonIds, (a, b) => sigmoid(4 * (values[a] - values[b])))]));
  commonSupportScores.bradleyTerry = score(comparisonIds, (a, b) => sigmoid(bt.theta[a] - bt.theta[b]));
  assert.deepEqual(bradleyTerry([...games].reverse()).theta.map((x) => Math.round(x * 1e8)), bt.theta.map((x) => Math.round(x * 1e8)));
  return { name, trainingGames: games.length, testGames: test.length,
    components: teams.map((team, i) => ({ team, component: labels[i] })),
    ratings: teams.map((team, i) => ({ team, win: win[i], points: points[i], bradleyTerryLogStrength: bt.theta[i], colley: cm.rating[i] })),
    convergence: { btIterations: bt.iterations, btMaxGradient: bt.maxGradient, colleyMaxResidual: cm.maxResidual },
    predictions, commonSupportScores };
}
const disconnectedPairs = pairs.filter(([a, b]) => (a < 3) === (b < 3));
const biasedPairs = [...pairs, ...Array.from({ length: 6 }, () => [[0, 5], [0, 4], [1, 2], [1, 3]]).flat()];
const scenarios = [
  benchmark("balanced", makeGames(pairs, 8, 1), makeGames(pairs, 4, 2000)),
  benchmark("unequal-repeated-opponents", makeGames(biasedPairs, 6, 1), makeGames(pairs, 4, 2000)),
  benchmark("complete-separation", makeGames(pairs, 4, 1, true), makeGames(pairs, 4, 2000)),
  benchmark("disconnected", makeGames(disconnectedPairs, 8, 1), makeGames(pairs, 4, 2000)),
  benchmark("empty", [], makeGames(pairs, 1, 2000)),
];
// Cutoff isolation: adding completed or newly available results at/after cutoff
// cannot change a fit. Synthetic clock units have no NHL timestamp implication.
const boundary = makeGames([[0, 1]], 1, cutoff);
assert.equal(eligible(boundary).length, 0);
assert.equal(eligible([{ ...boundary[0], completedAt: 999, knownAt: cutoff }]).length, 0);
assert(scenarios.every((s) => s.ratings.at(-1).win.wp === null && s.ratings.at(-1).colley === 0.5 && s.ratings.at(-1).bradleyTerryLogStrength === 0));
console.log(JSON.stringify({ version: "f9-synthetic-benchmark-v1", seed: 20261020, teams, latent,
  cutoff, data: "deterministic synthetic only", promotion: "unqualified; no NHL predictive-gain claim",
  probabilityMapping: "BT sigmoid(thetaA-thetaB); bounded ratings sigmoid(4*(ratingA-ratingB)), fixed without tuning",
  support: "exclude cross-component and null-rating pairs; commonSupportScores uses identical pairs for every method",
  assertions: ["strict cutoff", "finite ridge under separation", "Colley residual <1e-10 and [0,1] bounds", "isolated team priors explicit", "BT order invariance to 1e-8"],
  scenarios }, null, 2));
