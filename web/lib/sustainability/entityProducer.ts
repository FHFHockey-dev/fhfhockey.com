// web/lib/sustainability/entityProducer.ts
//
// Producer for the unified team/goalie sustainability tables
// (entity_sustainability_scores_daily, entity_sustainability_bands_daily).
//
// Pure computation only: no database access lives here. Every reading is
// strictly as-of its snapshot date. A team or goalie that did not play on a
// date keeps the rolling window of its most recent games (the window is still
// "the last N games as of this date"), and the row says so in metadata. A
// date is never filled with a neutral placeholder or another date's reading:
// when an input is missing or a comparison cannot be computed, no row is
// written and the skip is reported with its reason.

export const ENTITY_SUSTAINABILITY_MODEL_VERSION = "entity_sustainability_v1";
export const ENTITY_SUSTAINABILITY_WINDOWS = [
  { code: "l3", n: 3 },
  { code: "l5", n: 5 },
  { code: "l10", n: 10 },
  { code: "l20", n: 20 }
] as const;

export type EntityWindowCode = (typeof ENTITY_SUSTAINABILITY_WINDOWS)[number]["code"];

/** Central 80% range, matching the skater usual range (decision 33). */
const RANGE_Z = 1.2815515655446004;
/** |z| at or beyond this is over/underperforming expectation. */
export const EXPECTATION_STATE_Z = 1;
const COMPONENT_Z_LIMIT = 3;
const S_RAW_LIMIT = 8;
/** League residual spread needs at least this many entities on a date. */
const MIN_LEAGUE_SPREAD_ENTITIES = 10;

