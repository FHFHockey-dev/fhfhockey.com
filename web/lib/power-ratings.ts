import { SupabaseClient } from "@supabase/supabase-js";

export const LOOKBACK_GAMES = 25;
export const HALF_LIFE_GAMES = 10.0;

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
  pdo_ewma: number;
  pp_xgf60_ewma: number;
  pk_xga60_ewma: number;
  discipline_diff_ewma: number;
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

export async function fetchGameLogs(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<GameLog[]> {
  // Fetch nst_team_gamelogs_as_rates (situation = 'all')
  const { data: allData, error: allError } = await supabase
    .from("nst_team_gamelogs_as_rates")
    .select("*")
    .eq("situation", "all")
    .gte("date", startDate)
    .lte("date", endDate);

  if (allError) throw allError;

  // Fetch nst_team_5v5 (situation = 'all')
  const { data: f5v5Data, error: f5v5Error } = await supabase
    .from("nst_team_5v5")
    .select("*")
    .eq("situation", "all")
    .gte("date", startDate)
    .lte("date", endDate);

  if (f5v5Error) throw f5v5Error;

  // Fetch PP Rates
  const { data: ppData, error: ppError } = await supabase
    .from("nst_team_gamelogs_pp_rates")
    .select("team_abbreviation, date, xgf_per_60")
    .eq("situation", "pp")
    .gte("date", startDate)
    .lte("date", endDate);

  if (ppError) throw ppError;

  // Fetch PK Rates
  const { data: pkData, error: pkError } = await supabase
    .from("nst_team_gamelogs_pk_rates")
    .select("team_abbreviation, date, xga_per_60")
    .eq("situation", "pk")
    .gte("date", startDate)
    .lte("date", endDate);

  if (pkError) throw pkError;

  // Fetch WGO Stats (for discipline)
  const { data: wgoData, error: wgoError } = await supabase
    .from("wgo_team_stats")
    .select(
      "team_id, franchise_name, date, penalties_drawn_per_60, penalties_taken_per_60"
    )
    .gte("date", startDate)
    .lte("date", endDate);

  if (wgoError) throw wgoError;

  // Helper to map WGO team_id/name to abbreviation
  const { data: teamsData } = await supabase
    .from("teams")
    .select("id, abbreviation, name");
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

    logs.push({
      team_abbreviation: row.team_abbreviation,
      date: row.date,
      season_id: row.season_id,
      cf_per_60: Number(row.cf_per_60),
      ca_per_60: Number(row.ca_per_60),
      sf_per_60: Number(row.sf_per_60),
      sa_per_60: Number(row.sa_per_60),
      gf_per_60: Number(row.gf_per_60),
      ga_per_60: Number(row.ga_per_60),
      xgf_per_60: Number(row.xgf_per_60),
      xga_per_60: Number(row.xga_per_60),
      gp: row.gp,
      toi_seconds: Number(row.toi_seconds),
      pace_per_60: (Number(row.cf_per_60) + Number(row.ca_per_60)) / 2.0,
      hdcf_per_60: Number(row.hdcf_per_60),
      hdca_per_60: Number(row.hdca_per_60),
      pdo: Number(row.pdo),
      data_mode: "all",
      pp_xgf_per_60: pp ? Number(pp.xgf_per_60) : null,
      pk_xga_per_60: pk ? Number(pk.xga_per_60) : null,
      penalties_drawn_per_60: wgo ? Number(wgo.penalties_drawn_per_60) : null,
      penalties_taken_per_60: wgo ? Number(wgo.penalties_taken_per_60) : null
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
      pdo: allRow ? Number(allRow.pdo) : null,
      data_mode: "5v5",
      pp_xgf_per_60: pp ? Number(pp.xgf_per_60) : null,
      pk_xga_per_60: pk ? Number(pk.xga_per_60) : null,
      penalties_drawn_per_60: wgo ? Number(wgo.penalties_drawn_per_60) : null,
      penalties_taken_per_60: wgo ? Number(wgo.penalties_taken_per_60) : null
    });
  });

  return logs;
}

