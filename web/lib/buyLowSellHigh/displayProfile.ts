/** Pure projection of saved BLSH research profiles (`currentWindows` Profile, dry run v4) into the
 * v2 display contract described in DISPLAY-FIELD-HANDOFF.md (handoff v2). It reads finished
 * scores and explanations and never recomputes them: ranks come from the frozen `rankTwoLists`,
 * and every check below only verifies that saved values reconcile. Fails closed on drift.
 * No I/O, clock or network; the caller supplies every input, including `packagedAtUTC`.
 * Research only: nothing here is trusted, adopted, a forecast or trade advice.
 */
import type { Profile } from "./currentWindows";
import { rankTwoLists, SUPPORT_GAP_EXPLANATION_VERSION, SUPPORT_GAP_VERSION, type Comparison, type ContextSignal, type CoverageNote } from "./supportGap";

export const DISPLAY_SNAPSHOT_VERSION = "fhfh.blsh.current-research-snapshot.v2";
export const DISPLAY_MAPPER_VERSION = "blsh-display-profile-v3";
/** List gate: the frozen score lists by direction alone, but a player without usable personal history is
 * measured against the position-cohort average, not their own level, so the display withholds them.
 * Confirmed zero (no reference games) and unknown (history that could not be used) keep separate reasons. */
export const NO_PERSONAL_HISTORY_LIST_WITHHELD = "no_personal_history_list_withheld";
export const PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD = "personal_history_unavailable_list_withheld";
/** v3 list rules (TJ decisions 1, 2 and 5, 2026-11-03). Below the provisional history cutoff the direction itself is
 * withheld; a list member also needs a full window and a headline (FHFH Standard) gap in the list's direction. */
export const BLSH_MIN_PERSONAL_GAMES = 20;
export const BLSH_LIST_WINDOW_GAMES = 5;
export const BLSH_LIST_TOP_N = 25;
export const INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD = "insufficient_personal_history_list_withheld";
export const SHORT_WINDOW_LIST_WITHHELD = "short_window_list_withheld";
export const HEADLINE_TRACK_CONFLICT_LIST_WITHHELD = "headline_track_conflict_list_withheld";
export const HEADLINE_TRACK_UNAVAILABLE_LIST_WITHHELD = "headline_track_unavailable_list_withheld";
/** The headline is the league-scoring track (FHFH Standard by default); G+A and Game Score are supporting tracks. */
export const HEADLINE_TRACK = "fantasy_points";
export const DISPLAY_HANDOFF_VERSION = "blsh-display-handoff-v2";

