/** BLSH opportunity comparisons (TJ decision 3, 2026-11-03). Two side-by-side retrospective
 * comparisons per production track:
 *   (a) recorded production versus the player's established per-game baseline, and
 *   (b) a separately labelled opportunity-adjusted comparison: recorded production versus the
 *       player's established power-play and non-power-play rates at the window's actual TOI split.
 * Plus the underlying TOI and PP changes with their estimated effect, and one assessment that
 * reports any conflict instead of forcing a direction. A promotion is never sell-high by itself,
 * and no direction here assumes a window role will persist.
 *
 * Method (`blsh-opportunity-split-v1`, validated offline in
 * tasks/artifacts/blsh-opportunity-2026-11-04/REPORT.md): a two-state rate model.
 *   G+A: PP rate = PP points / PP seconds; non-PP rate = other points / other seconds (exact split).
 *   FP: a PP point is valued at 3 + goal share (2 per assist, 1 PPP bonus, 1 more if a goal; PP goals
 *       are not recorded, so the player's goal share stands in). PP shots, hits and blocks stay in the
 *       non-PP rate, which under-adjusts large PP increases slightly.
 *   Game Score: no strength split exists, so (b) is unavailable for that track.
 *   The personal PP rate is shrunk toward a caller-supplied position-cohort PP rate with
 *   `ppPseudoSeconds` of cohort exposure; without a cohort, thin PP history makes (b) unavailable.
 * Scales are per-game SD (a) or split-model residual SD plus PP-rate uncertainty (b), times √games.
 * They are descriptive, not calibrated probabilities.
 *
 * Pure: no I/O, clock or network. Missing inputs give unavailable states with reasons, never zeros.
 * Research only: nothing here is trusted, adopted, a forecast or trade advice.
 */
export const OPPORTUNITY_VERSION = "blsh-opportunity-split-v1";
/** Same order as `productionReference.PRODUCTION_TRACKS`. */
export const OPPORTUNITY_TRACKS = ["fantasy_points", "goals_plus_assists", "wigo_game_score"] as const;
const TRACK_LABELS = ["FP", "G+A", "Game Score"];
/** Tracks with a power-play split; Game Score has none. */
const SPLIT_TRACKS = [true, true, false];
/** Provisional defaults; see REPORT.md for the validation behind each. */
export const OPPORTUNITY_DEFAULTS = { minGames: 20, ppPseudoSeconds: 3600, minPersonalPpSeconds: 1800, band: 0.5, headlineTrack: 0 } as const;
export const PERSISTENCE_NOTE = "A role change inside a short window is not evidence that the new role will persist.";

export type OpportunityGame = {
  seconds: number | null; ppSeconds: number | null; tracks: (number | null)[];
  goals: number | null; assists: number | null; ppPoints: number | null;
  /** Optional non-negative recency or exposure weight (the baseline lane's weighting); default 1. */
  weight?: number;
};
/** Position-cohort PP rates per PP second for [FP, G+A], and the cohort's goal share of points. */
export type OpportunityCohort = { ppRate: [number, number]; goalShare: number };
export type OpportunityOptions = { cohort?: OpportunityCohort | null; minGames?: number; ppPseudoSeconds?: number; minPersonalPpSeconds?: number };
export type PpRateSource = "personal" | "personal_shrunk_to_cohort" | "not_needed" | null;
export type OpportunityHistory = {
  version: typeof OPPORTUNITY_VERSION; games: number; effectiveGames: number; reason: string | null;
  perGame: (number | null)[]; perGameSD: (number | null)[]; trackReasons: (string | null)[];
  secondsPerGame: number | null; ppSecondsPerGame: number | null; ratePerSecond: (number | null)[];
  split: {
    reason: string | null; ppSeconds: number | null; nonPpSeconds: number | null; goalShare: number | null;
    ppPointValue: (number | null)[]; nonPpRate: (number | null)[]; ppRate: (number | null)[]; personalPpRate: (number | null)[];
    ppRateSource: PpRateSource; ppRateExposure: number | null; residualSD: (number | null)[];
  };
};
export type OpportunityWindow = { games: number; seconds: number | null; ppSeconds: number | null; observed: (number | null)[] };
export type Direction = "buy_low_evidence" | "sell_high_evidence" | "balanced";
export type ComparisonResult = {
  kind: "per_game_baseline" | "opportunity_adjusted"; label: string; available: boolean; reason: string | null;
  observed: number | null; expected: number | null; gap: number | null; scale: number | null; z: number | null; direction: Direction | null;
};
export type OpportunityChange = {
  metric: "toi_per_game" | "pp_toi_per_game"; label: string; units: "seconds/game";
  baseline: number | null; current: number | null; delta: number | null; deltaPct: number | null;
  /** Estimated effect on expected window production per track; null where unsupported. */
  impact: (number | null)[]; impactReason: string | null; text: string;
};
export type AssessmentReason =
  | "comparisons_agree" | "both_balanced" | "opportunity_explains_per_game_gap" | "adjusted_within_balanced_band"
  | "opposite_directions_role_persistence_unknown" | "per_game_at_baseline_rates_shifted"
  | "adjusted_unavailable_per_game_only" | "adjusted_unavailable_balanced" | "adjusted_unavailable_opportunity_may_explain"
  | "adjusted_unavailable_opportunity_unknown" | "per_game_unavailable";
