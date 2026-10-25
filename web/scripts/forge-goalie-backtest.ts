// Old-vs-new scorer for the FORGE goalie line (tasks 7.1, 7.2, 7.4).
//
// Input: a fixture of starting-goalie rows (no database access here). Rows are separated by ";"
// and fields by ",":
//   gameKey, isHome, shotsAgainst, goalsAgainst, win, shutout, evidenceShots, evidenceGoals,
//   legacySavePct x1e4, restFlag, projectedShotsAgainst x10, lambdaFor x100, lambdaAgainst x100,
//   leagueSavePct x1e4, teamWon
// restFlag = backToBack + 2 * (>=5 GP in prior 14d) + 4 * (>=6 GP); a row with 14 fields has a
// missing (null) restFlag, read as 0. Evidence is the goalie's previous 200 appearances; legacy
// save % is the pre-change model evaluated on the same pre-game evidence; projected shots and
// expected goals are pre-game trailing-10 team inputs shared by both models.
//
// Two win populations are scored separately (Codex review 7.2): the team win probability against
// game outcomes (one row per team-game, paired per game), and the goalie's credited W against
// credited wins, among starts (P(team wins | starts) x decision share) and, from a candidate
// fixture, among all candidate goalies (unconditional W = P(start) x that + relief share).
//
// Candidate fixture (--candidates <file>): one row per candidate goalie per team-game, fields
//   gameKey, isHome, goalieKey, startProbability x1e4, started, win, evidenceShots, evidenceGoals,
//   restFlag, projectedShotsAgainst x10, lambdaFor x100, lambdaAgainst x100, leagueSavePct x1e4,
//   teamWon
// startProbability is a pre-game value (the fixture says which prior); win is the credited W
// (a starter's or a reliever's).
//
// Usage: NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
//   scripts/forge-goalie-backtest.ts [<fixture-file> ...] [--candidates <candidate-fixture-file>]
import fs from "fs";

import {
  GOALIE_SAVE_PCT_PRIOR_SHOTS,
  STARTER_DECISION_SHARE,
  goalieConditionalWinProbability,
  goalieRestSavePctAdjustment,
  goalieWinPopulations,
  posteriorSavePct,
  shutoutProbability,
  teamWinProbability,
} from "../lib/projections/goalie/goalieOutcomes";

export type BacktestRow = {
  gameKey: number;
  isHome: boolean;
  shotsAgainst: number;
  goalsAgainst: number;
  win: number;
  shutout: number;
  evidenceShots: number;
  evidenceGoals: number;
  legacySavePct: number;
  backToBack: boolean;
  startsLast14Days: number;
  projectedShotsAgainst: number;
  lambdaFor: number;
  lambdaAgainst: number;
  leagueSavePct: number;
  teamWon: number;
};

export type GoalieLinePrediction = {
  savePct: number;
  goalsAgainst: number;
  saves: number;
  /** Goalie population: P(credited with the win | starts). */
  winProbability: number;
  /** Team population: P(team wins the game); null for the legacy model, which has none. */
  teamWinProbability: number | null;
  shutoutProbability: number;
};

export function parseFixture(text: string): BacktestRow[] {
  return text
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const f = chunk.split(",").map(Number);
      if (f.length === 14) f.splice(9, 0, 0);
      if (f.length !== 15 || f.some((v) => !Number.isFinite(v))) {
        throw new Error(`Malformed fixture row: ${chunk}`);
      }
      return {
        gameKey: f[0],
        isHome: f[1] === 1,
        shotsAgainst: f[2],
        goalsAgainst: f[3],
        win: f[4],
        shutout: f[5],
        evidenceShots: f[6],
        evidenceGoals: f[7],
        legacySavePct: f[8] / 1e4,
        backToBack: (f[9] & 1) === 1,
        startsLast14Days: f[9] & 4 ? 6 : f[9] & 2 ? 5 : 0,
        projectedShotsAgainst: f[10] / 10,
        lambdaFor: f[11] / 100,
        lambdaAgainst: f[12] / 100,
        leagueSavePct: f[13] / 1e4,
        teamWon: f[14],
      };
    });
}

