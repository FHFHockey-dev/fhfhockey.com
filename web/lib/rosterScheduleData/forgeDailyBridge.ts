import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarLeadDay, validForecastCalendarPolicy, type ForecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { loadDailyBoardEvidence, type DailyBoardEvidence } from "lib/projections/dailyBoardEvidence";
import { buildSkaterModeledHeadTotals } from "lib/projections/modeledHeadTotals";
import { excludeOffReleaseRuns } from "lib/projections/releasedRunFence";
import { computeTeamStrengthContextAdjustment } from "lib/projections/calculators/team-context-adjustments";
import { computeSkaterRestScheduleAdjustments } from "lib/projections/calculators/skater-adjustments";
import { DEFENSE_B2B_FATIGUE_BOOST, OPPONENT_AWAY_PENALTY, OPPONENT_B2B_PENALTY, OPPONENT_HOME_BOOST, OPPONENT_RESTED_BOOST } from "lib/projections/constants/projection-weights";
import type { TeamStrengthPrior } from "lib/projections/types/run-forge-projections.types";
import type { GameForecast, PlanningGame, PlanningPlayer, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";
import { pages, withinDeadline } from "./planningInputs";
import { bridgeWireRowBytes, FORGE_DAILY_BRIDGE_VERSION, jsonUtf8Bytes } from "./bridgeForecastWire";

type Row = Record<string, any>;
type Run = { runId: string; asOfDate: string; issuedAt: string; gitSha: string | null };

/** Interim RSO source until native forecasts are activated (TJ, 2026-10-19). Each player's
 * latest FORGE v2 daily projection stands in for his remaining games in the planning window. */
export { FORGE_DAILY_BRIDGE_VERSION };
export const FORGE_DAILY_BRIDGE_LOOKBACK_DAYS = 7;
/** Compact wire bytes (see bridgeForecastWire) the projections may take beside players, games and evidence. */
export const FORGE_DAILY_BRIDGE_BYTE_BUDGET = 2_500_000;
/** Bytes the projections may take once the client rebuilds them: one snapshot plus players and games stays well
 * inside the 10 MB save check and, packed, inside every 4.5 MB request, response and browser-storage limit. */
export const FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET = 4_000_000;
/** Yahoo skater stats FORGE does not project: per-game season rates stand in, and the evidence says so. */
export const FORGE_DAILY_BRIDGE_SEASON_RATED = ["PENALTY_MINUTES", "PLUS_MINUS", "SH_GOALS", "SH_ASSISTS", "SH_POINTS", "GAME_WINNING_GOALS", "FACEOFFS_WON", "FACEOFFS_LOST"] as const;
/** Start-chance floors for speculative goalie news (TJ may tune these). Confirmed is 1 and ruled out is 0. */
export const FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS: Readonly<Record<string, number>> = { likely: 0.8, projected: 0.65 };
/** Last season counts half; players with few games lean on the league rate (+/- on 0) for this many games. */
const LAST_SEASON_WEIGHT = 0.5;
const SHRINK_GAMES: Record<string, number> = { PENALTY_MINUTES: 10, PLUS_MINUS: 40, SH_GOALS: 20, SH_ASSISTS: 20, SH_POINTS: 20, FACEOFFS_WON: 0, FACEOFFS_LOST: 0 };
const GWG_SHARE_PRIOR = 0.16, GWG_SHRINK_GOALS = 10;
const TOTAL_COLUMNS: Record<string, string> = { PENALTY_MINUTES: "penalty_minutes", PLUS_MINUS: "plus_minus", SH_GOALS: "sh_goals",
  SH_ASSISTS: "sh_assists", SH_POINTS: "sh_points", FACEOFFS_WON: "total_fow", FACEOFFS_LOST: "total_fol" };
const DAY_MS = 86400000;
const VALID_DAYS = 8;
const FORECAST_LIMITATION = "Interim FORGE projection: the player's latest FORGE game line, reused for this game.";
const SKATER_COLUMNS = "run_id,as_of_date,horizon_games,game_id,player_id,team_id,opponent_team_id,proj_goals_es,proj_goals_pp,proj_goals_pk,proj_assists_es,proj_assists_pp,proj_assists_pk,proj_shots_es,proj_shots_pp,proj_shots_pk,proj_toi_es_seconds,proj_toi_pp_seconds,proj_toi_pk_seconds,proj_hits,proj_blocks,proj_pim,proj_plus_minus";
const GOALIE_COLUMNS = "run_id,as_of_date,horizon_games,game_id,goalie_id,team_id,opponent_team_id,starter_probability,proj_saves,proj_goals_allowed,proj_shots_against,proj_win_prob,proj_shutout_prob";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number | null) => value === null ? null : Math.round(value * 10000) / 10000;
const share = (value: unknown) => finite(value) && value >= 0 && value <= 1 ? value : null;

export type ForgeDailyBridgeInputs = { runs: Row[]; skaters: Row[]; goalies: Row[]; goalieShares: Row[];
  /** `wgo_skater_stats_totals` rows for this season and last; absent means the season rates could not be read. */
  seasonTotals?: Row[];
  /** Accepted IFTTT goalie news for the upcoming games; absent means it could not be read. */
  goalieNews?: DailyBoardEvidence;
  /** `nhl_team_data` rows (FORGE's team xG prior) for this season; absent means no opponent re-targeting. */
  teamPriors?: Row[];
  /** `nst_team_stats` rows (situation "all") for last season, blended into each team's prior. */
  lastSeasonTeams?: Row[];
  /** `games` rows (id, date, homeTeamId, awayTeamId) around the window, for home ice and rest days. */
  teamGames?: Row[];
  /** `opponent_skater_allowed_by_position` rows (this season and last); absent until that view exists. */
  positionAllowed?: Row[] };
