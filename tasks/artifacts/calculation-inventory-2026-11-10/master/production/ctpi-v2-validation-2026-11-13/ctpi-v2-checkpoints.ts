/**
 * Lane F5 checkpoint protocol (TJ direction, 2026-11-13).
 *
 * A forecast is issued at each team's completed game k (snapshot date D =
 * the day after the team's k-th game, inputs = games before D), and graded
 * on that team's next 10 games (k+1 … k+10). Reviews use completed-game
 * checkpoints:
 *
 *  - Game 10: coverage and stability (informational).
 *  - Game 20: first complete batch graded (k = 10), informational.
 *  - Game 30: batches k = 10 … 20, informational.
 *  - Game 40: formal decision on the fully matured batches k = 10 … 30, with
 *    the preset −0.03 margin judged on unrounded results. TJ adopted every
 *    game 10–30 as the formal set on 2026-11-13, before any 2026-27 batch was
 *    graded. Later forecasts are not part of the decision.
 *
 * Earlier looks are informational, not extra chances to pass.
 *
 * Matched variants share the same pregame inputs and dates:
 *  - v1 (with PDO) and v1 without PDO;
 *  - v2 (without PDO) and v2 + PDO (v1's hand-set 0.1 weight; exploratory).
 * Historically issued v1 rows are reported separately.
 *
 * Uncertainty accounts for shared games and overlapping windows in two ways.
 * The decision uses the wider interval.
 *  (a) A team-cluster bootstrap.
 *  (b) A dependency-graph jackknife. Forecasts i and j are linked when they
 *      belong to the same team, or when one's target games intersect the
 *      other's target or input games.
 *
 * Offline only: the inputs are CSVs (see REPORT.md). No database calls.
 *
 * Run from web/:
 *   NODE_PATH=. npx ts-node --transpile-only --compiler-options \
 *     '{"module":"commonjs","moduleResolution":"node"}' \
 *     ../tasks/.../ctpi-v2-validation-2026-11-13/ctpi-v2-checkpoints.ts \
 *     --data=<csv dir> --season=20262027 --as-of=YYYY-MM-DD --out=<json> [--formal]
 *     [--batches-only]
 */
import fs from "node:fs";
import path from "node:path";

import { buildRecentTeamFormCandidateSnapshot } from "lib/trends/recentTeamFormV2Provenance";

import {
  loadSeasons,
  mulberry32,
  quantile,
  readCsv,
  round,
  spearman,
  v1Scores,
  type SeasonInput,
} from "./ctpi-v2-validation";

/**
 * Adopted formal set (TJ, 2026-11-13): every completed game 10…30.
 * `--batches-only` reproduces the 10/20/30 batch design for reference only.
 */
const BATCHES_ONLY = process.argv.includes("--batches-only");
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);
const CHECKPOINTS: readonly number[] = BATCHES_ONLY ? [10, 20, 30, 40] : range(10, 40);
const FORMAL_BATCHES: readonly number[] = BATCHES_ONLY ? [10, 20, 30] : range(10, 30);
const HORIZON = 10;
const INPUT_GAMES = 10;
const MARGIN = 0.03;
const MIN_TEAMS_PER_BATCH = 16;
const REPS = 2000;
const VARIANTS = ["v1", "v1NoPdo", "v2", "v2PlusPdo"] as const;
const TARGETS = ["gd", "pts"] as const;
type Variant = (typeof VARIANTS)[number];
type Target = (typeof TARGETS)[number];

const COMPARISONS: Array<{ key: string; left: Variant; right: Variant }> = [
  { key: "v2_minus_v1", left: "v2", right: "v1" },
  { key: "v2_minus_v1NoPdo", left: "v2", right: "v1NoPdo" },
  { key: "v2PlusPdo_minus_v1", left: "v2PlusPdo", right: "v1" },
  { key: "v1_minus_v1NoPdo", left: "v1", right: "v1NoPdo" },
  { key: "v2PlusPdo_minus_v2", left: "v2PlusPdo", right: "v2" },
];

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