export const ENTITY_SUSTAINABILITY_CONFIG = {
  team: {
    /** Pre-window baseline shrinks toward the league with this many games of league-average events. */
    sharePriorGames: 5,
    /** Finishing and save baselines shrink toward the league with this many shots. */
    shootingPriorShots: 1500,
    savePriorShots: 1500,
    /**
     * Scales the weighted z sum to unit spread before the logistic. Set from
     * the 2026-27 dry run through 2026-11-22 (weighted-sum SD about 2.5), so
     * s_100 is not pinned at 0 or 100 for ordinary weeks.
     */
    scoreScale: 0.4,
    weights: {
      process: { xgf_pct: 0.9, scf_pct: 0.6, hdcf_pct: 0.6 },
      finishing: { on_ice_sh_pct: -1.0, on_ice_sv_pct: -1.0 }
    }
  },
  goalie: {
    savePriorShots: 1500,
    qualityStartPriorStarts: 10,
    ratePriorSeconds: 10 * 3600,
    countPriorGames: 10,
    /** Readings stop after this many days without an appearance (TJ 2026-11-23). */
    maxDaysSinceLastGame: 30,
    /** Weighted-sum SD about 1.7 in the same dry run. */
    scoreScale: 0.6,
    weights: {
      save_pct: -0.6,
      saves_above_expected: -1.0
    }
  },
  expectationStateZ: EXPECTATION_STATE_Z,
  rangeInterval: "central_80"
} as const;

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a_${hash.toString(16).padStart(8, "0")}`;
}

export const ENTITY_SUSTAINABILITY_CONFIG_HASH = fnv1a(
  stableStringify({
    model: ENTITY_SUSTAINABILITY_MODEL_VERSION,
    windows: ENTITY_SUSTAINABILITY_WINDOWS,
    config: ENTITY_SUSTAINABILITY_CONFIG
  })
);

// ---------------------------------------------------------------------------
// Input and output shapes

export type TeamGameInput = {
  teamId: number;
  teamAbbrev: string;
  date: string;
  xgf: number;
  xga: number;
  scf: number;
  sca: number;
  hdcf: number;
  hdca: number;
  gf: number;
  ga: number;
  sf: number;
  sa: number;
};

export type GoalieGameInput = {
  goalieId: number;
  teamId: number;
  teamAbbrev: string;
  date: string;
  started: boolean;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  toiSeconds: number;
  qualityStart: boolean;
  shutout: boolean;
  /** NST expected goals against for the appearance; null when not ingested. */
  xgAgainst: number | null;
};

/** A completed scheduled game for a team (from the games table). */
export type CompletedTeamGame = { teamId: number; date: string };

export type ScoreRow = {
  snapshot_date: string;
  season_id: number;
  entity_type: "team" | "goalie";
  entity_id: number;
  team_id: number | null;
  player_id: number | null;
  metric_scope: "overall";
  window_code: EntityWindowCode;
  baseline_value: number | null;
  recent_value: number | null;
  expected_value: number | null;
  z_score: number | null;
  s_raw: number;
  s_100: number;
  expectation_state: "overperforming" | "stable" | "underperforming";
  components: Record<string, unknown>;
  provenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type BandRow = {
  snapshot_date: string;
  season_id: number;
  entity_type: "team" | "goalie";
  entity_id: number;
  team_id: number | null;
  player_id: number | null;
  metric_key: string;
  window_code: EntityWindowCode;
  baseline: number | null;
  ewma: number | null;
  value: number;
  ci_lower: number;
  ci_upper: number;
  z_score: number | null;
  percentile: number | null;
  exposure: number | null;
  distribution: Record<string, unknown>;
  provenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type SkipRecord = {
  snapshot_date: string;
  entity_type: "team" | "goalie";
  entity_id: number;
  window_code: EntityWindowCode | null;
  reason: string;
  detail?: Record<string, unknown>;
};

export type ProducerResult = {
  scores: ScoreRow[];
  bands: BandRow[];
  skips: SkipRecord[];
};

// ---------------------------------------------------------------------------
// Small numeric helpers

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function clamp(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 erf). */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  let total = 0;
  for (const row of rows) total += pick(row);
  return total;
}

function sampleSd(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Percent rank of `value` within `population` (ties count half), 0-100. */
export function percentRank(value: number, population: number[]): number | null {
  if (!population.length) return null;
  let below = 0;
  let ties = 0;
  for (const candidate of population) {
    if (candidate < value) below += 1;
    else if (candidate === value) ties += 1;
  }
  return round(((below + 0.5 * ties) / population.length) * 100, 2);
}

/** Inclusive list of ISO dates from start to end. */
export function isoDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= stop.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  );
}

/**
 * EWMA of a ratio, smoothing numerator and denominator separately so a
 * single low-volume game does not swing it. alpha = 2 / (n + 1).
 */
function ewmaRatio<T>(
  games: T[],
  n: number,
  num: (row: T) => number,
  den: (row: T) => number
): number | null {
  if (!games.length) return null;
  const alpha = 2 / (n + 1);
  let eNum = num(games[0]);
  let eDen = den(games[0]);
  for (let i = 1; i < games.length; i += 1) {
    eNum = alpha * num(games[i]) + (1 - alpha) * eNum;
    eDen = alpha * den(games[i]) + (1 - alpha) * eDen;
  }
  return eDen > 0 ? eNum / eDen : null;
}

// ---------------------------------------------------------------------------
// Metric evaluation shared by teams and goalies

type MetricEval = {
  key: string;
  /** Observed window value in output units. */
  observed: number;
  /** Pre-window baseline in output units. */
  baseline: number;
  /** Spread of the window value around the baseline, output units. Null = from league residuals. */
  sd: number | null;
  /**
   * Poisson spread scaled by the league's over-dispersion on the same date
   * and window: sd * sqrt(mean squared Poisson z across entities), floored at 1.
   */
  overdispersed?: boolean;
  ewma: number | null;
  family:
    | "normal_binomial"
    | "normal_poisson"
    | "normal_poisson_overdispersed"
    | "normal_league_residual";
  count: number;
  exposure: number;
  baselineEvidence: number;
};

type ResolvedMetric = MetricEval & {
  sd: number;
  z: number;
  lower: number;
  upper: number;
  percentile: number | null;
};

/**
 * Resolve spreads that come from the league (residual SD of window value
 * around each entity's own baseline, across entities on the same date and
 * window), then z, range and percentile. Metrics that cannot be resolved are
 * returned in `unavailable` with a reason.
 */
function resolveMetrics(
  perEntity: Map<number, MetricEval[]>
): {
  resolved: Map<number, Map<string, ResolvedMetric>>;
  unavailable: Map<number, Map<string, string>>;
  leagueSpread: Record<string, number | null>;
} {
  const residualsByKey = new Map<string, number[]>();
  const squaredZByKey = new Map<string, number[]>();
  const observedByKey = new Map<string, number[]>();
  for (const evals of perEntity.values()) {
    for (const m of evals) {
      const observed = observedByKey.get(m.key) ?? [];
      observed.push(m.observed);
      observedByKey.set(m.key, observed);
      if (m.sd === null) {
        const residuals = residualsByKey.get(m.key) ?? [];
        residuals.push(m.observed - m.baseline);
        residualsByKey.set(m.key, residuals);
      } else if (m.overdispersed && m.sd > 0) {
        const squares = squaredZByKey.get(m.key) ?? [];
        squares.push(((m.observed - m.baseline) / m.sd) ** 2);
        squaredZByKey.set(m.key, squares);
      }
    }
  }
  const dispersion: Record<string, number | null> = {};
  for (const [key, squares] of squaredZByKey) {
    dispersion[key] =
      squares.length >= MIN_LEAGUE_SPREAD_ENTITIES
        ? Math.max(1, squares.reduce((a, b) => a + b, 0) / squares.length)
        : null;
  }
  const leagueSpread: Record<string, number | null> = {};
  for (const [key, residuals] of residualsByKey) {
    leagueSpread[key] =
      residuals.length >= MIN_LEAGUE_SPREAD_ENTITIES ? sampleSd(residuals) : null;
  }

  const resolved = new Map<number, Map<string, ResolvedMetric>>();
  const unavailable = new Map<number, Map<string, string>>();
  for (const [entityId, evals] of perEntity) {
    const ok = new Map<string, ResolvedMetric>();
    const bad = new Map<string, string>();
    for (const m of evals) {
      let sd = m.sd ?? leagueSpread[m.key] ?? null;
      if (m.overdispersed && sd !== null) {
        const phi = dispersion[m.key] ?? null;
        sd = phi === null ? null : sd * Math.sqrt(phi);
      }
      if (sd === null) {
        bad.set(m.key, "league_spread_unavailable");
        continue;
      }
      if (!(sd > 0) || !Number.isFinite(sd)) {
        bad.set(m.key, "zero_spread");
        continue;
      }
      ok.set(m.key, {
        ...m,
        sd,
        z: (m.observed - m.baseline) / sd,
        lower: m.baseline - RANGE_Z * sd,
        upper: m.baseline + RANGE_Z * sd,
        percentile: percentRank(m.observed, observedByKey.get(m.key) ?? [])
      });
    }
    resolved.set(entityId, ok);
    unavailable.set(entityId, bad);
  }
  return { resolved, unavailable, leagueSpread };
}

type EntityContext = {
  entityType: "team" | "goalie";
  entityId: number;
  teamId: number | null;
  playerId: number | null;
  windowCode: EntityWindowCode;
  windowSize: number;
  snapshotDate: string;
  seasonId: number;
  windowDates: string[];
  seasonGamesToDate: number;
  preWindowGames: number;
  lastGameDate: string;
  sourceTables: string[];
};

function rowMetadata(ctx: EntityContext): Record<string, unknown> {
  const playedOnSnapshot = ctx.lastGameDate === ctx.snapshotDate;
  return {
    window_size: ctx.windowSize,
    games_in_window: ctx.windowDates.length,
    partial_window: ctx.windowDates.length < ctx.windowSize,
    window_is_season_to_date: ctx.preWindowGames === 0,
    season_games_to_date: ctx.seasonGamesToDate,
    last_game_date: ctx.lastGameDate,
    played_on_snapshot: playedOnSnapshot,
    carried_forward: !playedOnSnapshot,
    days_since_last_game: daysBetween(ctx.lastGameDate, ctx.snapshotDate)
  };
}

function rowProvenance(ctx: EntityContext): Record<string, unknown> {
  return {
    model_version: ENTITY_SUSTAINABILITY_MODEL_VERSION,
    config_hash: ENTITY_SUSTAINABILITY_CONFIG_HASH,
    as_of: ctx.snapshotDate,
    source_tables: ctx.sourceTables,
    window_start_game_date: ctx.windowDates[0],
    window_end_game_date: ctx.windowDates[ctx.windowDates.length - 1],
    baseline_basis: "pre_window_season_to_date_shrunk_to_league_as_of"
  };
}

function buildBandRow(ctx: EntityContext, metric: ResolvedMetric): BandRow {
  const upperTail = 1 - normalCdf(metric.z);
  const lowerTail = normalCdf(metric.z);
  const status =
    metric.observed > metric.upper
      ? "hot"
      : metric.observed < metric.lower
        ? "cold"
        : "neutral";
  return {
    snapshot_date: ctx.snapshotDate,
    season_id: ctx.seasonId,
    entity_type: ctx.entityType,
    entity_id: ctx.entityId,
    team_id: ctx.teamId,
    player_id: ctx.playerId,
    metric_key: metric.key,
    window_code: ctx.windowCode,
    baseline: round(metric.baseline),
    ewma: metric.ewma === null ? null : round(metric.ewma),
    value: round(metric.observed),
    ci_lower: round(metric.lower),
    ci_upper: round(metric.upper),
    z_score: round(metric.z, 4),
    percentile: metric.percentile,
    exposure: ctx.windowDates.length,
    distribution: {
      sd: round(metric.sd),
      usualRange: {
        basis: "pre_window_baseline_league_prior",
        interval: "central_80",
        validated: false,
        family: metric.family,
        observed: round(metric.observed),
        lower: round(metric.lower),
        upper: round(metric.upper),
        baseline: round(metric.baseline),
        upperTail: round(upperTail),
        lowerTail: round(lowerTail),
        status,
        count: round(metric.count),
        exposure: round(metric.exposure),
        gamesInWindow: ctx.windowDates.length,
        gamesCovered: ctx.windowDates.length,
        baselineEvidence: round(metric.baselineEvidence),
        baselineSeasons: [ctx.seasonId]
      }
    },
    provenance: rowProvenance(ctx),
    metadata: rowMetadata(ctx)
  };
}

function expectationState(z: number): ScoreRow["expectation_state"] {
  if (z >= EXPECTATION_STATE_Z) return "overperforming";
  if (z <= -EXPECTATION_STATE_Z) return "underperforming";
  return "stable";
}

function scoreFromRaw(sRaw: number, warnings: string[]) {
  const clipped = clamp(sRaw, S_RAW_LIMIT);
  if (clipped !== sRaw) warnings.push("clipped_s_raw");
  return { sRaw: round(clipped, 6), s100: round(100 * sigmoid(clipped), 2) };
}

function componentZ(
  metric: ResolvedMetric,
  warnings: string[]
): number {
  const clipped = clamp(metric.z, COMPONENT_Z_LIMIT);
  if (clipped !== metric.z) warnings.push(`clipped_z_${metric.key}`);
  return round(clipped, 4);
}

// ---------------------------------------------------------------------------
// Schedule gating

/**
 * For each entity, the first date on which a completed scheduled game has
 * no ingested input. Readings on or after that date are skipped, never
 * carried forward over the gap.
 */
function firstMissingDates(
  completed: CompletedTeamGame[],
  hasInput: (teamId: number, date: string) => boolean
): Map<number, string> {
  const out = new Map<number, string>();
  for (const game of completed) {
    if (hasInput(game.teamId, game.date)) continue;
    const existing = out.get(game.teamId);
    if (!existing || game.date < existing) out.set(game.teamId, game.date);
  }
  return out;
}

export type ScheduledTeamGame = CompletedTeamGame & { completed: boolean };

/**
 * The last date that can be published: the day before the first scheduled
 * game that is not completed or has no team input, else `requestedEnd`.
 * A date whose games are still to be played or ingested is never published,
 * so a late input cannot turn into an earlier day's carried-forward reading.
 */
export function resolveReadyThrough(args: {
  seasonStart: string;
  requestedEnd: string;
  scheduled: ScheduledTeamGame[];
  hasTeamInput: (teamId: number, date: string) => boolean;
}): string | null {
  let firstBlocked: string | null = null;
  for (const game of args.scheduled) {
    if (game.date < args.seasonStart || game.date > args.requestedEnd) continue;
    if (game.completed && args.hasTeamInput(game.teamId, game.date)) continue;
    if (!firstBlocked || game.date < firstBlocked) firstBlocked = game.date;
  }
  if (!firstBlocked) return args.requestedEnd;
  const previous = new Date(`${firstBlocked}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const ready = previous.toISOString().slice(0, 10);
  return ready < args.seasonStart ? null : ready;
}

