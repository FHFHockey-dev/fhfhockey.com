import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  computeSkaterRestScheduleAdjustments,
  computeStrengthSplitConversionRates,
  resolveSkaterConversionRates,
} from "../lib/projections/calculators/skater-adjustments";
import { clamp } from "../lib/projections/utils/number-utils";

/**
 * Offline frozen-cohort backtest of Q7 (no second conversion shrink) and Q8 (B2B = 1 rest tiers).
 * Reads only local JSON exports (S1 runs, S2 projections, S3 actuals, S4 games); writes only --output.
 */
export type Head = "G" | "A" | "PPP";
export type Variant = "baseline" | "q7" | "q8" | "q7q8" | "a1" | "a2" | "a1a2" | "a3" | "a4" | "a4q7";
export type Line = Record<Head, number>;
export type SplitRates = { goalRateEs: number | null; goalRatePp: number | null; assistRateEs: number | null; assistRatePp: number | null };
export type UsedRates = { ges: number; gpp: number; aes: number; app: number };
type Json = Record<string, any>;
export const HEADS: Head[] = ["G", "A", "PPP"];
export type AssistDenominator = "per_goal" | "per_two_goals";
export type RateOptions = { q7Assist?: boolean; wideCoupling?: boolean; assistScale?: number; assistDenominator?: AssistDenominator };
/** q7 = no second shrink on goal AND assist rates; q7Assist = assist rates only; wideCoupling = outer teammate clamp [0.2, 3.0] / [0.3, 3.5];
 * assistScale multiplies the final assist rates (a3 = 2: proxy for the goals x 2 assist denominator convention);
 * assistDenominator "per_two_goals" reproduces stored rows, "per_goal" is the real refit (a4) with per-goal clamps. */
export const VARIANTS: ({ key: Variant; q7: boolean; q8: boolean } & Required<RateOptions>)[] = [
  { key: "baseline", q7: false, q8: false, q7Assist: false, wideCoupling: false, assistScale: 1, assistDenominator: "per_two_goals" },
  { key: "q7", q7: true, q8: false, q7Assist: false, wideCoupling: false, assistScale: 1, assistDenominator: "per_two_goals" },
  { key: "q8", q7: false, q8: true, q7Assist: false, wideCoupling: false, assistScale: 1, assistDenominator: "per_two_goals" },
  { key: "q7q8", q7: true, q8: true, q7Assist: false, wideCoupling: false, assistScale: 1, assistDenominator: "per_two_goals" },
  { key: "a1", q7: false, q8: false, q7Assist: true, wideCoupling: false, assistScale: 1, assistDenominator: "per_two_goals" },
  { key: "a2", q7: false, q8: false, q7Assist: false, wideCoupling: true, assistScale: 1, assistDenominator: "per_two_goals" },
  { key: "a1a2", q7: false, q8: false, q7Assist: true, wideCoupling: true, assistScale: 1, assistDenominator: "per_two_goals" },
  { key: "a3", q7: false, q8: false, q7Assist: false, wideCoupling: false, assistScale: 2, assistDenominator: "per_two_goals" },
  { key: "a4", q7: false, q8: false, q7Assist: true, wideCoupling: false, assistScale: 1, assistDenominator: "per_goal" },
  { key: "a4q7", q7: true, q8: false, q7Assist: true, wideCoupling: false, assistScale: 1, assistDenominator: "per_goal" },
];
const RATE_TOL = 5e-4, REST_TOL = 1.5e-4, RESIDUAL_TOL = 1e-3, MAX_BYTES = 64 * 1024 * 1024;