type ScheduledGame = { id: string; date: string; opponent: string };

type Forecast = {
  team: string;
  checkpoint: number;
  issueDate: string;
  inputGameIds: string[];
  targetGameIds: string[];
  matured: boolean;
  scores: Record<Variant, number | null>;
  v2Status: string;
  v2MissingComponents: string[];
  v2PdoAvailable: boolean;
  issuedV2: number | null;
  issuedV2MatchesOffline: boolean | null;
  issuedV1Previous: number | null;
  targets: Record<Target, number | null>;
};

type SnapshotScores = {
  v1: Map<string, { raw: number; luck: number }>;
  v2: Map<
    string,
    { raw: number | null; status: string; pdoZ: number | null; missing: string[] }
  >;
};

function buildSchedule(rows: Array<Record<string, string>>, seasonId: number) {
  const byTeam = new Map<string, ScheduledGame[]>();
  for (const row of rows) {
    if (Number(row.season_id) !== seasonId) continue;
    for (const [team, opponent] of [
      [row.home, row.away],
      [row.away, row.home],
    ]) {
      const list = byTeam.get(team) ?? [];
      list.push({ id: row.id, date: row.date, opponent });
      byTeam.set(team, list);
    }
  }
  byTeam.forEach((list) =>
    list.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
  );
  return byTeam;
}

function snapshotAt(season: SeasonInput, date: string, cache: Map<string, SnapshotScores>) {
  const cached = cache.get(date);
  if (cached) return cached;
  const v1 = new Map<string, { raw: number; luck: number }>();
  for (const score of v1Scores(season.sourceRows, date, false)) {
    v1.set(score.team, { raw: score.ctpi_raw, luck: score.luck });
  }
  const v2 = new Map<
    string,
    { raw: number | null; status: string; pdoZ: number | null; missing: string[] }
  >();
  for (const score of buildRecentTeamFormCandidateSnapshot(season.sourceRows, date).scores) {
    v2.set(score.team, {
      raw: score.status === "unavailable" ? null : score.ctpi_raw,
      status: score.status,
      pdoZ: score.pdoContext.z,
      missing: score.missingComponents,
    });
  }
  const result = { v1, v2 };
  cache.set(date, result);
  return result;
}

function buildForecasts(
  season: SeasonInput,
  schedule: Map<string, ScheduledGame[]>,
  stored: Array<Record<string, string>>,
  asOf: string,
): Forecast[] {
  const results = new Map(
    season.results.map((row) => [`${row.team}|${row.date}`, row]),
  );
  const storedByKey = new Map(
    stored
      .filter((row) => Number(row.season_id) === season.seasonId)
      .map((row) => [`${row.ctpi_version}|${row.team}|${row.date}`, Number(row.ctpi_raw)]),
  );
  const cache = new Map<string, SnapshotScores>();
  const forecasts: Forecast[] = [];
  for (const [team, games] of Array.from(schedule.entries()).sort()) {
    for (const checkpoint of CHECKPOINTS) {
      const kth = games[checkpoint - 1];
      if (!kth || kth.date >= asOf) continue; // checkpoint not reached yet
      const issueDate = addDays(kth.date, 1);
      const inputs = games.slice(Math.max(0, checkpoint - INPUT_GAMES), checkpoint);
      const window = games.slice(checkpoint, checkpoint + HORIZON);
      const windowResults = window.map((game) => results.get(`${team}|${game.date}`));
      const matured =
        window.length === HORIZON &&
        window.every((game) => game.date < asOf) &&
        windowResults.every((row) => row != null);
      const snapshot = snapshotAt(season, issueDate, cache);
      const v1 = snapshot.v1.get(team);
      const v2 = snapshot.v2.get(team);
      const v2Raw = v2?.raw ?? null;
      const issuedV2 = storedByKey.get(`2|${team}|${issueDate}`) ?? null;
      forecasts.push({
        team,
        checkpoint,
        issueDate,
        inputGameIds: inputs.map((game) => game.id),
        targetGameIds: window.map((game) => game.id),
        matured,
        scores: {
          v1: v1?.raw ?? null,
          v1NoPdo: v1 ? v1.raw - 0.1 * v1.luck : null,
          v2: v2Raw,
          v2PlusPdo: v2Raw == null ? null : v2Raw + 0.1 * (v2?.pdoZ ?? 0),
        },
        v2Status: v2?.status ?? "missing",
        v2MissingComponents: v2?.missing ?? [],
        v2PdoAvailable: v2?.pdoZ != null,
        issuedV2,
        issuedV2MatchesOffline:
          issuedV2 == null || v2Raw == null ? null : Math.abs(issuedV2 - v2Raw) < 1e-9,
        issuedV1Previous: storedByKey.get(`1|${team}|${kth.date}`) ?? null,
        targets: matured
          ? {
              gd:
                windowResults.reduce((total, row) => total + row!.goalDifferential, 0) /
                HORIZON,
              pts:
                windowResults.reduce((total, row) => total + row!.points, 0) /
                (2 * HORIZON),
            }
          : { gd: null, pts: null },
      });
    }
  }
  return forecasts;
}

