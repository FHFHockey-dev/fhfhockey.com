import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarLeadDay, validForecastCalendarPolicy, type ForecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { loadDailyBoardEvidence, type DailyBoardEvidence } from "lib/projections/dailyBoardEvidence";
import { buildSkaterModeledHeadTotals } from "lib/projections/modeledHeadTotals";
import { excludeOffReleaseRuns, restrictRunsToHorizon } from "lib/projections/releasedRunFence";
import { loadExternalInputProof } from "lib/projections/externalInputProof";
import { computeTeamStrengthContextAdjustment } from "lib/projections/calculators/team-context-adjustments";
import { computeSkaterRestScheduleAdjustments } from "lib/projections/calculators/skater-adjustments";
import { STARTER_DECISION_SHARE, teamWinProbability as forgeTeamWinProbability } from "lib/projections/goalie/goalieOutcomes";
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

export type ForgeDailyBridgeInputs = {
  /** Selected runs; only those with `external_input_proven: true` (their captured snapshot proves third-party fantasy
   * inputs were excluded) are used. Others are counted as withheld and their rows ignored. */
  runs: Row[]; skaters: Row[]; goalies: Row[]; goalieShares: Row[];
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
/** The served-forecast ledger's naive-baseline win chance (ties split for overtime) from both teams' xG, as Poisson goals;
 * home ice tilts the rates by 4%. Neutral 0.5 when either team's strength is unknown. Bridge forecasts no longer use it:
 * they serve FORGE's paired probability (BridgeTeamWin). Retire once the ledger reads `teamWins`. */
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
/** Moves a goalie's per-start line from the opponent FORGE projected to a new one, with FORGE's own team-strength terms.
 * Wins are not moved here: they come from the game's paired team probability. */
function retargetGoalieLine(line: StatLine, from: Context, to: Context, venue: { from: number; to: number } = { from: 0, to: 0 }): StatLine {
  const shots = (1 + to.shotsAgainst) / (1 + from.shotsAgainst) * (1 + venue.to) / (1 + venue.from);
  const against = (1 + to.goalsAgainst) / (1 + from.goalsAgainst) * (1 + venue.to) / (1 + venue.from);
  const scale = (value: number | null, factor: number) => value === null ? null : round(value * factor);
  return { ...line, SAVES_GOALIE: scale(line.SAVES_GOALIE, shots), SHOTS_AGAINST_GOALIE: scale(line.SHOTS_AGAINST_GOALIE, shots),
    GOALS_AGAINST_GOALIE: scale(line.GOALS_AGAINST_GOALIE, against),
    SHUTOUTS_GOALIE: line.SHUTOUTS_GOALIE === null ? null : round(Math.min(1, line.SHUTOUTS_GOALIE / against)) };
}
/** A team's chance to win one game (OT/SO included), kept apart from any goalie's wins. Both teams of a game sum to 1.
 * `forge`: FORGE projected the game; `forge_paired`: 1 − the opponent's FORGE value; `forge_model`: FORGE's win model on
 * team xG priors for a game FORGE has not projected yet. */
export type BridgeTeamWin = { gameId: string; team: string; probability: number; source: "forge" | "forge_paired" | "forge_model" };
export type ForgeDailyBridgeResult = { forecasts: GameForecast[]; limitations: string[]; teamWins: BridgeTeamWin[] };
type SeasonRates = Record<string, number | null> & { gwgShare: number | null };

/** Per-game rates for the stats FORGE does not project, blended over this season and half of last, pulled toward the league rate.
 * Only rows that record a stat count toward it, so a stat no row records is unknown (null), never 0. Players with no
 * rows get no entry: their rates are unknown too, not the league's. */
export function seasonRates(rows: Row[], seasonId: number): Map<number, SeasonRates> {
  const previous = String((Math.floor(seasonId / 10000) - 1) * 10001 + 1);
  const weighted = new Map<number, Record<string, { games: number; total: number }>>();
  for (const row of rows) {
    const weight = String(row.season) === String(seasonId) ? 1 : String(row.season) === previous ? LAST_SEASON_WEIGHT : 0;
    if (!weight || !finite(row.player_id) || !finite(row.games_played) || row.games_played <= 0) continue;
    const sums = weighted.get(row.player_id) ?? {};
    const add = (key: string, value: unknown) => {
      if (!finite(value)) return;
      const sum = sums[key] ??= { games: 0, total: 0 };
      sum.games += weight * row.games_played; sum.total += weight * value;
    };
    for (const [key, column] of Object.entries(TOTAL_COLUMNS)) add(key, row[column]);
    if (finite(row.goals) && finite(row.gw_goals)) { add("goals", row.goals); add("gwg", row.gw_goals); }
    weighted.set(row.player_id, sums);
  }
  const league: Record<string, number> = {};
  for (const key of Object.keys(TOTAL_COLUMNS)) {
    const sums = [...weighted.values()].flatMap(player => player[key] ? [player[key]] : []);
    const games = sums.reduce((total, sum) => total + sum.games, 0);
    league[key] = key === "PLUS_MINUS" || !games ? 0 : sums.reduce((total, sum) => total + sum.total, 0) / games;
  }
  const result = new Map<number, SeasonRates>();
  for (const [playerId, sums] of weighted) {
    const rates = { gwgShare: sums.goals ? (sums.gwg.total + GWG_SHARE_PRIOR * GWG_SHRINK_GOALS) / (sums.goals.total + GWG_SHRINK_GOALS) : null } as SeasonRates;
    for (const key of Object.keys(TOTAL_COLUMNS)) rates[key] = sums[key]
      ? (sums[key].total + SHRINK_GAMES[key] * league[key]) / (sums[key].games + SHRINK_GAMES[key]) : null;
    result.set(playerId, rates);
  }
  return result;
}

const POWER_PLAY_HEADS = ["proj_goals_pp", "proj_assists_pp", "proj_shots_pp"];
/** Up to this much projected power-play time per game counts as none. */
const NO_POWER_PLAY_SECONDS = 6;
/** Declared modeled-zero policy: FORGE leaves power-play heads blank for a skater with no power-play role. When it also
 * stores (about) no power-play time, the blanks are no production and count 0. Blank heads beside real or unrecorded
 * power-play time are absent evidence and stay unknown. Penalty-kill heads are not modeled (see modeledHeadTotals). */
function withPowerPlayZeros(row: Row): { row: Row; filled: boolean; unknown: boolean } {
  const blanks = POWER_PLAY_HEADS.filter(key => !finite(row[key]));
  if (!blanks.length || ![row.proj_goals_es, row.proj_assists_es, row.proj_shots_es].every(finite)) return { row, filled: false, unknown: false };
  if (!finite(row.proj_toi_pp_seconds) || row.proj_toi_pp_seconds > NO_POWER_PLAY_SECONDS) return { row, filled: false, unknown: true };
  return { row: { ...row, ...Object.fromEntries(blanks.map(key => [key, 0])) }, filled: true, unknown: false };
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
  // FORGE values win where the writers store them; season rates fill the rest, and an unreadable or missing rate stays unknown.
  const gwgShare = rates?.gwgShare;
  for (const key of FORGE_DAILY_BRIDGE_SEASON_RATED) stats[key] = key === "GAME_WINNING_GOALS"
    ? finite(gwgShare) ? heads.goals * gwgShare : null : rates?.[key] ?? null;
  if (finite(row.proj_pim)) stats.PENALTY_MINUTES = row.proj_pim;
  if (finite(row.proj_plus_minus)) stats.PLUS_MINUS = row.proj_plus_minus;
  return Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, round(value)]));
}