/** An opponent's tilt toward forwards or defencemen: weight of last season and shrinkage, in games; clamp. */
const TILT_LAST_SEASON_GAMES = 20, TILT_SHRINK_GAMES = 30, TILT_LIMIT = 0.15;
type Tilt = { points: number; shots: number };
/** Last season's team xG counts as this many games in the blended prior. */
export const LAST_SEASON_PRIOR_GAMES = 20;
/** On the second night of a back-to-back, the usual starter keeps this share of his start chance (no goalie news). */
export const BACK_TO_BACK_STARTER_SHARE = 0.55;
type GameContext = { teamRestDays: number | null; opponentRestDays: number | null; isHome: boolean };
const DAY = 86400000;
/** FORGE team-strength terms for one team against one opponent (fractional adjustments, already sample-weighted and clamped). */
type Context = { shotsAgainst: number; goalsAgainst: number; goalsFor: number };

/** One prior per team: the latest date's season-to-date row, i.e. the row whose xGA total matches its games played.
 * The table holds several rows per team and date, so a row is used only when exactly one matches. */
export function teamStrengthPriors(rows: Row[], lastSeason: Row[] = []): Map<string, TeamStrengthPrior> {
  const latest = new Map<string, string>();
  for (const row of rows) if (typeof row.team_abbrev === "string" && typeof row.date === "string"
    && (latest.get(row.team_abbrev) ?? "") < row.date) latest.set(row.team_abbrev, row.date);
  const priors = new Map<string, TeamStrengthPrior>();
  for (const [team, date] of latest) {
    const matches = rows.filter(row => row.team_abbrev === team && row.date === date).filter(row => {
      const xga = Number(row.xga), perGame = Number(row.xga_per_game), games = Number(row.games_played);
      return Number.isFinite(xga) && perGame > 0 && games > 0 && Math.abs(xga / perGame - games) < 0.5;
    });
    if (matches.length !== 1) continue;
    const row = matches[0];
    priors.set(team.toUpperCase(), { source: "nhl_team_data", sourceDate: date, xga: Number(row.xga),
      xgaPerGame: Number(row.xga_per_game), xgfPerGame: Number.isFinite(Number(row.xgf_per_game)) ? Number(row.xgf_per_game) : null });
  }
  // Blend last season in as LAST_SEASON_PRIOR_GAMES games, so early-season priors carry real weight.
  for (const row of lastSeason) {
    const team = typeof row.team_abbreviation === "string" ? row.team_abbreviation.toUpperCase() : "", games = Number(row.gp);
    const lastXga = Number(row.xga) / games, lastXgf = Number(row.xgf) / games;
    if (!team || !(games > 0) || !Number.isFinite(lastXga) || !Number.isFinite(lastXgf)) continue;
    const current = priors.get(team);
    const played = current?.xga && current.xgaPerGame ? current.xga / current.xgaPerGame : 0;
    const weight = LAST_SEASON_PRIOR_GAMES;
    priors.set(team, { source: "nhl_team_data", sourceDate: current?.sourceDate ?? null,
      xga: (current?.xga ?? 0) + weight * lastXga,
      xgaPerGame: ((current?.xga ?? 0) + weight * lastXga) / (played + weight),
      xgfPerGame: ((current?.xgfPerGame ?? lastXgf) * played + weight * lastXgf) / (played + weight) });
  }
  return priors;
}
/** Each opponent's share of points (and shots) going to forwards vs defencemen, against the league share.
 * Overall leakiness is left to the xG team-strength term; this is only the positional mix, shrunk toward 1. */
export function opponentTilts(rows: Row[], seasonId: number): Map<string, Tilt> {
  const previous = (Math.floor(seasonId / 10000) - 1) * 10001 + 1;
  const perGame = new Map<string, { games: number; points: number; shots: number }>();
  for (const row of rows) {
    const weight = Number(row.season_id) === seasonId ? 1 : Number(row.season_id) === previous ? TILT_LAST_SEASON_GAMES / Math.max(1, Number(row.games)) : 0;
    if (!weight || typeof row.opponent !== "string" || !["F", "D"].includes(row.position_group) || !(Number(row.games) > 0)) continue;
    const key = `${row.opponent.toUpperCase()}|${row.position_group}`, sum = perGame.get(key) ?? { games: 0, points: 0, shots: 0 };
    sum.games += weight * Number(row.games); sum.points += weight * (Number(row.points) || 0); sum.shots += weight * (Number(row.shots) || 0);
    perGame.set(key, sum);
  }
  const share = (team: string, stat: "points" | "shots") => {
    const f = perGame.get(`${team}|F`), d = perGame.get(`${team}|D`);
    if (!f || !d || !f.games || !d.games) return null;
    const forwards = f[stat] / f.games, defence = d[stat] / d.games;
    return forwards + defence > 0 ? { d: defence / (forwards + defence), games: Math.min(f.games, d.games) } : null;
  };
  const teams = [...new Set([...perGame.keys()].map(key => key.split("|")[0]))];
  const league = (stat: "points" | "shots") => {
    const shares = teams.map(team => share(team, stat)).filter((value): value is { d: number; games: number } => !!value);
    return shares.length ? shares.reduce((sum, value) => sum + value.d, 0) / shares.length : null;
  };
  const leaguePoints = league("points"), leagueShots = league("shots");
  const tilts = new Map<string, Tilt>();
  const factor = (own: number, base: number, games: number) =>
    Math.min(1 + TILT_LIMIT, Math.max(1 - TILT_LIMIT, 1 + (own / base - 1) * games / (games + TILT_SHRINK_GAMES)));
  for (const team of teams) {
    const points = share(team, "points"), shots = share(team, "shots");
    if (!points || !shots || !leaguePoints || !leagueShots) continue;
    // Defence factor from the D share; forwards take the mirror image so the team total is unchanged.
    tilts.set(`${team}|D`, { points: factor(points.d, leaguePoints, points.games), shots: factor(shots.d, leagueShots, shots.games) });
    tilts.set(`${team}|F`, { points: factor(1 - points.d, 1 - leaguePoints, points.games), shots: factor(1 - shots.d, 1 - leagueShots, shots.games) });
  }
  return tilts;
}
/** A team's chance to win (ties split for overtime) from both teams' xG, as Poisson goals; home ice tilts the rates
 * by 4% (about 54% home wins between equal teams). Neutral 0.5 when either team's strength is unknown. */