const isEligible = (forecast: Forecast) =>
  forecast.matured && VARIANTS.every((variant) => forecast.scores[variant] != null);

/** Mean over batches of per-batch Spearman(left) − Spearman(right). */
function batchDelta(
  forecasts: Forecast[],
  batches: readonly number[],
  target: Target,
  left: Variant,
  right: Variant,
  minTeams = MIN_TEAMS_PER_BATCH,
): number | null {
  const deltas: number[] = [];
  for (const batch of batches) {
    const rows = forecasts.filter((row) => row.checkpoint === batch);
    if (rows.length < minTeams) continue;
    const y = rows.map((row) => row.targets[target] as number);
    const a = spearman(rows.map((row) => row.scores[left] as number), y);
    const b = spearman(rows.map((row) => row.scores[right] as number), y);
    if (a == null || b == null) continue;
    deltas.push(a - b);
  }
  return deltas.length ? deltas.reduce((t, v) => t + v, 0) / deltas.length : null;
}

function batchMean(
  forecasts: Forecast[],
  batches: readonly number[],
  target: Target,
  variant: Variant,
): number | null {
  const values: number[] = [];
  for (const batch of batches) {
    const rows = forecasts.filter((row) => row.checkpoint === batch);
    if (rows.length < MIN_TEAMS_PER_BATCH) continue;
    const rho = spearman(
      rows.map((row) => row.scores[variant] as number),
      rows.map((row) => row.targets[target] as number),
    );
    if (rho != null) values.push(rho);
  }
  return values.length ? values.reduce((t, v) => t + v, 0) / values.length : null;
}

function linked(a: Forecast, b: Forecast): boolean {
  if (a.team === b.team) return true;
  const targetA = new Set(a.targetGameIds);
  const targetB = new Set(b.targetGameIds);
  return (
    b.targetGameIds.some((id) => targetA.has(id)) ||
    b.inputGameIds.some((id) => targetA.has(id)) ||
    a.inputGameIds.some((id) => targetB.has(id))
  );
}