/** Per-start volume and shutout line; wins come from the game's paired team probability, not this row. */
function goalieLine(row: Row): StatLine {
  const line: StatLine = { SAVES_GOALIE: finite(row.proj_saves) ? row.proj_saves : null,
    GOALS_AGAINST_GOALIE: finite(row.proj_goals_allowed) ? row.proj_goals_allowed : null,
    SHOTS_AGAINST_GOALIE: finite(row.proj_shots_against) ? row.proj_shots_against : null,
    SHUTOUTS_GOALIE: finite(row.proj_shutout_prob) ? row.proj_shutout_prob : null, GOALIE_MINUTES: 60, GAMES_STARTED: 1 };
  return Object.fromEntries(Object.entries(line).map(([key, value]) => [key, round(value)]));
}

/** Pure: no reads. Rows from runs not in `inputs.runs`, or from runs without external-input exclusion proof, are ignored. */
export function buildForgeDailyBridgeForecasts(inputs: ForgeDailyBridgeInputs, players: PlanningPlayer[], games: PlanningGame[],
  now: Date, seasonId: number, calendarPolicy: ForecastCalendarPolicy, byteBudget = FORGE_DAILY_BRIDGE_BYTE_BUDGET,
  expandedByteBudget = FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET): ForgeDailyBridgeResult {
  const runs = new Map<string, Run>();
  let withheldRuns = 0;
  for (const row of inputs.runs) if (typeof row.run_id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.as_of_date)
    && Date.parse(row.created_at) <= now.getTime()) {
    if (row.external_input_proven !== true) { withheldRuns++; continue; }
    runs.set(row.run_id, { runId: row.run_id, asOfDate: row.as_of_date,
      issuedAt: new Date(row.created_at).toISOString(), gitSha: row.git_sha ?? null });
  }
  if (!runs.size) return { forecasts: [], teamWins: [], limitations: [withheldRuns
    ? `Interim FORGE projections: no FORGE run in the last week can prove it excluded third-party fantasy projections (${withheldRuns} withheld), so planning is schedule-only.`
    : "Interim FORGE projections: no successful FORGE run in the last week, so planning is schedule-only."] };
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
  // A start share counts only from a row for the goalie's current team this season (the season is the game id's first
  // four digits): a row from before a trade, or from another season, describes another role, so it is ignored.
  const goalieTeams = new Map(players.filter(player => player.playerClass === "goalie" && player.nhlId !== null && finite(player.nhlTeamId))
    .map(player => [player.nhlId!, player.nhlTeamId!]));
  const seasonStartYear = Math.floor(seasonId / 10000);
  const latestShares = new Map<number, number>(), exactShares = new Map<string, number>(), unboundShares = new Set<number>();
  const shareOrder = new Map<number, string>();
  for (const row of inputs.goalieShares) {
    const value = share(row.l10_start_pct) ?? share(row.season_start_pct), key = `${row.game_date}|${row.updated_at ?? ""}`;
    if (value === null || !finite(row.player_id)) continue;
    if (!finite(row.team_id) || row.team_id !== goalieTeams.get(row.player_id) || !finite(row.game_id)
      || Math.floor(row.game_id / 1000000) !== seasonStartYear) { unboundShares.add(row.player_id); continue; }
    exactShares.set(`${row.game_id}:${row.player_id}`, value);
    if ((shareOrder.get(row.player_id) ?? "") >= key) continue;
    latestShares.set(row.player_id, value); shareOrder.set(row.player_id, key);
  }
  const rates = inputs.seasonTotals ? seasonRates(inputs.seasonTotals, seasonId) : null;
  const priors = teamStrengthPriors(inputs.teamPriors ?? [], inputs.lastSeasonTeams ?? []);
  const tilts = opponentTilts(inputs.positionAllowed ?? [], seasonId);
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
  // Opponents with no team-strength prior (or no abbreviation to look one up by), counted once each.
  const missingPriors = new Set<string>();
  const opponentAbbreviation = (teamId: unknown) => {
    const abbreviation = finite(teamId) ? abbreviationById.get(teamId) : undefined;
    if (finite(teamId) && !abbreviation) missingPriors.add(`#${teamId}`);
    return abbreviation;
  };
  const context = (team: string | null | undefined, opponent: string | null | undefined): Context | null => {
    const own = team ? priors.get(team.toUpperCase()) : undefined, other = opponent ? priors.get(opponent.toUpperCase()) : undefined;
    if (opponent && !other) missingPriors.add(opponent.toUpperCase());
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
  let staleSkaters = 0, teamMismatch = 0, noPowerPlay = 0, unknownPowerPlay = 0;
  const unknownHeads = new Set<number>(), unsharedGoalies = new Set<number>(), unratedSkaters = new Set<number>();
  for (const player of identified.filter(row => row.playerClass === "skater")) {
    const latestRow = skaterLatest.get(player.nhlId);
    if (!latestRow) continue;
    if (latestRow.team_id !== player.nhlTeamId) { teamMismatch++; continue; }
    // Missing from his team's latest run (scratched, injured or reassigned since): only lines issued for a game itself stand.
    const stale = latestRow.as_of_date !== teamLatestDate.get(latestRow.team_id), emitted = forecasts.length;
    const playerRates = rates?.get(player.nhlId!) ?? null;
    const lineFor = (row: Row) => {
      const special = withPowerPlayZeros(row);
      if (special.filled) noPowerPlay++;
      if (special.unknown) unknownPowerPlay++;
      const line = skaterStats(special.row, playerRates);
      if (line && rates && !playerRates) unratedSkaters.add(player.nhlId!);
      if (!line && !special.unknown) unknownHeads.add(player.nhlId!);
      return line;
    };
    const stats = stale ? null : lineFor(latestRow);
    const projectedAgainst = stale ? null : context(player.teamAbbreviation, opponentAbbreviation(latestRow.opponent_team_id));
    for (const game of upcoming(player.teamAbbreviation!)) {
      const own = exactSkater.get(`${game.id}:${player.nhlId}`);
      if (own && (stale || own !== latestRow) && own.team_id === player.nhlTeamId) {
        // Projected for this game itself: use that line as issued, no re-aiming.
        const ownStats = lineFor(own);
        if (ownStats) { emit(player, game, runs.get(own.run_id)!, ownStats, null); continue; }
      }
      if (!stats) continue;
      const row = latestRow;
      const facing = String(row.game_id) === game.id ? null : context(player.teamAbbreviation, game.opponent);
      const scale = projectedAgainst && facing ? (1 + facing.goalsFor) / (1 + projectedAgainst.goalsFor) : 1;
      const rest = String(row.game_id) === game.id ? null : restScale(gameContext(row.game_id, row.team_id), gameContext(game.id, row.team_id));
      const tilt = String(row.game_id) === game.id ? undefined : tiltBetween(player, abbreviationById.get(row.opponent_team_id), game.opponent);
      emit(player, game, runs.get(row.run_id)!, scale === 1 && !rest && !tilt ? stats : retargetSkater(stats, scale, rest, tilt), null);
    }
    if (stale && forecasts.length === emitted) staleSkaters++;
  }
  // One win model per game: FORGE's team probability, paired so both teams sum to 1. Pre-7.2 FORGE rows are not
  // paired, so a game with both teams' rows is normalised; a game FORGE projected without a win value stays unknown.
  const idByAbbreviation = new Map([...abbreviationById].map(([id, abbreviation]) => [abbreviation, id]));
  const teamWins = new Map<string, BridgeTeamWin | null>();
  const teamWin = (game: PlanningGame, teamId: number): BridgeTeamWin | null => {
    const key = `${game.id}:${teamId}`;
    if (teamWins.has(key)) return teamWins.get(key)!;
    const team = game.teamAbbreviation!.toUpperCase(), opponent = game.opponent.toUpperCase();
    const scheduled = scheduleById.get(game.id), ownRow = exactGoalie.get(key);
    const opponentId: number | undefined = scheduled && (scheduled.homeTeamId === teamId || scheduled.awayTeamId === teamId)
      ? scheduled.homeTeamId === teamId ? scheduled.awayTeamId : scheduled.homeTeamId
      : finite(ownRow?.opponent_team_id) ? ownRow!.opponent_team_id : idByAbbreviation.get(opponent);
    const otherRow = opponentId === undefined ? undefined : exactGoalie.get(`${game.id}:${opponentId}`);
    const own = finite(ownRow?.proj_win_prob) ? ownRow!.proj_win_prob : null, other = finite(otherRow?.proj_win_prob) ? otherRow!.proj_win_prob : null;
    const unit = (value: number) => Math.min(1, Math.max(0, value));
    let result: BridgeTeamWin | null = null;
    if (own !== null && other !== null && own + other > 0) result = { gameId: game.id, team, probability: own / (own + other), source: "forge" };
    else if (own !== null) result = { gameId: game.id, team, probability: unit(own / STARTER_DECISION_SHARE), source: "forge" };
    else if (other !== null) result = { gameId: game.id, team, probability: 1 - unit(other / STARTER_DECISION_SHARE), source: "forge_paired" };
    else if (!ownRow && !otherRow) {
      // Not projected yet: FORGE's Poisson-race win model on each team's xG for and against, with FORGE's rest/home goal effect.
      const ownPrior = priors.get(team), otherPrior = priors.get(opponent);
      const goals = (attack: TeamStrengthPrior | undefined, defence: TeamStrengthPrior | undefined, side: number | undefined) => {
        if (!finite(attack?.xgfPerGame) || !finite(defence?.xgaPerGame)) return null;
        const rest = side === undefined ? null : gameContext(game.id, side);
        return (attack!.xgfPerGame! + defence!.xgaPerGame!) / 2 * (rest ? computeSkaterRestScheduleAdjustments(rest).goalRateMultiplier : 1);
      };
      const scored = goals(ownPrior, otherPrior, teamId), allowed = goals(otherPrior, ownPrior, opponentId);
      if (scored !== null && allowed !== null) result = { gameId: game.id, team, probability: forgeTeamWinProbability(scored, allowed), source: "forge_model" };
    }
    teamWins.set(key, result);
    return result;
  };
  let unknownWins = 0;
  const goaliesByTeam = new Map<number, PlanningPlayer[]>();
  for (const player of identified.filter(row => row.playerClass === "goalie")) goaliesByTeam.set(player.nhlTeamId!, [...(goaliesByTeam.get(player.nhlTeamId!) ?? []), player]);
  // Every goalie on a team's current roster counts toward whether its shares are complete, identified or not. A goalie
  // with no current team counts at the team his latest current-season start row (else FORGE line) names.
  const rosterGoalies = new Map<number, number[]>();
  for (const [id, team] of goalieTeams) rosterGoalies.set(team, [...(rosterGoalies.get(team) ?? []), id]);
  const teamless = players.filter(player => player.playerClass === "goalie" && player.nhlId !== null && !finite(player.nhlTeamId));
  const teamlessTeams = new Set(teamless.flatMap(goalie => {
    const rows = inputs.goalieShares.filter(row => row.player_id === goalie.nhlId && finite(row.team_id) && finite(row.game_id)
      && Math.floor(row.game_id / 1000000) === seasonStartYear).sort((a, b) => `${b.game_date}|${b.updated_at ?? ""}`.localeCompare(`${a.game_date}|${a.updated_at ?? ""}`));
    const team = rows[0]?.team_id ?? goalieLatest.get(goalie.nhlId)?.team_id;
    return finite(team) ? [team] : [];
  }));
  let openTeamGames = 0;
  for (const [teamId, goalies] of goaliesByTeam) for (const game of upcoming(goalies[0].teamAbbreviation!)) {
    const exact = exactGoalie.get(`${game.id}:${teamId}`), exactProbability = exact ? share(exact.starter_probability) : null;
    // This game's own start-share row first, else the goalie's latest bound row.
    const shares = new Map(goalies.flatMap(goalie => {
      const value = exactShares.get(`${game.id}:${goalie.nhlId}`) ?? latestShares.get(goalie.nhlId!);
      return value === undefined ? [] : [[goalie.nhlId!, value] as const];
    }));
    const probability = new Map<string, number>();
    // Never scale chances up past a goalie whose chance is unknown: the known ones keep their shares as read (scaled down
    // only to fit), so the team's start chances may sum to less than 1. With every goalie known they sum to 1 as before.
    const open = () => teamlessTeams.has(teamId) || (rosterGoalies.get(teamId) ?? []).some(id => !probability.has(String(id)));
    const rescale = (except: string | null, mass: number) => {
      const others = [...probability].filter(([id]) => id !== except), total = others.reduce((sum, [, value]) => sum + value, 0);
      const factor = total > 0 ? open() ? Math.min(1, mass / total) : mass / total : 0;
      for (const [id, value] of others) probability.set(id, value * factor);
    };
    for (const goalie of goalies) if (shares.has(goalie.nhlId!)) probability.set(String(goalie.nhlId), shares.get(goalie.nhlId!)!);
    if (exact && exactProbability !== null && goalies.some(goalie => goalie.nhlId === exact.goalie_id)) {
      probability.set(String(exact.goalie_id), exactProbability);
      rescale(String(exact.goalie_id), 1 - exactProbability);
    } else rescale(null, 1);
    // Second night of a back-to-back: the usual starter rarely starts both, so part of his chance moves to the others
    // (and stays unassigned when one of them is unknown).
    if (!exact && gameContext(game.id, teamId)?.teamRestDays === 1 && probability.size > 1) {
      const [starter, share] = [...probability].sort((a, b) => b[1] - a[1])[0];
      const moved = share * (1 - BACK_TO_BACK_STARTER_SHARE), others = [...probability].filter(([id]) => id !== starter);
      const total = others.reduce((sum, [, value]) => sum + value, 0);
      probability.set(starter, share - moved);
      if (!open()) for (const [id, value] of others) probability.set(id, value + (total > 0 ? moved * value / total : moved / others.length));
    }
    // Accepted IFTTT goalie news overrides start shares: confirmed and ruled out outright, likely/projected as floors.
    const disputed = inputs.goalieNews?.conflicts.some(row => row.dimension === "goalie" && row.gameId === Number(game.id) && row.teamId === teamId);
    const signal = disputed ? undefined : inputs.goalieNews?.assertions.find(row => row.dimension === "goalie" && row.gameId === Number(game.id)
      && row.teamId === teamId && goalies.some(goalie => goalie.nhlId === row.playerId));
    if (disputed) news.disputed++;
    let confirmedId: string | null = null;
    if (signal) {
      const named = String(signal.playerId), floor = FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS[signal.value];
      if (signal.value === "confirmed") { rescale(named, 0); probability.set(named, 1); confirmedId = named; news.confirmed++; }
      else if (signal.value === "ruled_out") { probability.set(named, 0); rescale(named, 1); news.ruledOut++; }
      else if (floor !== undefined) { const p = Math.max(probability.get(named) ?? 0, floor); probability.set(named, p); rescale(named, 1 - p); news.speculative++; }
    }
    if (probability.size && open() && [...probability.values()].reduce((sum, value) => sum + value, 0) < 1 - 1e-9) openTeamGames++;
    for (const goalie of goalies) {
      const p = probability.get(String(goalie.nhlId));
      const own = goalieLatest.get(goalie.nhlId);
      const source = exact && exact.goalie_id === goalie.nhlId ? exact : own && own.team_id === teamId ? own : teamGoalieLatest.get(teamId);
      if (p === undefined) unsharedGoalies.add(goalie.nhlId!);
      if (p === undefined || !source) continue;
      const from = String(source.game_id) === game.id ? null : context(goalies[0].teamAbbreviation, opponentAbbreviation(source.opponent_team_id));
      const to = from ? context(goalies[0].teamAbbreviation, game.opponent) : null;
      const fromGame = String(source.game_id) === game.id ? null : gameContext(source.game_id, teamId), toGame = fromGame ? gameContext(game.id, teamId) : null;
      const venue = fromGame && toGame ? { from: goalieShotContext(fromGame), to: goalieShotContext(toGame) } : undefined;
      const forgeLine = from && to ? retargetGoalieLine(goalieLine(source), from, to, venue) : goalieLine(source);
      // If he starts he is credited with FORGE's decision share of his team's wins; unknown stays unknown.
      const win = teamWin(game, teamId), startWin = win === null ? null : win.probability * STARTER_DECISION_SHARE;
      if (win === null) unknownWins++;
      const line = { ...forgeLine, WINS_GOALIE: round(startWin), LOSSES_GOALIE: startWin === null ? null : round(1 - startWin) };
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
  const staleShareGoalies = [...unboundShares].filter(id => goalieTeams.has(id) && !latestShares.has(id)).length;
  const limitations = [
    `Interim FORGE projections until native forecasts go live: each player's latest FORGE v2 daily line (runs ${dates[0]} to ${dates.at(-1)}) stands in for his remaining games; ${coveredTeams} of ${teamCount} teams covered.`,
    ...(withheldRuns ? [`${withheldRuns} FORGE runs in the last week cannot prove they excluded third-party fantasy projections, so they are withheld; players covered only by them get no forecast.`] : []),
    rates ? "Penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are season per-game rates (this season plus half of last, pulled toward league rates), not FORGE projections."
      : "Season rates could not be read, so penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are unknown; totals that score them are withheld.",
    ...(unratedSkaters.size ? [`${unratedSkaters.size} skaters have no season totals this season or last, so their penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are unknown.`] : []),
    priors.size ? `Future games move each FORGE line to that game's opponent with FORGE's team-strength adjustment (team xG for and against, ${priors.size} teams${inputs.lastSeasonTeams?.length ? `, last season blended in as ${LAST_SEASON_PRIOR_GAMES} games` : ""})${scheduleById.size ? ", plus FORGE's home-ice and rest model (back-to-backs included); a goalie's start chance drops on the second night of a back-to-back" : ""}${tilts.size ? ", and each opponent's tilt toward forwards or defencemen (points and shots allowed by position vs league, shrunk)" : ""}.`
      : "Team strength could not be read, so future games reuse each FORGE line without an opponent adjustment.",
    ...(teamWins.size ? [`Goalie wins: FORGE's per-game team win probability (both teams sum to 1) × ${STARTER_DECISION_SHARE} starter decision share, times his start chance; games FORGE has not projected yet use FORGE's same win model on team xG.`] : []),
    ...(unknownWins ? [`${unknownWins} goalie-games have no team win probability (FORGE left it blank, or a team-strength prior is missing), so their wins are unknown.`] : []),
    "Goalie starts use each goalie's last-10 start share (season share when missing) from start rows for his current team this season: the row for that game when one exists, otherwise his latest. FORGE's own starter probability applies to an already projected game. Per-start lines come from his latest FORGE line, or his team's when he has none.",
    ...(openTeamGames ? [`${openTeamGames} team-games have a goalie with no start share; the others keep their own shares, never scaled up, so start chances there sum to less than 1.`] : []),
    ...(teamless.length ? [`${teamless.length} goalies have no current NHL team, so their start chances are unknown; the team their latest start row or FORGE line names keeps its other goalies' shares unscaled.`] : []),
    ...(staleShareGoalies ? [`${staleShareGoalies} goalies have start shares only from another team or season; those are ignored, so their start chance is unknown.`] : []),
    inputs.goalieNews ? `Goalie news (IFTTT, accepted automatically): ${news.confirmed} confirmed, ${news.speculative} likely or projected (start chance at least ${FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS.likely * 100}% / ${FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS.projected * 100}%), ${news.ruledOut} ruled out${news.disputed ? `, ${news.disputed} disputed and ignored` : ""}.`
      : "Goalie news could not be read; start chances use start shares only.",
    ...(noPowerPlay ? [`${noPowerPlay} skaters with no FORGE power-play line and at most ${NO_POWER_PLAY_SECONDS} s of projected power-play time count 0 power-play production.`] : []),
    ...(unknownPowerPlay ? [`${unknownPowerPlay} skaters have no FORGE power-play line and real or unrecorded power-play time, so they get no forecast.`] : []),
    ...(unknownHeads.size ? [`${unknownHeads.size} skaters have a FORGE line with blank even-strength goals, assists or shots; such lines give no forecast.`] : []),
    ...(staleSkaters ? [`${staleSkaters} skaters missing from their team's latest FORGE run get no forecast (likely scratched, injured or moved).`] : []),
    ...(teamMismatch ? [`${teamMismatch} skaters whose latest FORGE line is for a different team than their current one get no forecast.`] : []),
    ...(unsharedGoalies.size ? [`${unsharedGoalies.size} goalies with no start share get no forecast for games FORGE has not projected for them.`] : []),
    ...(priors.size && missingPriors.size ? [`${missingPriors.size} opponents have no team-strength prior, so lines projected against or moved to them skip the opponent adjustment.`] : []),
    ...(kept < forecasts.length ? [`Interim projections were trimmed to the first ${kept} of ${forecasts.length} player-games to fit the planning transport; later games stay schedule-only.`] : []),
  ];
  const servedTeams = new Set(forecasts.slice(0, kept).map(row => `${row.gameId}:${row.issuedContext!.teamId}`));
  return { forecasts: forecasts.slice(0, kept), limitations,
    teamWins: [...teamWins].flatMap(([key, win]) => win && servedTeams.has(key) ? [win] : []) };
}

/** Read-only: the latest successful public h1 FORGE run per slate date in the lookback whose captured snapshot proves it
 * excluded third-party fantasy inputs. Newer unproven runs of a date are passed on unread, only to be counted. */
export async function loadForgeDailyBridgeForecasts(db: SupabaseClient<any>, players: PlanningPlayer[], games: PlanningGame[], now: Date,
  seasonId: number, deadline: number, calendarPolicy: ForecastCalendarPolicy): Promise<ForgeDailyBridgeResult> {
  const readDeadline = Math.min(deadline, Date.now() + 6000);
  const from = new Date(now.getTime() - FORGE_DAILY_BRIDGE_LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);
  const runRows = await pages(() => restrictRunsToHorizon(excludeOffReleaseRuns(db.from("forge_runs").select("run_id,as_of_date,created_at,git_sha", { count: "exact" })
    .eq("status", "succeeded"))).gte("as_of_date", from).lte("as_of_date", to)
    .order("as_of_date", { ascending: false }).order("created_at", { ascending: false }).order("run_id"), readDeadline, 500, row => row.run_id);
  const issued = runRows.filter(row => Date.parse(row.created_at) <= now.getTime());
  const proof = issued.length ? await withinDeadline(readDeadline, () => loadExternalInputProof(db, issued.map(row => row.run_id))) : new Map();
  const latestByDate = new Map<string, Row>(), withheld: Row[] = [];
  for (const row of issued) {
    if (latestByDate.has(row.as_of_date)) continue;
    if (proof.has(row.run_id)) latestByDate.set(row.as_of_date, { ...row, external_input_proven: true });
    else withheld.push({ ...row, external_input_proven: false });
  }
  const runs = [...latestByDate.values()], runIds = runs.map(row => row.run_id);
  if (!runIds.length) return buildForgeDailyBridgeForecasts({ runs: withheld, skaters: [], goalies: [], goalieShares: [] }, players, games, now, seasonId, calendarPolicy);
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
    pages(() => db.from("goalie_start_projections").select("player_id,team_id,game_id,game_date,l10_start_pct,season_start_pct,updated_at", { count: "exact" })
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
  return buildForgeDailyBridgeForecasts({ runs: [...runs, ...withheld], skaters, goalies, goalieShares, seasonTotals, goalieNews, teamPriors, lastSeasonTeams, teamGames, positionAllowed }, players, games, now, seasonId, calendarPolicy);
}
