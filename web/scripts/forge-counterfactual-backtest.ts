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
export type Variant = "baseline" | "q7" | "q8" | "q7q8" | "a1" | "a2" | "a1a2" | "a3" | "a4" | "a4q7" | "a5";
export type Line = Record<Head, number>;
export type SplitRates = { goalRateEs: number | null; goalRatePp: number | null; assistRateEs: number | null; assistRatePp: number | null };
export type UsedRates = { ges: number; gpp: number; aes: number; app: number };
type Json = Record<string, any>;
export const HEADS: Head[] = ["G", "A", "PPP"];
export type AssistScale = "per_goal" | "per_two_goals";
/** Mirrors SkaterAssistDenominatorOption; always passed explicitly (the calculators' omitted default is mixed). */
export type AssistDenominator = AssistScale | { es: AssistScale; pp: AssistScale };
export type RateOptions = { q7Assist?: boolean; wideCoupling?: boolean; assistScale?: number; assistDenominator?: AssistDenominator };
/** q7 = no second shrink on goal AND assist rates; q7Assist = assist rates only; wideCoupling = outer teammate clamp [0.2, 3.0] / [0.3, 3.5];
 * assistScale multiplies the final assist rates (a3 = 2: proxy for the goals x 2 assist denominator convention);
 * assistDenominator "per_two_goals" reproduces stored rows, "per_goal" is the real refit (a4) with per-goal clamps;
 * { es, pp } mixes scales per strength (a5 = per-goal ES, old-scale PP), with each strength's clamps following its scale. */
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
  { key: "a5", q7: false, q8: false, q7Assist: true, wideCoupling: false, assistScale: 1, assistDenominator: { es: "per_goal", pp: "per_two_goals" } },
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
  const den = opts.assistDenominator ?? "per_two_goals";
  const esPerGoal = (typeof den === "string" ? den : den.es) === "per_goal", ppPerGoal = (typeof den === "string" ? den : den.pp) === "per_goal";
  const r = resolveSkaterConversionRates({ splitRates: split, sampleWeight, assistDenominator: den });
  // Per-goal clamps copied from skater-stage.ts (not imported: it reaches lib/supabase); old scale otherwise.
  const esTrend = esPerGoal ? [0.4, 3.4] : [0.2, 1.7], ppTrend = ppPerGoal ? [0.6, 4.0] : [0.3, 2];
  const pick = (on: boolean, value: number, key: keyof typeof r.conversionShrink) => (on ? value : r.conversionShrink[key].legacy);
  const assistOn = q7 || Boolean(opts.q7Assist);
  const coupled = {
    es: clamp(pick(assistOn, r.assistRateEs, "assist_es") * trend.a, esTrend[0], esTrend[1]) * teammate.es,
    pp: clamp(pick(assistOn, r.assistRatePp, "assist_pp") * trend.a, ppTrend[0], ppTrend[1]) * teammate.pp,
  };
  const esMin = esPerGoal ? 0.4 : 0.2, ppMin = ppPerGoal ? 0.6 : 0.3;
  const esMax = esPerGoal ? 3.6 : opts.wideCoupling ? 3.0 : 1.8, ppMax = ppPerGoal ? 4.2 : opts.wideCoupling ? 3.5 : 2.1;
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
  return { pred, residual, organicA: { es: aEs, pp: aPp } };
}

export type PreparedRow = { gameId: number; playerId: number; date: string; gitSha: string | null; stamped: boolean;
  teamRest: number | null; oppRest: number | null; heads: Head[]; actual: Line; preds: Record<Variant, Line>; decomp: AssistDecomp;
  /** Counterfactual organic (pre-bootstrap) assists per strength, per variant. */
  organicA: Record<Variant, { es: number; pp: number }>;
  /** Stored columns and the PP-per-goal assist delta, used by the optional PP-usage counterfactual. */
  ppBase?: PpBase; ppPreds?: Record<PpVariant, Line>; pp?: { teamId: number; heads: PpHead[]; actual: PpLine; preds: Record<"baseline" | PpVariant, PpLine> } };