// ---------------------------------------------------------------------------
// Teams

const TEAM_SOURCE_TABLES = ["nst_team_gamelogs_as_counts", "games"];

export function buildTeamReadings(args: {
  seasonId: number;
  dates: string[];
  games: TeamGameInput[];
  completedGames: CompletedTeamGame[];
  teamIds: number[];
}): ProducerResult {
  const cfg = ENTITY_SUSTAINABILITY_CONFIG.team;
  const byTeam = new Map<number, TeamGameInput[]>();
  const inputKeys = new Set<string>();
  for (const game of [...args.games].sort((a, b) => a.date.localeCompare(b.date))) {
    const list = byTeam.get(game.teamId) ?? [];
    list.push(game);
    byTeam.set(game.teamId, list);
    inputKeys.add(`${game.teamId}|${game.date}`);
  }
  const missingFrom = firstMissingDates(args.completedGames, (teamId, date) =>
    inputKeys.has(`${teamId}|${date}`)
  );
  const allGames = [...args.games].sort((a, b) => a.date.localeCompare(b.date));

  const scores: ScoreRow[] = [];
  const bands: BandRow[] = [];
  const skips: SkipRecord[] = [];

  for (const date of args.dates) {
    // League totals strictly as of this date.
    const leagueGames = allGames.filter((g) => g.date <= date);
    const leagueGames0 = leagueGames.length || 1;
    const lgSh = sum(leagueGames, (g) => g.gf) / Math.max(sum(leagueGames, (g) => g.sf), 1);
    const lgSv = 1 - sum(leagueGames, (g) => g.ga) / Math.max(sum(leagueGames, (g) => g.sa), 1);
    const lgEvents = {
      xg: sum(leagueGames, (g) => g.xgf + g.xga) / leagueGames0,
      sc: sum(leagueGames, (g) => g.scf + g.sca) / leagueGames0,
      hd: sum(leagueGames, (g) => g.hdcf + g.hdca) / leagueGames0
    };

    const eligible: Array<{ teamId: number; played: TeamGameInput[] }> = [];
    for (const teamId of args.teamIds) {
      const missing = missingFrom.get(teamId);
      if (missing && missing <= date) {
        skips.push({
          snapshot_date: date,
          entity_type: "team",
          entity_id: teamId,
          window_code: null,
          reason: "scheduled_game_missing_input",
          detail: { missing_game_date: missing }
        });
        continue;
      }
      const played = (byTeam.get(teamId) ?? []).filter((g) => g.date <= date);
      if (!played.length) {
        skips.push({
          snapshot_date: date,
          entity_type: "team",
          entity_id: teamId,
          window_code: null,
          reason: "no_game_yet_this_season"
        });
        continue;
      }
      eligible.push({ teamId, played });
    }

    for (const window of ENTITY_SUSTAINABILITY_WINDOWS) {
      const perEntity = new Map<number, MetricEval[]>();
      const windows = new Map<number, { win: TeamGameInput[]; pre: TeamGameInput[] }>();
      for (const { teamId, played } of eligible) {
        const win = played.slice(-window.n);
        const pre = played.slice(0, played.length - win.length);
        windows.set(teamId, { win, pre });
        const evals: MetricEval[] = [];
        const share = (
          key: string,
          f: (g: TeamGameInput) => number,
          a: (g: TeamGameInput) => number,
          leagueEventsPerGame: number
        ) => {
          const wf = sum(win, f);
          const wa = sum(win, a);
          if (!(wf + wa > 0)) return;
          const prior = cfg.sharePriorGames * leagueEventsPerGame;
          const pf = sum(pre, f);
          const pa = sum(pre, a);
          evals.push({
            key,
            observed: (100 * wf) / (wf + wa),
            baseline: (100 * (pf + 0.5 * prior)) / (pf + pa + prior),
            sd: null,
            ewma: (() => {
              const e = ewmaRatio(played, window.n, f, (g) => f(g) + a(g));
              return e === null ? null : 100 * e;
            })(),
            family: "normal_league_residual",
            count: wf,
            exposure: wf + wa,
            baselineEvidence: pf + pa
          });
        };
        share("xgf_pct", (g) => g.xgf, (g) => g.xga, lgEvents.xg);
        share("scf_pct", (g) => g.scf, (g) => g.sca, lgEvents.sc);
        share("hdcf_pct", (g) => g.hdcf, (g) => g.hdca, lgEvents.hd);

        const wsf = sum(win, (g) => g.sf);
        const wsa = sum(win, (g) => g.sa);
        const psf = sum(pre, (g) => g.sf);
        const psa = sum(pre, (g) => g.sa);
        const baseSh = (sum(pre, (g) => g.gf) + lgSh * cfg.shootingPriorShots) / (psf + cfg.shootingPriorShots);
        const baseSv =
          (psa - sum(pre, (g) => g.ga) + lgSv * cfg.savePriorShots) / (psa + cfg.savePriorShots);
        if (wsf > 0) {
          const obs = sum(win, (g) => g.gf) / wsf;
          evals.push({
            key: "on_ice_sh_pct",
            observed: 100 * obs,
            baseline: 100 * baseSh,
            sd: 100 * Math.sqrt((baseSh * (1 - baseSh)) / wsf),
            ewma: (() => {
              const e = ewmaRatio(played, window.n, (g) => g.gf, (g) => g.sf);
              return e === null ? null : 100 * e;
            })(),
            family: "normal_binomial",
            count: sum(win, (g) => g.gf),
            exposure: wsf,
            baselineEvidence: psf
          });
        }
        if (wsa > 0) {
          const obs = 1 - sum(win, (g) => g.ga) / wsa;
          evals.push({
            key: "on_ice_sv_pct",
            observed: 100 * obs,
            baseline: 100 * baseSv,
            sd: 100 * Math.sqrt((baseSv * (1 - baseSv)) / wsa),
            ewma: (() => {
              const e = ewmaRatio(played, window.n, (g) => g.sa - g.ga, (g) => g.sa);
              return e === null ? null : 100 * e;
            })(),
            family: "normal_binomial",
            count: wsa - sum(win, (g) => g.ga),
            exposure: wsa,
            baselineEvidence: psa
          });
        }
        if (wsf > 0 && wsa > 0) {
          const obs = sum(win, (g) => g.gf) / wsf + 1 - sum(win, (g) => g.ga) / wsa;
          const eSh = ewmaRatio(played, window.n, (g) => g.gf, (g) => g.sf);
          const eSv = ewmaRatio(played, window.n, (g) => g.sa - g.ga, (g) => g.sa);
          evals.push({
            key: "pdo",
            observed: obs,
            baseline: baseSh + baseSv,
            sd: Math.sqrt((baseSh * (1 - baseSh)) / wsf + (baseSv * (1 - baseSv)) / wsa),
            ewma: eSh === null || eSv === null ? null : eSh + eSv,
            family: "normal_binomial",
            count: sum(win, (g) => g.gf) + wsa - sum(win, (g) => g.ga),
            exposure: wsf + wsa,
            baselineEvidence: psf + psa
          });
        }
        perEntity.set(teamId, evals);
      }

      const { resolved, unavailable } = resolveMetrics(perEntity);
      for (const { teamId, played } of eligible) {
        const { win, pre } = windows.get(teamId)!;
        const ctx: EntityContext = {
          entityType: "team",
          entityId: teamId,
          teamId,
          playerId: null,
          windowCode: window.code,
          windowSize: window.n,
          snapshotDate: date,
          seasonId: args.seasonId,
          windowDates: win.map((g) => g.date),
          seasonGamesToDate: played.length,
          preWindowGames: pre.length,
          lastGameDate: played[played.length - 1].date,
          sourceTables: TEAM_SOURCE_TABLES
        };
        const metrics = resolved.get(teamId)!;
        for (const metric of metrics.values()) bands.push(buildBandRow(ctx, metric));

        const required = ["xgf_pct", "scf_pct", "hdcf_pct", "on_ice_sh_pct", "on_ice_sv_pct"];
        const missing = required.filter((key) => !metrics.has(key));
        if (missing.length) {
          skips.push({
            snapshot_date: date,
            entity_type: "team",
            entity_id: teamId,
            window_code: window.code,
            reason: "insufficient_score_inputs",
            detail: {
              missing,
              reasons: Object.fromEntries(unavailable.get(teamId) ?? [])
            }
          });
          continue;
        }
        const wgf = sum(win, (g) => g.gf);
        const wga = sum(win, (g) => g.ga);
        const wxgf = sum(win, (g) => g.xgf);
        const wxga = sum(win, (g) => g.xga);
        if (!(wgf + wga > 0) || !(wxgf + wxga > 0)) {
          skips.push({
            snapshot_date: date,
            entity_type: "team",
            entity_id: teamId,
            window_code: window.code,
            reason: "no_goals_in_window"
          });
          continue;
        }
        const goalShare = wgf / (wgf + wga);
        const xgShare = wxgf / (wxgf + wxga);
        const gapZ =
          (goalShare - xgShare) / Math.sqrt((xgShare * (1 - xgShare)) / (wgf + wga));

        const warnings: string[] = [];
        const z = (key: string) => componentZ(metrics.get(key)!, warnings);
        const components: Record<string, unknown> = {
          z_xgf_pct: z("xgf_pct"),
          z_scf_pct: z("scf_pct"),
          z_hdcf_pct: z("hdcf_pct"),
          z_on_ice_sh_pct: z("on_ice_sh_pct"),
          z_on_ice_sv_pct: z("on_ice_sv_pct")
        };
        if (metrics.has("pdo")) components.z_pdo = z("pdo");
        const w = cfg.weights;
        const raw =
          w.process.xgf_pct * (components.z_xgf_pct as number) +
          w.process.scf_pct * (components.z_scf_pct as number) +
          w.process.hdcf_pct * (components.z_hdcf_pct as number) +
          w.finishing.on_ice_sh_pct * (components.z_on_ice_sh_pct as number) +
          w.finishing.on_ice_sv_pct * (components.z_on_ice_sv_pct as number);
        const { sRaw, s100 } = scoreFromRaw(cfg.scoreScale * raw, warnings);
        const xgBaseline = metrics.get("xgf_pct")!.baseline;

        scores.push({
          snapshot_date: date,
          season_id: args.seasonId,
          entity_type: "team",
          entity_id: teamId,
          team_id: teamId,
          player_id: null,
          metric_scope: "overall",
          window_code: window.code,
          baseline_value: round(xgBaseline),
          recent_value: round(100 * goalShare),
          expected_value: round(100 * xgShare),
          z_score: round(gapZ, 4),
          s_raw: sRaw,
          s_100: s100,
          expectation_state: expectationState(gapZ),
          components: {
            ...components,
            modelVersion: ENTITY_SUSTAINABILITY_MODEL_VERSION,
            configHash: ENTITY_SUSTAINABILITY_CONFIG_HASH,
            weights: w,
            scoring: { scale: cfg.scoreScale, logistic: "100 * sigmoid(scale * weighted_z_sum)" },
            expectation: {
              basis: "window_goal_share_vs_window_xg_share",
              goal_share_pct: round(100 * goalShare),
              xg_share_pct: round(100 * xgShare),
              goals_for: wgf,
              goals_against: wga,
              gap_z: round(gapZ, 4),
              threshold_z: EXPECTATION_STATE_Z
            },
            warnings
          },
          provenance: rowProvenance(ctx),
          metadata: rowMetadata(ctx)
        });
      }
    }
  }
  return { scores, bands, skips };
}

