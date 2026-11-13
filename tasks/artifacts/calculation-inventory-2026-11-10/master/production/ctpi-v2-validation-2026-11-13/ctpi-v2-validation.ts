/**
 * Lane F5 (2026-11-13): held-out comparison of CTPI v1 and Recent Team Form v2
 * (candidate-2) as predictors of a team's next-N-games goal differential per
 * game and points%.
 *
 * Offline only. Inputs are CSV copies of the four NST team game-log tables
 * (gp = 1, seasons 20252026 and 20262027) and the stored team_ctpi_daily
 * scores (no payload), read once from production under read hygiene. No
 * database, NST or NHL calls are made here.
 *
 * Both formulas are scored with the code that ships today:
 *   v1: computeTrendMetrics + computeCtpi (web/lib/trends/ctpi.ts)
 *   v2: buildRecentTeamFormCandidateSnapshot (the writer's own snapshot path)
 * and with the same information set: games strictly before snapshot date D.
 * Targets are the team's next N games dated on or after D.
 *
 * Run from web/:
 *   NODE_PATH=. npx ts-node --transpile-only --compiler-options \
 *     '{"module":"commonjs","moduleResolution":"node"}' \
 *     ../tasks/artifacts/calculation-inventory-2026-11-10/master/production/ctpi-v2-validation-2026-11-13/ctpi-v2-validation.ts \
 *     --data=<dir with the CSVs> --out=<results.json>
 */
import fs from "node:fs";
import path from "node:path";

import {
  computeCtpi,
  computeTrendMetrics,
  type TeamGameRow,
} from "lib/trends/ctpi";
import {
  buildRecentTeamFormCandidateSnapshot,
  type RecentTeamFormSourceRow,
} from "lib/trends/recentTeamFormV2Provenance";

export type Csv = Array<Record<string, string>>;

const SEASONS = [20252026, 20262027] as const;
const HORIZONS = [5, 10, 20] as const;
const PRIMARY_HORIZON = 10;
const BOOTSTRAP_REPS = 2000;
const BLOCK_GAME_DAYS = 20;
const MIN_TEAMS_PER_DATE = 16;
const NON_INFERIORITY_MARGIN = 0.03;

function arg(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  if (!value) throw new Error(`Missing --${name}=`);
  return value.slice(prefix.length);
}

export function readCsv(file: string): Csv {
  const [header, ...lines] = fs
    .readFileSync(file, "utf8")
    .trim()
    .split(/\r?\n/);
  const keys = header.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    if (cells.length !== keys.length) {
      throw new Error(`Unexpected CSV shape in ${file}: ${line}`);
    }
    return Object.fromEntries(keys.map((key, index) => [key, cells[index]]));
  });
}

export const num = (value: string | undefined): number | null => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export type GameResult = {
  team: string;
  date: string;
  goalDifferential: number;
  points: number;
};

export type SeasonInput = {
  seasonId: number;
  sourceRows: RecentTeamFormSourceRow[];
  results: GameResult[];
  gameDays: string[];
  teams: string[];
};