/** The pre-change line: legacy save %, logistic((GF - GA) / 1.25), e^-GA. */
export function predictLegacy(row: BacktestRow): GoalieLinePrediction {
  const goalsAgainst = row.projectedShotsAgainst * (1 - row.legacySavePct);
  return {
    savePct: row.legacySavePct,
    goalsAgainst,
    saves: row.projectedShotsAgainst - goalsAgainst,
    winProbability: 1 / (1 + Math.exp(-(row.lambdaFor - goalsAgainst) / 1.25)),
    teamWinProbability: null,
    shutoutProbability: Math.exp(-goalsAgainst),
  };
}

export type NewModelOptions = {
  priorShots?: number;
  spreadShrink?: number;
  goalieAdjustedWins?: boolean;
  nbSize?: number;
  fullGameProbability?: number;
};

export function predictNew(row: BacktestRow, options: NewModelOptions = {}): GoalieLinePrediction {
  const savePct = Math.min(0.94, Math.max(0.85,
    posteriorSavePct({ shots: row.evidenceShots, goals: row.evidenceGoals, priorMean: row.leagueSavePct,
      priorShots: options.priorShots ?? GOALIE_SAVE_PCT_PRIOR_SHOTS }) +
    goalieRestSavePctAdjustment({ isGoalieBackToBack: row.backToBack, startsLast14Days: row.startsLast14Days })));
  const goalsAgainst = row.projectedShotsAgainst * (1 - savePct);
  const teamWin = teamWinProbability(row.lambdaFor, row.lambdaAgainst, { spreadShrink: options.spreadShrink });
  const ifStarts = options.goalieAdjustedWins
    ? goalieConditionalWinProbability({ teamWinProbability: teamWin, lambdaFor: row.lambdaFor,
        lambdaAgainst: row.lambdaAgainst, goalsAgainstRatio: (1 - savePct) / (1 - row.leagueSavePct) })
    : teamWin;
  return {
    savePct,
    goalsAgainst,
    saves: row.projectedShotsAgainst - goalsAgainst,
    winProbability: ifStarts * STARTER_DECISION_SHARE,
    teamWinProbability: teamWin,
    shutoutProbability: shutoutProbability({ expectedShotsAgainst: row.projectedShotsAgainst, savePct,
      nbSize: options.nbSize, fullGameProbability: options.fullGameProbability }),
  };
}

export function biasRmse(predicted: number[], actual: number[]) {
  const n = predicted.length;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i += 1) {
    const e = predicted[i] - actual[i];
    sum += e;
    sumSq += e * e;
  }
  return { n, bias: n ? sum / n : NaN, rmse: n ? Math.sqrt(sumSq / n) : NaN };
}

export function brierScore(probabilities: number[], outcomes: number[]): number {
  let sum = 0;
  for (let i = 0; i < probabilities.length; i += 1) sum += (probabilities[i] - outcomes[i]) ** 2;
  return probabilities.length ? sum / probabilities.length : NaN;
}

export function logLoss(probabilities: number[], outcomes: number[]): number {
  let sum = 0;
  for (let i = 0; i < probabilities.length; i += 1) {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, probabilities[i]));
    sum -= outcomes[i] ? Math.log(p) : Math.log(1 - p);
  }
  return probabilities.length ? sum / probabilities.length : NaN;
}

/** Equal-count bins ordered by predicted probability: mean prediction vs observed rate. */
export function reliabilityBins(probabilities: number[], outcomes: number[], bins = 5) {
  const order = probabilities.map((p, i) => [p, outcomes[i]] as const).sort((a, b) => a[0] - b[0]);
  const result: Array<{ n: number; meanPredicted: number; observed: number }> = [];
  for (let b = 0; b < bins; b += 1) {
    const slice = order.slice(Math.floor((b * order.length) / bins), Math.floor(((b + 1) * order.length) / bins));
    if (!slice.length) continue;
    result.push({
      n: slice.length,
      meanPredicted: slice.reduce((s, [p]) => s + p, 0) / slice.length,
      observed: slice.reduce((s, [, y]) => s + y, 0) / slice.length,
    });
  }
  return result;
}