const TRACK_LABELS = ["FP", "G+A", "FHFH WiGO Game Score"];
const STATUS_LABELS: Record<string, string> = {
  concordant_research_candidate: "Production and support agree in direction",
  conflicting_baseline_and_support: "Production and support disagree; withheld from lists",
  support_direction_without_baseline_concordance: "Support gives a direction the reference gap does not; withheld from lists",
  balanced_model_estimate: "Balanced",
  unavailable: "Unavailable",
};
const KIND_LABELS: Record<string, string> = {
  reference_gap: "Reference vs recorded",
  model_sensitivity: "Process change × frozen sensitivity",
  imputed_estimate: "Estimated: current process missing",
  floor_adjustment: "Raised to zero (counts can't be negative)",
};
const METRIC_LABELS: Record<string, string> = {
  total_TOI_per_game: "Total TOI per game", ES_TOI_per_game: "ES TOI per game", PP_TOI_per_game: "PP TOI per game",
  goals_minus_individual_xG_per_60: "Goals minus individual xG per 60", on_ice_goals_minus_xGF_per_60: "On-ice goals minus xGF per 60",
  assists_per_teammate_on_ice_goal: "Assists per teammate on-ice goal", shots_per_60: "Shots per 60",
};
const MISMATCH = "Context withheld: it could not be matched to the scored games";
/** Handoff §4. Codes not listed here fall back to "Unavailable: <code>", never a blank. */
const REASON_TEXT: Record<string, string> = {
  no_measured_current_production_or_exposure: "Score unavailable: a current-window game is missing a production track or ice time (often the six on-ice goal fields Game Score needs)",
  no_observed_current_process: "Score unavailable: none of the three process rates is observed for the current window",
  unestimable_prior_sensitivity: "Score unavailable: the process sensitivity could not be estimated before this window",
  missing_invalid_baseline_inputs: "Score unavailable: the production reference is missing or invalid",
  fewer_than_five_recorded_slots: "Fewer than five current games recorded",
  missing_measurement_or_exposure: "Personal history exists but a game lacks a track or ice time; the cohort reference is used",
  no_personal_history_cohort: "No personal history; the position-cohort reference is used",
  [NO_PERSONAL_HISTORY_LIST_WITHHELD]: "Withheld from lists: no personal history, so the gap is measured against the position-cohort average, not the player's own level",
  [PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD]: "Withheld from lists: personal history could not be used (unknown, not zero), so the gap is measured against the position-cohort average",
  [INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD]: `Insufficient history: fewer than ${BLSH_MIN_PERSONAL_GAMES} personal games (provisional cutoff), so direction is withheld and the reference leans on the position cohort`,
  [SHORT_WINDOW_LIST_WITHHELD]: `Withheld from lists: fewer than ${BLSH_LIST_WINDOW_GAMES} games in the window`,
  [HEADLINE_TRACK_CONFLICT_LIST_WITHHELD]: "Withheld from lists: the FHFH Standard points gap points the other way from the combined evidence",
  [HEADLINE_TRACK_UNAVAILABLE_LIST_WITHHELD]: "Withheld from lists: the FHFH Standard points track is unavailable (not counted as zero)",
  mixed_personal_position_cohort_reference: "Personal history spans positions; the position-cohort reference is used",
  no_personal_reference_cohort_mean_used: "Process reference is the cohort mean, not the player's own",
  reference_estimated_not_personal_measured: "Process reference is estimated, not the player's own measured history",
  current_process_missing_linear_estimate: "Current process value missing; estimated from the observed ones",
  dry_run_simplified_gate_not_sealed_transport: "History process gate is a disclosed simplification, not the sealed v1 transport",
  reference_window_not_supplied: "No personal reference window supplied; context comparison unavailable",
  current_window_not_supplied: "No current window supplied; context unavailable",
  goals_or_individual_xG_missing: "Unavailable: an input total is missing for the window",
  on_ice_goals_or_xGF_missing: "Unavailable: an input total is missing for the window",
  assists_goals_or_on_ice_goals_missing: "Unavailable: an input total is missing for the window",
  shots_missing: "Unavailable: an input total is missing for the window",
  no_teammate_on_ice_goals_ratio_undefined: "Undefined: no teammate goals while on ice",
  assists_exceed_teammate_on_ice_goals_data_conflict: "Data conflict: more assists than teammate on-ice goals",
  spread_undefined_zero_xG: "Finishing spread undefined at zero xG (the zero is still shown)",
  current_reference_revision_mismatch: "Change withheld: current and reference use different known source revisions",
  current_reference_mixed_revision_composition: "Change withheld: a window mixes source revisions game by game",
  current_reference_scope_mismatch: "Change withheld: current and reference describe different game states",
  current_reference_source_mismatch: "Change withheld: current and reference come from different sources",
  provider_revision_unverified: "Source revision unverified",
  exposure_components_exceed_total: "ES or PP ice time exceeds total; window context withheld",
  no_reference_value: "No reference value to compare",
  window_not_supplied: "No window for this side (no personal reference, or context withheld); value unavailable",
  appearances_missing: "Unavailable: the window's appearance count is missing",
  no_appearances: "Unavailable: the window has no appearances",
  TOI_missing: "Unavailable: ice time missing for the window", ES_TOI_missing: "Unavailable: ES ice time missing for the window", PP_TOI_missing: "Unavailable: PP ice time missing for the window",
  unknown_scope_no_exposure: "Unavailable: the game state is unknown, so no ice-time denominator applies",
  provenance_unknown: "Unavailable: the source of an input is unknown",
  operands_scope_mismatch: "Unavailable: the inputs describe different game states",
  explanation_attribution_missing: "Score components unavailable: no attribution was recorded with this score",
  unusable_aggregate_scale: "Score unavailable: the tracks' joint scale is unusable",
  score_not_available: "Score unavailable",
  no_current_value: "No current value to compare",
  context_identity_differs_from_scored_window: MISMATCH, context_identity_differs_from_scored_reference: MISMATCH,
  context_window_mismatch_with_scored_window: MISMATCH, context_outcomes_disagree_with_scored_totals: MISMATCH,
  current_window_invalid: MISMATCH, reference_window_invalid: MISMATCH, scored_identity_not_recorded: MISMATCH, window_identity_missing: MISMATCH,
};
const PROCESS_SOURCE: Record<string, string> = { individual: "individual", onIce: "on-ice" };
export function reasonText(code: string | null): string | null {
  if (code === null) return null;
  if (REASON_TEXT[code]) return REASON_TEXT[code];
  let m: RegExpMatchArray | null;
  if ((m = code.match(/^wigoGameScore:missing_or_invalid_(.+)$/))) return `Game Score unavailable for this game: on-ice ${m[1].replace(/_/g, " ")} missing`;
  if ((m = code.match(/^(fantasyPoints|rawPoints):missing_or_invalid_(.+)$/))) return `${m[1] === "fantasyPoints" ? "FP" : "G+A"} unavailable for this game: ${m[2].replace(/_/g, " ")} missing or invalid`;
  if ((m = code.match(/^(individual|onIce):no_matching_process_record$/))) return `No matching NST ${PROCESS_SOURCE[m[1]]} record for this game`;
  if ((m = code.match(/^(individual|onIce):process_WGO_exposure_mismatch$/))) return `NST ${PROCESS_SOURCE[m[1]]} ice time differs from WGO ice time for this game; process value not used`;
  if ((m = code.match(/^history_nst_(individual|onice)_absent$/))) return `Reference game has no NST ${m[1] === "onice" ? "on-ice" : "individual"} record`;
  if ((m = code.match(/^history_nst_(individual|onice)_gate_failed$/))) return `Reference game's NST ${m[1] === "onice" ? "on-ice" : "individual"} record failed the GP/ice-time match`;
  if ((m = code.match(/^(all_situations|even_strength|power_play)_TOI_missing$/))) return `Unavailable: ${m[1].replace(/_/g, " ")} ice time missing for the window`;
  if ((m = code.match(/^no_(all_situations|even_strength|power_play)_ice_time$/))) return `Unavailable: no ${m[1].replace(/_/g, " ")} ice time in the window`;
  if ((m = code.match(/^attribution_integrity_failed:(.+)$/))) return `Score components unavailable: the recorded attribution failed its integrity check (${m[1]})`;
  if ((m = code.match(/^invalid_(.+)$/))) return `Invalid recorded value (${m[1].replace(/_/g, " ")}); treated as unavailable`;
  return `Unavailable: ${code}`;
}