function uncertainty(
  forecasts: Forecast[],
  batches: readonly number[],
  target: Target,
  left: Variant,
  right: Variant,
  seed: number,
) {
  const point = batchDelta(forecasts, batches, target, left, right);
  if (point == null) return null;
  // (a) team-cluster bootstrap: one team draw applied to every batch.
  const teams = Array.from(new Set(forecasts.map((row) => row.team))).sort();
  const byTeam = new Map(teams.map((team) => [team, forecasts.filter((row) => row.team === team)]));
  const random = mulberry32(seed);
  const boot: number[] = [];
  for (let rep = 0; rep < REPS; rep++) {
    const draw = teams.flatMap(
      () => byTeam.get(teams[Math.floor(random() * teams.length)]) ?? [],
    );
    const value = batchDelta(draw, batches, target, left, right);
    if (value != null) boot.push(value);
  }
  const teamCi = [quantile(boot, 0.025), quantile(boot, 0.975)];
  // (b) dependency-graph jackknife on leave-one-forecast-out pseudo-values.
  const n = forecasts.length;
  const pseudo = forecasts.map((_, index) => {
    const without = forecasts.filter((__, other) => other !== index);
    // A batch admitted at MIN teams must still score with one forecast left out.
    const value =
      batchDelta(without, batches, target, left, right, MIN_TEAMS_PER_BATCH - 1) ?? point;
    return n * point - (n - 1) * value;
  });
  const mean = pseudo.reduce((t, v) => t + v, 0) / n;
  let graphSum = 0;
  let edges = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || linked(forecasts[i], forecasts[j])) {
        graphSum += (pseudo[i] - mean) * (pseudo[j] - mean);
        if (i !== j) edges++;
      }
    }
  }
  const independent =
    pseudo.reduce((t, v) => t + (v - mean) ** 2, 0) / (n * (n - 1));
  const variance = Math.max(graphSum / n ** 2, independent);
  const half = 1.96 * Math.sqrt(variance);
  const graphCi = [point - half, point + half];
  return {
    point,
    teamBootstrapCi95: teamCi,
    dependencyGraphCi95: graphCi,
    dependencyEdges: edges / 2,
    lower: Math.min(teamCi[0], graphCi[0]),
    upper: Math.max(teamCi[1], graphCi[1]),
  };
}

function stability(stored: Array<Record<string, string>>, season: SeasonInput) {
  const rows = stored.filter(
    (row) => Number(row.ctpi_version) === 2 && Number(row.season_id) === season.seasonId,
  );
  if (rows.length === 0) return null;
  const played = new Set(season.results.map((row) => `${row.team}|${row.date}`));
  const byDate = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    const map = byDate.get(row.date) ?? new Map<string, number>();
    map.set(row.team, Number(row.ctpi_0_to_100));
    byDate.set(row.date, map);
  });
  const dates = Array.from(byDate.keys()).sort();
  const rankAgreement: number[] = [];
  const movedAfterGame: number[] = [];
  const movedNoGame: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const before = byDate.get(dates[i - 1])!;
    const after = byDate.get(dates[i])!;
    const teams = Array.from(after.keys()).filter((team) => before.has(team));
    const rho = spearman(
      teams.map((team) => before.get(team)!),
      teams.map((team) => after.get(team)!),
    );
    if (rho != null) rankAgreement.push(rho);
    for (const team of teams) {
      // Snapshot D+1 adds games dated D: did this team play on the earlier date?
      const change = Math.abs(after.get(team)! - before.get(team)!);
      (played.has(`${team}|${dates[i - 1]}`) ? movedAfterGame : movedNoGame).push(change);
    }
  }
  const weekly: number[] = [];
  for (let i = 7; i < dates.length; i++) {
    const before = byDate.get(dates[i - 7])!;
    const after = byDate.get(dates[i])!;
    after.forEach((value, team) => {
      if (before.has(team)) weekly.push(Math.abs(value - before.get(team)!));
    });
  }
  const summary = (values: number[]) =>
    values.length
      ? {
          n: values.length,
          median: round(quantile(values, 0.5), 2),
          p90: round(quantile(values, 0.9), 2),
          max: round(Math.max(...values), 2),
        }
      : null;
  return {
    issuedRows: rows.length,
    dates: dates.length,
    firstDate: dates[0],
    lastDate: dates.at(-1),
    dayToDayRankSpearman: {
      mean: round(rankAgreement.reduce((t, v) => t + v, 0) / rankAgreement.length),
      min: round(Math.min(...rankAgreement)),
    },
    dailyAbsChangeAfterTeamGame: summary(movedAfterGame),
    dailyAbsChangeNoTeamGame: summary(movedNoGame),
    weeklyAbsChange: summary(weekly),
    shareWeeklyChangeOver10Points: round(
      weekly.filter((value) => value > 10).length / weekly.length,
      3,
    ),
  };
}