export function teamWinProbability(own: TeamStrengthPrior | undefined, other: TeamStrengthPrior | undefined, isHome: boolean): number {
  if (!own?.xgfPerGame || !own.xgaPerGame || !other?.xgfPerGame || !other.xgaPerGame) return 0.5;
  const venue = isHome ? 1.04 : 0.96;
  const scored = (own.xgfPerGame + other.xgaPerGame) / 2 * venue, allowed = (other.xgfPerGame + own.xgaPerGame) / 2 / venue;
  const poisson = (rate: number) => { const out: number[] = [Math.exp(-rate)]; for (let k = 1; k <= 12; k++) out.push(out[k - 1] * rate / k); return out; };
  const a = poisson(scored), b = poisson(allowed);
  let win = 0, tie = 0;
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) { if (i > j) win += a[i] * b[j]; else if (i === j) tie += a[i] * b[j]; }
  return Math.min(0.95, Math.max(0.05, win + tie / 2));
}
/** Multipliers that move a skater line between game contexts, from FORGE's own rest/home model. */
function restScale(from: GameContext | null, to: GameContext | null) {
  if (!from || !to) return null;
  const a = computeSkaterRestScheduleAdjustments(from), b = computeSkaterRestScheduleAdjustments(to);
  return { toi: b.toiMultiplier / a.toiMultiplier, shot: b.shotRateMultiplier / a.shotRateMultiplier,
    goal: b.goalRateMultiplier / a.goalRateMultiplier, assist: b.assistRateMultiplier / a.assistRateMultiplier };
}
/** FORGE goalie-stage shots-against context for rest and venue (constants from projection-weights). */
function goalieShotContext(context: GameContext) {
  const opponent = context.opponentRestDays === null ? 0 : context.opponentRestDays >= 2 ? OPPONENT_RESTED_BOOST : context.opponentRestDays === 1 ? -OPPONENT_B2B_PENALTY : 0;
  const own = context.teamRestDays === 1 ? DEFENSE_B2B_FATIGUE_BOOST : 0;
  return Math.min(0.2, Math.max(-0.15, opponent + own + (context.isHome ? -OPPONENT_AWAY_PENALTY : OPPONENT_HOME_BOOST)));
}
/** Team strength (`team`) and FORGE rest/home (`rest`) applied to a skater line; totals stay the sum of their parts. */
function retargetSkater(stats: StatLine, team: number, rest: ReturnType<typeof restScale>, tilt: Tilt = { points: 1, shots: 1 }): StatLine {
  const r = rest ?? { toi: 1, shot: 1, goal: 1, assist: 1 };
  const out: StatLine = { ...stats };
  const scale = (keys: string[], factor: number) => { for (const key of keys) if (out[key] !== null && out[key] !== undefined) out[key] = round(out[key]! * factor); };
  scale(["GOALS", "PP_GOALS", "SH_GOALS", "GAME_WINNING_GOALS"], team * r.goal * r.toi * tilt.points);
  scale(["ASSISTS", "PP_ASSISTS", "SH_ASSISTS"], team * r.assist * r.toi * tilt.points);
  scale(["SHOTS_ON_GOAL"], team * r.shot * r.toi * tilt.shots);
  scale(["TIME_ON_ICE_PER_GAME", "HITS", "BLOCKED_SHOTS"], r.toi);
  const sum = (a: string, b: string) => out[a] !== null && out[a] !== undefined && out[b] !== null && out[b] !== undefined ? round(out[a]! + out[b]!) : null;
  if (sum("GOALS", "ASSISTS") !== null) out.POINTS = sum("GOALS", "ASSISTS");
  if (sum("PP_GOALS", "PP_ASSISTS") !== null) out.PP_POINTS = sum("PP_GOALS", "PP_ASSISTS");
  if (sum("SH_GOALS", "SH_ASSISTS") !== null) out.SH_POINTS = sum("SH_GOALS", "SH_ASSISTS");
  return out;
}
/** Moves a goalie's per-start line from the opponent FORGE projected to a new one, with FORGE's own team-strength terms. */
function retargetGoalieLine(line: StatLine, from: Context, to: Context, venue: { from: number; to: number } = { from: 0, to: 0 }): StatLine {
  const shots = (1 + to.shotsAgainst) / (1 + from.shotsAgainst) * (1 + venue.to) / (1 + venue.from);
  const against = (1 + to.goalsAgainst) / (1 + from.goalsAgainst) * (1 + venue.to) / (1 + venue.from);
  const edge = (to.goalsFor - to.goalsAgainst) - (from.goalsFor - from.goalsAgainst);
  const win = line.WINS_GOALIE === null ? null : Math.min(0.98, Math.max(0.02, line.WINS_GOALIE * (1 + edge)));
  const scale = (value: number | null, factor: number) => value === null ? null : round(value * factor);
  return { ...line, SAVES_GOALIE: scale(line.SAVES_GOALIE, shots), SHOTS_AGAINST_GOALIE: scale(line.SHOTS_AGAINST_GOALIE, shots),
    GOALS_AGAINST_GOALIE: scale(line.GOALS_AGAINST_GOALIE, against), WINS_GOALIE: round(win), LOSSES_GOALIE: win === null ? null : round(1 - win),
    SHUTOUTS_GOALIE: line.SHUTOUTS_GOALIE === null ? null : round(Math.min(1, line.SHUTOUTS_GOALIE / against)) };
}
export type ForgeDailyBridgeResult = { forecasts: GameForecast[]; limitations: string[] };
type SeasonRates = Record<string, number> & { gwgShare: number };