/** Slot-note components whose `count` is a number of games; every other component is one profile-level note. */
const GAME_COUNT_COMPONENTS = new Set(["current_window_slot", "reference_slot"]);

type DisplayComparison = {
  metric: string; label: string; kind: string; units: string; current: number | null; reference: number | null; delta: number | null;
  status: "available" | "unavailable"; reasonText: string | null; referenceReasonText: string | null; deltaReasonText: string | null;
  reason: string | null; referenceReason: string | null; deltaReason: string | null; revisionVerified: boolean | null; revisionText: string | null;
};
export type DisplayContextSignal = DisplayComparison & { scoreInput: false; interpretation: "hypothesis"; hypothesesHeading: string; hypotheses: string[]; scale: { value: number; units: string; assumption: string } | null };
export type DisplayNote = { source: "explanation" | "slot"; component: string; state: string | null; reason: string; text: string; games: number | null };
export type DisplayTrack = {
  track: string; label: string; observed: number; referenceAtCurrentTOI: number; supportConditioned: number; gap: number;
  components: { id: string; kind: string; kindLabel: string; value: number; note: string; processDelta: number | null; referenceKind: string | null }[];
  componentSum: number; normalizationMultiplier: number; normalizedGapContribution: number; baselineNormalizedGapContribution: number;
  role: "headline" | "supporting";
};
/** The headline track's own values; null when the track is missing, never a zero. */
export type DisplayHeadline = { track: typeof HEADLINE_TRACK; scoring: "FHFH Standard"; label: string; observed: number; expected: number; referenceAtCurrentTOI: number; gap: number };
export type DisplayProfile = {
  playerId: number; name: string | null; displayName: string; team: string | null; position: "F" | "D" | null;
  score: {
    version: typeof SUPPORT_GAP_VERSION; value: number | null; normalizedGap: number | null; baselineNormalizedGap: number | null;
    gapSign: "buy_low_evidence" | "sell_high_evidence" | "balanced" | null; gapSignLabel: string | null;
    status: string; statusLabel: string; list: "BL" | "SH" | null; listLabel: string; rank: number | null;
    positionRank: number | null; positionTopN: boolean; headline: DisplayHeadline | null;
    directionWithheldReason: string | null; directionWithheldText: string | null;
    reason: string | null; reasonText: string | null; trusted: false; calibratedProbability: null;
    indexTransform: "100·g / (1 + |g|) of the normalized gap g";
  };
  tracks: DisplayTrack[];
  evidence: {
    window: { games: number; spanDays: number; dates: string[]; sourceIds: number[]; seconds: number | null; minutes: number | null;
      lastGameDaysBeforeRecordedThrough: number | null; recordedThroughDate: string; fresh: boolean; freshnessText: string };
    reference: { personalGames: number; estimatorWeight: number | null; cohortEstimatorWeight: number | null; estimatorWeightNote: string;
      ageDays: number | null; ageText: string; seasons: number[]; staleDevelopmentReference: boolean; sourceIds: number[]; dates: string[] };
    donorPlayers: number | null;
    tier: "measured_process_personal_reference" | "provisional_estimated_or_extrapolated" | null; tierLabel: string; tierNote: string;
    outsidePriorSpan: boolean | null; outsidePriorComponentRange: boolean | null; extrapolationText: string | null;
    calibratedProbability: null; calibratedProbabilityText: "Unavailable (no calibrated probability exists)";
  };
  coverage: {
    notes: DisplayNote[]; imputedProcesses: string[]; physicalFloors: string[];
    context: Record<"current" | "reference", { verified: boolean; reason: string | null; text: string | null }>;
  };
  context: { heading: "Context, not part of the score"; opportunity: DisplayComparison[]; signals: DisplayContextSignal[] };
  streak: null; streakText: string;
  claims: { luckIdentified: false; marketValue: false; forecast: false; trusted: false }; claimsText: string;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const close = (a: number, b: number, scale = 1) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(scale));