/** Per game with both starters: the sum of the two teams' win probabilities. */
export function pairedWinSums(rows: BacktestRow[], winProbability: (row: BacktestRow) => number) {
  const byGame = new Map<number, number[]>();
  for (const row of rows) byGame.set(row.gameKey, [...(byGame.get(row.gameKey) ?? []), winProbability(row)]);
  const sums = [...byGame.values()].filter((v) => v.length === 2).map(([a, b]) => a + b);
  return {
    games: sums.length,
    mean: sums.reduce((s, v) => s + v, 0) / (sums.length || 1),
    min: Math.min(...sums),
    max: Math.max(...sums),
  };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Game-clustered bootstrap 95% interval of mean(metric(new) - metric(old)) per row. */
export function clusteredBootstrapDiff(rows: BacktestRow[], rowDiff: (row: BacktestRow) => number, reps = 2000, seed = 7) {
  const games = new Map<number, number[]>();
  for (const row of rows) games.set(row.gameKey, [...(games.get(row.gameKey) ?? []), rowDiff(row)]);
  const clusters = [...games.values()];
  const rand = mulberry32(seed);
  const means: number[] = [];
  for (let r = 0; r < reps; r += 1) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < clusters.length; i += 1) {
      const c = clusters[Math.floor(rand() * clusters.length)];
      for (const v of c) { sum += v; n += 1; }
    }
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  const point = rows.reduce((s, row) => s + rowDiff(row), 0) / rows.length;
  return { point, lo: means[Math.floor(0.025 * reps)], hi: means[Math.floor(0.975 * reps)] };
}

function rest(flag: number) {
  return { backToBack: (flag & 1) === 1, startsLast14Days: flag & 4 ? 6 : flag & 2 ? 5 : 0 };
}

export type CandidateRow = {
  gameKey: number;
  isHome: boolean;
  goalieKey: number;
  startProbability: number;
  started: number;
  win: number;
  evidenceShots: number;
  evidenceGoals: number;
  backToBack: boolean;
  startsLast14Days: number;
  projectedShotsAgainst: number;
  lambdaFor: number;
  lambdaAgainst: number;
  leagueSavePct: number;
  teamWon: number;
};

export function parseCandidateFixture(text: string): CandidateRow[] {
  return text
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const f = chunk.split(",").map(Number);
      if (f.length !== 14 || f.some((v) => !Number.isFinite(v))) {
        throw new Error(`Malformed candidate fixture row: ${chunk}`);
      }
      return {
        gameKey: f[0],
        isHome: f[1] === 1,
        goalieKey: f[2],
        startProbability: f[3] / 1e4,
        started: f[4],
        win: f[5],
        evidenceShots: f[6],
        evidenceGoals: f[7],
        ...rest(f[8]),
        projectedShotsAgainst: f[9] / 10,
        lambdaFor: f[10] / 100,
        lambdaAgainst: f[11] / 100,
        leagueSavePct: f[12] / 1e4,
        teamWon: f[13],
      };
    });
}

function probabilitySummary(probabilities: number[], outcomes: number[], bins = 5) {
  return {
    n: probabilities.length,
    brier: brierScore(probabilities, outcomes),
    logLoss: logLoss(probabilities, outcomes),
    meanPredicted: probabilities.reduce((s, p) => s + p, 0) / (probabilities.length || 1),
    observed: outcomes.reduce((s, y) => s + y, 0) / (outcomes.length || 1),
    reliability: reliabilityBins(probabilities, outcomes, bins),
  };
}

/**
 * Score each win population against its own denominator from a candidate fixture, with the
 * production composition: P(team wins | starts) moves the team value by the goalie's goals per
 * shot relative to the team's start-weighted expectation, and goalieWinPopulations adds relief.
 */