export type PpBase = { runId: string; teamId: number; gEs: number | null; gPp: number | null; aEs: number | null; aPp: number | null;
  sPp: number | null; ppAssistDelta: number };
/** Rows scored by summarize / clusterBootstrap: any head and variant names. */
export type ScoredRow = { gameId: number; playerId: number; heads: readonly string[]; actual: Record<string, number>;
  preds: Record<string, Record<string, number>> };
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
  { heads: Head[]; preds: Record<Variant, Line>; decomp: AssistDecomp; organicA: PreparedRow["organicA"]; ppAssistDelta: number } | { drop: string } {
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
  const preds = {} as Record<Variant, Line>, organicA = {} as PreparedRow["organicA"];
  const decomp: AssistDecomp = { p: weights.p, W: weights.W, orgA: base.aes + base.app, finalA: final.A,
    priorA: (weights.W * final.A - weights.p * (base.aes + base.app)) / weights.W,
    bindEs: rates.coupled.es > 1.8 || rates.coupled.es < 0.2, bindPp: rates.coupled.pp > 2.1 || rates.coupled.pp < 0.3 };
  for (const v of VARIANTS) {
    const restScale: Line = v.q8 ? {
      G: newRest.goalRateMultiplier / legacyRest.goalRateMultiplier, A: newRest.assistRateMultiplier / legacyRest.assistRateMultiplier,
      PPP: ctx(newRest.goalRateMultiplier, newRest.assistRateMultiplier) / ctx(legacyRest.goalRateMultiplier, legacyRest.assistRateMultiplier),
    } : { G: 1, A: 1, PPP: 1 };
    const ratesPrime = usedRates(v.q8 ? splitNew : v.assistDenominator === "per_two_goals" ? splitOld
      : split(legacyRest.goalRateMultiplier, legacyRest.assistRateMultiplier, v.assistDenominator), sw, trend, teammate, v.q7, v);
    const out = counterfactualHeads({ base, final, weights, rates, ratesPrime, restScale, capPpp: avail.G && avail.A });
    preds[v.key] = out.pred; organicA[v.key] = out.organicA;
    if (v.key !== "baseline") continue;
    for (const k of HEADS) {
      if (!avail[k]) continue;
      if (weights.present && out.residual[k] < -RESIDUAL_TOL) { avail[k] = false; bump(checks, `negative_residual_${k}`); }
      if (!weights.present && Math.abs(out.residual[k]) > RESIDUAL_TOL) bump(checks, `unbootstrapped_final_ne_organic_${k}`);
    }
  }
  for (const k of HEADS) if (!avail[k]) bump(checks, `head_withheld_${k}`);
  // pp2: the PP half of the per-goal assist refit (legacy shrink kept), as a change in final A (= final PP assists).
  const ppDen: AssistDenominator = { es: "per_two_goals", pp: "per_goal" };
  const ppOut = counterfactualHeads({ base, final, weights, rates, restScale: { G: 1, A: 1, PPP: 1 }, capPpp: false,
    ratesPrime: usedRates(split(legacyRest.goalRateMultiplier, legacyRest.assistRateMultiplier, ppDen), sw, trend, teammate, false, { assistDenominator: ppDen }) });
  return { heads: HEADS.filter((k) => avail[k]), preds, decomp, organicA, ppAssistDelta: ppOut.pred.A - preds.baseline.A };
}

export function prepareRows(input: { runs: Json[]; projections: Json[]; actuals: Json[]; games: Json[]; pp?: PpInputs }) {
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
      stamped: isStamped(run.git_sha), teamRest, oppRest, heads: result.heads, preds: result.preds, decomp: result.decomp, organicA: result.organicA,
      actual: { G: num(actual.goals) ?? 0, A: num(actual.assists) ?? 0, PPP: num(actual.pp_points) ?? 0 },
      ppBase: { runId: String(raw.run_id), teamId, gEs: num(raw.proj_goals_es), gPp: num(raw.proj_goals_pp), aEs: num(raw.proj_assists_es),
        aPp: num(raw.proj_assists_pp), sPp: num(raw.proj_shots_pp), ppAssistDelta: result.ppAssistDelta } });
  }
  checks.rows_used = rows.length;
  const ppReport = input.pp ? applyPpUsage(rows, input.projections, input.pp, checks) : null;
  return { rows, checks, selected, ppReport };
}