function check(ok: unknown, playerId: number, what: string): asserts ok {
  if (!ok) throw new Error(`BLSH display mapping refused for player ${playerId}: ${what}`);
}
const comparison = (c: Comparison): DisplayComparison => ({
  metric: c.metric, label: METRIC_LABELS[c.metric] ?? c.metric.replace(/_/g, " "), kind: c.kind, units: c.units,
  current: c.current, reference: c.reference, delta: c.delta, status: c.status,
  reason: c.reason, referenceReason: c.referenceReason, deltaReason: c.deltaReason,
  reasonText: reasonText(c.reason), referenceReasonText: reasonText(c.referenceReason), deltaReasonText: reasonText(c.deltaReason),
  revisionVerified: c.revisionVerified, revisionText: c.revisionVerified === false ? REASON_TEXT.provider_revision_unverified : null,
});

/** Why the direction is withheld for lack of personal history, or null at or above the provisional cutoff.
 * Only zero reference games is confirmed zero; any other missing or unusable count is unknown history. */
export function personalHistoryReason(p: Profile): string | null {
  const n = p.reference.personalN, axisN = p.result.productionAxis.personal_n;
  if (!Number.isSafeInteger(n) || n < 0 || (axisN !== undefined && axisN !== n)) return PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD;
  if (n === 0) return p.reference.sourceIds.length === 0 ? NO_PERSONAL_HISTORY_LIST_WITHHELD : PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD;
  return n < BLSH_MIN_PERSONAL_GAMES ? INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD : null;
}
/** Headline (FHFH Standard) gap, support-conditioned minus observed: positive is buy-low. Null when missing, never 0. */
const headlineGap = (p: Profile) => {
  const t = p.explanation.tracks.find(x => x.track === HEADLINE_TRACK);
  return t && finite(t.gap) ? t.gap : null;
};

/** The v3 list gate's reason for withholding a profile the frozen rule would list, or null; first failing rule wins:
 * personal history, then a full window, then a headline gap that agrees with the list's direction. */
export function listWithheldReason(p: Profile): string | null {
  if (p.result.researchList === null) return null;
  const history = personalHistoryReason(p);
  if (history !== null) return history;
  if (!(p.window.appearances >= BLSH_LIST_WINDOW_GAMES)) return SHORT_WINDOW_LIST_WITHHELD;
  const gap = headlineGap(p);
  if (gap === null) return HEADLINE_TRACK_UNAVAILABLE_LIST_WITHHELD;
  return (p.result.researchList === "BL" ? gap > 0 : gap < 0) ? null : HEADLINE_TRACK_CONFLICT_LIST_WITHHELD;
}

