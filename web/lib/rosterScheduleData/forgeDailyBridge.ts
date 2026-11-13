import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarLeadDay, validForecastCalendarPolicy, type AnyForecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { loadDailyBoardEvidence, type DailyBoardEvidence } from "lib/projections/dailyBoardEvidence";
import { buildSkaterModeledHeadTotals } from "lib/projections/modeledHeadTotals";
import { excludeOffReleaseRuns, restrictRunsToHorizon } from "lib/projections/releasedRunFence";
import { loadExternalInputProof, runProofDiagnostics } from "lib/projections/externalInputProof";
import { forgeReservePassEnabled } from "lib/projections/reserveProjections";
import { computeTeamStrengthContextAdjustment } from "lib/projections/calculators/team-context-adjustments";
import { computeSkaterRestScheduleAdjustments } from "lib/projections/calculators/skater-adjustments";
import { goalieWinPopulations, STARTER_DECISION_SHARE, teamWinProbability as forgeTeamWinProbability } from "lib/projections/goalie/goalieOutcomes";
import { readGoalieCandidatesContract, type GoalieCandidateRow, type GoalieCandidatesContract } from "lib/projections/goalie/goalieCandidates";
import { DEFENSE_B2B_FATIGUE_BOOST, OPPONENT_AWAY_PENALTY, OPPONENT_B2B_PENALTY, OPPONENT_HOME_BOOST, OPPONENT_RESTED_BOOST } from "lib/projections/constants/projection-weights";
import type { TeamStrengthPrior } from "lib/projections/types/run-forge-projections.types";
import type { GameForecast, PlanningGame, PlanningPlayer, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";
import { pages, withinDeadline } from "./planningInputs";
import { bridgeAllowedUses, bridgeWireRowBytes, FORGE_DAILY_BRIDGE_VERSION, jsonUtf8Bytes, isReserveLine, RESERVE_FORECAST_NOTES, reserveAppearanceProbability, reserveCodeOf, type BridgeRunProof, type ReserveCode } from "./bridgeForecastWire";

type Row = Record<string, any>;
type Run = { runId: string; asOfDate: string; issuedAt: string; gitSha: string | null; proof: BridgeRunProof | null };

/** Interim RSO source until native forecasts are activated (TJ, 2026-10-19). Each player's
 * latest FORGE v2 daily projection stands in for his remaining games in the planning window. */
export { FORGE_DAILY_BRIDGE_VERSION };
export const FORGE_DAILY_BRIDGE_LOOKBACK_DAYS = 7;
/** Runs are read through this many days ahead: a run projects the games on its own date, so RSO's seven-day horizon
 * needs the runs dated through today + 6 (written by FORGE_PROJECTION_DAYS_AHEAD or a manual range run). */
export const FORGE_DAILY_BRIDGE_AHEAD_DAYS = 7;
/** Compact wire bytes (see bridgeForecastWire) the projections may take beside players, games and evidence. */
export const FORGE_DAILY_BRIDGE_BYTE_BUDGET = 2_500_000;
/** Bytes the projections may take once the client rebuilds them. Every identified player now has a row for every game
 * (a real line, a reserve line or the labelled "no FORGE line" 0), measured for a production-shaped week in
 * forgeReservePayload.test.ts. The stored snapshot is unpacked, so this plus players and games must stay under the
 * tightest unpacked check, the 8 MiB preservation backup, with room for workspace copies; packed, it stays inside
 * every 4.5 MB request and response. Raised from 4 MB with the "no FORGE line" rows (TJ, option B, 2026-10-26). */
export const FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET = 6_000_000;
/** The same budget with the FORGE reserve pass on. */
export const FORGE_RESERVE_EXPANDED_BYTE_BUDGET = FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET;
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
const SKATER_COLUMNS = "run_id,as_of_date,horizon_games,game_id,player_id,team_id,opponent_team_id,proj_goals_es,proj_goals_pp,proj_goals_pk,proj_assists_es,proj_assists_pp,proj_assists_pk,proj_shots_es,proj_shots_pp,proj_shots_pk,proj_toi_es_seconds,proj_toi_pp_seconds,proj_toi_pk_seconds,proj_hits,proj_blocks,proj_pim,proj_plus_minus,availability_state:uncertainty->availability->>state,availability_game_id:uncertainty->availability->>game_id";
const RESERVE_COLUMNS = "run_id,as_of_date,horizon_games,game_id,player_id,team_id,opponent_team_id,player_class,conditioning,reserve_reason,proj_goals_es,proj_goals_pp,proj_assists_es,proj_assists_pp,proj_shots_es,proj_shots_pp,proj_toi_es_seconds,proj_toi_pp_seconds,proj_hits,proj_blocks,proj_saves,proj_goals_allowed,proj_shots_against,proj_shutout_prob,availability_state:uncertainty->availability->>state,availability_game_id:uncertainty->availability->>game_id";
// The stored proj_* are the team's goalie slot (a start-weighted mixture), not any goalie's own line (W2-8 PR5); each
// goalie's own line and start chance are the per-candidate contract in uncertainty.goalie_candidates (AF-01).
const GOALIE_COLUMNS = "run_id,as_of_date,horizon_games,game_id,goalie_id,team_id,opponent_team_id,starter_probability,proj_saves,proj_goals_allowed,proj_shots_against,proj_win_prob,proj_shutout_prob,goalie_candidates:uncertainty->goalie_candidates";
const GOALIE_KEYS = ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "SHUTOUTS_GOALIE", "GOALIE_MINUTES", "GAMES_STARTED", "WINS_GOALIE", "LOSSES_GOALIE", "OTL_GOALIE"];

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number | null) => value === null ? null : Math.round(value * 10000) / 10000;

export type ForgeDailyBridgeInputs = {
  /** Selected runs (each may carry `proof`, its runProofDiagnostics); only those with `external_input_proven: true` (their captured snapshot proves third-party fantasy
   * inputs were excluded) are used. Others are counted as withheld and their rows ignored. */
  runs: Row[]; skaters: Row[];
  /** `forge_goalie_projections` rows; each goalie's start chance and lines come only from their `goalie_candidates`
   * contract (AF-01). Last-10 and season start shares are not read: they are not start probabilities (W1 P0 #17). */
  goalies: Row[];
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
  positionAllowed?: Row[];
  /** `forge_reserve_projections` rows (FORGE reserve pass) for the selected runs. Absent: the reserve pass is off and
   * every path behaves as before. Null: it is on but the rows could not be read. */
  reserves?: Row[] | null };
/** An opponent's tilt toward forwards or defencemen: weight of last season and shrinkage, in games; clamp. */
const TILT_LAST_SEASON_GAMES = 20, TILT_SHRINK_GAMES = 30, TILT_LIMIT = 0.15;
type Tilt = { points: number; shots: number };
/** Last season's team xG counts as this many games in the blended prior. */
export const LAST_SEASON_PRIOR_GAMES = 20;
type GameContext = { teamRestDays: number | null; opponentRestDays: number | null; isHome: boolean };
const DAY = 86400000;
/** FORGE team-strength terms for one team against one opponent (fractional adjustments, already sample-weighted and clamped). */
type Context = { shotsAgainst: number; goalsAgainst: number; goalsFor: number };

