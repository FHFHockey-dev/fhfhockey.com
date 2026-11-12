import { SupabaseClient } from "@supabase/supabase-js";

export const LOOKBACK_GAMES = 25;
export const HALF_LIFE_GAMES = 10.0;
export const POSTGREST_PAGE_SIZE = 1000;

export async function fetchPaginatedRows<T>(
  buildQuery: () => any,
  orderColumns: readonly string[],
): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; ; page += 1) {
    let query = buildQuery();
    orderColumns.forEach((column) => {
      query = query.order(column, { ascending: true });
    });

    const from = page * POSTGREST_PAGE_SIZE;
    const to = from + POSTGREST_PAGE_SIZE - 1;
    const { data, error } = await query.range(from, to);

    if (error) throw error;

    const pageRows = (data ?? []) as T[];
    rows.push(...pageRows);

    if (pageRows.length < POSTGREST_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

export interface GameLog {
  team_abbreviation: string;
  date: string;
  season_id: number;
  cf_per_60: number | null;
  ca_per_60: number | null;
  sf_per_60: number | null;
  sa_per_60: number | null;
  gf_per_60: number | null;
  ga_per_60: number | null;
  xgf_per_60: number | null;
  xga_per_60: number | null;
  gp: number;
  toi_seconds: number | null;
  pace_per_60: number | null;
  hdcf_per_60: number | null;
  hdca_per_60: number | null;
  pdo: number | null;
  data_mode: "all" | "5v5";
  // New fields for sub-ratings
  pp_xgf_per_60: number | null;
  pk_xga_per_60: number | null;
  penalties_drawn_per_60: number | null;
  penalties_taken_per_60: number | null;
}

export interface TeamGame extends GameLog {
  rn_desc: number;
  gp_to_date: number;
}

export interface EwmaMetrics {
  team_abbreviation: string;
  date: string;
  season_id: number;
  gp_to_date: number;
  xgf60_ewma: number;
  gf60_ewma: number;
  sf60_ewma: number;
  xga60_ewma: number;
  ga60_ewma: number;
  sa60_ewma: number;
  pace60_ewma: number;
  // New EWMA fields
  hdcf60_ewma: number;
  hdca60_ewma: number;
  pdo_ewma: number | null;
  pdo_observation_count: number;
  /** Null when no game in the window has the input (never read as 0). */
  pp_xgf60_ewma: number | null;
  pk_xga60_ewma: number | null;
  discipline_diff_ewma: number | null;
}

export interface LeagueMetrics {
  date: string;
  league_xgf60_avg: number;
  league_xgf60_stddev: number;
  league_gf60_avg: number;
  league_gf60_stddev: number;
  league_sf60_avg: number;
  league_sf60_stddev: number;
  league_xga60_avg: number;
  league_xga60_stddev: number;
  league_ga60_avg: number;
  league_ga60_stddev: number;
  league_sa60_avg: number;
  league_sa60_stddev: number;
  league_pace60_avg: number;
  league_pace60_stddev: number;
  // New League Metrics
  league_finishing_avg: number;
  league_finishing_stddev: number;
  league_goalie_avg: number;
  league_goalie_stddev: number;
  league_danger_avg: number;
  league_danger_stddev: number;
  league_pp_off_avg: number;
  league_pp_off_stddev: number;
  league_pk_def_avg: number;
  league_pk_def_stddev: number;
  league_discipline_avg: number;
  league_discipline_stddev: number;
  league_pdo_avg: number;
  league_pdo_stddev: number;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export async function fetchGameLogs(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<GameLog[]> {
  // Fetch nst_team_gamelogs_as_rates (situation = 'all')
  const allDataPromise = fetchPaginatedRows<any>(
    () =>
      supabase
        .from("nst_team_gamelogs_as_rates")
        .select("*")
        .eq("situation", "all")
        .gte("date", startDate)
        .lte("date", endDate),
    ["date", "team_abbreviation"],
  );

  // Fetch nst_team_5v5 (situation = 'all')
  const f5v5DataPromise = fetchPaginatedRows<any>(
    () =>
      supabase
        .from("nst_team_5v5")
        .select("*")
        .eq("situation", "all")
        .gte("date", startDate)
        .lte("date", endDate),
    ["date", "team_abbreviation"],
  );

  // Fetch PP Rates
  const ppDataPromise = fetchPaginatedRows<any>(
    () =>
      supabase
        .from("nst_team_gamelogs_pp_rates")
        .select("team_abbreviation, date, xgf_per_60")
        .eq("situation", "pp")
        .gte("date", startDate)
        .lte("date", endDate),
    ["date", "team_abbreviation"],
  );

  // Fetch PK Rates
  const pkDataPromise = fetchPaginatedRows<any>(
    () =>
      supabase
        .from("nst_team_gamelogs_pk_rates")
        .select("team_abbreviation, date, xga_per_60")
        .eq("situation", "pk")
        .gte("date", startDate)
        .lte("date", endDate),
    ["date", "team_abbreviation"],
  );

  // Fetch WGO Stats (for discipline)
  const wgoDataPromise = fetchPaginatedRows<any>(
    () =>
      supabase
        .from("wgo_team_stats")
        .select(
          "team_id, franchise_name, date, penalties_drawn_per_60, penalties_taken_per_60",
        )
        .gte("date", startDate)
        .lte("date", endDate),
    ["date", "team_id"],
  );

  // Helper to map WGO team_id/name to abbreviation
  const teamsDataPromise = supabase
    .from("teams")
    .select("id, abbreviation, name");
  const [allData, f5v5Data, ppData, pkData, wgoData, { data: teamsData }] =
    await Promise.all([
      allDataPromise,
      f5v5DataPromise,
      ppDataPromise,
      pkDataPromise,
      wgoDataPromise,
      teamsDataPromise,
    ]);
  const idMap = new Map<number, string>();
  const nameMap = new Map<string, string>();
  teamsData?.forEach((t: any) => {
    idMap.set(t.id, t.abbreviation);
    nameMap.set(t.name, t.abbreviation);
  });

  // Create Maps for easy lookup
  const allDataMap = new Map<string, any>();
  allData?.forEach((row) => {
    allDataMap.set(`${row.team_abbreviation}|${row.date}`, row);
  });

  const ppMap = new Map<string, any>();
  ppData?.forEach((row) => {
    ppMap.set(`${row.team_abbreviation}|${row.date}`, row);
  });

  const pkMap = new Map<string, any>();
  pkData?.forEach((row) => {
    pkMap.set(`${row.team_abbreviation}|${row.date}`, row);
  });

  const wgoMap = new Map<string, any>();
  wgoData?.forEach((row) => {
    let abbr = idMap.get(row.team_id);
    if (!abbr) abbr = nameMap.get(row.franchise_name);
    if (abbr) {
      wgoMap.set(`${abbr}|${row.date}`, row);
    }
  });

  const logs: GameLog[] = [];

  // Process 'all' rows
  allData?.forEach((row) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    const pp = ppMap.get(key);
    const pk = pkMap.get(key);
    const wgo = wgoMap.get(key);

    const cf = toNullableNumber(row.cf_per_60);
    const ca = toNullableNumber(row.ca_per_60);

    // Unknowns stay unknown (rule 5): a null source value is never read as 0.
    logs.push({
      team_abbreviation: row.team_abbreviation,
      date: row.date,
      season_id: row.season_id,
      cf_per_60: cf,
      ca_per_60: ca,
      sf_per_60: toNullableNumber(row.sf_per_60),
      sa_per_60: toNullableNumber(row.sa_per_60),
      gf_per_60: toNullableNumber(row.gf_per_60),
      ga_per_60: toNullableNumber(row.ga_per_60),
      xgf_per_60: toNullableNumber(row.xgf_per_60),
      xga_per_60: toNullableNumber(row.xga_per_60),
      gp: row.gp,
      toi_seconds: toNullableNumber(row.toi_seconds),
      pace_per_60: cf != null && ca != null ? (cf + ca) / 2.0 : null,
      hdcf_per_60: toNullableNumber(row.hdcf_per_60),
      hdca_per_60: toNullableNumber(row.hdca_per_60),
      pdo: toNullableNumber(row.pdo),
      data_mode: "all",
      pp_xgf_per_60: pp ? toNullableNumber(pp.xgf_per_60) : null,
      pk_xga_per_60: pk ? toNullableNumber(pk.xga_per_60) : null,
      penalties_drawn_per_60: wgo
        ? toNullableNumber(wgo.penalties_drawn_per_60)
        : null,
      penalties_taken_per_60: wgo
        ? toNullableNumber(wgo.penalties_taken_per_60)
        : null,
    });
  });

  // Process '5v5' rows
  f5v5Data?.forEach((row) => {
    const key = `${row.team_abbreviation}|${row.date}`;
    const allRow = allDataMap.get(key);
    const pp = ppMap.get(key);
    const pk = pkMap.get(key);
    const wgo = wgoMap.get(key);

    const toi = Number(row.toi);
    const factor = toi > 0 ? 3600.0 / toi : 0;

    logs.push({
      team_abbreviation: row.team_abbreviation,
      date: row.date,
      season_id: allRow?.season_id ?? 20242025,
      cf_per_60: toi > 0 ? Number(row.cf) * factor : null,
      ca_per_60: toi > 0 ? Number(row.ca) * factor : null,
      sf_per_60: toi > 0 ? Number(row.sf) * factor : null,
      sa_per_60: toi > 0 ? Number(row.sa) * factor : null,
      gf_per_60: toi > 0 ? Number(row.gf) * factor : null,
      ga_per_60: toi > 0 ? Number(row.ga) * factor : null,
      xgf_per_60: toi > 0 ? Number(row.xgf) * factor : null,
      xga_per_60: toi > 0 ? Number(row.xga) * factor : null,
      gp: row.gp,
      toi_seconds: null,
      pace_per_60: null,
      hdcf_per_60: null,
      hdca_per_60: null,
      pdo: allRow ? toNullableNumber(allRow.pdo) : null,
      data_mode: "5v5",
      pp_xgf_per_60: pp ? Number(pp.xgf_per_60) : null,
      pk_xga_per_60: pk ? Number(pk.xga_per_60) : null,
      penalties_drawn_per_60: wgo ? Number(wgo.penalties_drawn_per_60) : null,
      penalties_taken_per_60: wgo ? Number(wgo.penalties_taken_per_60) : null,
    });
  });

  return logs;
}

export function calculateEwma(
  games: TeamGame[],
  targetDate: string,
): EwmaMetrics | null {
  const validGames = games.filter((g) => g.date <= targetDate);
  if (validGames.length === 0) return null;

  validGames.sort((a, b) => b.date.localeCompare(a.date));

  const cur = validGames[0];

  if (cur.date !== targetDate) {
    return null;
  }

  const window = validGames.slice(0, LOOKBACK_GAMES);
  const weights = window.map((_, i) => Math.pow(0.5, i / HALF_LIFE_GAMES));

  /** Weighted mean over the games that observed the input (per-metric weights). */
  const weightedMean = (read: (game: TeamGame) => number | null) => {
    let sum = 0;
    let weightSum = 0;
    let count = 0;
    window.forEach((game, i) => {
      const value = read(game);
      if (value == null || !Number.isFinite(value)) return;
      sum += value * weights[i];
      weightSum += weights[i];
      count += 1;
    });
    return { value: weightSum > 0 ? sum / weightSum : null, count };
  };

  const xgf = weightedMean((g) => g.xgf_per_60).value;
  const gf = weightedMean((g) => g.gf_per_60).value;
  const sf = weightedMean((g) => g.sf_per_60).value;
  const xga = weightedMean((g) => g.xga_per_60).value;
  const ga = weightedMean((g) => g.ga_per_60).value;
  const sa = weightedMean((g) => g.sa_per_60).value;
  const pace = weightedMean((g) =>
    g.pace_per_60 ??
    (g.cf_per_60 != null && g.ca_per_60 != null
      ? (g.cf_per_60 + g.ca_per_60) / 2.0
      : null),
  ).value;
  const hdcf = weightedMean((g) => g.hdcf_per_60).value;
  const hdca = weightedMean((g) => g.hdca_per_60).value;
  const pdo = weightedMean((g) => g.pdo);

  // A team without the core rates in its window cannot be rated (unknown, not 0).
  if (
    xgf == null || gf == null || sf == null || xga == null || ga == null ||
    sa == null || pace == null || hdcf == null || hdca == null
  ) {
    return null;
  }

  return {
    team_abbreviation: cur.team_abbreviation,
    date: cur.date,
    season_id: cur.season_id,
    gp_to_date: cur.gp_to_date,
    xgf60_ewma: xgf,
    gf60_ewma: gf,
    sf60_ewma: sf,
    xga60_ewma: xga,
    ga60_ewma: ga,
    sa60_ewma: sa,
    pace60_ewma: pace,
    hdcf60_ewma: hdcf,
    hdca60_ewma: hdca,
    pdo_ewma: pdo.value,
    pdo_observation_count: pdo.count,
    pp_xgf60_ewma: weightedMean((g) => g.pp_xgf_per_60).value,
    pk_xga60_ewma: weightedMean((g) => g.pk_xga_per_60).value,
    discipline_diff_ewma: weightedMean((g) =>
      g.penalties_drawn_per_60 != null && g.penalties_taken_per_60 != null
        ? g.penalties_drawn_per_60 - g.penalties_taken_per_60
        : null,
    ).value,
  };
}

/**
 * Mean and sample SD. Floating-point noise around a constant population is zero
 * variance, so identical teams all rate 100 (BA W1-4 B).
 */
function sampleStats(values: number[]) {
  if (values.length === 0) return { avg: 0, stddev: 0 };
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (values.length === 1) return { avg, stddev: 0 };
  const variance =
    values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (values.length - 1);
  const noiseFloor = 1e-20 * Math.max(1, avg * avg);
  return { avg, stddev: variance <= noiseFloor ? 0 : Math.sqrt(variance) };
}

const knownValues = (values: (number | null)[]): number[] =>
  values.filter((value): value is number => value != null);

export function calculateLeagueMetrics(metrics: EwmaMetrics[]): LeagueMetrics {
  const calcStats = sampleStats;

  const xgf = calcStats(metrics.map((m) => m.xgf60_ewma));
  const gf = calcStats(metrics.map((m) => m.gf60_ewma));
  const sf = calcStats(metrics.map((m) => m.sf60_ewma));
  const xga = calcStats(metrics.map((m) => m.xga60_ewma));
  const ga = calcStats(metrics.map((m) => m.ga60_ewma));
  const sa = calcStats(metrics.map((m) => m.sa60_ewma));
  const pace = calcStats(metrics.map((m) => m.pace60_ewma));

  // Derived metrics for league stats
  const finishing = calcStats(metrics.map((m) => m.gf60_ewma - m.xgf60_ewma));
  const goalie = calcStats(metrics.map((m) => m.xga60_ewma - m.ga60_ewma));
  const danger = calcStats(
    metrics.map((m) => {
      const total = m.hdcf60_ewma + m.hdca60_ewma;
      return total > 0 ? m.hdcf60_ewma / total : 0.5;
    }),
  );
  const ppOff = calcStats(knownValues(metrics.map((m) => m.pp_xgf60_ewma)));
  const pkDef = calcStats(knownValues(metrics.map((m) => m.pk_xga60_ewma)));
  const discipline = calcStats(
    knownValues(metrics.map((m) => m.discipline_diff_ewma)),
  );
  const pdo = calcStats(
    metrics.flatMap((metric) =>
      metric.pdo_ewma === null ? [] : [metric.pdo_ewma],
    ),
  );

  return {
    date: metrics[0].date,
    league_xgf60_avg: xgf.avg,
    league_xgf60_stddev: xgf.stddev,
    league_gf60_avg: gf.avg,
    league_gf60_stddev: gf.stddev,
    league_sf60_avg: sf.avg,
    league_sf60_stddev: sf.stddev,
    league_xga60_avg: xga.avg,
    league_xga60_stddev: xga.stddev,
    league_ga60_avg: ga.avg,
    league_ga60_stddev: ga.stddev,
    league_sa60_avg: sa.avg,
    league_sa60_stddev: sa.stddev,
    league_pace60_avg: pace.avg,
    league_pace60_stddev: pace.stddev,
    league_finishing_avg: finishing.avg,
    league_finishing_stddev: finishing.stddev,
    league_goalie_avg: goalie.avg,
    league_goalie_stddev: goalie.stddev,
    league_danger_avg: danger.avg,
    league_danger_stddev: danger.stddev,
    league_pp_off_avg: ppOff.avg,
    league_pp_off_stddev: ppOff.stddev,
    league_pk_def_avg: pkDef.avg,
    league_pk_def_stddev: pkDef.stddev,
    league_discipline_avg: discipline.avg,
    league_discipline_stddev: discipline.stddev,
    league_pdo_avg: pdo.avg,
    league_pdo_stddev: pdo.stddev,
  };
}

export interface ZScored {
  team_abbreviation: string;
  date: string;
  xgf60_z: number;
  gf60_z: number;
  sf60_z: number;
  xga60_z: number;
  ga60_z: number;
  sa60_z: number;
  pace60_z: number;
  xgf60: number;
  gf60: number;
  sf60: number;
  xga60: number;
  ga60: number;
  sa60: number;
  pace60: number;
  // New Z-Scores
  finishing_z: number;
  goalie_z: number;
  danger_z: number;
  pp_off_z: number | null;
  pk_def_z: number | null;
  discipline_z: number | null;
  pdo_z: number;
  pdo_missing: boolean;
}

/** GP at which the early-season prior stops pulling toward 100 (decision 19). */
export const POWER_RATING_PRIOR_FULL_WEIGHT_GP = 10;

/**
 * Approved interim prior (TJ, 2026-11-12): a linear ramp to GP 10. Unfitted;
 * a hypothesis to fit on held-out games (rule 12).
 */
export function powerRatingPriorWeight(gamesPlayed: number): number {
  return Math.min(
    1.0,
    Math.max(0.0, gamesPlayed / POWER_RATING_PRIOR_FULL_WEIGHT_GP),
  );
}

/**
 * The prior is applied after normalisation against the day's all-team
 * reference (decision 19): rating = 100 + w(GP) × (normalised − 100).
 */
export function applyPowerRatingPrior(
  rating: FinalRating,
  gamesPlayed: number,
): FinalRating {
  const w = powerRatingPriorWeight(gamesPlayed);
  const shrink = (value: number) => 100 + w * (value - 100);
  return {
    ...rating,
    off_rating: shrink(rating.off_rating),
    def_rating: shrink(rating.def_rating),
    pace_rating: shrink(rating.pace_rating),
  };
}

export function calculateZScores(
  metric: EwmaMetrics,
  league: LeagueMetrics,
): ZScored {
  const z = (val: number, avg: number, stddev: number) =>
    stddev === 0 ? 0 : (val - avg) / stddev;
  const zKnown = (val: number | null, avg: number, stddev: number) =>
    val == null ? null : z(val, avg, stddev);

  // The stored per-60 components keep their GP blend toward the league mean
  // (Start Chart reads them). The z-scores use the unblended EWMA: the prior
  // is applied once, after normalisation (decision 19), in
  // applyPowerRatingPrior, so the final standardisation cannot cancel it.
  const gpWeight = powerRatingPriorWeight(metric.gp_to_date);

  const blend = (val: number, avg: number) =>
    gpWeight * val + (1.0 - gpWeight) * avg;

  const xgf60 = blend(metric.xgf60_ewma, league.league_xgf60_avg);
  const gf60 = blend(metric.gf60_ewma, league.league_gf60_avg);
  const sf60 = blend(metric.sf60_ewma, league.league_sf60_avg);
  const xga60 = blend(metric.xga60_ewma, league.league_xga60_avg);
  const ga60 = blend(metric.ga60_ewma, league.league_ga60_avg);
  const sa60 = blend(metric.sa60_ewma, league.league_sa60_avg);
  const pace60 = blend(metric.pace60_ewma, league.league_pace60_avg);

  // Derived metrics for Z-scores
  const finishing = metric.gf60_ewma - metric.xgf60_ewma;
  const goalie = metric.xga60_ewma - metric.ga60_ewma;
  const dangerTotal = metric.hdcf60_ewma + metric.hdca60_ewma;
  const danger = dangerTotal > 0 ? metric.hdcf60_ewma / dangerTotal : 0.5;
  const ppOff = metric.pp_xgf60_ewma;
  const pkDef = metric.pk_xga60_ewma;
  const discipline = metric.discipline_diff_ewma;
  const pdo = metric.pdo_ewma;

  return {
    team_abbreviation: metric.team_abbreviation,
    date: metric.date,
    xgf60,
    gf60,
    sf60,
    xga60,
    ga60,
    sa60,
    pace60,
    xgf60_z: z(metric.xgf60_ewma, league.league_xgf60_avg, league.league_xgf60_stddev),
    gf60_z: z(metric.gf60_ewma, league.league_gf60_avg, league.league_gf60_stddev),
    sf60_z: z(metric.sf60_ewma, league.league_sf60_avg, league.league_sf60_stddev),
    xga60_z: z(metric.xga60_ewma, league.league_xga60_avg, league.league_xga60_stddev),
    ga60_z: z(metric.ga60_ewma, league.league_ga60_avg, league.league_ga60_stddev),
    sa60_z: z(metric.sa60_ewma, league.league_sa60_avg, league.league_sa60_stddev),
    pace60_z: z(metric.pace60_ewma, league.league_pace60_avg, league.league_pace60_stddev),
    finishing_z: z(
      finishing,
      league.league_finishing_avg,
      league.league_finishing_stddev,
    ),
    goalie_z: z(goalie, league.league_goalie_avg, league.league_goalie_stddev),
    danger_z: z(danger, league.league_danger_avg, league.league_danger_stddev),
    pp_off_z: zKnown(ppOff, league.league_pp_off_avg, league.league_pp_off_stddev),
    pk_def_z: zKnown(pkDef, league.league_pk_def_avg, league.league_pk_def_stddev),
    discipline_z: zKnown(
      discipline,
      league.league_discipline_avg,
      league.league_discipline_stddev,
    ),
    pdo_z:
      pdo === null
        ? 0
        : z(pdo, league.league_pdo_avg, league.league_pdo_stddev),
    pdo_missing: pdo === null,
  };
}

export interface RawScore {
  team_abbreviation: string;
  date: string;
  off_raw: number;
  def_raw: number;
  pace_raw: number;
  z: ZScored;
}

export function calculateRawScores(z: ZScored): RawScore {
  return {
    team_abbreviation: z.team_abbreviation,
    date: z.date,
    off_raw:
      0.7 * (z.xgf60_z || 0) + 0.2 * (z.sf60_z || 0) + 0.1 * (z.gf60_z || 0),
    def_raw:
      0.7 * (-z.xga60_z || 0) + 0.2 * (-z.sa60_z || 0) + 0.1 * (-z.ga60_z || 0),
    pace_raw: z.pace60_z || 0,
    z,
  };
}

export interface RawDistribution {
  date: string;
  off_raw_avg: number;
  off_raw_stddev: number;
  def_raw_avg: number;
  def_raw_stddev: number;
  pace_raw_avg: number;
  pace_raw_stddev: number;
}

export function calculateRawDistribution(scores: RawScore[]): RawDistribution {
  const calcStats = sampleStats;

  const off = calcStats(scores.map((s) => s.off_raw));
  const def = calcStats(scores.map((s) => s.def_raw));
  const pace = calcStats(scores.map((s) => s.pace_raw));

  return {
    date: scores[0].date,
    off_raw_avg: off.avg,
    off_raw_stddev: off.stddev,
    def_raw_avg: def.avg,
    def_raw_stddev: def.stddev,
    pace_raw_avg: pace.avg,
    pace_raw_stddev: pace.stddev,
  };
}

export interface FinalRating {
  team_abbreviation: string;
  date: string;
  off_rating: number;
  def_rating: number;
  pace_rating: number;
  xgf60: number;
  gf60: number;
  sf60: number;
  xga60: number;
  ga60: number;
  sa60: number;
  pace60: number;
  // New Ratings
  finishing_rating: number;
  goalie_rating: number;
  danger_rating: number;
  /** Null when the team's PP or PK input is unknown. */
  special_rating: number | null;
  discipline_rating: number | null;
  variance_flag: number;
}

export function calculateFinalRating(
  score: RawScore,
  dist: RawDistribution,
): FinalRating {
  const normalize = (val: number, avg: number, stddev: number) =>
    100 + 15 * (stddev === 0 ? 0 : (val - avg) / stddev);

  const z = score.z;

  return {
    team_abbreviation: score.team_abbreviation,
    date: score.date,
    off_rating: normalize(score.off_raw, dist.off_raw_avg, dist.off_raw_stddev),
    def_rating: normalize(score.def_raw, dist.def_raw_avg, dist.def_raw_stddev),
    pace_rating: normalize(
      score.pace_raw,
      dist.pace_raw_avg,
      dist.pace_raw_stddev,
    ),
    xgf60: score.z.xgf60,
    gf60: score.z.gf60,
    sf60: score.z.sf60,
    xga60: score.z.xga60,
    ga60: score.z.ga60,
    sa60: score.z.sa60,
    pace60: score.z.pace60,
    finishing_rating: 100 + 15 * (z.finishing_z || 0),
    goalie_rating: 100 + 15 * (z.goalie_z || 0),
    danger_rating: 100 + 15 * (z.danger_z || 0),
    special_rating:
      z.pp_off_z == null || z.pk_def_z == null
        ? null
        : 100 + 15 * (0.2 * z.pp_off_z + 0.2 * -z.pk_def_z),
    discipline_rating:
      z.discipline_z == null ? null : 100 + 15 * z.discipline_z,
    variance_flag: Math.abs(z.pdo_z || 0) >= 1.0 ? 1 : 0,
  };
}

export interface WgoStat {
  team_abbreviation: string;
  date: string;
  power_play_pct: number | null;
  penalty_kill_pct: number | null;
  penalties_drawn_per_60: number | null;
  penalties_taken_per_60: number | null;
  pp_opportunities_per_game: number | null;
  times_shorthanded_per_game: number | null;
}

export async function fetchWgoStats(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<WgoStat[]> {
  const wgoData = await fetchPaginatedRows<any>(
    () =>
      supabase
        .from("wgo_team_stats")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate),
    ["date", "team_id"],
  );

  const { data: teamsData } = await supabase
    .from("teams")
    .select("id, abbreviation, name");

  const idMap = new Map<number, string>();
  const nameMap = new Map<string, string>();

  teamsData?.forEach((t: any) => {
    idMap.set(t.id, t.abbreviation);
    nameMap.set(t.name, t.abbreviation);
  });

  const stats: WgoStat[] = [];
  wgoData?.forEach((row) => {
    let abbr = idMap.get(row.team_id);
    if (!abbr) abbr = nameMap.get(row.franchise_name);

    if (abbr) {
      stats.push({
        team_abbreviation: abbr,
        date: row.date,
        power_play_pct: Number(row.power_play_pct),
        penalty_kill_pct: Number(row.penalty_kill_pct),
        penalties_drawn_per_60: Number(row.penalties_drawn_per_60),
        penalties_taken_per_60: Number(row.penalties_taken_per_60),
        pp_opportunities_per_game: Number(row.pp_opportunities_per_game),
        times_shorthanded_per_game: Number(row.times_shorthanded_per_game),
      });
    }
  });

  return stats;
}

export async function fetchAllRatings(
  supabase: SupabaseClient,
  table: string,
  targetDate: string,
  trendStartDate: string,
) {
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .lt("date", targetDate)
      .gte("date", trendStartDate)
      .order("date", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (data) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}

export type DailyPowerRating = {
  rating: FinalRating;
  /** Date of the latest genuine game behind the rating. */
  sourceThroughDate: string;
};

/**
 * Genuine games only: one all-situations row per team and date (no all/5v5
 * mixing, BA W1-4 C). `gp_to_date` counts the team's games in that season.
 */
export function buildGenuineTeamGames(
  logs: readonly GameLog[],
): Map<string, TeamGame[]> {
  const byTeam = new Map<string, Map<string, GameLog>>();
  logs.forEach((log) => {
    if (log.data_mode !== "all") return;
    const games = byTeam.get(log.team_abbreviation) ?? new Map<string, GameLog>();
    if (!games.has(log.date)) games.set(log.date, log);
    byTeam.set(log.team_abbreviation, games);
  });

  const grouped = new Map<string, TeamGame[]>();
  byTeam.forEach((games, team) => {
    const ascending = [...games.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const seasonCounts = new Map<number, number>();
    const withGp = ascending.map((game) => {
      const gp = (seasonCounts.get(game.season_id) ?? 0) + 1;
      seasonCounts.set(game.season_id, gp);
      return { ...game, gp_to_date: gp };
    });
    grouped.set(
      team,
      withGp.reverse().map((game, index) => ({ ...game, rn_desc: index })),
    );
  });
  return grouped;
}

/**
 * One day's ratings (W1 P0 #12, decision 19). Every team with a genuine game
 * on or before `targetDate` is rated as of its latest game, and all of them are
 * standardised against one baseline (sample SD; zero variance gives 100), so
 * which teams played tonight cannot move anyone's rating. The prior is applied
 * after that normalisation. `previousByTeam` only fills teams with no game in
 * the window (offseason carry-forward).
 */
export function computeDailyPowerRatings(
  teamGames: Map<string, TeamGame[]>,
  targetDate: string,
  previousByTeam: Map<string, DailyPowerRating> = new Map(),
): Map<string, DailyPowerRating> {
  const ewmaMetrics: EwmaMetrics[] = [];
  for (const games of teamGames.values()) {
    const latest = games
      .filter((game) => game.date <= targetDate)
      .reduce<TeamGame | null>(
        (best, game) => (best == null || game.date > best.date ? game : best),
        null,
      );
    if (!latest) continue;
    const ewma = calculateEwma(games, latest.date);
    if (ewma) ewmaMetrics.push(ewma);
  }

  const result = new Map<string, DailyPowerRating>();
  if (ewmaMetrics.length > 0) {
    const league = calculateLeagueMetrics(ewmaMetrics);
    const scored = ewmaMetrics.map((metric) => ({
      metric,
      raw: calculateRawScores(calculateZScores(metric, league)),
    }));
    const dist = calculateRawDistribution(scored.map(({ raw }) => raw));
    scored.forEach(({ metric, raw }) => {
      const rating = applyPowerRatingPrior(
        { ...calculateFinalRating(raw, dist), date: targetDate },
        metric.gp_to_date,
      );
      result.set(metric.team_abbreviation, {
        rating,
        sourceThroughDate: metric.date,
      });
    });
  }
  previousByTeam.forEach((previous, team) => {
    if (!result.has(team)) result.set(team, previous);
  });
  return result;
}

export type SpecialTeamsTier = 1 | 2 | 3;

/**
 * PP/PK tier from a competition rank among the teams with a known pooled
 * season-to-date value (decision 20, W1 P0 #13). Tier 1 = rank ≤ ⌈n/3⌉,
 * tier 2 = rank ≤ ⌈2n/3⌉, otherwise 3. Tie rule: tied teams share the better
 * competition rank (1, 2, 2, 4) and therefore the same tier, so tiers can hold
 * unequal counts. An unknown value has no tier (null), never tier 3.
 */
export function specialTeamsTierFromRank(
  rank: number | null | undefined,
  knownCount: number,
): SpecialTeamsTier | null {
  if (rank == null || !Number.isFinite(rank) || knownCount <= 0) return null;
  if (rank <= Math.ceil(knownCount / 3)) return 1;
  if (rank <= Math.ceil((2 * knownCount) / 3)) return 2;
  return 3;
}

export type PooledSpecialTeamsInput = {
  ppPct: number | null;
  ppRank: number | null;
  pkPct: number | null;
  pkRank: number | null;
};

export function computeSpecialTeamsTiers(
  pooledByTeam: Map<string, PooledSpecialTeamsInput>,
): Map<string, { ppTier: SpecialTeamsTier | null; pkTier: SpecialTeamsTier | null }> {
  const values = [...pooledByTeam.values()];
  const ppKnown = values.filter((v) => v.ppPct != null && v.ppRank != null).length;
  const pkKnown = values.filter((v) => v.pkPct != null && v.pkRank != null).length;
  const tiers = new Map<string, { ppTier: SpecialTeamsTier | null; pkTier: SpecialTeamsTier | null }>();
  pooledByTeam.forEach((v, team) => {
    tiers.set(team, {
      ppTier: v.ppPct == null ? null : specialTeamsTierFromRank(v.ppRank, ppKnown),
      pkTier: v.pkPct == null ? null : specialTeamsTierFromRank(v.pkRank, pkKnown),
    });
  });
  return tiers;
}