export type Assessment = {
  direction: Direction | "withheld" | "unavailable"; qualified: boolean; conflict: boolean; reason: AssessmentReason;
  opportunityEffect: number | null; opportunityEffectSource: "split" | "toi_only" | null; opportunityShift: "increase" | "decrease" | "stable" | "unknown"; text: string;
};
export type TrackOpportunity = { track: (typeof OPPORTUNITY_TRACKS)[number]; label: string; perGame: ComparisonResult; adjusted: ComparisonResult; assessment: Assessment };
export type OpportunityResult = {
  version: typeof OPPORTUNITY_VERSION; headlineTrack: number; tracks: TrackOpportunity[]; headline: Assessment;
  changes: { toi: OpportunityChange; pp: OpportunityChange }; persistenceNote: string;
  retrospective: true; forecast: false; trusted: false; calibratedProbability: null;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const nonNegative = (v: unknown): v is number => finite(v) && v >= 0;
const signed = (v: number, digits = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

/** Weighted summary of the established baseline games (already restricted to before the window). */
export function summarizeOpportunityHistory(games: OpportunityGame[], options: OpportunityOptions = {}): OpportunityHistory {
  const minGames = options.minGames ?? OPPORTUNITY_DEFAULTS.minGames, k = options.ppPseudoSeconds ?? OPPORTUNITY_DEFAULTS.ppPseudoSeconds;
  const minPp = options.minPersonalPpSeconds ?? OPPORTUNITY_DEFAULTS.minPersonalPpSeconds, cohort = options.cohort ?? null;
  const n = games.length, nulls = () => [null, null, null] as (number | null)[];
  const out: OpportunityHistory = {
    version: OPPORTUNITY_VERSION, games: n, effectiveGames: 0, reason: null, perGame: nulls(), perGameSD: nulls(), trackReasons: nulls() as (string | null)[],
    secondsPerGame: null, ppSecondsPerGame: null, ratePerSecond: nulls(),
    split: { reason: null, ppSeconds: null, nonPpSeconds: null, goalShare: null, ppPointValue: nulls(), nonPpRate: nulls(), ppRate: nulls(), personalPpRate: nulls(), ppRateSource: null, ppRateExposure: null, residualSD: nulls() },
  };
  if (n === 0) return { ...out, reason: "no_personal_history", trackReasons: OPPORTUNITY_TRACKS.map(() => "no_personal_history"), split: { ...out.split, reason: "no_personal_history" } };
  const raw = games.map(g => g.weight ?? 1);
  if (raw.some(w => !nonNegative(w)) || raw.every(w => w === 0)) throw new Error("Invalid opportunity history weights");
  // Normalise to effective games, so pseudo-exposure and SDs keep their unweighted meaning.
  const sw = raw.reduce((s, w) => s + w, 0), neff = sw ** 2 / raw.reduce((s, w) => s + w * w, 0), w = raw.map(x => (x * neff) / sw);
  out.effectiveGames = neff;
  if (neff < minGames) out.reason = "insufficient_personal_history";
  const wsum = (f: (g: OpportunityGame, i: number) => number) => games.reduce((s, g, i) => s + w[i] * f(g, i), 0);
  const wsd = (f: (g: OpportunityGame, i: number) => number, m: number) => (neff > 1 ? Math.sqrt(wsum((g, i) => (f(g, i) - m) ** 2) / (neff - 1)) : null);

  for (let t = 0; t < 3; t++) {
    if (games.some(g => g.tracks.length !== 3)) throw new Error("Opportunity history games need three tracks");
    if (!games.every(g => finite(g.tracks[t]))) { out.trackReasons[t] = "track_unavailable_in_history"; continue; }
    const m = wsum(g => g.tracks[t] as number) / neff;
    out.perGame[t] = m; out.perGameSD[t] = wsd(g => g.tracks[t] as number, m);
  }
  const exposureOk = games.every(g => finite(g.seconds) && g.seconds > 0);
  if (!exposureOk) { out.split.reason = "history_toi_unavailable"; return out; }
  const seconds = wsum(g => g.seconds as number);
  out.secondsPerGame = seconds / neff;
  out.ratePerSecond = out.perGame.map(m => (m === null ? null : (m * neff) / seconds));

  const splitOk = games.every(g => nonNegative(g.ppSeconds) && g.ppSeconds <= (g.seconds as number) && nonNegative(g.ppPoints) && nonNegative(g.goals) && nonNegative(g.assists) && g.ppPoints <= g.goals + g.assists);
  if (!splitOk) { out.split.reason = "pp_split_inputs_unavailable"; return out; }
  const pp = wsum(g => g.ppSeconds as number), nonPp = seconds - pp, ppp = wsum(g => g.ppPoints as number);
  const points = wsum(g => (g.goals as number) + (g.assists as number));
  out.ppSecondsPerGame = pp / neff;
  const goalShare = points > 0 ? wsum(g => g.goals as number) / points : cohort?.goalShare ?? 0;
  Object.assign(out.split, { ppSeconds: pp, nonPpSeconds: nonPp, goalShare });
  if (nonPp <= 0) { out.split.reason = "no_non_pp_exposure"; return out; }
  const usable = pp >= minPp;
  if (!usable && !cohort) out.split.reason = "pp_rate_unsupported_without_cohort";
  out.split.ppRateSource = cohort ? "personal_shrunk_to_cohort" : usable ? "personal" : null;
  out.split.ppRateExposure = cohort ? pp + k : usable ? pp : null;
  for (let t = 0; t < 3; t++) {
    if (!SPLIT_TRACKS[t] || out.perGame[t] === null) continue;
    const value = t === 0 ? 3 + goalShare : 1, ppValue = value * ppp;
    out.split.ppPointValue[t] = value;
    out.split.nonPpRate[t] = (out.perGame[t]! * neff - ppValue) / nonPp;
    out.split.personalPpRate[t] = pp > 0 ? ppValue / pp : null;
    out.split.ppRate[t] = cohort ? (ppValue + k * cohort.ppRate[t]) / (pp + k) : usable ? ppValue / pp : null;
    // Without a supported PP rate, (b) exists only for windows with no PP time; the residual SD
    // still needs the history's PP games, so it uses the raw personal PP rate there.
    const r0 = out.split.nonPpRate[t]!, r1 = out.split.ppRate[t] ?? out.split.personalPpRate[t] ?? 0;
    const residual = (g: OpportunityGame) => (g.tracks[t] as number) - r0 * ((g.seconds as number) - (g.ppSeconds as number)) - r1 * (g.ppSeconds as number);
    out.split.residualSD[t] = wsd(residual, wsum(residual) / neff);
  }
  return out;
}

/** Pooled position-cohort PP rates from donor games (prior-only by the caller's construction). */
export function pooledCohort(games: OpportunityGame[]): OpportunityCohort | null {
  const ok = games.filter(g => nonNegative(g.ppSeconds) && nonNegative(g.ppPoints) && nonNegative(g.goals) && nonNegative(g.assists));
  const pp = ok.reduce((s, g) => s + (g.ppSeconds as number), 0), ppp = ok.reduce((s, g) => s + (g.ppPoints as number), 0);
  const points = ok.reduce((s, g) => s + (g.goals as number) + (g.assists as number), 0), goals = ok.reduce((s, g) => s + (g.goals as number), 0);
  if (pp <= 0 || points <= 0) return null;
  const goalShare = goals / points;
  return { ppRate: [(ppp * (3 + goalShare)) / pp, ppp / pp], goalShare };
}

function compareTo(kind: ComparisonResult["kind"], observed: number | null, expected: number | null, scale: number | null, reason: string | null, band: number): ComparisonResult {
  const label = kind === "per_game_baseline" ? "Versus established per-game baseline" : "Opportunity-adjusted: versus established PP and non-PP rates at this window's ice time";
  const base = { kind, label, observed, expected: null, gap: null, scale: null, z: null, direction: null } as ComparisonResult;
  if (reason) return { ...base, available: false, reason };
  if (observed === null) return { ...base, available: false, reason: "observed_production_unavailable" };
  if (expected === null || scale === null || !(scale > 0)) return { ...base, available: false, reason: "unestimated_scale" };
  const gap = observed - expected, z = gap / scale;
  return { ...base, available: true, reason: null, expected, gap, scale, z, direction: Math.abs(z) < band ? "balanced" : z > 0 ? "sell_high_evidence" : "buy_low_evidence" };
}

const DIRECTION_TEXT: Record<Direction, string> = { buy_low_evidence: "below", sell_high_evidence: "above", balanced: "in line with" };

function assess(label: string, a: ComparisonResult, b: ComparisonResult, effect: number | null, source: Assessment["opportunityEffectSource"], band: number): Assessment {
  const shift: Assessment["opportunityShift"] = effect === null || a.scale === null ? "unknown" : Math.abs(effect) < band * a.scale ? "stable" : effect > 0 ? "increase" : "decrease";
  const base = { opportunityEffect: effect, opportunityEffectSource: source, opportunityShift: shift };
  const make = (direction: Assessment["direction"], reason: AssessmentReason, qualified: boolean, conflict: boolean, text: string): Assessment => ({ ...base, direction, reason, qualified, conflict, text });
  if (!a.available || !a.direction) return make("unavailable", "per_game_unavailable", false, false, `${label}: the per-game comparison is unavailable (${a.reason}), so no direction is given.`);
  const da = a.direction, explains = (da === "sell_high_evidence" && shift === "increase") || (da === "buy_low_evidence" && shift === "decrease");
  const roleWord = shift === "increase" ? "a bigger role (more ice time or power play)" : "a smaller role (less ice time or power play)";
  const effectText = effect === null ? "" : ` The opportunity change alone is worth about ${signed(effect)} ${label} over the window.`;
  if (!b.available || !b.direction) {
    if (da === "balanced") return make("balanced", "adjusted_unavailable_balanced", false, false, `${label}: production is in line with the per-game baseline; the opportunity-adjusted comparison is unavailable (${b.reason}).`);
    if (shift === "unknown") return make("withheld", "adjusted_unavailable_opportunity_unknown", false, true, `${label}: production is ${DIRECTION_TEXT[da]} the per-game baseline, but the window's ice time is unknown, so opportunity cannot be ruled out; direction withheld.`);
    if (explains) return make("withheld", "adjusted_unavailable_opportunity_may_explain", false, true, `${label}: production is ${DIRECTION_TEXT[da]} the per-game baseline, but ${roleWord} could account for it and the opportunity-adjusted comparison is unavailable (${b.reason}); direction withheld.${effectText}`);
    return make(da, "adjusted_unavailable_per_game_only", true, false, `${label}: production is ${DIRECTION_TEXT[da]} the per-game baseline and the ice-time change does not account for it. Qualified: the opportunity-adjusted comparison is unavailable (${b.reason}).`);
  }
  const db = b.direction;
  if (da === db && da !== "balanced") return make(da, "comparisons_agree", false, false, `${label}: production is ${DIRECTION_TEXT[da]} both the per-game baseline and the player's established rates at this window's ice time.${shift === "stable" ? "" : effectText}`);
  if (da === "balanced" && db === "balanced") return make("balanced", "both_balanced", false, false, `${label}: production is in line with the per-game baseline and with the established rates at this window's ice time.`);
  if (da !== "balanced" && db === "balanced") {
    if (explains) return make("balanced", "opportunity_explains_per_game_gap", false, true, `${label}: production is ${DIRECTION_TEXT[da]} the per-game baseline, but in line with the player's established rates once ${roleWord} is accounted for. The change in role, not the rates, explains the gap; this is not ${da === "sell_high_evidence" ? "sell-high" : "buy-low"} evidence.${effectText}`);
    return make(da, "adjusted_within_balanced_band", true, true, `${label}: production is ${DIRECTION_TEXT[da]} the per-game baseline; the opportunity-adjusted gap points the same way but sits inside the balanced band. Qualified direction.`);
  }
  if (da === "balanced") {
    const why = db === "buy_low_evidence"
      ? "below what the player's established rates imply at this window's ice time. Reading that as buy-low would assume the new role persists, which this window does not show"
      : "above the player's established rates at this window's ice time, but per-game output is not elevated";
    return make("balanced", "per_game_at_baseline_rates_shifted", false, true, `${label}: production is in line with the per-game baseline yet ${why}; held balanced.${effectText}`);
  }
  return make("withheld", "opposite_directions_role_persistence_unknown", false, true, `${label}: production is ${DIRECTION_TEXT[da]} the per-game baseline but ${DIRECTION_TEXT[db]} the established rates at this window's ice time, because of ${roleWord}. Which reading holds depends on whether the role persists, which this window does not show; direction withheld.${effectText}`);
}

function change(metric: OpportunityChange["metric"], baseline: number | null, current: number | null, impact: (number | null)[], impactReason: string | null, headline: number, games: number): OpportunityChange {
  const label = metric === "toi_per_game" ? "Total TOI per game" : "PP TOI per game";
  const delta = baseline === null || current === null ? null : current - baseline;
  const deltaPct = delta === null || !baseline ? null : (100 * delta) / baseline;
  const what = metric === "toi_per_game" ? "Ice time" : "Power-play time";
  let text: string;
  if (delta === null) text = `${what} change unavailable: ${baseline === null ? "baseline" : "window"} value missing.`;
  else {
    const moved = Math.abs(delta) < 1 ? "is unchanged" : `is ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(0)} s per game${deltaPct === null ? "" : ` (${signed(deltaPct, 0)}%)`}`;
    const h = impact[headline], effect = h === null
      ? ` Its effect on ${TRACK_LABELS[headline]} is not estimated${impactReason ? ` (${impactReason})` : ""}.`
      : ` At the player's established rates that is worth about ${signed(h)} ${TRACK_LABELS[headline]} over these ${games} games.`;
    text = `${what} ${moved} against the established baseline (${baseline!.toFixed(0)} s → ${current!.toFixed(0)} s).${Math.abs(delta) < 1 ? "" : effect}`;
  }
  return { metric, label, units: "seconds/game", baseline, current, delta, deltaPct, impact, impactReason, text };
}

/** Both comparisons, the TOI and PP changes, and per-track and headline assessments for one window. */
export function compareOpportunity(history: OpportunityHistory, window: OpportunityWindow, options: { band?: number; headlineTrack?: number } = {}): OpportunityResult {
  const band = options.band ?? OPPORTUNITY_DEFAULTS.band, headlineTrack = options.headlineTrack ?? OPPORTUNITY_DEFAULTS.headlineTrack;
  if (window.observed.length !== 3 || ![0, 1, 2].includes(headlineTrack)) throw new Error("Opportunity window needs three tracks and a valid headline track");
  const n = window.games;
  const windowReason = !(Number.isInteger(n) && n > 0) ? "window_games_unavailable" : null;
  const toiKnown = !windowReason && finite(window.seconds) && window.seconds > 0;
  const ppKnown = toiKnown && nonNegative(window.ppSeconds) && window.ppSeconds <= (window.seconds as number);
  const observed = window.observed.map(v => (finite(v) ? v : null));
  const sqrtN = Math.sqrt(Math.max(n, 0));
  const deltaToi = toiKnown && history.secondsPerGame !== null ? (window.seconds as number) - n * history.secondsPerGame : null;

  const tracks: TrackOpportunity[] = OPPORTUNITY_TRACKS.map((track, t) => {
    const label = TRACK_LABELS[t];
    const aReason = windowReason ?? (history.reason === "no_personal_history" || history.reason === "insufficient_personal_history" ? history.reason : history.trackReasons[t]);
    const sdA = history.perGameSD[t];
    const perGame = compareTo("per_game_baseline", observed[t], history.perGame[t] === null ? null : n * history.perGame[t]!, sdA === null ? null : sdA * sqrtN, aReason, band);
    const s = history.split, r0 = s.nonPpRate[t], r1 = s.ppRate[t];
    let bReason: string | null = aReason;
    if (!bReason && !SPLIT_TRACKS[t]) bReason = "no_strength_split_for_track";
    if (!bReason && !toiKnown) bReason = "window_toi_unavailable";
    if (!bReason && !ppKnown) bReason = "window_pp_toi_unavailable";
    if (!bReason && s.reason === "pp_rate_unsupported_without_cohort" && (window.ppSeconds as number) === 0) bReason = null;
    else if (!bReason && s.reason) bReason = s.reason;
    let expected: number | null = null, scale: number | null = null;
    if (!bReason && r0 !== null && s.residualSD[t] !== null) {
      const wpp = window.ppSeconds as number, wnon = (window.seconds as number) - wpp;
      const rate = r1 ?? 0; // r1 is null only when the window has no PP time, so it does not enter.
      expected = r0 * wnon + rate * wpp;
      const rateVar = wpp > 0 && s.ppRateExposure ? (wpp ** 2 * s.ppPointValue[t]! * rate) / s.ppRateExposure : 0;
      scale = Math.sqrt(n * s.residualSD[t]! ** 2 + rateVar);
    } else if (!bReason) bReason = "split_rates_unavailable";
    const adjusted = compareTo("opportunity_adjusted", observed[t], expected, scale, bReason, band);
    // Opportunity effect: split expectation minus per-game expectation when (b) exists, else the total-TOI effect.
    let effect: number | null = null, source: Assessment["opportunityEffectSource"] = null;
    if (adjusted.available && perGame.available) { effect = adjusted.expected! - perGame.expected!; source = "split"; }
    else if (deltaToi !== null && history.ratePerSecond[t] !== null) { effect = history.ratePerSecond[t]! * deltaToi; source = "toi_only"; }
    return { track, label, perGame, adjusted, assessment: assess(label, perGame, adjusted, effect, source, band) };
  });

  // TOI effect at the all-situations rate; PP effect is the rest of the split expectation's change.
  const toiImpact = tracks.map((_, t) => (deltaToi === null || history.ratePerSecond[t] === null ? null : history.ratePerSecond[t]! * deltaToi));
  const ppImpact = tracks.map((x, t) => (x.adjusted.available && x.perGame.available && toiImpact[t] !== null ? x.adjusted.expected! - x.perGame.expected! - toiImpact[t]! : null));
  const ppImpactReason = tracks[headlineTrack].adjusted.available ? null : tracks[headlineTrack].adjusted.reason;
  const perGameWindow = (total: number | null | undefined, ok: boolean) => (ok && finite(total) ? total / n : null);
  return {
    version: OPPORTUNITY_VERSION, headlineTrack, tracks, headline: tracks[headlineTrack].assessment,
    changes: {
      toi: change("toi_per_game", history.secondsPerGame, perGameWindow(window.seconds, toiKnown), toiImpact, deltaToi === null ? "toi_unavailable" : null, headlineTrack, n),
      pp: change("pp_toi_per_game", history.ppSecondsPerGame, perGameWindow(window.ppSeconds, ppKnown), ppImpact, ppImpactReason, headlineTrack, n),
    },
    persistenceNote: PERSISTENCE_NOTE, retrospective: true, forecast: false, trusted: false, calibratedProbability: null,
  };
}