/** Per-game rates for the stats FORGE does not project, blended over this season and half of last, pulled toward the league rate. */
export function seasonRates(rows: Row[], seasonId: number): Map<number, SeasonRates> {
  const previous = String((Math.floor(seasonId / 10000) - 1) * 10001 + 1);
  const weighted = new Map<number, Record<string, number>>();
  for (const row of rows) {
    const weight = String(row.season) === String(seasonId) ? 1 : String(row.season) === previous ? LAST_SEASON_WEIGHT : 0;
    if (!weight || !finite(row.player_id) || !finite(row.games_played) || row.games_played <= 0) continue;
    const sum = weighted.get(row.player_id) ?? { games: 0, goals: 0, gwg: 0 };
    sum.games += weight * row.games_played;
    sum.goals += weight * (finite(row.goals) ? row.goals : 0); sum.gwg += weight * (finite(row.gw_goals) ? row.gw_goals : 0);
    for (const [key, column] of Object.entries(TOTAL_COLUMNS)) sum[key] = (sum[key] ?? 0) + weight * (finite(row[column]) ? row[column] : 0);
    weighted.set(row.player_id, sum);
  }
  const league: Record<string, number> = {};
  const games = [...weighted.values()].reduce((total, sum) => total + sum.games, 0);
  for (const key of Object.keys(TOTAL_COLUMNS)) league[key] = key === "PLUS_MINUS" || !games ? 0
    : [...weighted.values()].reduce((total, sum) => total + sum[key], 0) / games;
  const result = new Map<number, SeasonRates>();
  for (const [playerId, sum] of weighted) {
    const rates = { gwgShare: (sum.gwg + GWG_SHARE_PRIOR * GWG_SHRINK_GOALS) / (sum.goals + GWG_SHRINK_GOALS) } as SeasonRates;
    for (const key of Object.keys(TOTAL_COLUMNS)) rates[key] = (sum[key] + SHRINK_GAMES[key] * league[key]) / (sum.games + SHRINK_GAMES[key]);
    result.set(playerId, rates);
  }
  result.set(0, { ...Object.fromEntries(Object.keys(TOTAL_COLUMNS).map(key => [key, SHRINK_GAMES[key] ? league[key] : 0])), gwgShare: GWG_SHARE_PRIOR } as SeasonRates);
  return result;
}

const SPECIAL_TEAMS_COLUMNS = ["proj_goals_pp", "proj_assists_pp", "proj_shots_pp", "proj_toi_pp_seconds",
  "proj_goals_pk", "proj_assists_pk", "proj_shots_pk", "proj_toi_pk_seconds"];
/** Up to this much projected power-play time per game counts as none. */
const NO_POWER_PLAY_SECONDS = 6;
/** FORGE leaves power-play and penalty-kill heads blank for a skater with no such history. With (about) no projected
 * power-play time that is no production, not unknown; with real power-play time the blanks stay unknown. */
function withSpecialTeamsZeros(row: Row): { row: Row; filled: boolean; unknown: boolean } {
  if (![row.proj_goals_es, row.proj_assists_es, row.proj_shots_es].every(finite)) return { row, filled: false, unknown: false };
  const blanks = SPECIAL_TEAMS_COLUMNS.filter(key => !finite(row[key]));
  const powerPlayBlank = blanks.some(key => key.includes("_pp"));
  if (powerPlayBlank && finite(row.proj_toi_pp_seconds) && row.proj_toi_pp_seconds > NO_POWER_PLAY_SECONDS) return { row, filled: false, unknown: true };
  return blanks.length ? { row: { ...row, ...Object.fromEntries(blanks.map(key => [key, 0])) }, filled: powerPlayBlank, unknown: false }
    : { row, filled: false, unknown: false };
}

function skaterStats(row: Row, rates: SeasonRates | null): StatLine | null {
  const heads = buildSkaterModeledHeadTotals(row);
  if (heads.goals === null || heads.assists === null || heads.shots === null) return null;
  const toi = finite(row.proj_toi_es_seconds) && finite(row.proj_toi_pp_seconds)
    ? (row.proj_toi_es_seconds + row.proj_toi_pp_seconds + (finite(row.proj_toi_pk_seconds) ? row.proj_toi_pk_seconds : 0)) / 60 : null;
  const stats: StatLine = { GOALS: heads.goals, ASSISTS: heads.assists, POINTS: heads.points,
    PP_GOALS: finite(row.proj_goals_pp) ? row.proj_goals_pp : null, PP_ASSISTS: finite(row.proj_assists_pp) ? row.proj_assists_pp : null,
    PP_POINTS: heads.ppPoints, SHOTS_ON_GOAL: heads.shots,
    HITS: finite(row.proj_hits) ? row.proj_hits : null, BLOCKED_SHOTS: finite(row.proj_blocks) ? row.proj_blocks : null,
    TIME_ON_ICE_PER_GAME: toi };
  // FORGE values win where the writers store them; season rates (or 0 when unreadable) fill the rest.
  for (const key of FORGE_DAILY_BRIDGE_SEASON_RATED) stats[key] = key === "GAME_WINNING_GOALS" ? heads.goals * (rates?.gwgShare ?? 0) : rates?.[key] ?? 0;
  if (finite(row.proj_pim)) stats.PENALTY_MINUTES = row.proj_pim;
  if (finite(row.proj_plus_minus)) stats.PLUS_MINUS = row.proj_plus_minus;
  return Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, round(value)]));
}

function goalieLine(row: Row): StatLine {
  const win = finite(row.proj_win_prob) ? row.proj_win_prob : null;
  const line: StatLine = { SAVES_GOALIE: finite(row.proj_saves) ? row.proj_saves : null,
    GOALS_AGAINST_GOALIE: finite(row.proj_goals_allowed) ? row.proj_goals_allowed : null,
    SHOTS_AGAINST_GOALIE: finite(row.proj_shots_against) ? row.proj_shots_against : null,
    WINS_GOALIE: win, LOSSES_GOALIE: win === null ? null : Math.max(0, 1 - win),
    SHUTOUTS_GOALIE: finite(row.proj_shutout_prob) ? row.proj_shutout_prob : null, GOALIE_MINUTES: 60, GAMES_STARTED: 1 };
  return Object.fromEntries(Object.entries(line).map(([key, value]) => [key, round(value)]));
}