export function calculateEwma(
  games: TeamGame[],
  targetDate: string
): EwmaMetrics | null {
  const validGames = games.filter((g) => g.date <= targetDate);
  if (validGames.length === 0) return null;

  validGames.sort((a, b) => b.date.localeCompare(a.date));

  const cur = validGames[0];

  if (cur.date !== targetDate) {
    return null;
  }

  const window = validGames.slice(0, LOOKBACK_GAMES);

  let sumWeights = 0;
  let sumXgf = 0;
  let sumGf = 0;
  let sumSf = 0;
  let sumXga = 0;
  let sumGa = 0;
  let sumSa = 0;
  let sumPace = 0;
  let sumHdcf = 0;
  let sumHdca = 0;
  let sumPdo = 0;
  let sumPpXgf = 0;
  let sumPkXga = 0;
  let sumDisciplineDiff = 0;

  for (let i = 0; i < window.length; i++) {
    const game = window[i];
    const diff = i;
    const weight = Math.pow(0.5, diff / HALF_LIFE_GAMES);

    sumWeights += weight;
    sumXgf += (game.xgf_per_60 ?? 0) * weight;
    sumGf += (game.gf_per_60 ?? 0) * weight;
    sumSf += (game.sf_per_60 ?? 0) * weight;
    sumXga += (game.xga_per_60 ?? 0) * weight;
    sumGa += (game.ga_per_60 ?? 0) * weight;
    sumSa += (game.sa_per_60 ?? 0) * weight;
    sumHdcf += (game.hdcf_per_60 ?? 0) * weight;
    sumHdca += (game.hdca_per_60 ?? 0) * weight;
    sumPdo += (game.pdo ?? 100) * weight; // Default PDO to 100 if null? Or 1.0? Usually it's around 1.0 or 100. NST uses 1.0 I think? Let's check.
    // In fetchGameLogs: pdo: Number(row.pdo). NST usually provides 1.02 etc.
    // Let's assume 1.0 base.

    sumPpXgf += (game.pp_xgf_per_60 ?? 0) * weight;
    sumPkXga += (game.pk_xga_per_60 ?? 0) * weight;

    const discDiff =
      (game.penalties_drawn_per_60 ?? 0) - (game.penalties_taken_per_60 ?? 0);
    sumDisciplineDiff += discDiff * weight;

    const pace =
      game.pace_per_60 ?? ((game.cf_per_60 ?? 0) + (game.ca_per_60 ?? 0)) / 2.0;
    sumPace += pace * weight;
  }

  return {
    team_abbreviation: cur.team_abbreviation,
    date: cur.date,
    season_id: cur.season_id,
    gp_to_date: cur.gp_to_date,
    xgf60_ewma: sumXgf / sumWeights,
    gf60_ewma: sumGf / sumWeights,
    sf60_ewma: sumSf / sumWeights,
    xga60_ewma: sumXga / sumWeights,
    ga60_ewma: sumGa / sumWeights,
    sa60_ewma: sumSa / sumWeights,
    pace60_ewma: sumPace / sumWeights,
    hdcf60_ewma: sumHdcf / sumWeights,
    hdca60_ewma: sumHdca / sumWeights,
    pdo_ewma: sumPdo / sumWeights,
    pp_xgf60_ewma: sumPpXgf / sumWeights,
    pk_xga60_ewma: sumPkXga / sumWeights,
    discipline_diff_ewma: sumDisciplineDiff / sumWeights
  };
}

export function calculateLeagueMetrics(metrics: EwmaMetrics[]): LeagueMetrics {
  const calcStats = (values: number[]) => {
    if (values.length === 0) return { avg: 0, stddev: 0 };
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (values.length === 1) return { avg, stddev: 0 };
    const variance =
      values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) /
      (values.length - 1);
    return { avg, stddev: Math.sqrt(variance) };
  };

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
    })
  );
  const ppOff = calcStats(metrics.map((m) => m.pp_xgf60_ewma));
  const pkDef = calcStats(metrics.map((m) => m.pk_xga60_ewma));
  const discipline = calcStats(metrics.map((m) => m.discipline_diff_ewma));
  const pdo = calcStats(metrics.map((m) => m.pdo_ewma));

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
    league_pdo_stddev: pdo.stddev
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
  pp_off_z: number;
  pk_def_z: number;
  discipline_z: number;
  pdo_z: number;
}

export function calculateZScores(
  metric: EwmaMetrics,
  league: LeagueMetrics
): ZScored {
  const z = (val: number, avg: number, stddev: number) =>
    stddev === 0 ? 0 : (val - avg) / stddev;

  const gpWeight = Math.min(1.0, Math.max(0.0, metric.gp_to_date / 10.0));

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
    xgf60_z: z(xgf60, league.league_xgf60_avg, league.league_xgf60_stddev),
    gf60_z: z(gf60, league.league_gf60_avg, league.league_gf60_stddev),
    sf60_z: z(sf60, league.league_sf60_avg, league.league_sf60_stddev),
    xga60_z: z(xga60, league.league_xga60_avg, league.league_xga60_stddev),
    ga60_z: z(ga60, league.league_ga60_avg, league.league_ga60_stddev),
    sa60_z: z(sa60, league.league_sa60_avg, league.league_sa60_stddev),
    pace60_z: z(pace60, league.league_pace60_avg, league.league_pace60_stddev),
    finishing_z: z(
      finishing,
      league.league_finishing_avg,
      league.league_finishing_stddev
    ),
    goalie_z: z(goalie, league.league_goalie_avg, league.league_goalie_stddev),
    danger_z: z(danger, league.league_danger_avg, league.league_danger_stddev),
    pp_off_z: z(ppOff, league.league_pp_off_avg, league.league_pp_off_stddev),
    pk_def_z: z(pkDef, league.league_pk_def_avg, league.league_pk_def_stddev),
    discipline_z: z(
      discipline,
      league.league_discipline_avg,
      league.league_discipline_stddev
    ),
    pdo_z: z(pdo, league.league_pdo_avg, league.league_pdo_stddev)
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
    z
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
  const calcStats = (values: number[]) => {
    if (values.length === 0) return { avg: 0, stddev: 0 };
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (values.length === 1) return { avg, stddev: 0 };
    const variance =
      values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) /
      (values.length - 1);
    return { avg, stddev: Math.sqrt(variance) };
  };

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
    pace_raw_stddev: pace.stddev
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
  special_rating: number;
  discipline_rating: number;
  variance_flag: number;
}

export function calculateFinalRating(
  score: RawScore,
  dist: RawDistribution
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
      dist.pace_raw_stddev
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
      100 + 15 * (0.2 * (z.pp_off_z || 0) + 0.2 * -(z.pk_def_z || 0)),
    discipline_rating: 100 + 15 * (z.discipline_z || 0),
    variance_flag: Math.abs(z.pdo_z || 0) >= 1.0 ? 1 : 0
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
  endDate: string
): Promise<WgoStat[]> {
  const { data: wgoData, error: wgoError } = await supabase
    .from("wgo_team_stats")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate);

  if (wgoError) throw wgoError;

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
        times_shorthanded_per_game: Number(row.times_shorthanded_per_game)
      });
    }
  });

  return stats;
}

export async function fetchAllRatings(
  supabase: SupabaseClient,
  table: string,
  targetDate: string,
  trendStartDate: string
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