export type ListRanks = { rank: number; positionRank: number };
/** Project one saved profile. `ranks` holds its 1-based place in its gated list (headline-gap order) and within
 * its position group on that side, or null when it is not listed. */
export function toDisplayProfile(p: Profile, ranks: ListRanks | null, recordedThroughDate: string): DisplayProfile {
  const e = p.explanation, r = p.result, id = p.playerId;
  check(e.version === SUPPORT_GAP_EXPLANATION_VERSION && e.scoreVersion === SUPPORT_GAP_VERSION && r.version === SUPPORT_GAP_VERSION, id, "version");
  check(e.claims.luckIdentified === false && e.claims.marketValue === false && e.claims.forecast === false && e.claims.trusted === false, id, "claims");
  check(e.confidence.calibratedProbability === null && r.confidenceProbability === null && r.trustedListEligible === false, id, "research semantics");
  check(e.value === r.value && e.status === r.status && e.researchList === r.researchList, id, "explanation matches the scored result");
  const g = e.normalizedGap;
  if (r.value === null) {
    check(r.status === "unavailable" && g === null && e.confidence.evidenceTier === null && !e.tracks.length && r.researchList === null, id, "unavailable score has no tier, tracks or list");
  } else {
    check(finite(r.value) && finite(g) && close(r.value, (100 * g) / (1 + Math.abs(g)), 100), id, "bounded index transform");
    check(e.confidence.evidenceTier !== null && e.tracks.length === 3, id, "numeric score has a tier and three tracks");
  }
  if (r.researchList !== null) check(r.status === "concordant_research_candidate" && p.window.fresh && (r.researchList === "BL" ? r.value! > 0 : r.value! < 0), id, "signed fresh list member");
  const listReason = listWithheldReason(p), list = listReason === null ? r.researchList : null;
  if (list !== null) check(ranks !== null && Number.isSafeInteger(ranks.rank) && ranks.rank > 0 && Number.isSafeInteger(ranks.positionRank) && ranks.positionRank > 0
    && ranks.positionRank <= ranks.rank && p.position !== null, id, "list member has a rank and a position group");
  else check(ranks === null, id, "withheld profile has no rank");
  const reason = r.value === null ? r.reason ?? null : listReason;
  const directionWithheldReason = r.value === null ? null : personalHistoryReason(p);

  const tracks: DisplayTrack[] = e.tracks.map((t, i) => {
    const componentSum = t.components.reduce((s, c) => s + c.value, 0);
    check(close(componentSum, t.gap, t.gap), id, `${t.track} components add to the gap`);
    return {
      track: t.track, label: TRACK_LABELS[i], observed: t.actual, referenceAtCurrentTOI: t.expectedBaseline, supportConditioned: t.expectedSupport, gap: t.gap,
      components: t.components.map(c => ({ id: c.id, kind: c.kind, kindLabel: KIND_LABELS[c.kind] ?? c.kind, value: c.value, note: c.note,
        processDelta: c.processDelta ?? null, referenceKind: c.referenceKind ?? null })),
      componentSum, normalizationMultiplier: t.normalizedWeight, normalizedGapContribution: t.normalizedContribution, baselineNormalizedGapContribution: t.baselineNormalizedContribution,
      role: t.track === HEADLINE_TRACK ? "headline" : "supporting",
    };
  });
  if (g !== null) check(close(tracks.reduce((s, t) => s + t.normalizedGapContribution, 0), g, g), id, "track contributions add to the normalized gap");
  const h = tracks.find(t => t.role === "headline");
  const headline: DisplayHeadline | null = h && [h.observed, h.supportConditioned, h.referenceAtCurrentTOI, h.gap].every(finite)
    ? { track: HEADLINE_TRACK, scoring: "FHFH Standard", label: "FHFH Standard points", observed: h.observed, expected: h.supportConditioned, referenceAtCurrentTOI: h.referenceAtCurrentTOI, gap: h.gap }
    : null;
  if (list !== null) check(headline !== null && (list === "BL" ? headline.gap > 0 : headline.gap < 0), id, "list member's headline gap agrees with its list");

  const notes: DisplayNote[] = [
    ...e.coverage.map((n: CoverageNote) => ({ source: "explanation" as const, component: n.component, state: n.state, reason: n.reason, text: reasonText(n.reason)!, games: null })),
    ...p.coverage.map(n => ({ source: "slot" as const, component: n.component, state: null, reason: n.reason, text: reasonText(n.reason)!,
      games: GAME_COUNT_COMPONENTS.has(n.component) ? n.count : null })),
  ];
  const contextState = (side: "current" | "reference") => {
    const verified = side === "current" ? e.scoreWindow.currentContextVerified : e.scoreWindow.referenceContextVerified;
    const reason = verified ? null : e.coverage.find(n => n.component === `${side}_window_context`)?.reason ?? null;
    check(verified || reason !== null, id, `${side} context withheld without a recorded reason`);
    return { verified, reason, text: reasonText(reason) };
  };
  const w = p.window, ref = p.reference, c = e.confidence;
  const age = w.lastDateAgeDays;
  const tier = c.evidenceTier;
  const weight = finite(c.personalWeight) ? c.personalWeight : null;
  const signals: DisplayContextSignal[] = e.context.map((s: ContextSignal) => ({ ...comparison(s), scoreInput: false, interpretation: "hypothesis",
    hypothesesHeading: "Possible explanations (not identified)", hypotheses: [...s.hypotheses], scale: s.scale ? { ...s.scale } : null }));
  check(signals.every(s => s.scoreInput === false && s.interpretation === "hypothesis"), id, "context is never a score input");

  return {
    playerId: id, name: p.name, displayName: p.name || `Player ${id} (name unavailable)`, team: p.team, position: p.position,
    score: {
      version: SUPPORT_GAP_VERSION, value: r.value, normalizedGap: g, baselineNormalizedGap: e.baselineNormalizedGap,
      gapSign: e.gapSign,
      gapSignLabel: directionWithheldReason !== null ? "Direction withheld: insufficient personal history"
        : e.gapSign === "buy_low_evidence" ? "Buy-low evidence" : e.gapSign === "sell_high_evidence" ? "Sell-high evidence" : e.gapSign === "balanced" ? "Balanced" : null,
      status: r.status, statusLabel: STATUS_LABELS[r.status] ?? r.status.replace(/_/g, " "),
      list, listLabel: list === "BL" ? "Buy-low research candidate" : list === "SH" ? "Sell-high research candidate" : "Withheld; inspect evidence",
      rank: ranks?.rank ?? null, positionRank: ranks?.positionRank ?? null, positionTopN: ranks !== null && ranks.positionRank <= BLSH_LIST_TOP_N, headline,
      directionWithheldReason, directionWithheldText: reasonText(directionWithheldReason),
      reason, reasonText: reasonText(reason),
      trusted: false, calibratedProbability: null, indexTransform: "100·g / (1 + |g|) of the normalized gap g",
    },
    tracks,
    evidence: {
      window: { games: w.appearances, spanDays: w.spanDays, dates: [...w.dates], sourceIds: [...w.sourceIds], seconds: w.seconds, minutes: w.seconds === null ? null : w.seconds / 60,
        lastGameDaysBeforeRecordedThrough: age, recordedThroughDate, fresh: w.fresh,
        freshnessText: `${age === null ? "Last game date unknown" : `Last game ${age} days before the recorded-through date (${recordedThroughDate})`}${w.fresh ? "" : "; stale window; withheld from lists"}` },
      reference: { personalGames: ref.personalN, estimatorWeight: weight, cohortEstimatorWeight: weight === null ? null : 1 - weight,
        estimatorWeightNote: "Estimator weights, shown as decimals; not confidence percentages",
        ageDays: ref.ageDays, ageText: ref.ageDays === null ? "No personal reference window" : `Reference ends ${ref.ageDays} days before the window (${ref.seasons.join(", ")})${ref.staleDevelopmentReference ? "; stale development history" : ""}`,
        seasons: [...ref.seasons], staleDevelopmentReference: ref.staleDevelopmentReference, sourceIds: [...ref.sourceIds], dates: [...ref.dates] },
      donorPlayers: c.donorPlayers,
      tier, tierLabel: tier === "measured_process_personal_reference" ? "Measured process, personal reference" : tier === "provisional_estimated_or_extrapolated" ? "Provisional: estimated or extrapolated" : "Unavailable: no score",
      tierNote: "A coverage tier, not calibrated confidence",
      outsidePriorSpan: c.outsidePriorSpan, outsidePriorComponentRange: c.outsidePriorComponentRange,
      extrapolationText: c.outsidePriorSpan || c.outsidePriorComponentRange ? "Process change outside the fitted range" : null,
      calibratedProbability: null, calibratedProbabilityText: "Unavailable (no calibrated probability exists)",
    },
    coverage: { notes, imputedProcesses: [...c.imputedProcesses], physicalFloors: [...c.physicalFloors], context: { current: contextState("current"), reference: contextState("reference") } },
    context: { heading: "Context, not part of the score", opportunity: e.opportunity.map(comparison), signals },
    streak: null, streakText: "No current-season streak is saved; streak unavailable",
    claims: { luckIdentified: false, marketValue: false, forecast: false, trusted: false },
    claimsText: "Not a luck finding, a market value, a forecast or a trusted recommendation.",
  };
}