/** Pure: no reads. Rows from runs not in `inputs.runs` are ignored. */
export function buildForgeDailyBridgeForecasts(inputs: ForgeDailyBridgeInputs, players: PlanningPlayer[], games: PlanningGame[],
  now: Date, seasonId: number, calendarPolicy: ForecastCalendarPolicy, byteBudget = FORGE_DAILY_BRIDGE_BYTE_BUDGET,
  expandedByteBudget = FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET): ForgeDailyBridgeResult {
  const runs = new Map<string, Run>();
  for (const row of inputs.runs) if (typeof row.run_id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.as_of_date)
    && Date.parse(row.created_at) <= now.getTime()) runs.set(row.run_id, { runId: row.run_id, asOfDate: row.as_of_date,
    issuedAt: new Date(row.created_at).toISOString(), gitSha: row.git_sha ?? null });
  if (!runs.size) return { forecasts: [], limitations: ["Interim FORGE projections: no successful FORGE run in the last week, so planning is schedule-only."] };
  const order = (row: Row) => `${row.as_of_date}|${runs.get(row.run_id)!.issuedAt}`;
  const latest = <K>(rows: Row[], key: (row: Row) => K) => {
    const result = new Map<K, Row>();
    for (const row of rows) { const previous = result.get(key(row)); if (!previous || order(row) > order(previous)) result.set(key(row), row); }
    return result;
  };
  const skaterRows = inputs.skaters.filter(row => runs.has(row.run_id) && row.horizon_games === 1 && finite(row.player_id) && finite(row.team_id));
  const goalieRows = inputs.goalies.filter(row => runs.has(row.run_id) && row.horizon_games === 1 && finite(row.goalie_id) && finite(row.team_id));
  const skaterLatest = latest(skaterRows, row => row.player_id);
  // A run that projected this very game (tomorrow's run, once it exists) beats a re-aimed line from another game.
  const exactSkater = latest(skaterRows, row => `${row.game_id}:${row.player_id}`);
  const teamLatestDate = new Map<number, string>();
  for (const row of skaterRows) if ((teamLatestDate.get(row.team_id) ?? "") < row.as_of_date) teamLatestDate.set(row.team_id, row.as_of_date);
  const goalieLatest = latest(goalieRows, row => row.goalie_id), teamGoalieLatest = latest(goalieRows, row => row.team_id);
  const exactGoalie = latest(goalieRows, row => `${row.game_id}:${row.team_id}`);
  const shares = new Map<number, number>();
  const shareOrder = new Map<number, string>();
  for (const row of inputs.goalieShares) {
    const value = share(row.l10_start_pct) ?? share(row.season_start_pct), key = `${row.game_date}|${row.updated_at ?? ""}`;
    if (value === null || !finite(row.player_id) || (shareOrder.get(row.player_id) ?? "") >= key) continue;
    shares.set(row.player_id, value); shareOrder.set(row.player_id, key);
  }
  const rates = inputs.seasonTotals ? seasonRates(inputs.seasonTotals, seasonId) : null;
  const priors = teamStrengthPriors(inputs.teamPriors ?? [], inputs.lastSeasonTeams ?? []);
  const tilts = opponentTilts(inputs.positionAllowed ?? [], seasonId);
  let estimatedWins = 0;
  const tiltBetween = (player: PlanningPlayer, from: string | undefined, to: string | undefined): Tilt | undefined => {
    const group = player.eligiblePositions.some(position => position.toUpperCase() === "D") ? "D" : "F";
    const a = from ? tilts.get(`${from.toUpperCase()}|${group}`) : undefined, b = to ? tilts.get(`${to.toUpperCase()}|${group}`) : undefined;
    return a && b ? { points: b.points / a.points, shots: b.shots / a.shots } : undefined;
  };
  // Rest days as FORGE counts them (days since the team's previous game; a back-to-back is 1) and venue, per game id.
  const scheduleById = new Map((inputs.teamGames ?? []).filter(row => finite(row.homeTeamId) && finite(row.awayTeamId) && typeof row.date === "string")
    .map(row => [String(row.id), row]));
  const datesByTeam = new Map<number, string[]>();
  for (const row of scheduleById.values()) for (const team of [row.homeTeamId, row.awayTeamId] as number[])
    datesByTeam.set(team, [...new Set([...(datesByTeam.get(team) ?? []), row.date as string])].sort());
  const restDays = (team: number, date: string) => {
    const previous = (datesByTeam.get(team) ?? []).filter(day => day < date).at(-1);
    return previous ? Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${previous}T12:00:00Z`)) / DAY) : null;
  };
  const gameContext = (gameId: string | number, team: number | undefined): GameContext | null => {
    const row = scheduleById.get(String(gameId));
    if (!row || !team || (row.homeTeamId !== team && row.awayTeamId !== team)) return null;
    const opponent = row.homeTeamId === team ? row.awayTeamId : row.homeTeamId;
    return { teamRestDays: restDays(team, row.date), opponentRestDays: restDays(opponent, row.date), isHome: row.homeTeamId === team };
  };
  const abbreviationById = new Map(players.filter(player => finite(player.nhlTeamId) && player.teamAbbreviation)
    .map(player => [player.nhlTeamId!, player.teamAbbreviation!.toUpperCase()]));
  const context = (team: string | null | undefined, opponent: string | null | undefined): Context | null => {
    const own = team ? priors.get(team.toUpperCase()) : undefined, other = opponent ? priors.get(opponent.toUpperCase()) : undefined;
    if (!own || !other) return null;
    const defending = computeTeamStrengthContextAdjustment({ defendingTeamPrior: own, opponentTeamPrior: other });
    // Goals for come from the same helper called from the opponent's side (its goals-against term for them),
    // which adds the opponent's defensive liability directly.
    const attacking = computeTeamStrengthContextAdjustment({ defendingTeamPrior: other, opponentTeamPrior: own });
    return { shotsAgainst: defending.shotsAgainstPctAdjustment, goalsAgainst: defending.opponentGoalsForPctAdjustment, goalsFor: attacking.opponentGoalsForPctAdjustment };
  };
  const news = { confirmed: 0, speculative: 0, ruledOut: 0, disputed: 0 };
  const nowIso = now.toISOString();
  const upcoming = (team: string) => games.filter(game => game.teamAbbreviation === team && game.status === "scheduled" && game.startsAt
    && game.scheduleRevision && Date.parse(game.startsAt) > now.getTime() && validForecastCalendarPolicy(calendarPolicy)
    && calendarLeadDay(game.startsAt, nowIso) < calendarPolicy.calendarDays);
  const forecasts: GameForecast[] = [];
  const emit = (player: PlanningPlayer, game: PlanningGame, run: Run, stats: StatLine, startProbability: number | null, conditionalStats?: StatLine, confirmedStart = false) => {
    const expiresAt = new Date(Math.min(Date.parse(game.startsAt!), Date.parse(run.issuedAt) + VALID_DAYS * DAY_MS)).toISOString();
    if (Date.parse(expiresAt) <= now.getTime()) return;
    forecasts.push({ sourceKind: "detailed", cutoffAt: run.issuedAt, expiresAt, sourceWatermark: `${FORGE_DAILY_BRIDGE_VERSION}:${run.runId}`,
      issuedContext: { version: "forge-issued-context-v1", playerId: player.id, gameId: game.id, nhlPlayerId: player.nhlId!, seasonId,
        teamId: player.nhlTeamId!, scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!, rosterRevision: player.rosterRevision!,
        observedAt: run.issuedAt, scheduleSourceUpdatedAt: null, scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] },
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      ...(conditionalStats ? { conditionalStats } : {}),
      playerId: player.id, gameId: game.id, stats, conditioning: "unconditional", startProbability, confirmedStart,
      revisionId: `${FORGE_DAILY_BRIDGE_VERSION}:${run.runId}`, issuedAt: run.issuedAt,
      modelVersion: `${FORGE_DAILY_BRIDGE_VERSION}:${run.gitSha ?? "unknown"}`, limitations: [FORECAST_LIMITATION] });
  };
  const identified = players.filter(player => player.nhlId !== null && finite(player.nhlTeamId) && player.rosterRevision && player.teamAbbreviation);
  let staleSkaters = 0, noPowerPlay = 0, unknownPowerPlay = 0;
  for (const player of identified.filter(row => row.playerClass === "skater")) {
    const latestRow = skaterLatest.get(player.nhlId);
    if (!latestRow || latestRow.team_id !== player.nhlTeamId) continue;
    // Missing from his team's latest run: scratched, injured or reassigned since.
    if (latestRow.as_of_date !== teamLatestDate.get(latestRow.team_id)) { staleSkaters++; continue; }
    const lineFor = (row: Row) => {
      const special = withSpecialTeamsZeros(row);
      if (special.filled) noPowerPlay++;
      if (special.unknown) unknownPowerPlay++;
      return skaterStats(special.row, rates ? rates.get(player.nhlId!) ?? rates.get(0)! : null);
    };
    const stats = lineFor(latestRow);
    const projectedAgainst = context(player.teamAbbreviation, abbreviationById.get(latestRow.opponent_team_id));
    if (stats) for (const game of upcoming(player.teamAbbreviation!)) {
      const own = exactSkater.get(`${game.id}:${player.nhlId}`);
      if (own && own !== latestRow && own.team_id === player.nhlTeamId) {
        // Projected for this game itself: use that line as issued, no re-aiming.
        const ownStats = lineFor(own);
        if (ownStats) { emit(player, game, runs.get(own.run_id)!, ownStats, null); continue; }
      }
      const row = latestRow;
      const facing = String(row.game_id) === game.id ? null : context(player.teamAbbreviation, game.opponent);
      const scale = projectedAgainst && facing ? (1 + facing.goalsFor) / (1 + projectedAgainst.goalsFor) : 1;
      const rest = String(row.game_id) === game.id ? null : restScale(gameContext(row.game_id, row.team_id), gameContext(game.id, row.team_id));
      const tilt = String(row.game_id) === game.id ? undefined : tiltBetween(player, abbreviationById.get(row.opponent_team_id), game.opponent);
      emit(player, game, runs.get(row.run_id)!, scale === 1 && !rest && !tilt ? stats : retargetSkater(stats, scale, rest, tilt), null);
    }
  }
  const goaliesByTeam = new Map<number, PlanningPlayer[]>();
  for (const player of identified.filter(row => row.playerClass === "goalie")) goaliesByTeam.set(player.nhlTeamId!, [...(goaliesByTeam.get(player.nhlTeamId!) ?? []), player]);
  for (const [teamId, goalies] of goaliesByTeam) for (const game of upcoming(goalies[0].teamAbbreviation!)) {
    const exact = exactGoalie.get(`${game.id}:${teamId}`), exactProbability = exact ? share(exact.starter_probability) : null;
    const probability = new Map<string, number>();
    if (exact && exactProbability !== null && goalies.some(goalie => goalie.nhlId === exact.goalie_id)) {
      const others = goalies.filter(goalie => goalie.nhlId !== exact.goalie_id && shares.has(goalie.nhlId!));
      const mass = others.reduce((sum, goalie) => sum + shares.get(goalie.nhlId!)!, 0);
      probability.set(String(exact.goalie_id), exactProbability);
      for (const goalie of others) probability.set(String(goalie.nhlId), mass > 0 ? (1 - exactProbability) * shares.get(goalie.nhlId!)! / mass : 0);
    } else {
      const known = goalies.filter(goalie => shares.has(goalie.nhlId!));
      const mass = known.reduce((sum, goalie) => sum + shares.get(goalie.nhlId!)!, 0);
      for (const goalie of known) probability.set(String(goalie.nhlId), shares.get(goalie.nhlId!)! / Math.max(1, mass));
    }
    // Second night of a back-to-back: the usual starter rarely starts both, so part of his chance moves to the others.
    if (!exact && gameContext(game.id, teamId)?.teamRestDays === 1 && probability.size > 1) {
      const [starter, share] = [...probability].sort((a, b) => b[1] - a[1])[0];
      const moved = share * (1 - BACK_TO_BACK_STARTER_SHARE), others = [...probability].filter(([id]) => id !== starter);
      const total = others.reduce((sum, [, value]) => sum + value, 0);
      probability.set(starter, share - moved);
      for (const [id, value] of others) probability.set(id, value + (total > 0 ? moved * value / total : moved / others.length));
    }
    // Accepted IFTTT goalie news overrides start shares: confirmed and ruled out outright, likely/projected as floors.
    const disputed = inputs.goalieNews?.conflicts.some(row => row.dimension === "goalie" && row.gameId === Number(game.id) && row.teamId === teamId);
    const signal = disputed ? undefined : inputs.goalieNews?.assertions.find(row => row.dimension === "goalie" && row.gameId === Number(game.id)
      && row.teamId === teamId && goalies.some(goalie => goalie.nhlId === row.playerId));
    if (disputed) news.disputed++;
    let confirmedId: string | null = null;
    if (signal) {
      const named = String(signal.playerId), floor = FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS[signal.value];
      const rescale = (mass: number) => {
        const others = [...probability].filter(([id]) => id !== named), total = others.reduce((sum, [, value]) => sum + value, 0);
        for (const [id, value] of others) probability.set(id, total > 0 ? mass * value / total : 0);
      };
      if (signal.value === "confirmed") { rescale(0); probability.set(named, 1); confirmedId = named; news.confirmed++; }
      else if (signal.value === "ruled_out") { probability.set(named, 0); rescale(1); news.ruledOut++; }
      else if (floor !== undefined) { const p = Math.max(probability.get(named) ?? 0, floor); probability.set(named, p); rescale(1 - p); news.speculative++; }
    }
    for (const goalie of goalies) {
      const p = probability.get(String(goalie.nhlId));
      const own = goalieLatest.get(goalie.nhlId);
      const source = exact && exact.goalie_id === goalie.nhlId ? exact : own && own.team_id === teamId ? own : teamGoalieLatest.get(teamId);
      if (p === undefined || !source) continue;
      const from = String(source.game_id) === game.id ? null : context(goalies[0].teamAbbreviation, abbreviationById.get(source.opponent_team_id));
      const to = from ? context(goalies[0].teamAbbreviation, game.opponent) : null;
      const fromGame = String(source.game_id) === game.id ? null : gameContext(source.game_id, teamId), toGame = fromGame ? gameContext(game.id, teamId) : null;
      const venue = fromGame && toGame ? { from: goalieShotContext(fromGame), to: goalieShotContext(toGame) } : undefined;
      const forgeLine = from && to ? retargetGoalieLine(goalieLine(source), from, to, venue) : goalieLine(source);
      // FORGE rarely fills a goalie's win chance; estimate the team's from both teams' xG so wins can be scored.
      const winChance = forgeLine.WINS_GOALIE === null ? teamWinProbability(priors.get(goalies[0].teamAbbreviation!.toUpperCase()), priors.get(game.opponent.toUpperCase()), game.home) : null;
      if (winChance !== null) estimatedWins++;
      const line = winChance === null ? forgeLine : { ...forgeLine, WINS_GOALIE: round(winChance), LOSSES_GOALIE: round(1 - winChance) };
      emit(goalie, game, runs.get(source.run_id)!, Object.fromEntries(Object.entries(line).map(([key, value]) => [key, value === null ? null : round(value * p)])),
        round(p), line, confirmedId === String(goalie.nhlId));
    }
  }
  forecasts.sort((a, b) => (a.issuedContext!.scheduledAt).localeCompare(b.issuedContext!.scheduledAt) || a.playerId.localeCompare(b.playerId) || a.gameId.localeCompare(b.gameId));
  let bytes = 0, expandedBytes = 0, kept = forecasts.length;
  for (const [index, forecast] of forecasts.entries()) {
    bytes += bridgeWireRowBytes(forecast); expandedBytes += jsonUtf8Bytes(forecast) + 1;
    if (bytes > byteBudget || expandedBytes > expandedByteBudget) { kept = index; break; }
  }
  const coveredTeams = new Set(forecasts.map(row => row.issuedContext!.teamId)).size;
  const teamCount = new Set(identified.map(player => player.nhlTeamId)).size;
  const dates = [...runs.values()].map(run => run.asOfDate).sort();
  const limitations = [
    `Interim FORGE projections until native forecasts go live: each player's latest FORGE v2 daily line (runs ${dates[0]} to ${dates.at(-1)}) stands in for his remaining games; ${coveredTeams} of ${teamCount} teams covered.`,
    rates ? "Penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are season per-game rates (this season plus half of last, pulled toward league rates), not FORGE projections."
      : "Season rates could not be read, so penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs count as 0.",
    priors.size ? `Future games move each FORGE line to that game's opponent with FORGE's team-strength adjustment (team xG for and against, ${priors.size} teams${inputs.lastSeasonTeams?.length ? `, last season blended in as ${LAST_SEASON_PRIOR_GAMES} games` : ""})${scheduleById.size ? ", plus FORGE's home-ice and rest model (back-to-backs included); a goalie's start chance drops on the second night of a back-to-back" : ""}${tilts.size ? ", and each opponent's tilt toward forwards or defencemen (points and shots allowed by position vs league, shrunk)" : ""}.`
      : "Team strength could not be read, so future games reuse each FORGE line without an opponent adjustment.",
    ...(estimatedWins ? ["Goalie wins use the team's win chance from both teams' xG (Poisson goals, home ice, ties split) where FORGE gives none."] : []),
    "Goalie starts use each goalie's last-10 start share (season share when missing), or FORGE's own starter probability for an already projected game. Per-start lines come from his latest FORGE line, or his team's when he has none.",
    inputs.goalieNews ? `Goalie news (IFTTT, accepted automatically): ${news.confirmed} confirmed, ${news.speculative} likely or projected (start chance at least ${FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS.likely * 100}% / ${FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS.projected * 100}%), ${news.ruledOut} ruled out${news.disputed ? `, ${news.disputed} disputed and ignored` : ""}.`
      : "Goalie news could not be read; start chances use start shares only.",
    ...(noPowerPlay ? [`${noPowerPlay} skaters with no FORGE power-play line or time count 0 power-play production.`] : []),
    ...(unknownPowerPlay ? [`${unknownPowerPlay} skaters have projected power-play time but no FORGE power-play line, so they get no forecast.`] : []),
    ...(staleSkaters ? [`${staleSkaters} skaters missing from their team's latest FORGE run get no forecast (likely scratched, injured or moved).`] : []),
    ...(kept < forecasts.length ? [`Interim projections were trimmed to the first ${kept} of ${forecasts.length} player-games to fit the planning transport; later games stay schedule-only.`] : []),
  ];
  return { forecasts: forecasts.slice(0, kept), limitations };
}