/** One prior per team: the latest date's season-to-date row, i.e. the row whose xGA total matches its games played.
 * The table holds several rows per team and date, so a row is used only when exactly one matches. */
export function teamStrengthPriors(rows: Row[], lastSeason: Row[] = [], seasonId?: number): Map<string, TeamStrengthPrior> {
  // W2-1 C2 (migration 129): once rows carry `nst_season`, the season is an exact join key: only rows whose joined NST
  // season is this season count, and the games-played inference below is not used for them (a null season is unknown).
  // Before 129 the field is absent and the legacy inference stays, so the reader never errors on either shape.
  const keyed = seasonId !== undefined && rows.some(row => Object.prototype.hasOwnProperty.call(row, "nst_season"));
  if (keyed) rows = rows.filter(row => row.nst_season !== null && row.nst_season !== undefined && Number(row.nst_season) === seasonId);
  const latest = new Map<string, string>();
  for (const row of rows) if (typeof row.team_abbrev === "string" && typeof row.date === "string"
    && (latest.get(row.team_abbrev) ?? "") < row.date) latest.set(row.team_abbrev, row.date);
  const priors = new Map<string, TeamStrengthPrior>();
  for (const [team, date] of latest) {
    const matches = rows.filter(row => row.team_abbrev === team && row.date === date).filter(row => {
      const xga = Number(row.xga), perGame = Number(row.xga_per_game), games = Number(row.games_played);
      return Number.isFinite(xga) && perGame > 0 && games > 0 && (keyed || Math.abs(xga / perGame - games) < 0.5);
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
  // Sorted, so summing the league share never depends on row order.
  const teams = [...new Set([...perGame.keys()].map(key => key.split("|")[0]))].sort();
  const league = (stat: "points" | "shots") => {
    const shares = teams.map(team => share(team, stat)).filter((value): value is { d: number; games: number } => !!value);
    return shares.length ? shares.reduce((sum, value) => sum + value.d, 0) / shares.length : null;
  };
  const leaguePoints = league("points"), leagueShots = league("shots");
  const tilts = new Map<string, Tilt>();
  // Decision 136: the tilt only redistributes. The shrunk defence factor is limited to the range where both it and the
  // forwards' factor stay within ±TILT_LIMIT while base × f_D + (1 − base) × f_F = 1 at the league reference mix, and
  // forwards take exactly the remainder, so a clamp never leaks part of the team total (the old independent clamps gave
  // 0.93–0.95).
  const pair = (own: { d: number; games: number }, base: number) => {
    const raw = 1 + (own.d / base - 1) * own.games / (own.games + TILT_SHRINK_GAMES);
    const low = Math.max(1 - TILT_LIMIT, (1 - (1 - base) * (1 + TILT_LIMIT)) / base);
    const high = Math.min(1 + TILT_LIMIT, (1 - (1 - base) * (1 - TILT_LIMIT)) / base);
    const d = Math.min(high, Math.max(low, raw));
    return { d, f: (1 - base * d) / (1 - base) };
  };
  for (const team of teams) {
    const points = share(team, "points"), shots = share(team, "shots");
    if (!points || !shots || !leaguePoints || !leagueShots || leaguePoints >= 1 || leagueShots >= 1) continue;
    const p = pair(points, leaguePoints), q = pair(shots, leagueShots);
    tilts.set(`${team}|D`, { points: p.d, shots: q.d });
    tilts.set(`${team}|F`, { points: p.f, shots: q.f });
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
  const moved = { ...line, SAVES_GOALIE: scale(line.SAVES_GOALIE, shots), SHOTS_AGAINST_GOALIE: scale(line.SHOTS_AGAINST_GOALIE, shots),
    GOALS_AGAINST_GOALIE: scale(line.GOALS_AGAINST_GOALIE, against),
    SHUTOUTS_GOALIE: line.SHUTOUTS_GOALIE === null ? null : round(Math.min(1, line.SHUTOUTS_GOALIE / against)) };
  return reconcileSaves(moved);
}
/** SA = SV + GA (Astra PR1): shots and goals against move by different factors, so saves are derived as SA − GA. Goals
 * against above shots against is an impossible line: its three components become unknown, never a negative save count. */
function reconcileSaves(line: StatLine): StatLine {
  const shots = line.SHOTS_AGAINST_GOALIE, goals = line.GOALS_AGAINST_GOALIE;
  if (!finite(shots) || !finite(goals)) return line;
  if (goals > shots) return { ...line, SAVES_GOALIE: null, SHOTS_AGAINST_GOALIE: null, GOALS_AGAINST_GOALIE: null };
  return { ...line, SAVES_GOALIE: round(shots - goals) };
}
/** A team's chance to win one game (OT/SO included), kept apart from any goalie's wins. Both teams of a game sum to 1.
 * `forge`: FORGE projected the game; `forge_paired`: 1 − the opponent's FORGE value; `forge_model`: FORGE's win model on
 * team xG priors for a game FORGE has not projected yet. */
export type BridgeTeamWin = { gameId: string; team: string; probability: number; source: "forge" | "forge_paired" | "forge_model" };
/** `runProofs`: each served run's external-input proof (basis, release and closure), for the response wire only. */
export type ForgeDailyBridgeResult = { forecasts: GameForecast[]; limitations: string[]; teamWins: BridgeTeamWin[]; runProofs: BridgeRunProof[] };
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

/** The released per-candidate contract on a FORGE goalie row (L9b, forge_goalie_candidates_v1), or null when the row
 * predates it, fails validation or names another game or team: unknown, never rebuilt from the slot row. */
function candidateContract(row: Row | undefined): GoalieCandidatesContract | null {
  if (!row) return null;
  const contract = readGoalieCandidatesContract({ goalie_candidates: row.goalie_candidates });
  return contract && contract.game_id === Number(row.game_id) && contract.team_id === row.team_id ? contract : null;
}
const known = (value: unknown) => finite(value) ? round(value) : null;
/** A candidate's own line if he starts: his credited Win if he starts; regulation L and OTL unknown (W1 P0 #28). */
function candidateLine(candidate: GoalieCandidateRow): StatLine {
  const line = candidate.if_starts;
  return { SAVES_GOALIE: known(line.saves), GOALS_AGAINST_GOALIE: known(line.goals_allowed), SHOTS_AGAINST_GOALIE: known(line.shots_against),
    SHUTOUTS_GOALIE: known(line.shutout_prob), GOALIE_MINUTES: 60, GAMES_STARTED: 1, WINS_GOALIE: known(line.credited_win_prob), LOSSES_GOALIE: null, OTL_GOALIE: null };
}
/** A candidate's unconditional values as the contract issued them (P(start) times his line, zero relief for counts; his
 * credited Win includes his modelled relief share). */
function contractUnconditional(candidate: GoalieCandidateRow): StatLine {
  const line = candidate.unconditional, p = candidate.start_probability;
  return { SAVES_GOALIE: known(line.saves), GOALS_AGAINST_GOALIE: known(line.goals_allowed), SHOTS_AGAINST_GOALIE: known(line.shots_against),
    SHUTOUTS_GOALIE: known(line.shutout_prob), GOALIE_MINUTES: round(60 * p), GAMES_STARTED: round(p), WINS_GOALIE: known(line.credited_win_prob),
    LOSSES_GOALIE: null, OTL_GOALIE: null };
}
/** Credited Wins under start chances that news changed: FORGE's own win populations over each candidate's contract
 * "team wins if he starts". Null when a goalie with a start chance has no such value (his relief effect is unknown). */
function newsAdjustedWins(probability: Map<number, number>, candidates: Map<number, GoalieCandidateRow>): Map<number, number> | null {
  const teamWinIfStarts = (id: number) => {
    const credited = candidates.get(id)?.if_starts.credited_win_prob;
    return finite(credited) ? credited / STARTER_DECISION_SHARE : null;
  };
  if ([...probability].some(([id, p]) => p > 0 && teamWinIfStarts(id) === null)) return null;
  return new Map(goalieWinPopulations([...probability].map(([goalieId, startProbability]) => ({ goalieId, startProbability,
    teamWinIfStarts: teamWinIfStarts(goalieId) ?? 0 }))).goalies.map(goalie => [goalie.goalieId, goalie.unconditionalWin]));
}

/** VORP S3: one FORGE h1 row's own per-game line in league stat keys, in native units, with no season-rate substitute
 * (stats FORGE does not project stay null) and, for a goalie, no assumed start or minutes. Null when its heads are missing. */
export function forgeNativeLine(row: Row, playerClass: "skater" | "goalie"): StatLine | null {
  if (playerClass === "skater") return skaterStats(withPowerPlayZeros(row).row, null);
  const { GOALIE_MINUTES: _minutes, GAMES_STARTED: _started, ...line } = goalieLine(row);
  return line;
}
/** What the bridge read for one request, timed around the read of the admitted runs' output rows (VORP S3 capture). */
export type ForgeBridgeCapture = { startedAt: string; completedAt: string; runs: Row[]; skaters: Row[]; goalies: Row[]; reserves: Row[] | null | undefined };

/** Pure: no reads. Rows from runs not in `inputs.runs`, or from runs without external-input exclusion proof, are ignored. */
export function buildForgeDailyBridgeForecasts(inputs: ForgeDailyBridgeInputs, players: PlanningPlayer[], games: PlanningGame[],
  now: Date, seasonId: number, calendarPolicy: AnyForecastCalendarPolicy, byteBudget = FORGE_DAILY_BRIDGE_BYTE_BUDGET,
  expandedByteBudget = inputs.reserves === undefined ? FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET : FORGE_RESERVE_EXPANDED_BYTE_BUDGET): ForgeDailyBridgeResult {
  const runs = new Map<string, Run>();
  let withheldRuns = 0;
  for (const row of inputs.runs) if (typeof row.run_id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.as_of_date)
    && Date.parse(row.created_at) <= now.getTime()) {
    if (row.external_input_proven !== true) { withheldRuns++; continue; }
    runs.set(row.run_id, { runId: row.run_id, asOfDate: row.as_of_date,
      issuedAt: new Date(row.created_at).toISOString(), gitSha: row.git_sha ?? null, proof: row.proof ?? null });
  }
  if (!runs.size) return { forecasts: [], teamWins: [], runProofs: [], limitations: [withheldRuns
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
  const exactGoalie = latest(goalieRows, row => `${row.game_id}:${row.team_id}`);
  // Each goalie's own latest candidate line (his row in the latest contract that lists him), kept only as his "if he
  // starts" line for games no contract covers.
  const ownCandidateLatest = new Map<number, { row: Row; candidate: GoalieCandidateRow }>();
  for (const row of goalieRows) for (const candidate of candidateContract(row)?.rows ?? []) {
    const previous = ownCandidateLatest.get(candidate.goalie_id);
    if (!previous || order(row) > order(previous.row)) ownCandidateLatest.set(candidate.goalie_id, { row, candidate });
  }
  const rates = inputs.seasonTotals ? seasonRates(inputs.seasonTotals, seasonId) : null;
  const priors = teamStrengthPriors(inputs.teamPriors ?? [], inputs.lastSeasonTeams ?? [], seasonId);
  const tilts = opponentTilts(inputs.positionAllowed ?? [], seasonId);
  const tiltBetween = (player: PlanningPlayer, from: string | undefined, to: string | undefined): Tilt | undefined => {
    const group = player.eligiblePositions.some(position => position.toUpperCase() === "D") ? "D" : "F";
    // W1-6 D19 (decision 136): FORGE never applied a positional tilt for the opponent it projected, so the line is
    // neutral on this dimension: it takes the destination's tilt alone, never divided by the source's.
    void from;
    const b = to ? tilts.get(`${to.toUpperCase()}|${group}`) : undefined;
    return b ? { points: b.points, shots: b.shots } : undefined;
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
    // Decision 127: the policy decides the date basis (v2: the game's NHL schedule date), so pass both.
    && calendarLeadDay(game.startsAt, nowIso, calendarPolicy, game.date) < calendarPolicy.calendarDays);
  const forecasts: GameForecast[] = [];
  const emit = (player: PlanningPlayer, game: PlanningGame, run: Run, stats: StatLine, startProbability: number | null, conditionalStats?: StatLine, confirmedStart = false, reserve?: ReserveCode) => {
    const appearance = reserve ? reserveAppearanceProbability(reserve) : undefined;
    const expiresAt = new Date(Math.min(Date.parse(game.startsAt!), Date.parse(run.issuedAt) + VALID_DAYS * DAY_MS)).toISOString();
    if (Date.parse(expiresAt) <= now.getTime()) return;
    forecasts.push({ sourceKind: "detailed", cutoffAt: run.issuedAt, expiresAt, sourceWatermark: `${FORGE_DAILY_BRIDGE_VERSION}:${run.runId}`,
      issuedContext: { version: "forge-issued-context-v1", playerId: player.id, gameId: game.id, nhlPlayerId: player.nhlId!, seasonId,
        teamId: player.nhlTeamId!, scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!, rosterRevision: player.rosterRevision!,
        observedAt: run.issuedAt, scheduleSourceUpdatedAt: null, scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] },
      allowedUses: bridgeAllowedUses(reserve),
      ...(conditionalStats ? { conditionalStats } : {}), ...(appearance !== undefined ? { appearanceProbability: appearance } : {}),
      playerId: player.id, gameId: game.id, stats, conditioning: "unconditional", startProbability, confirmedStart,
      revisionId: `${FORGE_DAILY_BRIDGE_VERSION}:${run.runId}`, issuedAt: run.issuedAt,
      modelVersion: `${FORGE_DAILY_BRIDGE_VERSION}:${run.gitSha ?? "unknown"}`,
      limitations: reserve ? [FORECAST_LIMITATION, RESERVE_FORECAST_NOTES[reserve]] : [FORECAST_LIMITATION] });
  };
  const identified = players.filter(player => player.nhlId !== null && finite(player.nhlTeamId) && player.rosterRevision && player.teamAbbreviation);
  let staleSkaters = 0, teamMismatch = 0, noPowerPlay = 0, unknownPowerPlay = 0, reserveSkaterGames = 0, reserveGoalieGames = 0;
  const unknownPowerPlayIds = new Set<number>();
  const unknownHeads = new Set<number>(), unratedSkaters = new Set<number>();
  const reserveSkaters = new Set<number>();
  // Reserve rows count only from the team's latest lineup run, so a player is either in that run's lineup or its reserve,
  // never both; a lineup line always wins.
  const reserveRows = (inputs.reserves ?? []).filter(row => runs.has(row.run_id) && row.horizon_games === 1 && finite(row.player_id)
    && finite(row.team_id) && row.as_of_date === teamLatestDate.get(row.team_id)
    && (row.player_class === "skater" && row.conditioning === "if_dressed" || row.player_class === "goalie" && row.conditioning === "if_starts"));
  const reserveLatest = latest(reserveRows, row => `${row.player_class}:${row.player_id}`);
  const exactReserve = latest(reserveRows, row => `${row.player_class}:${row.game_id}:${row.player_id}`);
  /** What the accepted news for this game says about a reserve skater dressing. Only confirmed news settles it. */
  const skaterState = (game: PlanningGame, player: PlanningPlayer, reason: unknown): ReserveCode => {
    if (!inputs.goalieNews) return "skater:evidence_unavailable";
    const scope = (row: { gameId: number; teamId: number; playerId: number | null }) => row.gameId === Number(game.id)
      && row.teamId === player.nhlTeamId && row.playerId === player.nhlId;
    if (inputs.goalieNews.conflicts.some(row => scope(row) && (row.dimension === "availability" || row.dimension === "ev"))) return "skater:disputed";
    const news = inputs.goalieNews.assertions.filter(scope);
    // Of several assertions in one dimension, a confirmed one is the one that speaks.
    const pick = (dimension: string) => news.find(row => row.dimension === dimension && row.confirmed) ?? news.find(row => row.dimension === dimension);
    const availability = pick("availability"), lineup = pick("ev");
    // Confirmed news outranks unconfirmed news: a confirmed "out" counts 0, a confirmed lineup slot beats an
    // unconfirmed scratch report, and only then do unconfirmed reports apply (scratch before lineup).
    if (availability?.value === "out" && availability.confirmed) return "skater:confirmed_out";
    if (lineup?.confirmed) return "skater:confirmed_lineup";
    if (availability?.value === "out") return "skater:projected_scratch";
    if (lineup) return "skater:projected_lineup";
    if (availability?.value === "return") return "skater:return_reported";
    if (availability) return "skater:uncertain";
    return reason === "ruled_out" ? "skater:ruled_out_at_run" : "skater:no_lineup_evidence";
  };
  /** A reserve row's state: accepted news first, then FORGE's roster evidence out for this very game (L9c) as a real 0. */
  const reserveState = (game: PlanningGame, player: PlanningPlayer, row: Row): ReserveCode => {
    const news = skaterState(game, player, row.reserve_reason);
    if (news === "skater:confirmed_lineup" || news === "skater:confirmed_out") return news;
    return row.availability_state === "confirmed_out" && String(row.availability_game_id) === game.id ? "skater:roster_out" : news;
  };
  const zeroed = (line: StatLine): StatLine => Object.fromEntries(Object.entries(line).map(([key, value]) => [key, value === null ? null : 0]));
  const unknownLine = (line: StatLine): StatLine => Object.fromEntries(Object.keys(line).map(key => [key, null]));
  const emitReserve = (player: PlanningPlayer, game: PlanningGame, run: Run, line: StatLine, code: ReserveCode, startProbability: number | null = null) => {
    // Confirmed in the lineup: the conditional line is his expectation. Confirmed out: a real 0. Otherwise his
    // participation is unknown, so the unconditional line is unknown (decisions 3, 47), never a fabricated 0.
    emit(player, game, run, code === "skater:confirmed_lineup" ? line : code === "skater:confirmed_out" || code === "skater:roster_out" ? zeroed(line)
      : unknownLine(line), startProbability, line, false, code);
  };
  // L9c (decision 132): FORGE rows carry his "if he plays" line plus `uncertainty.availability` for the row's game. Accepted
  // news for this game decides first; then roster evidence out for this very game is a real 0; otherwise an uncertain or
  // unknown state (or an out on another game) leaves the unconditional value unknown. Rows without the field (older runs)
  // keep today's reading.
  const rowAvailability = (player: PlanningPlayer, row: Row, game: PlanningGame): "line" | ReserveCode => {
    const state = typeof row.availability_state === "string" ? row.availability_state : null;
    if (!state || state === "projected_lineup") return "line";
    const news = skaterState(game, player, null);
    if (news === "skater:confirmed_lineup") return "line";
    if (news === "skater:confirmed_out") return news;
    if (state === "confirmed_out" && String(row.availability_game_id) === game.id) return "skater:roster_out";
    return state === "uncertain" ? "skater:availability_uncertain" : "skater:availability_unknown";
  };
  const emitLineup = (player: PlanningPlayer, game: PlanningGame, run: Run, line: StatLine, row: Row) => {
    const state = rowAvailability(player, row, game);
    if (state === "line") emit(player, game, run, line, null);
    else emitReserve(player, game, run, line, state);
  };
  for (const player of identified.filter(row => row.playerClass === "skater")) {
    const latestRow = skaterLatest.get(player.nhlId);
    const lineupCurrent = !!latestRow && latestRow.team_id === player.nhlTeamId && latestRow.as_of_date === teamLatestDate.get(latestRow.team_id);
    const reserve = lineupCurrent ? undefined : reserveLatest.get(`skater:${player.nhlId}`);
    if (reserve && reserve.team_id === player.nhlTeamId) {
      const playerRates = rates?.get(player.nhlId!) ?? null;
      const reserveLine = (row: Row) => skaterStats(withPowerPlayZeros(row).row, playerRates);
      const baseLine = reserveLine(reserve);
      const projectedAgainst = context(player.teamAbbreviation, opponentAbbreviation(reserve.opponent_team_id));
      const emitted = forecasts.length;
      for (const game of upcoming(player.teamAbbreviation!)) {
        // A lineup line issued for this game itself (a later run that dressed him) wins over any reserve line.
        const own = exactSkater.get(`${game.id}:${player.nhlId}`);
        if (own && own.team_id === player.nhlTeamId) {
          const special = withPowerPlayZeros(own), ownStats = skaterStats(special.row, playerRates);
          if (ownStats) { emitLineup(player, game, runs.get(own.run_id)!, ownStats, own); continue; }
        }
        const exact = exactReserve.get(`skater:${game.id}:${player.nhlId}`);
        if (exact) {
          const line = reserveLine(exact);
          if (line) emitReserve(player, game, runs.get(exact.run_id)!, line, reserveState(game, player, exact));
          continue;
        }
        if (!baseLine) continue;
        const facing = context(player.teamAbbreviation, game.opponent);
        const scale = projectedAgainst && facing ? (1 + facing.goalsFor) / (1 + projectedAgainst.goalsFor) : 1;
        const rest = restScale(gameContext(reserve.game_id, reserve.team_id), gameContext(game.id, reserve.team_id));
        const tilt = tiltBetween(player, abbreviationById.get(reserve.opponent_team_id), game.opponent);
        emitReserve(player, game, runs.get(reserve.run_id)!, scale === 1 && !rest && !tilt ? baseLine : retargetSkater(baseLine, scale, rest, tilt),
          reserveState(game, player, reserve));
      }
      if (forecasts.length > emitted) { reserveSkaters.add(player.nhlId!); reserveSkaterGames += forecasts.length - emitted; }
      if (!baseLine && rates && !playerRates) unratedSkaters.add(player.nhlId!);
      continue;
    }
    if (!latestRow) continue;
    if (latestRow.team_id !== player.nhlTeamId) { teamMismatch++; continue; }
    // Missing from his team's latest run (scratched, injured or reassigned since): only lines issued for a game itself stand.
    const stale = latestRow.as_of_date !== teamLatestDate.get(latestRow.team_id), emitted = forecasts.length;
    const playerRates = rates?.get(player.nhlId!) ?? null;
    const lineFor = (row: Row) => {
      const special = withPowerPlayZeros(row);
      if (special.filled) noPowerPlay++;
      if (special.unknown) { unknownPowerPlay++; unknownPowerPlayIds.add(player.nhlId!); }
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
        if (ownStats) { emitLineup(player, game, runs.get(own.run_id)!, ownStats, own); continue; }
      }
      if (!stats) continue;
      const row = latestRow;
      const facing = String(row.game_id) === game.id ? null : context(player.teamAbbreviation, game.opponent);
      const scale = projectedAgainst && facing ? (1 + facing.goalsFor) / (1 + projectedAgainst.goalsFor) : 1;
      const rest = String(row.game_id) === game.id ? null : restScale(gameContext(row.game_id, row.team_id), gameContext(game.id, row.team_id));
      const tilt = String(row.game_id) === game.id ? undefined : tiltBetween(player, abbreviationById.get(row.opponent_team_id), game.opponent);
      emitLineup(player, game, runs.get(row.run_id)!, scale === 1 && !rest && !tilt ? stats : retargetSkater(stats, scale, rest, tilt), row);
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
    // The candidate contract states the team's win probability itself (AF-01); older rows carry only the goalie slot's
    // credited Win, read as before.
    const ownTeam = candidateContract(ownRow)?.team_win_probability, otherTeam = candidateContract(otherRow)?.team_win_probability;
    let result: BridgeTeamWin | null = null;
    if (finite(ownTeam) && finite(otherTeam) && ownTeam + otherTeam > 0) result = { gameId: game.id, team, probability: ownTeam / (ownTeam + otherTeam), source: "forge" };
    else if (finite(ownTeam)) result = { gameId: game.id, team, probability: unit(ownTeam), source: "forge" };
    else if (finite(otherTeam)) result = { gameId: game.id, team, probability: 1 - unit(otherTeam), source: "forge_paired" };
    else if (own !== null && other !== null && own + other > 0) result = { gameId: game.id, team, probability: own / (own + other), source: "forge" };
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
  /** A goalie's own "if he starts" line, never a teammate's: his candidate row for this game; else his own reserve line for
   * this game; else his latest own candidate or reserve line for this team, moved to this game (its Win then unknown). */
  const ownGoalieLine = (goalie: PlanningPlayer, game: PlanningGame, teamId: number, exact: Row | undefined, candidate: GoalieCandidateRow | undefined) => {
    if (exact && candidate) return { source: exact, line: candidateLine(candidate), moved: false };
    const decisionsUnknown = { WINS_GOALIE: null, LOSSES_GOALIE: null, OTL_GOALIE: null };
    const reserve = exactReserve.get(`goalie:${game.id}:${goalie.nhlId}`);
    if (reserve && reserve.team_id === teamId) return { source: reserve, line: { ...goalieLine(reserve), ...decisionsUnknown }, moved: false };
    const latestCandidate = ownCandidateLatest.get(goalie.nhlId!), latestReserve = reserveLatest.get(`goalie:${goalie.nhlId}`);
    const options = [...latestCandidate && latestCandidate.row.team_id === teamId ? [{ source: latestCandidate.row, line: candidateLine(latestCandidate.candidate) }] : [],
      ...latestReserve && latestReserve.team_id === teamId ? [{ source: latestReserve, line: goalieLine(latestReserve) }] : []];
    const pick = options.sort((a, b) => order(b.source).localeCompare(order(a.source)))[0];
    if (!pick) return null;
    const { source } = pick, here = String(source.game_id) === game.id;
    const from = here ? null : context(goalie.teamAbbreviation, opponentAbbreviation(source.opponent_team_id)), to = from ? context(goalie.teamAbbreviation, game.opponent) : null;
    const fromGame = here ? null : gameContext(source.game_id, teamId), toGame = fromGame ? gameContext(game.id, teamId) : null;
    const venue = fromGame && toGame ? { from: goalieShotContext(fromGame), to: goalieShotContext(toGame) } : undefined;
    return { source, line: { ...from && to ? retargetGoalieLine(pick.line, from, to, venue) : pick.line, ...decisionsUnknown }, moved: true };
  };
  // AF-01 (W1 P0 #20; decisions 25, 63): each goalie's start chance, "if he starts" line and unconditional values come from
  // FORGE's per-candidate contract for that team-game, his own row only. A goalie the contract does not list, or a game no
  // contract covers, has an unknown start chance (never a teammate's line, never a last-10 share); a contract whose chances
  // sum to less than 1 keeps the rest unassigned.
  let noContractTeamGames = 0, partialMassTeamGames = 0, absentCandidateGames = 0;
  const absentCandidates = new Set<number>();
  for (const [teamId, goalies] of goaliesByTeam) for (const game of upcoming(goalies[0].teamAbbreviation!)) {
    // The team's win probability is served for the game (teamWins); no goalie's Win is derived from it.
    teamWin(game, teamId);
    const exact = exactGoalie.get(`${game.id}:${teamId}`), contract = candidateContract(exact);
    if (!contract) noContractTeamGames++;
    const candidates = new Map((contract?.rows ?? []).map(row => [row.goalie_id, row]));
    const probability = new Map([...candidates].map(([id, row]) => [id, row.start_probability]));
    // Accepted IFTTT goalie news on top: confirmed and ruled out outright, likely/projected as floors. A chance taken from
    // one goalie is never handed to another (it stays unassigned); a floor scales the others down only to fit.
    const disputed = inputs.goalieNews?.conflicts.some(row => row.dimension === "goalie" && row.gameId === Number(game.id) && row.teamId === teamId);
    const signal = disputed ? undefined : inputs.goalieNews?.assertions.find(row => row.dimension === "goalie" && row.gameId === Number(game.id)
      && row.teamId === teamId && goalies.some(goalie => goalie.nhlId === row.playerId));
    if (disputed) news.disputed++;
    let confirmedId: number | null = null;
    if (signal) {
      const named = signal.playerId!, floor = FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS[signal.value];
      if (signal.value === "confirmed") {
        for (const id of [...candidates.keys(), ...goalies.map(goalie => goalie.nhlId!)]) probability.set(id, 0);
        probability.set(named, 1); confirmedId = named; news.confirmed++;
      } else if (signal.value === "ruled_out") { probability.set(named, 0); news.ruledOut++; }
      else if (floor !== undefined) {
        const p = Math.max(probability.get(named) ?? 0, floor), others = [...probability].filter(([id]) => id !== named);
        const total = others.reduce((sum, [, value]) => sum + value, 0);
        probability.set(named, p);
        if (total > 1 - p) for (const [id, value] of others) probability.set(id, value * (1 - p) / total);
        news.speculative++;
      }
    }
    const mass = [...probability.values()].reduce((sum, value) => sum + value, 0);
    if (probability.size && mass < 1 - probability.size * 5e-7) partialMassTeamGames++;
    const changed = probability.size !== candidates.size || [...candidates].some(([id, row]) => probability.get(id) !== row.start_probability);
    const adjustedWins = changed ? newsAdjustedWins(probability, candidates) : null;
    for (const goalie of goalies) {
      const id = goalie.nhlId!, candidate = candidates.get(id), p = probability.get(id);
      if (contract && !candidate) { absentCandidates.add(id); absentCandidateGames++; }
      const own = ownGoalieLine(goalie, game, teamId, exact, candidate);
      if (!own) {
        // No line of his own. Not listed by this game's contract: labelled unknown here; with no contract the no-line pass
        // labels him.
        if (exact && contract) { emit(goalie, game, runs.get(exact.run_id)!, Object.fromEntries(GOALIE_KEYS.map(key => [key, null])), null, undefined, false, "goalie:start_unknown"); reserveGoalieGames++; }
        continue;
      }
      const run = runs.get(own.source.run_id)!;
      // Unknown start chance: his own "if he starts" line stays visible and plans read him as unknown, labelled as such.
      if (p === undefined) { emitReserve(goalie, game, run, own.line, "goalie:start_unknown"); reserveGoalieGames++; continue; }
      // As issued when news left the chances alone; otherwise P(start) times his line (zero relief for counts, as the
      // contract) and his credited Win under the new chances. Start probabilities stay unrounded (W2-8 D2).
      const stats = candidate && !changed ? contractUnconditional(candidate) : reconcileSaves({
        ...Object.fromEntries(Object.entries(own.line).map(([key, value]) => [key, value === null ? null : round(value * p)])),
        WINS_GOALIE: own.moved ? null : round(adjustedWins?.get(id) ?? null), LOSSES_GOALIE: null, OTL_GOALIE: null });
      if (stats.WINS_GOALIE === null) unknownWins++;
      emit(goalie, game, run, stats, p, own.line, confirmedId === id);
    }
  }
  // No FORGE line: an identified player still without a row for a game in the horizon gets a labelled unknown row
  // under his team's latest proven run (decisions 3, 47 supersede the 2026-10-26 labelled 0): every scored key null and
  // no planning use, so he is never an automatic drop and lineup totals read incomplete. His latest proven line, if any,
  // is kept as the "if he plays" line and never counts. Only "no line exists" qualifies: when a withheld (unproven) run
  // may hold his team's newer line, he still gets no forecast.
  const served = new Set(forecasts.map(row => `${row.playerId}:${row.gameId}`));
  const withheldDates = inputs.runs.filter(row => row.external_input_proven !== true && typeof row.as_of_date === "string").map(row => row.as_of_date as string);
  const teamPlays = (teamId: number, date: string) => !scheduleById.size
    || [...scheduleById.values()].some(row => row.date === date && (row.homeTeamId === teamId || row.awayTeamId === teamId));
  const teamRun = new Map<number, Row>();
  for (const row of skaterRows) if (row.as_of_date === teamLatestDate.get(row.team_id)
    && (!teamRun.has(row.team_id) || order(row) > order(teamRun.get(row.team_id)!))) teamRun.set(row.team_id, row);
  const lineWithheld = (teamId: number) => withheldDates.some(date => date >= (teamLatestDate.get(teamId) ?? "") && teamPlays(teamId, date));
  const noLineTemplate: Record<"skater" | "goalie", StatLine> = {
    skater: Object.fromEntries(["GOALS", "ASSISTS", "POINTS", "PP_GOALS", "PP_ASSISTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS",
      "TIME_ON_ICE_PER_GAME", ...FORGE_DAILY_BRIDGE_SEASON_RATED].map(key => [key, 0])),
    goalie: { SAVES_GOALIE: 0, GOALS_AGAINST_GOALIE: 0, SHOTS_AGAINST_GOALIE: 0, SHUTOUTS_GOALIE: 0, GOALIE_MINUTES: 0, GAMES_STARTED: 0, WINS_GOALIE: 0, LOSSES_GOALIE: 0, OTL_GOALIE: 0 },
  };
  let noLineGames = 0;
  const noLinePlayers = new Set<number>(), withheldLinePlayers = new Set<number>();
  for (const player of identified) {
    // A line exists but cannot be read safely (blank heads, unknown power play): unknown stays unknown.
    if (unknownHeads.has(player.nhlId!) || unknownPowerPlayIds.has(player.nhlId!)) continue;
    for (const game of upcoming(player.teamAbbreviation!)) {
      if (served.has(`${player.id}:${game.id}`)) continue;
      if (lineWithheld(player.nhlTeamId!)) { withheldLinePlayers.add(player.nhlId!); continue; }
      const anchor = teamRun.get(player.nhlTeamId!);
      if (!anchor) continue;
      // His own latest proven line for this team, moved to this game as the lineup path does.
      const own = player.playerClass === "skater" ? skaterLatest.get(player.nhlId) : undefined;
      let conditional: StatLine | undefined;
      if (own && own.team_id === player.nhlTeamId) {
        const line = skaterStats(withPowerPlayZeros(own).row, rates?.get(player.nhlId!) ?? null);
        if (line) {
          const from = context(player.teamAbbreviation, opponentAbbreviation(own.opponent_team_id)), to = context(player.teamAbbreviation, game.opponent);
          const scale = String(own.game_id) === game.id || !from || !to ? 1 : (1 + to.goalsFor) / (1 + from.goalsFor);
          const rest = String(own.game_id) === game.id ? null : restScale(gameContext(own.game_id, own.team_id), gameContext(game.id, own.team_id));
          const tilt = String(own.game_id) === game.id ? undefined : tiltBetween(player, abbreviationById.get(own.opponent_team_id), game.opponent);
          conditional = scale === 1 && !rest && !tilt ? line : retargetSkater(line, scale, rest, tilt);
        }
      }
      // Accepted news confirming him out of this game: a real 0 that keeps his "if he plays" line (W2-8 D3). Otherwise
      // every key is unknown (null), so the plan reads him as unknown, never as a known 0.
      const template = { ...noLineTemplate[player.playerClass], ...conditional };
      if (player.playerClass === "skater" && skaterState(game, player, null) === "skater:confirmed_out") {
        emit(player, game, runs.get(anchor.run_id)!, zeroed(template), null, conditional, false, "skater:confirmed_out");
      } else emit(player, game, runs.get(anchor.run_id)!, unknownLine(template),
        null, conditional, false, player.playerClass === "skater" ? "skater:no_forge_line" : "goalie:no_forge_line");
      noLinePlayers.add(player.nhlId!); noLineGames++;
    }
  }
  forecasts.sort((a, b) => (a.issuedContext!.scheduledAt).localeCompare(b.issuedContext!.scheduledAt) || a.playerId.localeCompare(b.playerId) || a.gameId.localeCompare(b.gameId));
  const size = (rows: GameForecast[]) => rows.reduce((total, row) => ({ wire: total.wire + bridgeWireRowBytes(row),
    expanded: total.expanded + jsonUtf8Bytes(row) + 1 }), { wire: 0, expanded: 0 });
  // Reserve lines are all or nothing: when the full set does not fit, every one is withheld (never the late games
  // only) and the limitations say so, before lineup lines are trimmed as before.
  const total = size(forecasts), reservesFit = total.wire <= byteBudget && total.expanded <= expandedByteBudget;
  const reservesWithheld = reservesFit ? 0 : forecasts.filter(row => isReserveLine(reserveCodeOf(row))).length;
  if (reservesWithheld) forecasts.splice(0, forecasts.length, ...forecasts.filter(row => !isReserveLine(reserveCodeOf(row))));
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
    ...(withheldRuns ? [`${withheldRuns} FORGE runs in the last week cannot prove they excluded third-party fantasy projections, so they are withheld; players covered only by them get no forecast.`] : []),
    rates ? "Penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are season per-game rates (this season plus half of last, pulled toward league rates), not FORGE projections."
      : "Season rates could not be read, so penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are unknown; totals that score them are withheld.",
    ...(unratedSkaters.size ? [`${unratedSkaters.size} skaters have no season totals this season or last, so their penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are unknown.`] : []),
    priors.size ? `Future games move each FORGE line to that game's opponent with FORGE's team-strength adjustment (team xG for and against, ${priors.size} teams${inputs.lastSeasonTeams?.length ? `, last season blended in as ${LAST_SEASON_PRIOR_GAMES} games` : ""})${scheduleById.size ? ", plus FORGE's home-ice and rest model (back-to-backs included)" : ""}${tilts.size ? ", and each opponent's tilt toward forwards or defencemen (points and shots allowed by position vs league, shrunk)" : ""}.`
      : "Team strength could not be read, so future games reuse each FORGE line without an opponent adjustment.",
    "Goalie starts and lines: FORGE's per-candidate goalie contract for each team-game it projected gives each goalie his own start probability, \"if he starts\" line and unconditional values (counts assume no relief appearances); a teammate's line never stands in, and last-10 start shares are not start probabilities, so they are not used.",
    ...(partialMassTeamGames ? [`${partialMassTeamGames} team-games have goalie start chances that sum to less than 1; the rest stays unassigned, never spread over the listed goalies.`] : []),
    ...(absentCandidates.size ? [`${absentCandidates.size} goalies are not among FORGE's start candidates for ${absentCandidateGames} team-games, so their start chance is unknown; only a line of their own, where FORGE has one, is kept as their "if he starts" line.`] : []),
    ...(noContractTeamGames ? [`${noContractTeamGames} team-games have no FORGE goalie-candidate contract (not projected yet, or projected before the contract), so goalie start chances there are unknown; a goalie's own latest line, moved to the game, is kept as his "if he starts" line and never counts.`] : []),
    "Goalie wins: each goalie's credited Win from the contract (if he starts; unconditional with his modelled relief share), recomputed with FORGE's win populations when news changes start chances; the team's win probability is served apart and never multiplied into a goalie's Win.",
    ...(teamWins.size ? ["Goalie losses: regulation L and OT/SO L are unknown (no fitted overtime split, and the provider's L/OTL mapping is unverified), so totals that score them read unknown; L is never 1 − W, which would count overtime losses and no-decisions as losses."] : []),
    ...(unknownWins ? [`${unknownWins} goalie-games with a start chance have no credited-Win value (the contract left it blank, his line is not from this game's contract, or news named a goalie with no contract Win), so their wins are unknown.`] : []),
    inputs.goalieNews ? `Goalie news (IFTTT, accepted automatically): ${news.confirmed} confirmed, ${news.speculative} likely or projected (start chance at least ${FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS.likely * 100}% / ${FORGE_DAILY_BRIDGE_GOALIE_NEWS_FLOORS.projected * 100}%), ${news.ruledOut} ruled out${news.disputed ? `, ${news.disputed} disputed and ignored` : ""}.`
      : "Goalie news could not be read; start chances use FORGE's goalie contracts only.",
    ...(noPowerPlay ? [`${noPowerPlay} skaters with no FORGE power-play line and at most ${NO_POWER_PLAY_SECONDS} s of projected power-play time count 0 power-play production.`] : []),
    ...(unknownPowerPlay ? [`${unknownPowerPlay} skaters have no FORGE power-play line and real or unrecorded power-play time, so they get no forecast.`] : []),
    ...(unknownHeads.size ? [`${unknownHeads.size} skaters have a FORGE line with blank even-strength goals, assists or shots; such lines give no forecast.`] : []),
    ...(staleSkaters ? [`${staleSkaters} skaters missing from their team's latest FORGE run have no current FORGE line (likely scratched, injured or moved).`] : []),
    ...(teamMismatch ? [`${teamMismatch} skaters whose latest FORGE line is for a different team than their current one have no current FORGE line.`] : []),
    ...(noLineGames ? [`No FORGE line: ${noLinePlayers.size} players (${noLineGames} player-games) have no current FORGE line, so plans count 0 for them (a conservative assumption, not a zero chance); a player's last FORGE line, where one exists, is kept as his "if he plays" line and never counts.`] : []),
    ...(withheldLinePlayers.size ? [`${withheldLinePlayers.size} players have no proven FORGE line because a newer run for their team cannot prove it excluded third-party fantasy projections; they get no forecast rather than a 0.`] : []),
    ...(inputs.reserves === undefined ? [] : inputs.reserves ? [`FORGE reserve lines: ${reserveSkaters.size} skaters outside FORGE's projected lineup carry an "if he dresses" line (${reserveSkaterGames} player-games); dressing counts only when accepted news confirms it, otherwise plans count 0 and say why.${reserveGoalieGames ? ` ${reserveGoalieGames} goalie-games use an "if he starts" line with an unknown start chance.` : ""}`]
      : ["FORGE reserve lines could not be read, so players outside FORGE's projected lineups have no \"if he dresses\" line."]),
    ...(priors.size && missingPriors.size ? [`${missingPriors.size} opponents have no team-strength prior, so lines projected against or moved to them skip the opponent adjustment.`] : []),
    ...(reservesWithheld ? [`FORGE reserve lines for ${reservesWithheld} player-games were withheld because full coverage exceeds the planning transport budget, so players outside FORGE's projected lineups are not covered and a pickup search here is not complete; "no FORGE line" 0s are withheld with them.`] : []),
    ...(kept < forecasts.length ? [`Interim projections were trimmed to the first ${kept} of ${forecasts.length} player-games to fit the planning transport; later games stay schedule-only.`] : []),
  ];
  const servedTeams = new Set(forecasts.slice(0, kept).map(row => `${row.gameId}:${row.issuedContext!.teamId}`));
  const servedRuns = new Set(forecasts.slice(0, kept).map(row => row.revisionId));
  return { forecasts: forecasts.slice(0, kept), limitations,
    teamWins: [...teamWins].flatMap(([key, win]) => win && servedTeams.has(key) ? [win] : []),
    runProofs: [...runs.values()].flatMap(run => run.proof && servedRuns.has(`${FORGE_DAILY_BRIDGE_VERSION}:${run.runId}`) ? [run.proof] : []) };
}

/** Read-only: the latest successful public h1 FORGE run per slate date, from the lookback through the days ahead, whose
 * proof shows it excluded third-party fantasy inputs. Newer unproven runs of a date are passed on unread, only to be
 * counted. A later run of a date supersedes an earlier one for that date's games. */
export async function loadForgeDailyBridgeForecasts(db: SupabaseClient<any>, players: PlanningPlayer[], games: PlanningGame[], now: Date,
  seasonId: number, deadline: number, calendarPolicy: AnyForecastCalendarPolicy,
  /** VORP S3 only (flag on): receives the admitted runs and their output rows as read; never changes the result. */
  capture?: (observation: ForgeBridgeCapture) => void): Promise<ForgeDailyBridgeResult> {
  const readDeadline = Math.min(deadline, Date.now() + 6000);
  const captureStartedAt = capture ? new Date().toISOString() : "";
  const from = new Date(now.getTime() - FORGE_DAILY_BRIDGE_LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + FORGE_DAILY_BRIDGE_AHEAD_DAYS * DAY_MS).toISOString().slice(0, 10);
  const runRows = await pages(() => restrictRunsToHorizon(excludeOffReleaseRuns(db.from("forge_runs").select("run_id,as_of_date,created_at,git_sha", { count: "exact" })
    .eq("status", "succeeded"))).gte("as_of_date", from).lte("as_of_date", to)
    .order("as_of_date", { ascending: false }).order("created_at", { ascending: false }).order("run_id"), readDeadline, 500, row => row.run_id);
  const issued = runRows.filter(row => Date.parse(row.created_at) <= now.getTime());
  const proof = issued.length ? await withinDeadline(readDeadline, () => loadExternalInputProof(db, issued.map(row => row.run_id))) : new Map();
  const latestByDate = new Map<string, Row>(), withheld: Row[] = [];
  for (const row of issued) {
    if (latestByDate.has(row.as_of_date)) continue;
    if (proof.has(row.run_id)) latestByDate.set(row.as_of_date, { ...row, external_input_proven: true, proof: runProofDiagnostics(row.run_id, proof.get(row.run_id)) });
    else withheld.push({ ...row, external_input_proven: false });
  }
  const runs = [...latestByDate.values()], runIds = runs.map(row => row.run_id);
  if (!runIds.length) return buildForgeDailyBridgeForecasts({ runs: withheld, skaters: [], goalies: [] }, players, games, now, seasonId, calendarPolicy);
  const previousSeason = String((Math.floor(seasonId / 10000) - 1) * 10001 + 1);
  const upcomingGameIds = [...new Set(games.filter(game => game.status === "scheduled" && game.startsAt && Date.parse(game.startsAt) > now.getTime())
    .map(game => Number(game.id)).filter(Number.isSafeInteger))].slice(0, 500);
  const windowEnd = games.map(game => game.date).sort().at(-1) ?? to;
  const scheduleFrom = new Date(Date.parse(`${from}T12:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
  const [skaters, goalies, seasonTotals, goalieNews, teamPriors, lastSeasonTeams, teamGames, positionAllowed, reserves] = await Promise.all([
    pages(() => db.from("forge_player_projections").select(SKATER_COLUMNS, { count: "exact" }).in("run_id", runIds).eq("horizon_games", 1)
      .order("run_id").order("game_id").order("player_id"), readDeadline, 15000, row => [row.run_id, row.game_id, row.player_id]),
    pages(() => db.from("forge_goalie_projections").select(GOALIE_COLUMNS, { count: "exact" }).in("run_id", runIds).eq("horizon_games", 1)
      .order("run_id").order("game_id").order("goalie_id"), readDeadline, 2000, row => [row.run_id, row.game_id, row.goalie_id]),
    // Optional inputs: a failed read keeps the projections and says so in the evidence.
    pages(() => db.from("wgo_skater_stats_totals").select("player_id,season,games_played,goals,gw_goals,penalty_minutes,plus_minus,sh_goals,sh_assists,sh_points,total_fow,total_fol", { count: "exact" })
      .in("season", [String(seasonId), previousSeason]).order("season").order("player_id"), readDeadline, 5000, row => [row.season, row.player_id]).catch(() => undefined),
    withinDeadline(readDeadline, () => loadDailyBoardEvidence(upcomingGameIds, now.toISOString(), db as never)).catch(() => undefined),
    // "*" keeps the read valid before and after migration 129 (which adds nst_season); the reader checks the field.
    pages(() => db.from("nhl_team_data").select("*", { count: "exact" })
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
    // Read only with the reserve pass on; a failed read leaves reserves without a line and says so.
    forgeReservePassEnabled() ? pages(() => db.from("forge_reserve_projections").select(RESERVE_COLUMNS, { count: "exact" }).in("run_id", runIds).eq("horizon_games", 1)
      .order("run_id").order("game_id").order("player_id"), readDeadline, 15000, row => [row.run_id, row.game_id, row.player_id]).catch(() => null) : Promise.resolve(undefined),
  ]);
  capture?.({ startedAt: captureStartedAt, completedAt: new Date().toISOString(), runs, skaters, goalies, reserves });
  return buildForgeDailyBridgeForecasts({ runs: [...runs, ...withheld], skaters, goalies, seasonTotals, goalieNews, teamPriors, lastSeasonTeams, teamGames, positionAllowed, reserves }, players, games, now, seasonId, calendarPolicy);
}