export type ReferencePolicy = {
  arm: Profile["arm"]; inputs: "verified_inputs_only" | "official_receipt_overlay"; label: string;
  stale: boolean; provisional: true; selectedBy: string; selectedAtUTC: string;
};
export type SnapshotInput = {
  profiles: Profile[]; referencePolicy: ReferencePolicy; assemblerVersion: string; seasonId: number;
  eventThroughDate: string; asOfUTC: string; packagedAtUTC: string; sourcePins: Record<string, string>;
};
export type DisplaySnapshot = ReturnType<typeof buildDisplaySnapshot>;

/** Build the whole candidate. Every captured profile is kept. The frozen `rankTwoLists` decides list membership;
 * the saved order is the headline (FHFH Standard) gap in the list's direction, with full lists and a per-position rank. */
export function buildDisplaySnapshot(input: SnapshotInput) {
  const { profiles, referencePolicy: policy } = input;
  if (!profiles.length) throw new Error("No profiles");
  if (new Set(profiles.map(p => p.playerId)).size !== profiles.length) throw new Error("Duplicate player profile");
  if (profiles.some(p => p.arm !== policy.arm)) throw new Error("Profiles do not match the selected reference arm");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventThroughDate) || !(Date.parse(input.packagedAtUTC) > Date.parse(input.asOfUTC))) throw new Error("Invalid recorded-through, as-of or packaging time");
  const eligible = new Map(profiles.filter(p => listWithheldReason(p) === null).map(p => [p.playerId, p]));
  const lists = rankTwoLists([...eligible.values()].map(p => ({ playerId: p.playerId, snapshotDate: input.eventThroughDate, candidate: p.result })));
  const ranks = new Map<number, ListRanks>();
  for (const side of ["BL", "SH"] as const) {
    const directed = (id: number) => (side === "BL" ? 1 : -1) * headlineGap(eligible.get(id)!)!;
    const next = { F: 0, D: 0 };
    [...lists[side]].sort((a, b) => directed(b.playerId) - directed(a.playerId) || a.playerId - b.playerId).forEach((x, i) => {
      const position = eligible.get(x.playerId)!.position;
      if (position === null) throw new Error(`Listed player ${x.playerId} has no position group`);
      ranks.set(x.playerId, { rank: i + 1, positionRank: ++next[position] });
    });
  }
  const out = [...profiles].sort((a, b) => a.playerId - b.playerId).map(p => toDisplayProfile(p, ranks.get(p.playerId) ?? null, input.eventThroughDate));
  const listed = (side: "BL" | "SH", position: "F" | "D") => out.filter(p => p.score.list === side && p.position === position).length;
  const withheldFor = (reason: string) => out.filter(p => p.score.reason === reason).length;
  const zeroShot = out.filter(p => p.context.signals.find(s => s.metric === "shots_per_60")?.current === 0);
  const ages = out.map(p => p.evidence.reference.ageDays).filter(finite);
  return {
    schemaVersion: DISPLAY_SNAPSHOT_VERSION, mapperVersion: DISPLAY_MAPPER_VERSION, handoffVersion: DISPLAY_HANDOFF_VERSION,
    scoreVersion: SUPPORT_GAP_VERSION, explanationVersion: SUPPORT_GAP_EXPLANATION_VERSION, assemblerVersion: input.assemblerVersion,
    scope: "current_season_research" as const, seasonId: input.seasonId, referencePolicy: { ...policy },
    banner: `Current-season research snapshot through ${input.eventThroughDate}; provisional, exploratory; not trade advice.`,
    exploratory: true as const, provisional: true as const, trusted: false as const, productionAdopted: false as const, confidenceProbability: null, issuedAtUTC: null,
    eventThroughDate: input.eventThroughDate, asOfUTC: input.asOfUTC, packagedAtUTC: input.packagedAtUTC,
    historyGate: "simplified currentInput-style gate; not the sealed v1 transport",
    headline: {
      track: HEADLINE_TRACK, scoring: "FHFH Standard" as const, label: "FHFH Standard points gap", supportingTracks: ["goals_plus_assists", "wigo_game_score"],
      listOrder: "FHFH Standard points gap (support-conditioned expected minus observed), largest first in each list's direction",
      combinedIndexNote: "The combined index joins the three tracks without a validated weighting; it is supporting evidence, not the headline.",
    },
    lists: { topN: BLSH_LIST_TOP_N, positionGroups: ["F", "D"] as const, minPersonalGames: BLSH_MIN_PERSONAL_GAMES, minPersonalGamesProvisional: true as const, windowGames: BLSH_LIST_WINDOW_GAMES },
    overlay: input.referencePolicy.inputs === "official_receipt_overlay" ? "Official-receipt research overlay for on-ice goals; not the stored play-by-play reconstruction" : null,
    predictiveResearch: { note: "Separately, development tests on 2023-24 found the support adjustment added almost nothing to next-five-game forecasts beyond the production reference. This display is retrospective.",
      report: "tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/FORECAST-DEV-V2-REPORT.md" },
    limits: [
      "Retrospective research comparison of recorded games; not a forecast, probability, market value or trade recommendation.",
      "The reference is the 2022-24 development history and is stale; each profile shows its own reference age.",
      "Coverage tiers are not calibrated confidence; personal estimator weights are not confidence percentages.",
      "History process gate is a disclosed simplification, not the sealed v1 transport.",
      `Lists use the frozen concordant-direction rule plus three gates: at least ${BLSH_MIN_PERSONAL_GAMES} personal reference games (provisional; below it the direction is withheld, and unknown history stays apart from confirmed zero), a ${BLSH_LIST_WINDOW_GAMES}-game window, and an FHFH Standard points gap in the list's direction. Withheld and unavailable profiles stay inspectable.`,
      `Lists are ordered by the FHFH Standard points gap; the top ${BLSH_LIST_TOP_N} per side and position group (F, D) lead, and the full ranked lists are kept. G+A and Game Score are supporting tracks; the combined index is not a validated headline. A missing track is unavailable, never zero.`,
      "League-specific scoring is not in this snapshot; FHFH Standard is the default league scoring.",
      "No current-season streak is saved.",
    ],
    sourcePins: { ...input.sourcePins },
    counts: {
      profiles: out.length, numeric: out.filter(p => p.score.value !== null).length, BL: lists.BL.length, SH: lists.SH.length,
      withheld: out.filter(p => p.score.list === null).length, withheldNoPersonalHistory: out.filter(p => p.score.reason === NO_PERSONAL_HISTORY_LIST_WITHHELD).length,
      withheldPersonalHistoryUnavailable: out.filter(p => p.score.reason === PERSONAL_HISTORY_UNAVAILABLE_LIST_WITHHELD).length,
      withheldInsufficientPersonalHistory: withheldFor(INSUFFICIENT_PERSONAL_HISTORY_LIST_WITHHELD), withheldShortWindow: withheldFor(SHORT_WINDOW_LIST_WITHHELD),
      withheldHeadlineConflict: withheldFor(HEADLINE_TRACK_CONFLICT_LIST_WITHHELD), withheldHeadlineUnavailable: withheldFor(HEADLINE_TRACK_UNAVAILABLE_LIST_WITHHELD),
      directionWithheld: out.filter(p => p.score.directionWithheldReason !== null).length,
      byPosition: { F: { BL: listed("BL", "F"), SH: listed("SH", "F") }, D: { BL: listed("BL", "D"), SH: listed("SH", "D") } },
      unavailableTier: out.filter(p => p.evidence.tier === null).length,
      referenceContextAbsent: out.filter(p => p.coverage.context.reference.reason === "reference_window_not_supplied").length,
      zeroShotWindows: zeroShot.length, zeroShotNumeric: zeroShot.filter(p => p.score.value !== null).length, zeroShotListed: zeroShot.filter(p => p.score.list !== null).length,
      personalReference1to4: out.filter(p => p.evidence.reference.personalGames >= 1 && p.evidence.reference.personalGames <= 4).length,
      referenceAgeDays: ages.length ? { n: ages.length, min: Math.min(...ages), max: Math.max(...ages) } : null,
    },
    profiles: out,
  };
}