/** Read-only: the latest successful public FORGE run per slate date in the lookback, as Start Chart serves it. */
export async function loadForgeDailyBridgeForecasts(db: SupabaseClient<any>, players: PlanningPlayer[], games: PlanningGame[], now: Date,
  seasonId: number, deadline: number, calendarPolicy: ForecastCalendarPolicy): Promise<ForgeDailyBridgeResult> {
  const readDeadline = Math.min(deadline, Date.now() + 6000);
  const from = new Date(now.getTime() - FORGE_DAILY_BRIDGE_LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);
  const runRows = await pages(() => excludeOffReleaseRuns(db.from("forge_runs").select("run_id,as_of_date,created_at,git_sha", { count: "exact" })
    .eq("status", "succeeded")).gte("as_of_date", from).lte("as_of_date", to)
    .order("as_of_date", { ascending: false }).order("created_at", { ascending: false }).order("run_id"), readDeadline, 500, row => row.run_id);
  const latestByDate = new Map<string, Row>();
  for (const row of runRows) if (!latestByDate.has(row.as_of_date) && Date.parse(row.created_at) <= now.getTime()) latestByDate.set(row.as_of_date, row);
  const runs = [...latestByDate.values()], runIds = runs.map(row => row.run_id);
  if (!runIds.length) return buildForgeDailyBridgeForecasts({ runs: [], skaters: [], goalies: [], goalieShares: [] }, players, games, now, seasonId, calendarPolicy);
  const previousSeason = String((Math.floor(seasonId / 10000) - 1) * 10001 + 1);
  const upcomingGameIds = [...new Set(games.filter(game => game.status === "scheduled" && game.startsAt && Date.parse(game.startsAt) > now.getTime())
    .map(game => Number(game.id)).filter(Number.isSafeInteger))].slice(0, 500);
  const windowEnd = games.map(game => game.date).sort().at(-1) ?? to;
  const scheduleFrom = new Date(Date.parse(`${from}T12:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
  const [skaters, goalies, goalieShares, seasonTotals, goalieNews, teamPriors, lastSeasonTeams, teamGames, positionAllowed] = await Promise.all([
    pages(() => db.from("forge_player_projections").select(SKATER_COLUMNS, { count: "exact" }).in("run_id", runIds).eq("horizon_games", 1)
      .order("run_id").order("game_id").order("player_id"), readDeadline, 15000, row => [row.run_id, row.game_id, row.player_id]),
    pages(() => db.from("forge_goalie_projections").select(GOALIE_COLUMNS, { count: "exact" }).in("run_id", runIds).eq("horizon_games", 1)
      .order("run_id").order("game_id").order("goalie_id"), readDeadline, 2000, row => [row.run_id, row.game_id, row.goalie_id]),
    pages(() => db.from("goalie_start_projections").select("player_id,game_id,game_date,l10_start_pct,season_start_pct,updated_at", { count: "exact" })
      .gte("game_date", from).lte("game_date", to).order("game_date", { ascending: false }).order("game_id").order("player_id"),
    readDeadline, 5000, row => [row.game_id, row.player_id]),
    // Optional inputs: a failed read keeps the projections and says so in the evidence.
    pages(() => db.from("wgo_skater_stats_totals").select("player_id,season,games_played,goals,gw_goals,penalty_minutes,plus_minus,sh_goals,sh_assists,sh_points,total_fow,total_fol", { count: "exact" })
      .in("season", [String(seasonId), previousSeason]).order("season").order("player_id"), readDeadline, 5000, row => [row.season, row.player_id]).catch(() => undefined),
    withinDeadline(readDeadline, () => loadDailyBoardEvidence(upcomingGameIds, now.toISOString(), db as never)).catch(() => undefined),
    pages(() => db.from("nhl_team_data").select("team_abbrev,date,xga,xga_per_game,xgf_per_game,games_played", { count: "exact" })
      .eq("season_id", seasonId).gte("date", from).lte("date", to).order("date", { ascending: false }).order("team_abbrev"),
    readDeadline, 2000, row => [row.team_abbrev, row.date, row.xga, row.xga_per_game]).catch(() => undefined),
    pages(() => db.from("nst_team_stats").select("team_abbreviation,season,situation,gp,xga,xgf", { count: "exact" })
      .eq("season", Number(previousSeason)).eq("situation", "all").order("team_abbreviation"), readDeadline, 200, row => [row.team_abbreviation, row.season]).catch(() => undefined),
    pages(() => db.from("games").select("id,date,homeTeamId,awayTeamId", { count: "exact" }).gte("date", scheduleFrom).lte("date", windowEnd)
      .order("date").order("id"), readDeadline, 3000).catch(() => undefined),
    // Optional until the opponent_skater_allowed_by_position view is applied; a failed read skips the tilt.
    pages(() => db.from("opponent_skater_allowed_by_position").select("season_id,opponent,position_group,games,points,shots", { count: "exact" })
      .in("season_id", [seasonId, Number(previousSeason)]).order("season_id").order("opponent").order("position_group"),
    readDeadline, 400, row => [row.season_id, row.opponent, row.position_group]).catch(() => undefined),
  ]);
  return buildForgeDailyBridgeForecasts({ runs, skaters, goalies, goalieShares, seasonTotals, goalieNews, teamPriors, lastSeasonTeams, teamGames, positionAllowed }, players, games, now, seasonId, calendarPolicy);
}