function main() {
  const dataDir = arg("data");
  const seasonId = Number(arg("season"));
  const out = arg("out");
  if (!dataDir || !seasonId || !out) {
    throw new Error("Usage: --data=<dir> --season=<id> --as-of=YYYY-MM-DD --out=<file> [--formal]");
  }
  const formal = process.argv.includes("--formal");
  const seasons = loadSeasons(dataDir);
  const season = seasons.get(seasonId);
  if (!season) throw new Error(`No data for season ${seasonId}`);
  const asOf = arg("as-of") ?? addDays(season.gameDays.at(-1)!, 1);
  const schedule = buildSchedule(readCsv(path.join(dataDir, "schedule.csv")), seasonId);
  const stored = readCsv(path.join(dataDir, "ctpi_stored.csv"));
  const forecasts = buildForecasts(season, schedule, stored, asOf);

  const coverage = CHECKPOINTS.map((checkpoint) => {
    const rows = forecasts.filter((row) => row.checkpoint === checkpoint);
    const statuses: Record<string, number> = {};
    rows.forEach((row) => {
      statuses[row.v2Status] = (statuses[row.v2Status] ?? 0) + 1;
    });
    const missing: Record<string, number> = {};
    rows.forEach((row) =>
      row.v2MissingComponents.forEach((key) => {
        missing[key] = (missing[key] ?? 0) + 1;
      }),
    );
    const v1v2 = rows.filter((row) => row.scores.v1 != null && row.scores.v2 != null);
    return {
      checkpoint,
      teamsIssued: rows.length,
      issueDates: rows.length
        ? [rows.map((r) => r.issueDate).sort()[0], rows.map((r) => r.issueDate).sort().at(-1)]
        : null,
      v2Status: statuses,
      v2MissingComponents: missing,
      v2PdoContextAvailable: rows.filter((row) => row.v2PdoAvailable).length,
      issuedV2Rows: rows.filter((row) => row.issuedV2 != null).length,
      issuedV2MatchesOffline: rows.filter((row) => row.issuedV2MatchesOffline === true).length,
      issuedV2Mismatches: rows.filter((row) => row.issuedV2MatchesOffline === false).length,
      v1VsV2RankSpearman: round(
        spearman(
          v1v2.map((row) => row.scores.v1 as number),
          v1v2.map((row) => row.scores.v2 as number),
        ),
      ),
      matured: rows.filter((row) => row.matured).length,
      eligible: rows.filter(isEligible).length,
    };
  });

  const eligible = forecasts.filter(isEligible);
  // A batch is graded only when every team has reached checkpoint k and every
  // team's 10-game window has been played (a complete batch); no partial peeks.
  const partial = process.argv.includes("--partial");
  const maturedBatches = FORMAL_BATCHES.filter((batch) => {
    const issued = forecasts.filter((row) => row.checkpoint === batch);
    const complete =
      issued.length === schedule.size &&
      issued.every((row) => row.targetGameIds.length === HORIZON && row.matured);
    return (
      (complete || partial) &&
      eligible.filter((row) => row.checkpoint === batch).length >= MIN_TEAMS_PER_BATCH
    );
  });
  // Game 40 is the formal look in both modes.
  const allTeamsReached40 =
    forecasts.filter((row) => row.checkpoint === 40).length === schedule.size;
  const allFormalMatured = FORMAL_BATCHES.every((batch) =>
    forecasts
      .filter((row) => row.checkpoint === batch)
      .every((row) => row.matured),
  );
  const pooledEligible = eligible.filter((row) =>
    (maturedBatches as readonly number[]).includes(row.checkpoint),
  );
  let seed = 20261113;
  const comparisons: Record<string, unknown> = {};
  const perBatch: Record<string, unknown> = {};
  for (const target of TARGETS) {
    perBatch[target] = Object.fromEntries(
      maturedBatches.map((batch) => [
        batch,
        Object.fromEntries(
          VARIANTS.map((variant) => [
            variant,
            round(batchMean(pooledEligible, [batch], target, variant)),
          ]),
        ),
      ]),
    );
    comparisons[target] = Object.fromEntries(
      COMPARISONS.map(({ key, left, right }) => [
        key,
        uncertainty(pooledEligible, maturedBatches, target, left, right, seed++),
      ]),
    );
  }

  // Issued v1 (stored row for the day of game k, i.e. games 1..k), reported separately.
  const issuedV1 = Object.fromEntries(
    TARGETS.map((target) => {
      const values: Array<{ batch: number; issued: number | null; v2: number | null; n: number }> = [];
      for (const batch of maturedBatches) {
        const rows = pooledEligible.filter(
          (row) => row.checkpoint === batch && row.issuedV1Previous != null,
        );
        if (rows.length < MIN_TEAMS_PER_BATCH) continue;
        const y = rows.map((row) => row.targets[target] as number);
        values.push({
          batch,
          n: rows.length,
          issued: round(spearman(rows.map((row) => row.issuedV1Previous as number), y)),
          v2: round(spearman(rows.map((row) => row.scores.v2 as number), y)),
        });
      }
      return [target, values];
    }),
  );

  const primary = Object.fromEntries(
    TARGETS.map((target) => [
      target,
      (comparisons[target] as Record<string, ReturnType<typeof uncertainty>>).v2_minus_v1,
    ]),
  );
  const formalReady =
    allTeamsReached40 &&
    allFormalMatured &&
    maturedBatches.length === FORMAL_BATCHES.length;
  let decision: string;
  if (!formal) {
    decision = "informational look: not a decision";
  } else if (!formalReady) {
    decision = "formal look requested before every team completed game 40 with every formal batch matured: refused";
  } else if (TARGETS.every((target) => primary[target] != null && primary[target]!.lower >= -MARGIN)) {
    decision = "pass: v2 non-inferior to v1 on both targets (lower bound ≥ −0.03, unrounded)";
  } else if (TARGETS.some((target) => primary[target] != null && primary[target]!.upper < -MARGIN)) {
    decision = "inferior: v2 worse than v1 by more than the margin on at least one target";
  } else {
    decision = "inconclusive: keep the descriptive beta; predictive use stays gated";
  }

  const result = {
    generatedAt: new Date().toISOString(),
    seasonId,
    asOf,
    formalRequested: formal,
    formalSet: BATCHES_ONLY
      ? "batches 10/20/30 (reference only)"
      : "every completed game 10…30 (adopted 2026-11-13)",
    partialBatchesAllowed: partial,
    formalReady,
    decision,
    margin: MARGIN,
    design: {
      checkpoints: CHECKPOINTS,
      formalBatches: FORMAL_BATCHES,
      issueDate: "day after the team's k-th game; inputs = games before that date",
      target: "team games k+1 … k+10: GD per game and points% (points / 20)",
      statistic: "mean over batches of per-batch Spearman across teams; Δ = left − right",
      uncertainty:
        "wider of a team-cluster bootstrap and a dependency-graph jackknife (links: same team, or target games shared with the other forecast's target or input games)",
      minTeamsPerBatch: MIN_TEAMS_PER_BATCH,
      reps: REPS,
    },
    coverage,
    maturedBatches,
    eligibleForecasts: pooledEligible.length,
    perBatchSpearman: perBatch,
    comparisons,
    issuedV1,
    stability: stability(stored, season),
  };
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ seasonId, asOf, decision, coverage, maturedBatches, primary }, null, 2));
}

if (require.main === module) main();