export function scoreWinPopulations(rows: CandidateRow[], options: NewModelOptions = {}) {
  const teamGames = new Map<string, CandidateRow[]>();
  for (const row of rows) {
    const key = `${row.gameKey}:${row.isHome ? 1 : 0}`;
    teamGames.set(key, [...(teamGames.get(key) ?? []), row]);
  }
  const team = { p: [] as number[], y: [] as number[] };
  const pairs = new Map<number, number[]>();
  const starts = { p: [] as number[], y: [] as number[] };
  const candidates = { p: [] as number[], y: [] as number[] };
  const startProb = { p: [] as number[], y: [] as number[] };
  // The misuse the review warns about: a team-level value scored as a candidate's W.
  const teamValueAsCandidateW = { p: [] as number[], y: [] as number[] };
  const creditedSums: number[] = [];
  const creditedOutcomes: number[] = [];
  let teamGamesWithoutStarterCandidate = 0;
  for (const group of teamGames.values()) {
    const first = group[0];
    const teamWin = teamWinProbability(first.lambdaFor, first.lambdaAgainst, { spreadShrink: options.spreadShrink });
    team.p.push(teamWin);
    team.y.push(first.teamWon);
    pairs.set(first.gameKey, [...(pairs.get(first.gameKey) ?? []), teamWin]);
    const savePcts = group.map((row) => Math.min(0.94, Math.max(0.85,
      posteriorSavePct({ shots: row.evidenceShots, goals: row.evidenceGoals, priorMean: row.leagueSavePct,
        priorShots: options.priorShots ?? GOALIE_SAVE_PCT_PRIOR_SHOTS }) +
      goalieRestSavePctAdjustment({ isGoalieBackToBack: row.backToBack, startsLast14Days: row.startsLast14Days }))));
    const mass = group.reduce((s, row) => s + Math.max(0, row.startProbability), 0);
    const referenceGoalsPerShot = mass > 0
      ? group.reduce((s, row, i) => s + Math.max(0, row.startProbability) * (1 - savePcts[i]), 0) / mass
      : 1 - first.leagueSavePct;
    const populations = goalieWinPopulations(group.map((row, i) => ({
      goalieId: row.goalieKey,
      startProbability: row.startProbability,
      teamWinIfStarts: goalieConditionalWinProbability({ teamWinProbability: teamWin, lambdaFor: row.lambdaFor,
        lambdaAgainst: row.lambdaAgainst, goalsAgainstRatio: (1 - savePcts[i]) / referenceGoalsPerShot }),
    })));
    if (!group.some((row) => row.started === 1)) teamGamesWithoutStarterCandidate += 1;
    group.forEach((row, i) => {
      const g = populations.goalies[i];
      if (row.started === 1) {
        starts.p.push(g.creditedWinIfStarts);
        starts.y.push(row.win);
      }
      candidates.p.push(g.unconditionalWin);
      candidates.y.push(row.win);
      startProb.p.push(Math.min(1, Math.max(0, row.startProbability)));
      startProb.y.push(row.started);
      teamValueAsCandidateW.p.push(teamWin);
      teamValueAsCandidateW.y.push(row.win);
    });
    creditedSums.push(populations.goalies.reduce((s, g) => s + g.unconditionalWin, 0));
    creditedOutcomes.push(Math.min(1, group.reduce((s, row) => s + row.win, 0)));
  }
  const sums = [...pairs.values()].filter((v) => v.length === 2).map(([a, b]) => a + b);
  return {
    teamWinVsGameOutcome: {
      population: "team_game",
      ...probabilitySummary(team.p, team.y),
      pairedSums: { games: sums.length, min: Math.min(...sums), max: Math.max(...sums) },
    },
    goalieWinAmongStarts: { population: "starts", ...probabilitySummary(starts.p, starts.y) },
    goalieWinAmongCandidates: { population: "candidate_goalie_games", ...probabilitySummary(candidates.p, candidates.y) },
    startProbability: { population: "candidate_goalie_games", ...probabilitySummary(startProb.p, startProb.y) },
    teamValueScoredAsCandidateW: { population: "candidate_goalie_games (mismatched)",
      ...probabilitySummary(teamValueAsCandidateW.p, teamValueAsCandidateW.y) },
    creditedWinPerTeamGame: { population: "team_game (candidates' credited W summed)",
      ...probabilitySummary(creditedSums.map((v) => Math.min(1, v)), creditedOutcomes) },
    teamGames: teamGames.size,
    teamGamesWithoutStarterCandidate,
  };
}