export const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || typeof v === "boolean" || !Number.isFinite(Number(v)) ? null : Number(v);
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const day = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : null);
const daysBetween = (later: string, earlier: string | null) =>
  earlier ? Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${day(earlier)}T12:00:00Z`)) / 86400000) : null;
export const isStamped = (sha: unknown) => typeof sha === "string" && sha.length > 0 && !sha.startsWith("local:");

/** S2 support_counts: {"ev.goalPerShot.all": [numerator, denominator], ...}; a null denominator means the pair is absent. */
export function bayesSplitRates(support: Json | null, goalRateMultiplier: number, assistRateMultiplier: number,
  assistDenominator: AssistDenominator = "per_two_goals"): SplitRates {
  const pair = (st: "ev" | "pp", pr: "goalPerShot" | "assistPerGoal") => {
    const all = support?.[`${st}.${pr}.all`], last5 = support?.[`${st}.${pr}.last5`];
    const den = num(all?.[1]);
    return den == null ? null : { all: { n: num(all?.[0]) ?? 0, d: den }, last5: { n: num(last5?.[0]) ?? 0, d: num(last5?.[1]) ?? 0 } };
  };
  const ev = { goalPerShot: pair("ev", "goalPerShot"), assistPerGoal: pair("ev", "assistPerGoal") };
  const pp = { goalPerShot: pair("pp", "goalPerShot"), assistPerGoal: pair("pp", "assistPerGoal") };
  // Mirrors computeSupportedStrengthSplitConversionRates: one call per pair with zero placeholders.
  const calculate = (name: "goalPerShot" | "assistPerGoal") => {
    const e = ev[name], p = pp[name], g = name === "goalPerShot";
    return computeStrengthSplitConversionRates({
      evGoalsRecent: g ? e?.last5.n ?? 0 : e?.last5.d ?? 0, evGoalsAll: g ? e?.all.n ?? 0 : e?.all.d ?? 0,
      evShotsRecent: g ? e?.last5.d ?? 0 : 0, evShotsAll: g ? e?.all.d ?? 0 : 0,
      evAssistsRecent: g ? 0 : e?.last5.n ?? 0, evAssistsAll: g ? 0 : e?.all.n ?? 0,
      ppGoalsRecent: g ? p?.last5.n ?? 0 : p?.last5.d ?? 0, ppGoalsAll: g ? p?.all.n ?? 0 : p?.all.d ?? 0,
      ppShotsRecent: g ? p?.last5.d ?? 0 : 0, ppShotsAll: g ? p?.all.d ?? 0 : 0,
      ppAssistsRecent: g ? 0 : p?.last5.n ?? 0, ppAssistsAll: g ? 0 : p?.all.n ?? 0,
      goalRateMultiplier, assistRateMultiplier, assistDenominator,
    });
  };
  const goals = calculate("goalPerShot"), assists = calculate("assistPerGoal");
  return {
    goalRateEs: ev.goalPerShot && ev.goalPerShot.all.d > 0 ? goals.goalRateEs : null,
    goalRatePp: pp.goalPerShot && pp.goalPerShot.all.d > 0 ? goals.goalRatePp : null,
    assistRateEs: ev.assistPerGoal && ev.assistPerGoal.all.d > 0 ? assists.assistRateEs : null,
    assistRatePp: pp.assistPerGoal && pp.assistPerGoal.all.d > 0 ? assists.assistRatePp : null,
  };
}

/**
 * Used rates as persisted: (Q7 Bayes value | legacy second shrink) x trend, then teammate coupling for assists.
 * `coupled` is the assist rate after coupling but before the outer clamp (for clamp-binding diagnostics).
 */
export function usedRates(split: SplitRates, sampleWeight: number, trend: { g: number; a: number },
  teammate: { es: number; pp: number }, q7: boolean, opts: RateOptions = {}): UsedRates & { coupled: { es: number; pp: number } } {
  const perGoal = opts.assistDenominator === "per_goal";
  const r = resolveSkaterConversionRates({ splitRates: split, sampleWeight, assistDenominator: perGoal ? "per_goal" : "per_two_goals" });
  // Per-goal clamps copied from skater-stage.ts (not imported: it reaches lib/supabase); old scale otherwise.
  const [esTrend, ppTrend] = perGoal ? [[0.4, 3.4], [0.6, 4.0]] : [[0.2, 1.7], [0.3, 2]];
  const pick = (on: boolean, value: number, key: keyof typeof r.conversionShrink) => (on ? value : r.conversionShrink[key].legacy);
  const assistOn = q7 || Boolean(opts.q7Assist);
  const coupled = {
    es: clamp(pick(assistOn, r.assistRateEs, "assist_es") * trend.a, esTrend[0], esTrend[1]) * teammate.es,
    pp: clamp(pick(assistOn, r.assistRatePp, "assist_pp") * trend.a, ppTrend[0], ppTrend[1]) * teammate.pp,
  };
  const [esMin, ppMin] = perGoal ? [0.4, 0.6] : [0.2, 0.3];
  const [esMax, ppMax] = perGoal ? [3.6, 4.2] : opts.wideCoupling ? [3.0, 3.5] : [1.8, 2.1];
  return {
    ges: clamp(pick(q7, r.goalRateEs, "goal_es") * trend.g, 0.025, 0.3),
    gpp: clamp(pick(q7, r.goalRatePp, "goal_pp") * trend.g, 0.04, 0.45),
    aes: clamp(coupled.es, esMin, esMax) * (opts.assistScale ?? 1), app: clamp(coupled.pp, ppMin, ppMax) * (opts.assistScale ?? 1), coupled,
  };
}

/** Season-bootstrap weights: organic weight p and total weight W (null bootstrap = organic only). */
export function bootstrapWeights(sb: Json | null) {
  if (!sb || num(sb.currentSeasonGames) == null) return { p: 1, W: 1, present: false };
  const p = Math.min(1, Math.max(0, num(sb.currentSeasonGames)!) / (num(sb.transitionGames) || 20));
  const W = p + ((num(sb.historyGames) ?? 0) > 0 ? num(sb.historyWeight) ?? 0 : 0)
    + (Array.isArray(sb.sourceIds) && sb.sourceIds.length > 0 ? num(sb.fantasyWeight) ?? 0 : 0);
  return W > 0 ? { p, W, present: true } : { p: 1, W: 1, present: false };
}

/**
 * final_K = (p*org_K + R_K)/W  =>  R_K = W*final_K - p*org_K;  final_K' = (p*org_K' + s_K*R_K)/W.
 * org_g' = base_g * rg'/rg ; org_a' = base_a * (rg'/rg) * (ra'/ra), per ES/PP.
 */
export function counterfactualHeads(args: { base: UsedRates; final: Line; weights: { p: number; W: number };
  rates: UsedRates; ratesPrime: UsedRates; restScale: Line; capPpp: boolean }) {
  const { base, final, rates: r, ratesPrime: q, weights: { p, W } } = args;
  const gEs = base.ges * q.ges / r.ges, gPp = base.gpp * q.gpp / r.gpp;
  const aEs = base.aes * (q.ges / r.ges) * (q.aes / r.aes), aPp = base.app * (q.gpp / r.gpp) * (q.app / r.app);
  const org: Line = { G: base.ges + base.gpp, A: base.aes + base.app, PPP: base.gpp + base.app };
  const orgPrime: Line = { G: gEs + gPp, A: aEs + aPp, PPP: gPp + aPp };
  const residual = {} as Line, pred = {} as Line;
  for (const k of HEADS) {
    residual[k] = W * final[k] - p * org[k];
    pred[k] = (p * orgPrime[k] + args.restScale[k] * residual[k]) / W;
  }
  if (args.capPpp) pred.PPP = Math.min(pred.PPP, pred.G + pred.A);
  return { pred, residual };
}

export type PreparedRow = { gameId: number; playerId: number; date: string; gitSha: string | null; stamped: boolean;
  teamRest: number | null; oppRest: number | null; heads: Head[]; actual: Line; preds: Record<Variant, Line>; decomp: AssistDecomp };
/** Baseline assist decomposition: final = (p*org + W*prior)/W, prior = (W*final - p*org)/W. */
export type AssistDecomp = { p: number; W: number; orgA: number; priorA: number; finalA: number; bindEs: boolean; bindPp: boolean };
export type Checks = Record<string, number>;
const bump = (checks: Checks, key: string) => { checks[key] = (checks[key] ?? 0) + 1; };

export function selectRuns(runs: Json[]) {
  const byDate = new Map<string, Json>();
  const rank = (r: Json) => [isStamped(r.git_sha) ? 1 : 0, Date.parse(r.created_at ?? "") || 0];
  for (const run of runs) {
    const date = day(run.as_of_date);
    if (!date || (run.horizon_games != null && String(run.horizon_games) !== "1")) continue;
    const prev = byDate.get(date);
    if (!prev) { byDate.set(date, run); continue; }
    const [a, b] = [rank(run), rank(prev)];
    if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) byDate.set(date, run);
  }
  return byDate;
}

/** One stored row -> four variants, after the self-checks. Returns a drop reason on failure. */
export function evaluateRow(raw: Json, isHome: boolean, checks: Checks):
  { heads: Head[]; preds: Record<Variant, Line>; decomp: AssistDecomp } | { drop: string } {
  if (raw.rollout_mode === "candidate") return { drop: "candidate_mode_not_modelled" };
  const cb = obj(raw.current_baseline), rest = obj(raw.rest_schedule), conv = obj(raw.conversion_rates);
  const sw = num(raw.sample_weight);
  if (!raw.current_baseline || !raw.rest_schedule || !raw.conversion_rates || sw == null) return { drop: "missing_inputs" };
  const teamRestDays = num(rest.team_rest_days), opponentRestDays = num(rest.opponent_rest_days);
  const legacyRest = computeSkaterRestScheduleAdjustments({ teamRestDays, opponentRestDays, isHome, buckets: "legacy" });
  const newRest = computeSkaterRestScheduleAdjustments({ teamRestDays, opponentRestDays, isHome });
  if (Math.abs(legacyRest.goalRateMultiplier - (num(rest.goal_rate_multiplier) ?? 1)) > REST_TOL
    || Math.abs(legacyRest.assistRateMultiplier - (num(rest.assist_rate_multiplier) ?? 1)) > REST_TOL) return { drop: "rest_multiplier_mismatch" };
  const onIce = obj(raw.on_ice), team = obj(raw.team_level), opp = obj(raw.opp_goalie), trendM = obj(raw.trend_mult), tm = obj(raw.teammate);
  const m = (v: unknown) => num(v) ?? 1;
  const goalCtx = m(raw.sq_goal) * m(onIce.goal_environment_multiplier) * m(team.goal_rate_multiplier) * m(opp.goal_rate_multiplier);
  const assistCtx = m(onIce.assist_environment_multiplier) * m(team.assist_rate_multiplier) * m(opp.assist_rate_multiplier);
  const trend = { g: m(trendM.goal_rate), a: m(trendM.assist_rate) }, teammate = { es: m(tm.assist_rate_es_multiplier), pp: m(tm.assist_rate_pp_multiplier) };
  const split = (restG: number, restA: number, denominator?: AssistDenominator) =>
    bayesSplitRates(raw.support_counts ?? null, goalCtx * restG, assistCtx * restA, denominator);
  const splitOld = split(legacyRest.goalRateMultiplier, legacyRest.assistRateMultiplier);
  const splitNew = split(newRest.goalRateMultiplier, newRest.assistRateMultiplier);
  const splitPerGoal = split(legacyRest.goalRateMultiplier, legacyRest.assistRateMultiplier, "per_goal");
  const rates = usedRates(splitOld, sw, trend, teammate, false);
  const stored = { ges: conv.goal_rate_es, gpp: conv.goal_rate_pp, aes: conv.assist_rate_es, app: conv.assist_rate_pp };
  const supported = { ges: splitOld.goalRateEs != null, gpp: splitOld.goalRatePp != null,
    aes: splitOld.goalRateEs != null && splitOld.assistRateEs != null, app: splitOld.goalRatePp != null && splitOld.assistRatePp != null };
  for (const k of ["ges", "gpp", "aes", "app"] as const) {
    if (supported[k] !== (num(stored[k]) != null)) return { drop: "mask_disagrees_with_support" };
    if (supported[k] && Math.abs(rates[k] - num(stored[k])!) > RATE_TOL) return { drop: "used_rate_mismatch" };
  }
  const col = { ges: num(raw.proj_goals_es), gpp: num(raw.proj_goals_pp), aes: num(raw.proj_assists_es), app: num(raw.proj_assists_pp) };
  const avail: Record<Head, boolean> = {
    G: supported.ges && supported.gpp && col.ges != null && col.gpp != null,
    A: supported.aes && supported.app && col.aes != null && col.app != null,
    PPP: supported.gpp && supported.app && col.gpp != null && col.app != null,
  };
  const base: UsedRates = { ges: num(cb.goals_es) ?? 0, gpp: num(cb.goals_pp) ?? 0, aes: num(cb.assists_es) ?? 0, app: num(cb.assists_pp) ?? 0 };
  const final: Line = { G: (col.ges ?? 0) + (col.gpp ?? 0), A: (col.aes ?? 0) + (col.app ?? 0), PPP: (col.gpp ?? 0) + (col.app ?? 0) };
  const weights = bootstrapWeights(raw.season_bootstrap ?? null);
  const ctx = (restG: number, restA: number) => m(team.goal_rate_multiplier) * m(opp.goal_rate_multiplier) * restG
    + m(team.assist_rate_multiplier) * m(opp.assist_rate_multiplier) * restA;
  const preds = {} as Record<Variant, Line>;
  const decomp: AssistDecomp = { p: weights.p, W: weights.W, orgA: base.aes + base.app, finalA: final.A,
    priorA: (weights.W * final.A - weights.p * (base.aes + base.app)) / weights.W,
    bindEs: rates.coupled.es > 1.8 || rates.coupled.es < 0.2, bindPp: rates.coupled.pp > 2.1 || rates.coupled.pp < 0.3 };
  for (const v of VARIANTS) {
    const restScale: Line = v.q8 ? {
      G: newRest.goalRateMultiplier / legacyRest.goalRateMultiplier, A: newRest.assistRateMultiplier / legacyRest.assistRateMultiplier,
      PPP: ctx(newRest.goalRateMultiplier, newRest.assistRateMultiplier) / ctx(legacyRest.goalRateMultiplier, legacyRest.assistRateMultiplier),
    } : { G: 1, A: 1, PPP: 1 };
    const ratesPrime = usedRates(v.q8 ? splitNew : v.assistDenominator === "per_goal" ? splitPerGoal : splitOld, sw, trend, teammate, v.q7, v);
    const out = counterfactualHeads({ base, final, weights, rates, ratesPrime, restScale, capPpp: avail.G && avail.A });
    preds[v.key] = out.pred;
    if (v.key !== "baseline") continue;
    for (const k of HEADS) {
      if (!avail[k]) continue;
      if (weights.present && out.residual[k] < -RESIDUAL_TOL) { avail[k] = false; bump(checks, `negative_residual_${k}`); }
      if (!weights.present && Math.abs(out.residual[k]) > RESIDUAL_TOL) bump(checks, `unbootstrapped_final_ne_organic_${k}`);
    }
  }
  for (const k of HEADS) if (!avail[k]) bump(checks, `head_withheld_${k}`);
  return { heads: HEADS.filter((k) => avail[k]), preds, decomp };
}

export function prepareRows(input: { runs: Json[]; projections: Json[]; actuals: Json[]; games: Json[] }) {
  const checks: Checks = { projection_rows: input.projections.length, drop_used_rate_mismatch: 0,
    drop_rest_multiplier_mismatch: 0, drop_mask_disagrees_with_support: 0, negative_residual_G: 0, negative_residual_A: 0, negative_residual_PPP: 0 };
  const selected = selectRuns(input.runs);
  const games = new Map(input.games.map((g) => [Number(g.id), g]));
  const actuals = new Map(input.actuals.map((a) => [`${a.game_id}:${a.player_id}`, a]));
  const rows: PreparedRow[] = [];
  for (const raw of input.projections) {
    const date = day(raw.as_of_date)!, run = selected.get(date);
    if (!run || run.run_id !== raw.run_id) { bump(checks, "drop_not_selected_run"); continue; }
    const game = games.get(Number(raw.game_id));
    if (!game) { bump(checks, "drop_missing_game"); continue; }
    if (day(game.date) !== date) { bump(checks, "drop_game_date_ne_as_of_date"); continue; }
    const teamId = Number(raw.team_id), home = Number(game.homeTeamId), away = Number(game.awayTeamId);
    if (teamId !== home && teamId !== away) { bump(checks, "drop_team_not_in_game"); continue; }
    const isHome = teamId === home;
    const actual = actuals.get(`${raw.game_id}:${raw.player_id}`);
    if (!actual || (actual.date != null && day(actual.date) !== date)) { bump(checks, "drop_no_actual"); continue; }
    const result = evaluateRow(raw, isHome, checks);
    if ("drop" in result) { bump(checks, `drop_${result.drop}`); continue; }
    const rest = obj(raw.rest_schedule), teamRest = num(rest.team_rest_days), oppRest = num(rest.opponent_rest_days);
    const gTeam = daysBetween(date, isHome ? game.home_prev_date : game.away_prev_date);
    const gOpp = daysBetween(date, isHome ? game.away_prev_date : game.home_prev_date);
    if (gTeam !== teamRest) bump(checks, "info_team_rest_ne_games_derived");
    if (gOpp !== oppRest) bump(checks, "info_opponent_rest_ne_games_derived");
    const storedHome = obj(rest.rest).is_home;
    if (typeof storedHome === "boolean" && storedHome !== isHome) bump(checks, "info_is_home_ne_games");
    rows.push({ gameId: Number(raw.game_id), playerId: Number(raw.player_id), date, gitSha: run.git_sha ?? null,
      stamped: isStamped(run.git_sha), teamRest, oppRest, heads: result.heads, preds: result.preds, decomp: result.decomp,
      actual: { G: num(actual.goals) ?? 0, A: num(actual.assists) ?? 0, PPP: num(actual.pp_points) ?? 0 } });
  }
  checks.rows_used = rows.length;
  return { rows, checks, selected };
}

export function summarize(rows: PreparedRow[], variant: Variant, head: Head) {
  const use = rows.filter((r) => r.heads.includes(head));
  const err = use.map((r) => r.preds[variant][head] - r.actual[head]);
  const n = use.length, sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return { n, mae: n ? sum(err.map(Math.abs)) / n : NaN, bias: n ? sum(err) / n : NaN, rmse: n ? Math.sqrt(sum(err.map((e) => e * e)) / n) : NaN,
    sumPred: sum(use.map((r) => r.preds[variant][head])), sumActual: sum(use.map((r) => r.actual[head])) };
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Paired cluster bootstrap by game_id: same resampled games for every variant/head under a seed. */
export function clusterBootstrap(rows: PreparedRow[], variant: Variant, head: Head, seed: number, reps = 2000) {
  type Cluster = { n: number; dAbs: number; dErr: number; sse0: number; sse1: number };
  const clusters = new Map<number, Cluster>();
  for (const r of rows) {
    if (!r.heads.includes(head)) continue;
    const c = clusters.get(r.gameId) ?? { n: 0, dAbs: 0, dErr: 0, sse0: 0, sse1: 0 };
    const e1 = r.preds[variant][head] - r.actual[head], e0 = r.preds.baseline[head] - r.actual[head];
    c.n += 1; c.dAbs += Math.abs(e1) - Math.abs(e0); c.dErr += e1 - e0; c.sse0 += e0 * e0; c.sse1 += e1 * e1;
    clusters.set(r.gameId, c);
  }
  const list = [...clusters.keys()].sort((a, b) => a - b).map((k) => clusters.get(k)!);
  const add = (a: Cluster, c: Cluster): Cluster => ({ n: a.n + c.n, dAbs: a.dAbs + c.dAbs, dErr: a.dErr + c.dErr, sse0: a.sse0 + c.sse0, sse1: a.sse1 + c.sse1 });
  const empty: Cluster = { n: 0, dAbs: 0, dErr: 0, sse0: 0, sse1: 0 };
  const dRmse = (t: Cluster) => Math.sqrt(t.sse1 / t.n) - Math.sqrt(t.sse0 / t.n);
  const total = list.reduce(add, empty);
  const rand = mulberry32(seed), mae: number[] = [], bias: number[] = [], rmse: number[] = [];
  for (let i = 0; i < reps && list.length; i++) {
    let t = empty;
    for (let j = 0; j < list.length; j++) t = add(t, list[Math.floor(rand() * list.length)]);
    if (t.n) { mae.push(t.dAbs / t.n); bias.push(t.dErr / t.n); rmse.push(dRmse(t)); }
  }
  const ci = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b);
    return s.length ? [s[Math.floor(0.025 * (s.length - 1))], s[Math.ceil(0.975 * (s.length - 1))]] : [NaN, NaN]; };
  return { clusters: list.length, dMae: total.n ? total.dAbs / total.n : NaN, dMaeCi: ci(mae),
    dBias: total.n ? total.dErr / total.n : NaN, dBiasCi: ci(bias), dRmse: total.n ? dRmse(total) : NaN, dRmseCi: ci(rmse) };
}

export function topDecile(rows: PreparedRow[], variant: Variant) {
  const g = rows.filter((r) => r.heads.includes("G")).sort((a, b) => b.preds[variant].G - a.preds[variant].G || a.playerId - b.playerId);
  return g.slice(0, Math.ceil(g.length / 10));
}

const f = (x: number, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const signed = (x: number, d = 4) => (Number.isFinite(x) ? `${x >= 0 ? "+" : ""}${x.toFixed(d)}` : "n/a");

function metricsTable(rows: PreparedRow[], seed: number, reps: number) {
  const out = ["| variant | head | n | MAE | bias | RMSE | ΔMAE [95% CI] | Δbias [95% CI] | ΔRMSE [95% CI] |", "|---|---|---|---|---|---|---|---|---|"];
  const delta = (d: number, ci: number[]) => `${signed(d)} [${signed(ci[0])}, ${signed(ci[1])}]`;
  for (const head of HEADS) for (const v of VARIANTS) {
    const s = summarize(rows, v.key, head);
    const b = v.key === "baseline" ? null : clusterBootstrap(rows, v.key, head, seed, reps);
    out.push(`| ${v.key} | ${head} | ${s.n} | ${f(s.mae)} | ${signed(s.bias)} | ${f(s.rmse)} | ${b ? delta(b.dMae, b.dMaeCi) : "—"} | ${
      b ? delta(b.dBias, b.dBiasCi) : "—"} | ${b ? delta(b.dRmse, b.dRmseCi) : "—"} |`);
  }
  return out.join("\n");
}

function decileTable(rows: PreparedRow[]) {
  const fixed = topDecile(rows, "baseline");
  const out = ["| variant | head | bin | n | Σactual/Σpred | mean pred | mean actual |", "|---|---|---|---|---|---|---|"];
  for (const v of VARIANTS) {
    for (const head of HEADS) {
      const s = summarize(fixed, v.key, head);
      out.push(`| ${v.key} | ${head} | baseline-G top decile | ${s.n} | ${f(s.sumActual / s.sumPred, 3)} | ${f(s.sumPred / s.n)} | ${f(s.sumActual / s.n)} |`);
    }
    const own = summarize(topDecile(rows, v.key), v.key, "G");
    out.push(`| ${v.key} | G | own top decile | ${own.n} | ${f(own.sumActual / own.sumPred, 3)} | ${f(own.sumPred / own.n)} | ${f(own.sumActual / own.n)} |`);
  }
  return out.join("\n");
}

function assistDecompositionSection(rows: PreparedRow[]) {
  const withA = rows.filter((r) => r.heads.includes("A"));
  const top = new Set(topDecile(rows, "baseline"));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const line = (label: string, set: PreparedRow[]) => `| ${label} | ${set.length} | ${f(mean(set.map((r) => r.decomp.orgA)))} | ${
    f(mean(set.map((r) => r.decomp.p)))} | ${f(mean(set.map((r) => r.decomp.priorA)))} | ${f(mean(set.map((r) => r.decomp.finalA)))} | ${
    f(mean(set.map((r) => r.actual.A)))} |`;
  const share = (k: "bindEs" | "bindPp") => `${withA.filter((r) => r.decomp[k]).length}/${withA.length} (${f(100 * mean(withA.map((r) => (r.decomp[k] ? 1 : 0))), 1)}%)`;
  return ["Rows with head A available. final A = (p·org + W·prior)/W; prior part = (W·final − p·org)/W.", "",
    "| subset | n | mean organic A | mean p | mean prior part | mean final A | mean actual A |", "|---|---|---|---|---|---|---|",
    line("all", withA), line("baseline top decile by predicted G", withA.filter((r) => top.has(r))), "",
    `Outer coupling clamp binding in baseline: ES ${share("bindEs")}, PP ${share("bindPp")}.`, "",
    `Mean A under a3 / a4: ${f(mean(withA.map((r) => r.preds.a3.A)))} / ${f(mean(withA.map((r) => r.preds.a4.A)))} (baseline ${
      f(mean(withA.map((r) => r.preds.baseline.A)))}).`].join("\n");
}

export function renderReport(args: { rows: PreparedRow[]; checks: Checks; selected: Map<string, Json>;
  inputs: { name: string; path: string; sha256: string }[]; seed: number; reps: number }) {
  const { rows, seed, reps } = args;
  const slices: [string, PreparedRow[]][] = [
    ["B2B team (stored team_rest_days = 1)", rows.filter((r) => r.teamRest === 1)],
    ["B2B opponent (stored opponent_rest_days = 1)", rows.filter((r) => r.oppRest === 1)],
    ["Stratum: stamped git_sha", rows.filter((r) => r.stamped)],
    ["Stratum: null/local git_sha", rows.filter((r) => !r.stamped)],
  ];
  return [
    "# FORGE counterfactual backtest (Q7 conversion shrink, Q8 rest buckets)", "",
    `Seed ${seed}, ${reps} paired cluster-bootstrap reps by game_id; Δ is variant minus baseline (negative ΔMAE = better).`,
    "Baseline reproduces stored predictions; Q7 drops the second sample-weight shrink; Q8 uses B2B = 1 rest tiers (organic rates and season-bootstrap prior context).",
    "Organic shots/TOI are held fixed under Q8 (team reconciliation cancels uniform rest multipliers); candidate-mode rows are not modelled.",
    "Assist-only variants: a1 drops the second shrink on assist rates only; a2 widens the outer teammate-coupling clamp to [0.2, 3.0] ES / [0.3, 3.5] PP; a1a2 both; a3 doubles the final assist rates (proxy for the goals x 2 assist denominator). a4 is the real per-goal assist refit (Bayes value, per-goal clamps); a4q7 adds the Q7 goal path. Goals are unchanged under a1/a2/a3/a4.", "",
    "## Inputs", "", "| input | path | sha256 |", "|---|---|---|",
    ...args.inputs.map((i) => `| ${i.name} | ${i.path} | ${i.sha256} |`), "",
    "## Selected runs", "", "| as_of_date | run_id | git_sha |", "|---|---|---|",
    ...[...args.selected.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, r]) => `| ${d} | ${r.run_id} | ${r.git_sha ?? "null"} |`), "",
    "## Check counts", "", "| check | count |", "|---|---|",
    ...Object.entries(args.checks).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `| ${k} | ${v} |`), "",
    `Games (clusters): ${new Set(rows.map((r) => r.gameId)).size}`, "",
    "## All rows", "", metricsTable(rows, seed, reps), "",
    "## Top decile by predicted G", "", decileTable(rows), "",
    "## Assists decomposition (baseline)", "", assistDecompositionSection(rows), "",
    ...slices.flatMap(([title, slice]) => [`## ${title}`, "", slice.length ? metricsTable(slice, seed, reps) : "_no rows_", ""]),
  ].join("\n");
}