// ---------------------------------------------------------------------------
// Goalies

const GOALIE_SOURCE_TABLES = ["wgo_goalie_stats", "nst_gamelog_goalie_all_counts", "games"];

export function buildGoalieReadings(args: {
  seasonId: number;
  dates: string[];
  games: GoalieGameInput[];
  completedGames: CompletedTeamGame[];
}): ProducerResult {
  const cfg = ENTITY_SUSTAINABILITY_CONFIG.goalie;
  const sorted = [...args.games].sort((a, b) => a.date.localeCompare(b.date));
  const byGoalie = new Map<number, GoalieGameInput[]>();
  const teamDatesWithGoalie = new Set<string>();
  for (const game of sorted) {
    const list = byGoalie.get(game.goalieId) ?? [];
    list.push(game);
    byGoalie.set(game.goalieId, list);
    teamDatesWithGoalie.add(`${game.teamId}|${game.date}`);
  }
  // A completed team game with no goalie appearance ingested: that team's
  // goalies cannot be read for dates after it until it is ingested.
  const missingTeamDates = args.completedGames
    .filter((g) => !teamDatesWithGoalie.has(`${g.teamId}|${g.date}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  const scores: ScoreRow[] = [];
  const bands: BandRow[] = [];
  const skips: SkipRecord[] = [];

  for (const date of args.dates) {
    const league = sorted.filter((g) => g.date <= date);
    const lgSv = 1 - sum(league, (g) => g.goalsAgainst) / Math.max(sum(league, (g) => g.shotsAgainst), 1);
    const leagueStarts = league.filter((g) => g.started);
    const lgQs = leagueStarts.length
      ? leagueStarts.filter((g) => g.qualityStart).length / leagueStarts.length
      : 0.5;
    const lgToi = Math.max(sum(league, (g) => g.toiSeconds), 1);
    const lgGaPerSec = sum(league, (g) => g.goalsAgainst) / lgToi;
    const lgSaPerSec = sum(league, (g) => g.shotsAgainst) / lgToi;
    const lgGames = Math.max(league.length, 1);
    const lgSavesPerGame = sum(league, (g) => g.saves) / lgGames;
    const lgShutoutsPerGame = league.filter((g) => g.shutout).length / lgGames;

    const eligible: Array<{ goalieId: number; played: GoalieGameInput[] }> = [];
    for (const [goalieId, all] of byGoalie) {
      const played = all.filter((g) => g.date <= date);
      if (!played.length) continue; // not yet in the league this season: no entity
      const last = played[played.length - 1];
      const gap = missingTeamDates.find(
        (g) => g.teamId === last.teamId && g.date > last.date && g.date <= date
      );
      if (gap) {
        skips.push({
          snapshot_date: date,
          entity_type: "goalie",
          entity_id: goalieId,
          window_code: null,
          reason: "team_game_missing_goalie_input",
          detail: { team_id: last.teamId, missing_game_date: gap.date }
        });
        continue;
      }
      // Stale: no reading (and no place in the percentile pool) once a
      // goalie has gone this long without an appearance (TJ 2026-11-23).
      const idleDays = daysBetween(last.date, date);
      if (idleDays > cfg.maxDaysSinceLastGame) {
        skips.push({
          snapshot_date: date,
          entity_type: "goalie",
          entity_id: goalieId,
          window_code: null,
          reason: "no_appearance_in_max_days",
          detail: { last_game_date: last.date, days_since_last_game: idleDays }
        });
        continue;
      }
      eligible.push({ goalieId, played });
    }

    for (const window of ENTITY_SUSTAINABILITY_WINDOWS) {
      const perEntity = new Map<number, MetricEval[]>();
      const windows = new Map<number, { win: GoalieGameInput[]; pre: GoalieGameInput[] }>();
      for (const { goalieId, played } of eligible) {
        const win = played.slice(-window.n);
        const pre = played.slice(0, played.length - win.length);
        windows.set(goalieId, { win, pre });
        const evals: MetricEval[] = [];

        const wsa = sum(win, (g) => g.shotsAgainst);
        const psa = sum(pre, (g) => g.shotsAgainst);
        const psaves = sum(pre, (g) => g.saves);
        const baseSv = (psaves + lgSv * cfg.savePriorShots) / (psa + cfg.savePriorShots);
        if (wsa > 0) {
          evals.push({
            key: "save_pct",
            observed: (100 * sum(win, (g) => g.saves)) / wsa,
            baseline: 100 * baseSv,
            sd: 100 * Math.sqrt((baseSv * (1 - baseSv)) / wsa),
            ewma: (() => {
              const e = ewmaRatio(played, window.n, (g) => g.saves, (g) => g.shotsAgainst);
              return e === null ? null : 100 * e;
            })(),
            family: "normal_binomial",
            count: sum(win, (g) => g.saves),
            exposure: wsa,
            baselineEvidence: psa
          });
        }

        const wStarts = win.filter((g) => g.started);
        const pStarts = pre.filter((g) => g.started);
        if (wStarts.length > 0) {
          const pQs = pStarts.filter((g) => g.qualityStart).length;
          const baseQs = (pQs + lgQs * cfg.qualityStartPriorStarts) / (pStarts.length + cfg.qualityStartPriorStarts);
          evals.push({
            key: "quality_starts_pct",
            observed: (100 * wStarts.filter((g) => g.qualityStart).length) / wStarts.length,
            baseline: 100 * baseQs,
            sd: 100 * Math.sqrt((baseQs * (1 - baseQs)) / wStarts.length),
            ewma: (() => {
              const e = ewmaRatio(
                played.filter((g) => g.started),
                window.n,
                (g) => (g.qualityStart ? 1 : 0),
                () => 1
              );
              return e === null ? null : 100 * e;
            })(),
            family: "normal_binomial",
            count: wStarts.filter((g) => g.qualityStart).length,
            exposure: wStarts.length,
            baselineEvidence: pStarts.length
          });
        }

        const wToi = sum(win, (g) => g.toiSeconds);
        const pToi = sum(pre, (g) => g.toiSeconds);
        const perSixty = (
          key: string,
          pick: (g: GoalieGameInput) => number,
          leaguePerSec: number
        ) => {
          if (!(wToi > 0)) return;
          const baseRate = (sum(pre, pick) + leaguePerSec * cfg.ratePriorSeconds) / (pToi + cfg.ratePriorSeconds);
          const e = ewmaRatio(played, window.n, pick, (g) => g.toiSeconds);
          evals.push({
            key,
            observed: (3600 * sum(win, pick)) / wToi,
            baseline: 3600 * baseRate,
            // Poisson count over the window's minutes, widened by the league's
            // over-dispersion (team shot volume and goalie talent vary).
            sd: (3600 * Math.sqrt(baseRate * wToi)) / wToi,
            overdispersed: true,
            ewma: e === null ? null : 3600 * e,
            family: "normal_poisson_overdispersed",
            count: sum(win, pick),
            exposure: wToi / 60,
            baselineEvidence: pToi / 60
          });
        };
        perSixty("goals_against_avg", (g) => g.goalsAgainst, lgGaPerSec);
        perSixty("shots_against_per_60", (g) => g.shotsAgainst, lgSaPerSec);

        // Saves per appearance and shutouts in the window (count).
        const n = win.length;
        const baseSavesPerGame = (psaves + lgSavesPerGame * cfg.countPriorGames) / (pre.length + cfg.countPriorGames);
        evals.push({
          key: "saves",
          observed: sum(win, (g) => g.saves) / n,
          baseline: baseSavesPerGame,
          sd: Math.sqrt(baseSavesPerGame * n) / n,
          overdispersed: true,
          ewma: ewmaRatio(played, window.n, (g) => g.saves, () => 1),
          family: "normal_poisson_overdispersed",
          count: sum(win, (g) => g.saves),
          exposure: n,
          baselineEvidence: pre.length
        });
        const pShutouts = pre.filter((g) => g.shutout).length;
        const baseShutoutRate = (pShutouts + lgShutoutsPerGame * cfg.countPriorGames) / (pre.length + cfg.countPriorGames);
        const e = ewmaRatio(played, window.n, (g) => (g.shutout ? 1 : 0), () => 1);
        evals.push({
          key: "shutouts",
          observed: win.filter((g) => g.shutout).length,
          baseline: baseShutoutRate * n,
          sd: Math.sqrt(baseShutoutRate * n),
          ewma: e === null ? null : e * n,
          family: "normal_poisson",
          count: win.filter((g) => g.shutout).length,
          exposure: n,
          baselineEvidence: pre.length
        });
        perEntity.set(goalieId, evals);
      }

      const { resolved, unavailable } = resolveMetrics(perEntity);
      for (const { goalieId, played } of eligible) {
        const { win, pre } = windows.get(goalieId)!;
        const last = played[played.length - 1];
        const ctx: EntityContext = {
          entityType: "goalie",
          entityId: goalieId,
          teamId: last.teamId,
          playerId: goalieId,
          windowCode: window.code,
          windowSize: window.n,
          snapshotDate: date,
          seasonId: args.seasonId,
          windowDates: win.map((g) => g.date),
          seasonGamesToDate: played.length,
          preWindowGames: pre.length,
          lastGameDate: last.date,
          sourceTables: GOALIE_SOURCE_TABLES
        };
        const metrics = resolved.get(goalieId)!;
        for (const metric of metrics.values()) bands.push(buildBandRow(ctx, metric));

        if (!metrics.has("save_pct")) {
          skips.push({
            snapshot_date: date,
            entity_type: "goalie",
            entity_id: goalieId,
            window_code: window.code,
            reason: "insufficient_score_inputs",
            detail: {
              missing: ["save_pct"],
              reasons: Object.fromEntries(unavailable.get(goalieId) ?? [])
            }
          });
          continue;
        }
        const withXg = win.filter((g) => g.xgAgainst !== null);
        if (withXg.length !== win.length) {
          skips.push({
            snapshot_date: date,
            entity_type: "goalie",
            entity_id: goalieId,
            window_code: window.code,
            reason: "missing_expected_goals_input",
            detail: {
              dates: win.filter((g) => g.xgAgainst === null).map((g) => g.date)
            }
          });
          continue;
        }
        const wsa = sum(win, (g) => g.shotsAgainst);
        const wxga = sum(win, (g) => g.xgAgainst as number);
        const sv = sum(win, (g) => g.saves) / wsa;
        const xsv = 1 - wxga / wsa;
        if (!(xsv > 0 && xsv < 1)) {
          skips.push({
            snapshot_date: date,
            entity_type: "goalie",
            entity_id: goalieId,
            window_code: window.code,
            reason: "invalid_expected_save_pct",
            detail: { xsv }
          });
          continue;
        }
        const gapZ = (sv - xsv) / Math.sqrt((xsv * (1 - xsv)) / wsa);

        const warnings: string[] = [];
        const components: Record<string, unknown> = {};
        for (const metric of metrics.values()) {
          components[`z_${metric.key}`] = componentZ(metric, warnings);
        }
        const clippedGap = clamp(gapZ, COMPONENT_Z_LIMIT);
        if (clippedGap !== gapZ) warnings.push("clipped_z_saves_above_expected");
        const raw =
          cfg.weights.save_pct * (components.z_save_pct as number) +
          cfg.weights.saves_above_expected * clippedGap;
        const { sRaw, s100 } = scoreFromRaw(cfg.scoreScale * raw, warnings);

        scores.push({
          snapshot_date: date,
          season_id: args.seasonId,
          entity_type: "goalie",
          entity_id: goalieId,
          team_id: last.teamId,
          player_id: goalieId,
          metric_scope: "overall",
          window_code: window.code,
          baseline_value: round(metrics.get("save_pct")!.baseline),
          recent_value: round(100 * sv),
          expected_value: round(100 * xsv),
          z_score: round(gapZ, 4),
          s_raw: sRaw,
          s_100: s100,
          expectation_state: expectationState(gapZ),
          components: {
            ...components,
            modelVersion: ENTITY_SUSTAINABILITY_MODEL_VERSION,
            configHash: ENTITY_SUSTAINABILITY_CONFIG_HASH,
            weights: cfg.weights,
            scoring: { scale: cfg.scoreScale, logistic: "100 * sigmoid(scale * weighted_z_sum)" },
            expectation: {
              basis: "window_save_pct_vs_window_expected_save_pct",
              save_pct: round(100 * sv),
              expected_save_pct: round(100 * xsv),
              shots_against: wsa,
              xg_against: round(wxga),
              goals_saved_above_expected: round(wxga - sum(win, (g) => g.goalsAgainst)),
              gap_z: round(gapZ, 4),
              threshold_z: EXPECTATION_STATE_Z
            },
            warnings
          },
          provenance: rowProvenance(ctx),
          metadata: rowMetadata(ctx)
        });
      }
    }
  }
  return { scores, bands, skips };
}