export function scoreModels(rows: BacktestRow[], options: NewModelOptions = {}) {
  const legacy = rows.map(predictLegacy);
  const next = rows.map((row) => predictNew(row, options));
  const ga = rows.map((r) => r.goalsAgainst);
  const sv = rows.map((r) => r.shotsAgainst - r.goalsAgainst);
  const w = rows.map((r) => r.win);
  const so = rows.map((r) => r.shutout);
  const summarize = (preds: GoalieLinePrediction[]) => ({
    goalsAgainst: biasRmse(preds.map((p) => p.goalsAgainst), ga),
    saves: biasRmse(preds.map((p) => p.saves), sv),
    // Save % error on the actual shots isolates the save % model from the shots projection.
    goalsAgainstOnActualShots: biasRmse(preds.map((p, i) => rows[i].shotsAgainst * (1 - p.savePct)), ga),
    // Goalie population among starts: P(credited W | starts) vs the credited win.
    winPopulation: "starts",
    winBrier: brierScore(preds.map((p) => p.winProbability), w),
    winLogLoss: logLoss(preds.map((p) => p.winProbability), w),
    winMean: preds.reduce((s, p) => s + p.winProbability, 0) / preds.length,
    winReliability: reliabilityBins(preds.map((p) => p.winProbability), w),
    shutoutBrier: brierScore(preds.map((p) => p.shutoutProbability), so),
    shutoutMean: preds.reduce((s, p) => s + p.shutoutProbability, 0) / preds.length,
    shutoutReliability: reliabilityBins(preds.map((p) => p.shutoutProbability), so, 4),
  });
  return {
    rows: rows.length,
    observed: { winRate: w.reduce((s, v) => s + v, 0) / rows.length, shutoutRate: so.reduce((s, v) => s + v, 0) / rows.length,
      goalsAgainst: ga.reduce((s, v) => s + v, 0) / rows.length },
    legacy: { ...summarize(legacy), pairedWinSums: pairedWinSums(rows, (r) => predictLegacy(r).winProbability) },
    next: { ...summarize(next), pairedTeamWinSums: pairedWinSums(rows, (r) => predictNew(r, options).teamWinProbability!),
      // Team population: one starter row per team-game, so the denominator is team-games.
      teamWinVsGameOutcome: probabilitySummary(next.map((p) => p.teamWinProbability!), rows.map((r) => r.teamWon)) },
    deltas: {
      winBrier: clusteredBootstrapDiff(rows, (r) =>
        (predictNew(r, options).winProbability - r.win) ** 2 - (predictLegacy(r).winProbability - r.win) ** 2),
      shutoutBrier: clusteredBootstrapDiff(rows, (r) =>
        (predictNew(r, options).shutoutProbability - r.shutout) ** 2 - (predictLegacy(r).shutoutProbability - r.shutout) ** 2),
      goalsAgainstSquaredError: clusteredBootstrapDiff(rows, (r) =>
        (predictNew(r, options).goalsAgainst - r.goalsAgainst) ** 2 - (predictLegacy(r).goalsAgainst - r.goalsAgainst) ** 2),
    },
  };
}

function main(argv: string[]) {
  const round = (_key: string, value: unknown) => (typeof value === "number" ? Number(value.toFixed(5)) : value);
  const flag = argv.indexOf("--candidates");
  const paths = flag >= 0 ? argv.filter((_, i) => i !== flag && i !== flag + 1) : argv;
  if (flag >= 0) {
    if (!argv[flag + 1]) throw new Error("--candidates needs a file");
    const candidates = parseCandidateFixture(fs.readFileSync(argv[flag + 1], "utf8"));
    console.log(JSON.stringify({ populations: scoreWinPopulations(candidates) }, round, 2));
    if (!paths.length) return;
  }
  if (!paths.length) throw new Error("Pass one or more fixture files");
  const rows = paths.flatMap((p) => parseFixture(fs.readFileSync(p, "utf8")));
  console.log(JSON.stringify({ production: scoreModels(rows) }, round, 2));
  const variants: Record<string, NewModelOptions> = {
    k3400: { priorShots: 3400 }, k11000: { priorShots: 11000 },
    shrink0_5: { spreadShrink: 0.5 }, shrink1_0: { spreadShrink: 1 },
    goalieAdjustedWins: { goalieAdjustedWins: true },
    poissonShots: { nbSize: Infinity },
    fullGame0_98: { fullGameProbability: 0.98 },
  };
  const brief: Record<string, unknown> = {};
  for (const [name, opts] of Object.entries(variants)) {
    const s = scoreModels(rows, opts);
    brief[name] = { gaRmse: s.next.goalsAgainst.rmse, gaOnActualShotsRmse: s.next.goalsAgainstOnActualShots.rmse,
      winBrier: s.next.winBrier, shutoutBrier: s.next.shutoutBrier, shutoutMean: s.next.shutoutMean };
  }
  console.log(JSON.stringify({ variants: brief }, round, 2));
}

if (require.main === module) {
  main(process.argv.slice(2));
}