function localJson(name: string, path: string) {
  if (statSync(path).size > MAX_BYTES) throw new Error(`${name} exceeds 64 MiB`);
  const bytes = readFileSync(path);
  const value = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(value)) throw new Error(`${name} must be a JSON array of rows`);
  return { name, path, sha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"), value: value as Json[] };
}

const USAGE = "Use --runs FILE --projections FILE --actuals FILE --games FILE --output NEW_FILE [--seed N] [--reps N]";
export function runCounterfactualBacktest(argv: string[]) {
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--runs", "--projections", "--actuals", "--games", "--output", "--seed", "--reps"].includes(argv[i]) || !argv[i + 1] || opts.has(argv[i])) throw new Error(USAGE);
    opts.set(argv[i], argv[i + 1]);
  }
  for (const k of ["--runs", "--projections", "--actuals", "--games", "--output"]) if (!opts.has(k)) throw new Error(USAGE);
  const seed = Number(opts.get("--seed") ?? 1), reps = Number(opts.get("--reps") ?? 2000);
  if (!Number.isInteger(seed) || !Number.isInteger(reps) || reps < 1) throw new Error(USAGE);
  const [runs, projections, actuals, games] = (["runs", "projections", "actuals", "games"] as const)
    .map((k) => localJson(k, resolve(opts.get(`--${k}`)!)));
  const prepared = prepareRows({ runs: runs.value, projections: projections.value, actuals: actuals.value, games: games.value });
  const report = renderReport({ ...prepared, seed, reps, inputs: [runs, projections, actuals, games] });
  // A new output is required so prior reports are never overwritten.
  writeFileSync(resolve(opts.get("--output")!), report + "\n", { flag: "wx" });
  return { report, checks: prepared.checks, rows: prepared.rows };
}

if (require.main === module) {
  try {
    const { checks } = runCounterfactualBacktest(process.argv.slice(2));
    console.log(JSON.stringify(checks));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