export function summarize(rows: readonly ScoredRow[], variant: string, head: string) {
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
export function clusterBootstrap(rows: readonly ScoredRow[], variant: string, head: string, seed: number, reps = 2000) {
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

export function topDecile<T extends ScoredRow>(rows: T[], variant: string): T[] {
  const g = rows.filter((r) => r.heads.includes("G")).sort((a, b) => b.preds[variant].G - a.preds[variant].G || a.playerId - b.playerId);
  return g.slice(0, Math.ceil(g.length / 10));
}

const f = (x: number, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const signed = (x: number, d = 4) => (Number.isFinite(x) ? `${x >= 0 ? "+" : ""}${x.toFixed(d)}` : "n/a");

function metricsTable(rows: readonly ScoredRow[], seed: number, reps: number, variants: readonly string[], heads: readonly string[] = HEADS) {
  const out = ["| variant | head | n | MAE | bias | RMSE | ΔMAE [95% CI] | Δbias [95% CI] | ΔRMSE [95% CI] |", "|---|---|---|---|---|---|---|---|---|"];
  const delta = (d: number, ci: number[]) => `${signed(d)} [${signed(ci[0])}, ${signed(ci[1])}]`;
  for (const head of heads) for (const v of variants) {
    const s = summarize(rows, v, head);
    const b = v === "baseline" ? null : clusterBootstrap(rows, v, head, seed, reps);
    out.push(`| ${v} | ${head} | ${s.n} | ${f(s.mae)} | ${signed(s.bias)} | ${f(s.rmse)} | ${b ? delta(b.dMae, b.dMaeCi) : "—"} | ${
      b ? delta(b.dBias, b.dBiasCi) : "—"} | ${b ? delta(b.dRmse, b.dRmseCi) : "—"} |`);
  }
  return out.join("\n");
}

const calibrationRow = (rows: readonly ScoredRow[], v: string, head: string, bin: string) => {
  const s = summarize(rows, v, head);
  return `| ${v} | ${head} | ${bin} | ${s.n} | ${f(s.sumActual / s.sumPred, 3)} | ${f(s.sumPred / s.n)} | ${f(s.sumActual / s.n)} |`;
};
const CALIBRATION_HEADER = ["| variant | head | bin | n | Σactual/Σpred | mean pred | mean actual |", "|---|---|---|---|---|---|---|"];

function decileTable(rows: ScoredRow[], variants: readonly string[]) {
  const fixed = topDecile(rows, "baseline");
  const out = [...CALIBRATION_HEADER];
  for (const v of variants) {
    for (const head of HEADS) {
      const s = summarize(fixed, v, head);
      out.push(`| ${v} | ${head} | baseline-G top decile | ${s.n} | ${f(s.sumActual / s.sumPred, 3)} | ${f(s.sumPred / s.n)} | ${f(s.sumActual / s.n)} |`);
    }
    const own = summarize(topDecile(rows, v), v, "G");
    out.push(`| ${v} | G | own top decile | ${own.n} | ${f(own.sumActual / own.sumPred, 3)} | ${f(own.sumPred / own.n)} | ${f(own.sumActual / own.n)} |`);
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
    `Mean A under a3 / a4 / a5: ${f(mean(withA.map((r) => r.preds.a3.A)))} / ${f(mean(withA.map((r) => r.preds.a4.A)))} / ${
      f(mean(withA.map((r) => r.preds.a5.A)))} (baseline ${
      f(mean(withA.map((r) => r.preds.baseline.A)))}).`].join("\n");
}

export function renderReport(args: { rows: PreparedRow[]; checks: Checks; selected: Map<string, Json>;
  inputs: { name: string; path: string; sha256: string }[]; seed: number; reps: number; ppReport?: PpReport | null }) {
  const { rows, seed, reps, ppReport } = args;
  // With PP inputs, pp1/pp2 join every G/A/PPP table (rows without a PP counterfactual keep baseline values).
  const variants: string[] = [...VARIANTS.map((v) => v.key), ...(ppReport ? PP_VARIANTS : [])];
  const view = rows.map((r) => (ppReport ? { ...r, preds: { ...r.preds, ...(r.ppPreds ?? { pp1: r.preds.baseline, pp2: r.preds.baseline }) } } : r));
  const slices: [string, ScoredRow[]][] = [
    ["B2B team (stored team_rest_days = 1)", view.filter((r) => r.teamRest === 1)],
    ["B2B opponent (stored opponent_rest_days = 1)", view.filter((r) => r.oppRest === 1)],
    ["Stratum: stamped git_sha", view.filter((r) => r.stamped)],
    ["Stratum: null/local git_sha", view.filter((r) => !r.stamped)],
  ];
  return [
    "# FORGE counterfactual backtest (Q7 conversion shrink, Q8 rest buckets)", "",
    ...(ppReport ? ["pp1 = official PP targets in stage (target = mean of the team's last 10 regular-season summed official PP TOI; split by each player's mean official PP TOI over those games in which he has a row, else stored share x old target; PP shots/goals/assists scale with PP TOI; ES unchanged); pp2 = pp1 + PP assists on the per-goal scale.",
      "The stage's target additionally divides by summed official all-situation TOI and multiplies by the team's skater-second target; the harness uses the summed PP TOI directly (approximately equivalent).", ""] : []),
    `Seed ${seed}, ${reps} paired cluster-bootstrap reps by game_id; Δ is variant minus baseline (negative ΔMAE = better).`,
    "Baseline reproduces stored predictions; Q7 drops the second sample-weight shrink; Q8 uses B2B = 1 rest tiers (organic rates and season-bootstrap prior context).",
    "Organic shots/TOI are held fixed under Q8 (team reconciliation cancels uniform rest multipliers); candidate-mode rows are not modelled.",
    "Assist-only variants: a1 drops the second shrink on assist rates only; a2 widens the outer teammate-coupling clamp to [0.2, 3.0] ES / [0.3, 3.5] PP; a1a2 both; a3 doubles the final assist rates (proxy for the goals x 2 assist denominator). a4 is the real per-goal assist refit (Bayes value, per-goal clamps); a4q7 adds the Q7 goal path; a5 refits ES assists per goal and keeps PP on the old scale. Goals are unchanged under a1/a2/a3/a4.", "",
    "## Inputs", "", "| input | path | sha256 |", "|---|---|---|",
    ...args.inputs.map((i) => `| ${i.name} | ${i.path} | ${i.sha256} |`), "",
    "## Selected runs", "", "| as_of_date | run_id | git_sha |", "|---|---|---|",
    ...[...args.selected.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, r]) => `| ${d} | ${r.run_id} | ${r.git_sha ?? "null"} |`), "",
    "## Check counts", "", "| check | count |", "|---|---|",
    ...Object.entries(args.checks).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `| ${k} | ${v} |`), "",
    `Games (clusters): ${new Set(rows.map((r) => r.gameId)).size}`, "",
    "## All rows", "", metricsTable(view, seed, reps, variants), "",
    "## Top decile by predicted G", "", decileTable(view, variants), "",
    "## Assists decomposition (baseline)", "", assistDecompositionSection(rows), "",
    ...(ppReport ? [ppSection(rows, view, ppReport, seed, reps), ""] : []),
    ...slices.flatMap(([title, slice]) => [`## ${title}`, "", slice.length ? metricsTable(slice, seed, reps, variants) : "_no rows_", ""]),
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------
// PP-usage counterfactual ("official PP targets in stage"), enabled by the four optional PP inputs.
export type PpHead = "PP_TOI" | "PP_SHOTS" | "PP_GOALS" | "PP_ASSISTS";
export type PpVariant = "pp1" | "pp2";
export type PpLine = Record<PpHead, number>;
export type PpInputs = { ppActuals: Json[]; ppUsage: Json[]; wgoPp: Json[]; teamStrength: Json[] };
export const PP_HEADS: PpHead[] = ["PP_TOI", "PP_SHOTS", "PP_GOALS", "PP_ASSISTS"];
export const PP_VARIANTS: PpVariant[] = ["pp1", "pp2"];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** New team target split by official PP TOI per game; players without official history keep share x old target. */
export function allocatePpToi(players: { playerId: number; weight: number | null; fallbackSeconds: number }[], target: number) {
  const totalW = players.reduce((sum, p) => sum + (p.weight ?? 0), 0);
  const fixed = players.filter((p) => p.weight == null || totalW <= 0);
  const out = new Map(fixed.map((p) => [p.playerId, p.fallbackSeconds]));
  const rest = Math.max(0, target - fixed.reduce((sum, p) => sum + p.fallbackSeconds, 0));
  if (totalW > 0) for (const p of players) if (p.weight != null) out.set(p.playerId, (rest * p.weight) / totalW);
  return out;
}

/** PP shots keep shots per PP second and PP goals/assists keep conversion per shot; zero old TOI uses group rates. */
export function scalePpLine(old: PpLine, newToi: number, groupRate: { shotsPerSecond: number; goalsPerShot: number; assistsPerShot: number }): PpLine {
  if (old.PP_TOI > 0) {
    const k = newToi / old.PP_TOI;
    return { PP_TOI: newToi, PP_SHOTS: old.PP_SHOTS * k, PP_GOALS: old.PP_GOALS * k, PP_ASSISTS: old.PP_ASSISTS * k };
  }
  const shots = newToi * groupRate.shotsPerSecond;
  return { PP_TOI: newToi, PP_SHOTS: shots, PP_GOALS: shots * groupRate.goalsPerShot, PP_ASSISTS: shots * groupRate.assistsPerShot };
}

/**
 * Official per-player PP TOI (S7), regular season only. Team target = mean over the team's last 10 regular-season games
 * of the summed per-player PP TOI; player weight = his mean PP TOI over those same games in which he has a row.
 */
export function buildOfficialPp(wgoPp: Json[], teamStrength: Json[], playerTeam: Map<number, number>) {
  const gameType = new Map(teamStrength.map((r) => [Number(r.game_id), num(r.game_type)]));
  const regular = (gameId: number) => (gameType.has(gameId) ? gameType.get(gameId) === 2 : String(gameId).slice(4, 6) === "02");
  const teamGames = new Map<string, { teamId: number; gameId: number; date: string; sum: number }>();
  const players = new Map<number, Map<number, number>>();
  let unmappedRows = 0;
  for (const r of wgoPp) {
    const playerId = Number(r.player_id), gameId = Number(r.game_id), date = day(r.date), toi = num(r.pp_toi);
    if (!date || toi == null || !regular(gameId)) continue;
    players.set(playerId, (players.get(playerId) ?? new Map()).set(gameId, toi));
    const teamId = playerTeam.get(playerId);
    if (teamId == null) { unmappedRows += 1; continue; }
    const tg = teamGames.get(`${teamId}:${gameId}`) ?? { teamId, gameId, date, sum: 0 };
    tg.sum += toi; teamGames.set(`${teamId}:${gameId}`, tg);
  }
  const ordered = [...teamGames.values()].sort((a, b) => a.date.localeCompare(b.date) || a.gameId - b.gameId);
  const lastTen = (teamId: number, date: string) => ordered.filter((g) => g.teamId === teamId && g.date < date).slice(-10);
  return { unmappedRows, teamGames,
    teamTarget: (teamId: number, date: string) => {
      const last = lastTen(teamId, date);
      return last.length ? mean(last.map((g) => g.sum)) : null;
    },
    playerPerGame: (playerId: number, teamId: number, date: string) => {
      const own = players.get(playerId), tois = lastTen(teamId, date).filter((g) => own?.has(g.gameId)).map((g) => own!.get(g.gameId)!);
      return tois.length ? mean(tois) : null;
    } };
}

export type PpReport = { targets: { date: string; gameId: number; teamId: number; oldTarget: number; newTarget: number; actual: number; s8: number | null }[];
  units: string[] };

export function applyPpUsage(rows: PreparedRow[], projections: Json[], pp: PpInputs, checks: Checks): PpReport {
  const teamByKey = new Map(projections.map((p) => [`${p.run_id}:${p.game_id}:${p.player_id}`, Number(p.team_id)]));
  const latest = new Map<number, { date: string; teamId: number }>();
  for (const p of projections) {
    const date = day(p.as_of_date) ?? "", prev = latest.get(Number(p.player_id));
    if (!prev || date > prev.date) latest.set(Number(p.player_id), { date, teamId: Number(p.team_id) });
  }
  const playerTeam = new Map([...latest].map(([id, v]) => [id, v.teamId]));
  const official = buildOfficialPp(pp.wgoPp, pp.teamStrength, playerTeam);
  const usage = new Map<string, Json[]>();
  for (const u of pp.ppUsage) usage.set(`${u.run_id}:${u.game_id}`, [...(usage.get(`${u.run_id}:${u.game_id}`) ?? []), u]);
  const s5 = new Map(pp.ppActuals.map((a) => [`${a.game_id}:${a.player_id}`, a]));
  const teamOf = (runId: string, gameId: number, playerId: number) => teamByKey.get(`${runId}:${gameId}:${playerId}`) ?? playerTeam.get(playerId);
  const groups = new Map<string, { alloc: Map<number, number>; oldToi: Map<number, number>; oldTarget: number; newTarget: number }>();
  const report: PpReport = { targets: [], units: [] };
  const group = (r: PreparedRow) => {
    const { runId, teamId } = r.ppBase!, key = `${runId}:${r.gameId}:${teamId}`;
    if (groups.has(key)) return groups.get(key)!;
    const members = (usage.get(`${runId}:${r.gameId}`) ?? []).filter((u) => teamOf(runId, r.gameId, Number(u.player_id)) === teamId);
    const oldTarget = num(obj(members[0]?.pp_opportunity).team_pp_target_seconds) ?? 0;
    const target = official.teamTarget(teamId, r.date);
    if (target == null) bump(checks, "pp_target_no_official_history_kept_old");
    const players = members.map((u) => {
      const weight = official.playerPerGame(Number(u.player_id), teamId, r.date);
      if (weight == null) bump(checks, "pp_player_no_official_history_fallback");
      return { playerId: Number(u.player_id), weight, fallbackSeconds: (num(obj(u.pp_opportunity).allocated_player_pp_share) ?? 0) * oldTarget };
    });
    const g = { alloc: allocatePpToi(players, target ?? oldTarget), oldTarget, newTarget: target ?? oldTarget,
      oldToi: new Map(members.map((u) => [Number(u.player_id), num(u.proj_toi_pp_seconds) ?? 0])) };
    const actual = pp.ppActuals.filter((a) => Number(a.game_id) === r.gameId && teamOf(runId, r.gameId, Number(a.player_id)) === teamId)
      .reduce((sum, a) => sum + (num(a.pp_toi) ?? 0), 0);
    const s8 = pp.teamStrength.find((t) => Number(t.game_id) === r.gameId && Number(t.team_id) === teamId);
    report.targets.push({ date: r.date, gameId: r.gameId, teamId, oldTarget, newTarget: g.newTarget, actual, s8: num(s8?.toi_pp_seconds) });
    groups.set(key, g);
    return g;
  };
  // Group-level rates for players whose stored PP TOI is zero (no per-second rate of their own).
  const rateOf = (members: PreparedRow[], g: { oldToi: Map<number, number> }, pp2: boolean) => {
    const sum = (f: (r: PreparedRow) => number) => members.reduce((s, r) => s + f(r), 0);
    const toi = sum((r) => g.oldToi.get(r.playerId) ?? 0), shots = sum((r) => r.ppBase!.sPp ?? 0);
    return { shotsPerSecond: toi > 0 ? shots / toi : 0, goalsPerShot: shots > 0 ? sum((r) => r.ppBase!.gPp ?? 0) / shots : 0,
      assistsPerShot: shots > 0 ? sum((r) => (r.ppBase!.aPp ?? 0) + (pp2 ? r.ppBase!.ppAssistDelta : 0)) / shots : 0 };
  };
  for (const r of rows) {
    const b = r.ppBase!, g = group(r);
    if (!g.oldToi.has(r.playerId)) { bump(checks, "pp_usage_row_missing_kept_baseline"); continue; }
    const members = rows.filter((x) => x.ppBase!.runId === b.runId && x.gameId === r.gameId && x.ppBase!.teamId === b.teamId);
    const oldLine: PpLine = { PP_TOI: g.oldToi.get(r.playerId)!, PP_SHOTS: b.sPp ?? 0, PP_GOALS: b.gPp ?? 0, PP_ASSISTS: b.aPp ?? 0 };
    if (oldLine.PP_TOI <= 0 && (g.alloc.get(r.playerId) ?? 0) > 0) bump(checks, "pp_zero_old_toi_group_rate");
    const newToi = g.alloc.get(r.playerId) ?? oldLine.PP_TOI;
    const lines = { baseline: oldLine, pp1: scalePpLine(oldLine, newToi, rateOf(members, g, false)),
      pp2: scalePpLine({ ...oldLine, PP_ASSISTS: oldLine.PP_ASSISTS + b.ppAssistDelta }, newToi, rateOf(members, g, true)) };
    const toLine = (l: PpLine): Line => ({ G: (b.gEs ?? 0) + l.PP_GOALS, A: (b.aEs ?? 0) + l.PP_ASSISTS, PPP: l.PP_GOALS + l.PP_ASSISTS });
    r.ppPreds = { pp1: toLine(lines.pp1), pp2: toLine(lines.pp2) };
    const a = s5.get(`${r.gameId}:${r.playerId}`);
    if (!a) { bump(checks, "pp_no_s5_actual"); continue; }
    r.pp = { teamId: b.teamId, preds: lines, actual: { PP_TOI: num(a.pp_toi) ?? 0, PP_SHOTS: num(a.pp_shots) ?? 0, PP_GOALS: num(a.pp_goals) ?? 0,
      PP_ASSISTS: num(a.pp_assists) ?? 0 }, heads: PP_HEADS.filter((h) => (h !== "PP_GOALS" || b.gPp != null) && (h !== "PP_ASSISTS" || b.aPp != null)) };
  }
  // Units: S5 and S7 pp_toi are both seconds per player-game when they agree on shared game:player keys.
  const shared = pp.wgoPp.filter((w) => s5.has(`${w.game_id}:${w.player_id}`));
  const agree = shared.filter((w) => Math.abs((num(w.pp_toi) ?? NaN) - (num(s5.get(`${w.game_id}:${w.player_id}`)!.pp_toi) ?? NaN)) <= 1).length;
  const s8Ratios = pp.teamStrength.map((t) => [num(t.toi_pp_seconds), official.teamGames.get(`${t.team_id}:${t.game_id}`)?.sum] as const)
    .filter(([a, b]) => a != null && b != null && b > 0).map(([a, b]) => a! / b!);
  report.units = [
    `S5 vs S7 pp_toi on shared game:player keys: ${agree}/${shared.length} agree within 1 s (both seconds per player-game when they agree).`,
    `Mean S5 pp_toi on non-zero player-games: ${f(mean(pp.ppActuals.map((a) => num(a.pp_toi) ?? 0).filter((x) => x > 0)), 1)} s.`,
    `S7 pp_toi_per_game = pp_toi on ${pp.wgoPp.filter((w) => num(w.pp_toi_per_game) === num(w.pp_toi)).length}/${pp.wgoPp.length} rows.`,
    `S8 toi_pp_seconds / summed S7 per team-game: mean ${f(mean(s8Ratios), 3)} over ${s8Ratios.length} team-games; S7 rows with no team mapping: ${official.unmappedRows}.`,
  ];
  return report;
}

function ppSection(rows: PreparedRow[], view: ScoredRow[], ppReport: PpReport, seed: number, reps: number) {
  const ppRows: ScoredRow[] = rows.filter((r) => r.pp).map((r) => ({ gameId: r.gameId, playerId: r.playerId, heads: r.pp!.heads, actual: r.pp!.actual, preds: r.pp!.preds }));
  const top = new Set(topDecile(rows, "baseline").map((r) => `${r.gameId}:${r.playerId}`));
  const inTop = <T extends ScoredRow>(xs: T[]) => xs.filter((r) => top.has(`${r.gameId}:${r.playerId}`));
  const t = ppReport.targets, sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const targetRow = (label: string, pick: (x: PpReport["targets"][number]) => number) => `| ${label} | ${t.length} | ${f(mean(t.map(pick)), 1)} | ${
    f(mean(t.map((x) => x.actual)), 1)} | ${f(mean(t.map((x) => Math.abs(pick(x) - x.actual))), 1)} | ${f(sum(t.map((x) => x.actual)) / sum(t.map(pick)), 3)} |`;
  return ["## PP usage (official PP targets)", "", ...ppReport.units.map((u) => `- ${u}`), "",
    "Team PP target vs actual team PP TOI per game (skater-seconds; actual = Σ S5 pp_toi of the team's players).", "",
    "| target | team-games | mean target | mean actual | MAE | Σactual/Σtarget |", "|---|---|---|---|---|---|",
    targetRow("old (stored)", (x) => x.oldTarget), targetRow("new (official last 10)", (x) => x.newTarget), "",
    `Mean S8 toi_pp_seconds on these team-games: ${f(mean(t.map((x) => x.s8).filter((x): x is number => x != null)), 1)}.`, "",
    "## PP heads (vs S5)", "", ppRows.length ? metricsTable(ppRows, seed, reps, ["baseline", ...PP_VARIANTS], PP_HEADS) : "_no rows_", "",
    "## PP calibration: baseline-G top decile", "", ...CALIBRATION_HEADER,
    ...["baseline", ...PP_VARIANTS].flatMap((v) => [calibrationRow(inTop(ppRows), v, "PP_TOI", "baseline-G top decile"),
      calibrationRow(inTop(view), v, "PPP", "baseline-G top decile")])].join("\n");
}

function localJson(name: string, path: string) {
  if (statSync(path).size > MAX_BYTES) throw new Error(`${name} exceeds 64 MiB`);
  const bytes = readFileSync(path);
  const value = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(value)) throw new Error(`${name} must be a JSON array of rows`);
  return { name, path, sha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"), value: value as Json[] };
}

const USAGE = "Use --runs FILE --projections FILE --actuals FILE --games FILE --output NEW_FILE [--seed N] [--reps N]"
  + " [--pp-actuals FILE --pp-usage FILE --wgo-pp FILE --team-strength FILE]";
const PP_FLAGS = ["--pp-actuals", "--pp-usage", "--wgo-pp", "--team-strength"] as const;
export function runCounterfactualBacktest(argv: string[]) {
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--runs", "--projections", "--actuals", "--games", "--output", "--seed", "--reps", ...PP_FLAGS].includes(argv[i]) || !argv[i + 1] || opts.has(argv[i])) throw new Error(USAGE);
    opts.set(argv[i], argv[i + 1]);
  }
  for (const k of ["--runs", "--projections", "--actuals", "--games", "--output"]) if (!opts.has(k)) throw new Error(USAGE);
  const seed = Number(opts.get("--seed") ?? 1), reps = Number(opts.get("--reps") ?? 2000);
  if (!Number.isInteger(seed) || !Number.isInteger(reps) || reps < 1) throw new Error(USAGE);
  const [runs, projections, actuals, games] = (["runs", "projections", "actuals", "games"] as const)
    .map((k) => localJson(k, resolve(opts.get(`--${k}`)!)));
  const ppGiven = PP_FLAGS.filter((k) => opts.has(k));
  if (ppGiven.length !== 0 && ppGiven.length !== PP_FLAGS.length) throw new Error(USAGE);
  const ppFiles = ppGiven.map((k) => localJson(k.slice(2), resolve(opts.get(k)!)));
  const pp = ppFiles.length ? { ppActuals: ppFiles[0].value, ppUsage: ppFiles[1].value, wgoPp: ppFiles[2].value, teamStrength: ppFiles[3].value } : undefined;
  const prepared = prepareRows({ runs: runs.value, projections: projections.value, actuals: actuals.value, games: games.value, pp });
  const report = renderReport({ ...prepared, seed, reps, inputs: [runs, projections, actuals, games, ...ppFiles] });
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