export function loadSeasons(dataDir: string): Map<number, SeasonInput> {
  const rates = readCsv(path.join(dataDir, "as_rates.csv"));
  const counts = readCsv(path.join(dataDir, "as_counts.csv"));
  const pp = readCsv(path.join(dataDir, "pp_counts.csv"));
  const pk = readCsv(path.join(dataDir, "pk_counts.csv"));
  const key = (row: Record<string, string>) =>
    `${row.season_id}|${row.team}|${row.date}`;
  const byKey = (rows: Csv) => new Map(rows.map((row) => [key(row), row]));
  const countMap = byKey(counts);
  const ppMap = byKey(pp);
  const pkMap = byKey(pk);

  const seasons = new Map<number, SeasonInput>();
  for (const seasonId of SEASONS) {
    // Mirrors fetchGameRows in update-team-ctpi-daily.ts (as_rates is the base).
    const sourceRows = rates
      .filter((row) => Number(row.season_id) === seasonId)
      .map((row): RecentTeamFormSourceRow => {
        const asCount = countMap.get(key(row));
        const ppRow = ppMap.get(key(row));
        const pkRow = pkMap.get(key(row));
        return {
          team: row.team,
          date: row.date,
          gp: num(row.gp),
          xgf_per_60: num(row.xgf_per_60),
          hdcf_per_60: num(row.hdcf_per_60),
          gf_per_60: num(row.gf_per_60),
          xga_per_60: num(row.xga_per_60),
          hdca_per_60: num(row.hdca_per_60),
          ca_per_60: num(row.ca_per_60),
          sat_pct: num(row.cf_pct),
          goals_against: num(asCount?.ga),
          xga: num(asCount?.xga),
          powerPlayToi: num(ppRow?.toi_seconds),
          pp_xgf: num(ppRow?.xgf),
          toi_shorthanded: num(pkRow?.toi_seconds),
          pk_xga: num(pkRow?.xga),
          pdo: num(row.pdo),
          toi_all_seconds: num(asCount?.toi_seconds),
          sourceUpdatedAt: null,
        };
      });
    // Targets come from the all-situations count table (one row per team-game).
    const results = counts
      .filter((row) => Number(row.season_id) === seasonId)
      .flatMap((row): GameResult[] => {
        const gf = num(row.gf);
        const ga = num(row.ga);
        const points = num(row.points);
        if (gf == null || ga == null || points == null) return [];
        return [
          { team: row.team, date: row.date, goalDifferential: gf - ga, points },
        ];
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    const gameDays = Array.from(new Set(results.map((row) => row.date))).sort();
    const teams = Array.from(new Set(results.map((row) => row.team))).sort();
    seasons.set(seasonId, { seasonId, sourceRows, results, gameDays, teams });
  }
  return seasons;
}

type Snapshot = {
  date: string;
  v1: Map<string, number>;
  v1NoLuck: Map<string, number>;
  v2: Map<string, number>;
  v2PlusLuck: Map<string, number>;
  v2Status: Map<string, string>;
  /** Season-to-date naive baselines from the same information set. */
  gdPerGame: Map<string, number>;
  pointsPct: Map<string, number>;
  priorGames: Map<string, number>;
};

export function v1Scores(rows: TeamGameRow[], date: string, through: boolean) {
  const byTeam = new Map<string, TeamGameRow[]>();
  for (const row of rows) {
    if (through ? row.date > date : row.date >= date) continue;
    const list = byTeam.get(row.team) ?? [];
    list.push(row);
    byTeam.set(row.team, list);
  }
  // Same team set rule as the v1 writer: any team with at least one game.
  const metrics = Array.from(byTeam.values())
    .map((games) => computeTrendMetrics(games, undefined, 10))
    .filter((metric) => metric.source_game_count > 0 && metric.team);
  return computeCtpi(metrics);
}

function buildSnapshot(season: SeasonInput, date: string): Snapshot {
  const v1 = new Map<string, number>();
  const v1NoLuck = new Map<string, number>();
  for (const score of v1Scores(season.sourceRows, date, false)) {
    v1.set(score.team, score.ctpi_raw);
    v1NoLuck.set(score.team, score.ctpi_raw - 0.1 * score.luck);
  }
  const v2 = new Map<string, number>();
  const v2PlusLuck = new Map<string, number>();
  const v2Status = new Map<string, string>();
  const snapshot = buildRecentTeamFormCandidateSnapshot(season.sourceRows, date);
  for (const score of snapshot.scores) {
    v2Status.set(score.team, score.status);
    if (score.status !== "unavailable" && score.ctpi_raw != null) {
      v2.set(score.team, score.ctpi_raw);
      // Exploratory only: v1's hand-set 0.1 PDO weight added back (missing PDO
      // contributes 0, as in v1). Not a fitted coefficient (rule 12).
      v2PlusLuck.set(score.team, score.ctpi_raw + 0.1 * (score.pdoContext.z ?? 0));
    }
  }
  const gdPerGame = new Map<string, number>();
  const pointsPct = new Map<string, number>();
  const priorGames = new Map<string, number>();
  for (const team of season.teams) {
    const prior = season.results.filter(
      (row) => row.team === team && row.date < date,
    );
    priorGames.set(team, prior.length);
    if (prior.length === 0) continue;
    gdPerGame.set(
      team,
      prior.reduce((total, row) => total + row.goalDifferential, 0) /
        prior.length,
    );
    pointsPct.set(
      team,
      prior.reduce((total, row) => total + row.points, 0) /
        (2 * prior.length),
    );
  }
  return { date, v1, v1NoLuck, v2, v2PlusLuck, v2Status, gdPerGame, pointsPct, priorGames };
}

type Sample = {
  seasonId: number;
  date: string;
  team: string;
  priorGames: number;
  v2Status: string;
  predictors: Record<PredictorKey, number>;
  /** Issued v1 row for the calendar day before D (games through D − 1 = games before D). */
  storedV1Previous: number | null;
  targets: Record<string, number>;
};

const PREDICTORS = [
  "v1",
  "v2",
  "v1NoLuck",
  "v2PlusLuck",
  "seasonGd",
  "seasonPointsPct",
] as const;
type PredictorKey = (typeof PREDICTORS)[number];

function previousDay(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

function buildSamples(
  season: SeasonInput,
  snapshots: Snapshot[],
  storedV1: Map<string, number>,
): Sample[] {
  const samples: Sample[] = [];
  const resultsByTeam = new Map<string, GameResult[]>();
  for (const row of season.results) {
    const list = resultsByTeam.get(row.team) ?? [];
    list.push(row);
    resultsByTeam.set(row.team, list);
  }
  for (const snapshot of snapshots) {
    for (const team of season.teams) {
      const v1 = snapshot.v1.get(team);
      const v2 = snapshot.v2.get(team);
      const v1NoLuck = snapshot.v1NoLuck.get(team);
      const v2PlusLuck = snapshot.v2PlusLuck.get(team);
      const seasonGd = snapshot.gdPerGame.get(team);
      const seasonPointsPct = snapshot.pointsPct.get(team);
      // Paired design: a team-date enters only when both versions score it.
      if (
        v1 == null ||
        v2 == null ||
        v1NoLuck == null ||
        v2PlusLuck == null ||
        seasonGd == null ||
        seasonPointsPct == null
      ) {
        continue;
      }
      const future = (resultsByTeam.get(team) ?? []).filter(
        (row) => row.date >= snapshot.date,
      );
      const targets: Record<string, number> = {};
      for (const horizon of HORIZONS) {
        if (future.length < horizon) continue;
        const window = future.slice(0, horizon);
        targets[`gd${horizon}`] =
          window.reduce((total, row) => total + row.goalDifferential, 0) /
          horizon;
        targets[`pts${horizon}`] =
          window.reduce((total, row) => total + row.points, 0) / (2 * horizon);
        targets[`last${horizon}`] = Number(window.at(-1)!.date.replace(/-/g, ""));
      }
      samples.push({
        seasonId: season.seasonId,
        date: snapshot.date,
        team,
        priorGames: snapshot.priorGames.get(team) ?? 0,
        v2Status: snapshot.v2Status.get(team) ?? "missing",
        predictors: { v1, v2, v1NoLuck, v2PlusLuck, seasonGd, seasonPointsPct },
        storedV1Previous:
          storedV1.get(`${team}|${previousDay(snapshot.date)}`) ?? null,
        targets,
      });
    }
  }
  return samples;
}

export function ranks(values: number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) result[order[k].index] = rank;
    i = j + 1;
  }
  return result;
}

export function pearson(x: number[], y: number[]): number | null {
  if (x.length < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

export const spearman = (x: number[], y: number[]) => pearson(ranks(x), ranks(y));

export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Moving-block bootstrap over ordered game days; returns resampled index lists. */
export function blockResamples(count: number, block: number, reps: number, seed: number) {
  const random = mulberry32(seed);
  const length = Math.min(block, count);
  const out: number[][] = [];
  for (let rep = 0; rep < reps; rep++) {
    const indices: number[] = [];
    while (indices.length < count) {
      const start = Math.floor(random() * (count - length + 1));
      for (let k = 0; k < length && indices.length < count; k++) {
        indices.push(start + k);
      }
    }
    out.push(indices);
  }
  return out;
}

export function quantile(values: number[], probability: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export const round = (value: number | null, digits = 4) =>
  value == null ? null : Number(value.toFixed(digits));

type DateStat = { date: string; values: Record<PredictorKey, number>; n: number };

/** Per-date cross-sectional Spearman for each predictor against one target. */
function perDateSpearman(samples: Sample[], target: string): DateStat[] {
  const byDate = new Map<string, Sample[]>();
  for (const sample of samples) {
    if (sample.targets[target] == null) continue;
    const list = byDate.get(sample.date) ?? [];
    list.push(sample);
    byDate.set(sample.date, list);
  }
  const stats: DateStat[] = [];
  for (const [date, rows] of Array.from(byDate.entries()).sort()) {
    if (rows.length < MIN_TEAMS_PER_DATE) continue;
    const y = rows.map((row) => row.targets[target]);
    const values = {} as Record<PredictorKey, number>;
    let ok = true;
    for (const predictor of PREDICTORS) {
      const rho = spearman(
        rows.map((row) => row.predictors[predictor]),
        y,
      );
      if (rho == null) ok = false;
      values[predictor] = rho ?? NaN;
    }
    if (ok) stats.push({ date, values, n: rows.length });
  }
  return stats;
}

function summarizeSpearman(stats: DateStat[], seed: number) {
  const mean = (rows: DateStat[], key: PredictorKey) =>
    rows.reduce((total, row) => total + row.values[key], 0) / rows.length;
  if (stats.length === 0) return null;
  const estimable = stats.length >= 2 * BLOCK_GAME_DAYS;
  const resamples = blockResamples(stats.length, BLOCK_GAME_DAYS, BOOTSTRAP_REPS, seed);
  const pointFor = Object.fromEntries(
    PREDICTORS.map((key) => [key, round(mean(stats, key))]),
  );
  const deltas = (other: PredictorKey) => {
    const point = mean(stats, "v2") - mean(stats, other);
    const boot = resamples.map((indices) => {
      const rows = indices.map((index) => stats[index]);
      return mean(rows, "v2") - mean(rows, other);
    });
    return {
      point: round(point),
      ci95: estimable
        ? [round(quantile(boot, 0.025)), round(quantile(boot, 0.975))]
        : null,
      shareBootstrapAboveZero: estimable
        ? round(boot.filter((value) => value > 0).length / boot.length, 3)
        : null,
    };
  };
  const ciFor = (key: PredictorKey) => {
    const boot = resamples.map((indices) =>
      mean(indices.map((index) => stats[index]), key),
    );
    return estimable
      ? [round(quantile(boot, 0.025)), round(quantile(boot, 0.975))]
      : null;
  };
  return {
    dates: stats.length,
    ciEstimable: estimable,
    firstDate: stats[0].date,
    lastDate: stats.at(-1)!.date,
    meanTeamsPerDate: round(
      stats.reduce((total, row) => total + row.n, 0) / stats.length,
      1,
    ),
    meanSpearman: pointFor,
    meanSpearmanCi95: Object.fromEntries(PREDICTORS.map((key) => [key, ciFor(key)])),
    v2MinusV1: deltas("v1"),
    v2MinusV1NoLuck: deltas("v1NoLuck"),
    v2PlusLuckMinusV1: (() => {
      const point = mean(stats, "v2PlusLuck") - mean(stats, "v1");
      const boot = resamples.map((indices) => {
        const rows = indices.map((index) => stats[index]);
        return mean(rows, "v2PlusLuck") - mean(rows, "v1");
      });
      return {
        point: round(point),
        ci95: estimable
          ? [round(quantile(boot, 0.025)), round(quantile(boot, 0.975))]
          : null,
      };
    })(),
    v2MinusSeasonGd: deltas("seasonGd"),
    v2MinusSeasonPointsPct: deltas("seasonPointsPct"),
  };
}

function pooledCorrelations(samples: Sample[], target: string) {
  const rows = samples.filter((row) => row.targets[target] != null);
  const y = rows.map((row) => row.targets[target]);
  return {
    samples: rows.length,
    pearson: Object.fromEntries(
      PREDICTORS.map((key) => [
        key,
        round(pearson(rows.map((row) => row.predictors[key]), y)),
      ]),
    ),
  };
}

export function ols(x: number[], y: number[]) {
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  return { intercept: my - slope * mx, slope };
}

/**
 * Held-out calibration: fit y = a + b·score on training rows whose whole target
 * window ends before the split, score test rows. Skill = 1 − MSE/MSE(train mean).
 */
function heldOut(
  train: Sample[],
  test: Sample[],
  target: string,
  horizon: number,
  seed: number,
) {
  const trainRows = train.filter((row) => row.targets[target] != null);
  const testRows = test.filter((row) => row.targets[target] != null);
  if (trainRows.length < 50 || testRows.length < 32) {
    return { trainRows: trainRows.length, testRows: testRows.length, skipped: true };
  }
  const trainMean =
    trainRows.reduce((total, row) => total + row.targets[target], 0) /
    trainRows.length;
  const fits = Object.fromEntries(
    PREDICTORS.map((key) => [
      key,
      ols(
        trainRows.map((row) => row.predictors[key]),
        trainRows.map((row) => row.targets[target]),
      ),
    ]),
  ) as Record<PredictorKey, { intercept: number; slope: number }>;
  const byDate = new Map<string, { se: Record<string, number>; n: number }>();
  for (const row of testRows) {
    const entry = byDate.get(row.date) ?? {
      se: Object.fromEntries([...PREDICTORS, "baseline"].map((key) => [key, 0])),
      n: 0,
    };
    const y = row.targets[target];
    for (const key of PREDICTORS) {
      const fit = fits[key];
      entry.se[key] += (fit.intercept + fit.slope * row.predictors[key] - y) ** 2;
    }
    entry.se.baseline += (trainMean - y) ** 2;
    entry.n += 1;
    byDate.set(row.date, entry);
  }
  const dates = Array.from(byDate.keys()).sort();
  const entries = dates.map((date) => byDate.get(date)!);
  const mse = (rows: typeof entries, key: string) =>
    rows.reduce((total, row) => total + row.se[key], 0) /
    rows.reduce((total, row) => total + row.n, 0);
  const skill = (rows: typeof entries, key: string) =>
    1 - mse(rows, key) / mse(rows, "baseline");
  const estimable = entries.length >= 2 * BLOCK_GAME_DAYS;
  const resamples = blockResamples(entries.length, BLOCK_GAME_DAYS, BOOTSTRAP_REPS, seed);
  const delta = (other: PredictorKey, left: PredictorKey = "v2") => {
    const boot = resamples.map((indices) => {
      const rows = indices.map((index) => entries[index]);
      return skill(rows, left) - skill(rows, other);
    });
    return {
      point: round(skill(entries, left) - skill(entries, other)),
      ci95: estimable
        ? [round(quantile(boot, 0.025)), round(quantile(boot, 0.975))]
        : null,
    };
  };
  return {
    horizon,
    trainRows: trainRows.length,
    testRows: testRows.length,
    testDates: dates.length,
    testFirstDate: dates[0],
    testLastDate: dates.at(-1),
    fits: Object.fromEntries(
      PREDICTORS.map((key) => [
        key,
        { intercept: round(fits[key].intercept), slope: round(fits[key].slope) },
      ]),
    ),
    rmse: Object.fromEntries(
      [...PREDICTORS, "baseline"].map((key) => [key, round(Math.sqrt(mse(entries, key)))]),
    ),
    skillVsTrainMean: Object.fromEntries(
      PREDICTORS.map((key) => [key, round(skill(entries, key))]),
    ),
    v2MinusV1Skill: delta("v1"),
    v2MinusV1NoLuckSkill: delta("v1NoLuck"),
    v2PlusLuckMinusV1Skill: delta("v1", "v2PlusLuck"),
    ciEstimable: estimable,
  };
}

/**
 * v2 against the v1 rows actually issued (row for D − 1, i.e. games before D),
 * on the subset of paired samples where that issued row exists.
 */
function issuedV1Comparison(samples: Sample[], target: string, seed: number) {
  const rows = samples.filter(
    (row) => row.storedV1Previous != null && row.targets[target] != null,
  );
  const byDate = new Map<string, Sample[]>();
  rows.forEach((row) => {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  });
  const stats = Array.from(byDate.entries())
    .sort()
    .filter(([, list]) => list.length >= MIN_TEAMS_PER_DATE)
    .flatMap(([date, list]) => {
      const y = list.map((row) => row.targets[target]);
      const issued = spearman(list.map((row) => row.storedV1Previous as number), y);
      const v2 = spearman(list.map((row) => row.predictors.v2), y);
      return issued == null || v2 == null ? [] : [{ date, issued, v2 }];
    });
  if (stats.length === 0) return null;
  const estimable = stats.length >= 2 * BLOCK_GAME_DAYS;
  const mean = (list: typeof stats, key: "issued" | "v2") =>
    list.reduce((total, row) => total + row[key], 0) / list.length;
  const boot = blockResamples(stats.length, BLOCK_GAME_DAYS, BOOTSTRAP_REPS, seed).map(
    (indices) => {
      const list = indices.map((index) => stats[index]);
      return mean(list, "v2") - mean(list, "issued");
    },
  );
  return {
    samples: rows.length,
    dates: stats.length,
    meanSpearmanIssuedV1: round(mean(stats, "issued")),
    meanSpearmanV2: round(mean(stats, "v2")),
    v2MinusIssuedV1: {
      point: round(mean(stats, "v2") - mean(stats, "issued")),
      ci95: estimable
        ? [round(quantile(boot, 0.025)), round(quantile(boot, 0.975))]
        : null,
    },
  };
}

/**
 * Sensitivity: team-cluster bootstrap (resample the 32 teams with replacement),
 * which keeps each team's overlapping windows together. Returns 95% CIs for
 * v2 − other on the mean per-date Spearman and on held-out calibration skill.
 */
function teamClusterSensitivity(
  samples: Sample[],
  target: string,
  others: PredictorKey[],
  seed: number,
  heldOutSplit?: { train: Sample[]; testFrom: string },
) {
  const teams = Array.from(new Set(samples.map((row) => row.team))).sort();
  const random = mulberry32(seed);
  const draws = Array.from({ length: BOOTSTRAP_REPS }, () =>
    teams.map(() => teams[Math.floor(random() * teams.length)]),
  );
  const rowsFor = (team: string) =>
    samples.filter((row) => row.team === team && row.targets[target] != null);
  const byTeam = new Map(teams.map((team) => [team, rowsFor(team)]));
  const meanSpearmanFor = (teamDraw: string[]) => {
    const byDate = new Map<string, Sample[]>();
    for (const team of teamDraw) {
      for (const row of byTeam.get(team) ?? []) {
        const list = byDate.get(row.date) ?? [];
        list.push(row);
        byDate.set(row.date, list);
      }
    }
    const totals = Object.fromEntries(PREDICTORS.map((key) => [key, 0])) as Record<
      PredictorKey,
      number
    >;
    let dates = 0;
    for (const list of Array.from(byDate.values())) {
      if (list.length < MIN_TEAMS_PER_DATE) continue;
      const y = list.map((row) => row.targets[target]);
      const values = PREDICTORS.map((key) =>
        spearman(list.map((row) => row.predictors[key]), y),
      );
      if (values.some((value) => value == null)) continue;
      PREDICTORS.forEach((key, index) => {
        totals[key] += values[index] as number;
      });
      dates++;
    }
    return { totals, dates };
  };
  const spearmanDeltas = Object.fromEntries(
    others.map((other) => {
      const boot = draws.flatMap((draw) => {
        const { totals, dates } = meanSpearmanFor(draw);
        return dates > 0 ? [(totals.v2 - totals[other]) / dates] : [];
      });
      return [
        `v2Minus_${other}`,
        [round(quantile(boot, 0.025)), round(quantile(boot, 0.975))],
      ];
    }),
  );
  let heldOutDeltas: Record<string, unknown> | null = null;
  if (heldOutSplit) {
    const trainRows = heldOutSplit.train.filter((row) => row.targets[target] != null);
    const trainMean =
      trainRows.reduce((total, row) => total + row.targets[target], 0) / trainRows.length;
    const fits = Object.fromEntries(
      PREDICTORS.map((key) => [
        key,
        ols(
          trainRows.map((row) => row.predictors[key]),
          trainRows.map((row) => row.targets[target]),
        ),
      ]),
    ) as Record<PredictorKey, { intercept: number; slope: number }>;
    const perTeam = new Map<string, { se: Record<string, number>; n: number }>();
    for (const team of teams) {
      const entry = {
        se: Object.fromEntries([...PREDICTORS, "baseline"].map((key) => [key, 0])),
        n: 0,
      };
      for (const row of byTeam.get(team) ?? []) {
        if (row.date < heldOutSplit.testFrom) continue;
        const y = row.targets[target];
        for (const key of PREDICTORS) {
          entry.se[key] +=
            (fits[key].intercept + fits[key].slope * row.predictors[key] - y) ** 2;
        }
        entry.se.baseline += (trainMean - y) ** 2;
        entry.n += 1;
      }
      perTeam.set(team, entry);
    }
    const skill = (draw: string[], key: string) => {
      let se = 0;
      let base = 0;
      for (const team of draw) {
        se += perTeam.get(team)!.se[key];
        base += perTeam.get(team)!.se.baseline;
      }
      return 1 - se / base;
    };
    heldOutDeltas = Object.fromEntries(
      others.map((other) => {
        const boot = draws.map((draw) => skill(draw, "v2") - skill(draw, other));
        return [
          `v2Minus_${other}`,
          {
            point: round(skill(teams, "v2") - skill(teams, other)),
            ci95: [round(quantile(boot, 0.025)), round(quantile(boot, 0.975))],
          },
        ];
      }),
    );
  }
  return { teams: teams.length, spearmanDeltaCi95: spearmanDeltas, heldOutSkillDelta: heldOutDeltas };
}

function harnessCheck(
  season: SeasonInput,
  stored: Csv,
  version: 1 | 2,
): Record<string, unknown> {
  const rows = stored.filter(
    (row) =>
      Number(row.ctpi_version) === version &&
      Number(row.season_id) === season.seasonId,
  );
  const dates = Array.from(new Set(rows.map((row) => row.date))).sort();
  let compared = 0;
  let exact = 0;
  let maxAbs = 0;
  let storedOnly = 0;
  let offlineOnly = 0;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const date of dates) {
    const storedByTeam = new Map(
      rows.filter((row) => row.date === date).map((row) => [row.team, Number(row.ctpi_raw)]),
    );
    const offline = new Map<string, number>();
    if (version === 2) {
      for (const score of buildRecentTeamFormCandidateSnapshot(season.sourceRows, date).scores) {
        if (score.status !== "unavailable" && score.ctpi_raw != null) {
          offline.set(score.team, score.ctpi_raw);
        }
      }
    } else {
      // Stored v1 used games through D (sourceCutoff games_through_date).
      for (const score of v1Scores(season.sourceRows, date, true)) {
        offline.set(score.team, score.ctpi_raw);
      }
    }
    for (const [team, value] of Array.from(storedByTeam.entries())) {
      const mine = offline.get(team);
      if (mine == null) {
        storedOnly++;
        continue;
      }
      compared++;
      const diff = Math.abs(mine - value);
      if (diff < 1e-9) exact++;
      maxAbs = Math.max(maxAbs, diff);
      xs.push(mine);
      ys.push(value);
    }
    for (const team of Array.from(offline.keys())) {
      if (!storedByTeam.has(team)) offlineOnly++;
    }
  }
  return {
    version,
    seasonId: season.seasonId,
    storedRows: rows.length,
    dates: dates.length,
    compared,
    exactWithin1e9: exact,
    maxAbsDiff: round(maxAbs, 9),
    pearson: round(pearson(xs, ys), 6),
    storedOnly,
    offlineOnly,
  };
}

function main() {
  const dataDir = arg("data");
  const outFile = arg("out");
  const seasons = loadSeasons(dataDir);
  const stored = readCsv(path.join(dataDir, "ctpi_stored.csv"));

  const harness = [
    harnessCheck(seasons.get(20262027)!, stored, 2),
    harnessCheck(seasons.get(20262027)!, stored, 1),
    harnessCheck(seasons.get(20252026)!, stored, 1),
  ];

  const samplesBySeason = new Map<number, Sample[]>();
  const coverage: Record<string, unknown> = {};
  for (const season of Array.from(seasons.values())) {
    const snapshots = season.gameDays.map((date) => buildSnapshot(season, date));
    const storedV1 = new Map(
      stored
        .filter(
          (row) =>
            Number(row.ctpi_version) === 1 &&
            Number(row.season_id) === season.seasonId,
        )
        .map((row) => [`${row.team}|${row.date}`, Number(row.ctpi_raw)]),
    );
    const samples = buildSamples(season, snapshots, storedV1);
    samplesBySeason.set(season.seasonId, samples);
    const teamDates = snapshots.length * season.teams.length;
    const v2Scored = snapshots.reduce((total, snap) => total + snap.v2.size, 0);
    const v1Scored = snapshots.reduce((total, snap) => total + snap.v1.size, 0);
    const statusCounts: Record<string, number> = {};
    snapshots.forEach((snap) =>
      snap.v2Status.forEach((status) => {
        statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      }),
    );
    const pairedV = samples.map((row) => [row.predictors.v1, row.predictors.v2]);
    coverage[season.seasonId] = {
      sourceRows: season.sourceRows.length,
      resultRows: season.results.length,
      teams: season.teams.length,
      gameDays: season.gameDays.length,
      firstGameDay: season.gameDays[0],
      lastGameDay: season.gameDays.at(-1),
      teamDates,
      v1Scored,
      v2Scored,
      v2StatusCounts: statusCounts,
      pairedSamples: samples.length,
      pairedWithTarget: Object.fromEntries(
        HORIZONS.map((horizon) => [
          horizon,
          samples.filter((row) => row.targets[`gd${horizon}`] != null).length,
        ]),
      ),
      v1VsV2Pearson: round(pearson(pairedV.map((p) => p[0]), pairedV.map((p) => p[1]))),
      v1VsV2Spearman: round(spearman(pairedV.map((p) => p[0]), pairedV.map((p) => p[1]))),
    };
  }

  const crossSectional: Record<string, unknown> = {};
  const pooled: Record<string, unknown> = {};
  const issuedV1: Record<string, unknown> = {};
  let seed = 20261113;
  for (const [seasonId, samples] of Array.from(samplesBySeason.entries())) {
    for (const horizon of HORIZONS) {
      for (const kind of ["gd", "pts"]) {
        const target = `${kind}${horizon}`;
        crossSectional[`${seasonId}.${target}`] = summarizeSpearman(
          perDateSpearman(samples, target),
          seed++,
        );
        pooled[`${seasonId}.${target}`] = pooledCorrelations(samples, target);
        issuedV1[`${seasonId}.${target}`] = issuedV1Comparison(samples, target, seed++);
      }
    }
  }

  // Held-out calibration splits.
  const s2526 = samplesBySeason.get(20252026)!;
  const s2627 = samplesBySeason.get(20262027)!;
  const split = "2026-01-01";
  const splitNumber = Number(split.replace(/-/g, ""));
  const heldOutResults: Record<string, unknown> = {};
  for (const horizon of HORIZONS) {
    for (const kind of ["gd", "pts"]) {
      const target = `${kind}${horizon}`;
      const train = s2526.filter(
        (row) =>
          row.targets[`last${horizon}`] != null &&
          row.targets[`last${horizon}`] < splitNumber,
      );
      const test = s2526.filter((row) => row.date >= split);
      heldOutResults[`within2025-26.${target}`] = heldOut(train, test, target, horizon, seed++);
      heldOutResults[`2025-26to2026-27.${target}`] = heldOut(s2526, s2627, target, horizon, seed++);
    }
  }

  const sensitivity: Record<string, unknown> = {};
  for (const horizon of HORIZONS) {
    for (const kind of ["gd", "pts"]) {
      const target = `${kind}${horizon}`;
      sensitivity[`2025-26.${target}`] = teamClusterSensitivity(
        s2526,
        target,
        ["v1", "v1NoLuck"],
        seed++,
        {
          train: s2526.filter(
            (row) =>
              row.targets[`last${horizon}`] != null &&
              row.targets[`last${horizon}`] < splitNumber,
          ),
          testFrom: split,
        },
      );
    }
  }

  const primary = {
    horizon: PRIMARY_HORIZON,
    nonInferiorityMargin: NON_INFERIORITY_MARGIN,
    gd: crossSectional[`20252026.gd${PRIMARY_HORIZON}`],
    pts: crossSectional[`20252026.pts${PRIMARY_HORIZON}`],
  };

  const result = {
    generatedAt: new Date().toISOString(),
    design: {
      seasons: SEASONS,
      horizons: HORIZONS,
      primaryHorizon: PRIMARY_HORIZON,
      informationSet: "games strictly before snapshot date D (both versions)",
      targets: "team's next N games dated on or after D: GD per game, points% = points / (2N)",
      snapshotDates: "every game day of the season",
      minTeamsPerDate: MIN_TEAMS_PER_DATE,
      bootstrap: {
        kind: "moving-block over ordered game days",
        blockGameDays: BLOCK_GAME_DAYS,
        reps: BOOTSTRAP_REPS,
      },
      heldOutSplit: split,
      nonInferiorityMargin: NON_INFERIORITY_MARGIN,
    },
    harness,
    coverage,
    primary,
    crossSectional,
    pooled,
    issuedV1,
    heldOut: heldOutResults,
    teamClusterSensitivity: sensitivity,
  };
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ harness, coverage, primary }, null, 2));
}

if (require.main === module) main();
