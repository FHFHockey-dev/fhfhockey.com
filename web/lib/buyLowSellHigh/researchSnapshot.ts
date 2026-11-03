/** Read-only serving contract. No scorer, detector, forecasts or network imports. */
import type { DisplayProfile, DisplaySnapshot } from "./displayProfile";

export const BLSH_SNAPSHOT_VERSION = "fhfh.blsh.historical-snapshot.v1";
export const BLSH_CURRENT_SNAPSHOT_VERSION = "fhfh.blsh.current-research-snapshot.v2";
export const BLSH_SCORE_VERSION = "support-conditioned-production-gap-v1";
export const BLSH_STREAK_VERSION = "blsh-overnight-three-track-v2";
export const BLSH_SNAPSHOT_DATE = "2024-04-18";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Vector3 = [number, number, number] | null;
export type SavedTrack = {
  status: string; availability: string; reason: string | null;
  issuedAtUTC: null; retrospectivePhaseLabelsIncluded: false;
  observation: { gameDate: string; [key: string]: JsonValue } | null;
  [key: string]: JsonValue;
};
export type StreakEvidence = {
  playerId: number; eventThroughDate: string; detectorVersion: typeof BLSH_STREAK_VERSION;
  researchOption: "block5"; productionAdopted: false; issuedAtUTC: null;
  sourceFile: string; sourceSHA256: string;
  saved: { version: string; researchOption: string; productionAdopted: false; tracks: Record<string, SavedTrack>; [key: string]: JsonValue };
};
export type FamilyMetric = {
  current: string | number | null; reference: string | number | null; delta: string | number | null;
  units: string; current_status: string; personal_comparison_status: string;
  comparison_limitation: string | null; [key: string]: JsonValue;
};
export type FamilyEvidence = {
  status: string; metrics: Record<string, FamilyMetric>; source_scope?: string;
  [key: string]: JsonValue | undefined;
};
export type BlshResearchProfile = {
  playerId: number; displayName: string | null; nameKind: string | null;
  position: string | null; team: string | null; snapshotDate: string;
  sourceLine: number; sourceProfileSHA256: string;
  score: {
    version: typeof BLSH_SCORE_VERSION; value: number | null; normalizedGap: number | null;
    productionVersion: string | null; productionP: number | null;
    status: "concordant_research_candidate" | "conflicting_baseline_and_support" | "unavailable";
    evidenceTier: "measured_process_personal_reference" | "provisional_estimated_or_extrapolated" | "unavailable";
    sourceResearchList: "BL" | "SH" | null; list: "BL" | "SH" | null; rank: number | null;
    trusted: false; confidenceProbability: null;
    actual: Vector3; baseline: Vector3; support: Vector3; adjustment: Vector3;
  };
  reference: {
    personalGames: number | null; personalWeight: number | null; cohortWeight: number | null;
    referenceAgeDays: number | null; currentAgeDays: number | null;
    currentSourceIds: number[]; currentDates: string[]; referenceSourceIds: number[]; referenceDates: string[];
  };
  coverage: {
    noCurrent: boolean; freshProxy: boolean; shots: number | null; shotsPerAppearance: number | null;
    currentProcess: Vector3; process: { imputed_indices?: number[]; modes?: string[]; outside_prior_span?: boolean; outside_prior_component_range?: boolean; [key: string]: JsonValue | undefined } | null;
    modelBinding: { reason?: string | null; [key: string]: JsonValue | undefined };
    processAdmission: JsonValue; fittingRank: number | null; donorPlayers: number | null;
  };
  families: Record<string, FamilyEvidence>;
  context: { [key: string]: JsonValue };
  streak: StreakEvidence | null;
};
export type BlshResearchSnapshot = {
  schemaVersion: typeof BLSH_SNAPSHOT_VERSION; snapshotId: string; eventThroughDate: string; seasonId: 20232024;
  scope: "historical_development"; scoreVersion: typeof BLSH_SCORE_VERSION;
  productionAdopted: false; trusted: false; confidenceProbability: null;
  sourceAvailableThroughUTC: null; retrievedAtUTC: null; issuedAtUTC: null; packagedAtUTC: string;
  sourceRunCompletedAtUTC: string; sourcePins: Record<string, string>; streakFixturePins: Record<string, string>;
  scoringProfile: string; limits: string[]; profiles: BlshResearchProfile[];
};
export type BlshPreviewSnapshot = BlshResearchSnapshot | DisplaySnapshot;
export function isCurrentResearchSnapshot(snapshot: BlshPreviewSnapshot): snapshot is DisplaySnapshot {
  return snapshot.schemaVersion === BLSH_CURRENT_SNAPSHOT_VERSION;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finiteOrNull = (v: unknown) => v === null || typeof v === "number" && Number.isFinite(v);
const day = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const requireValue = (ok: unknown, reason: string): void => { if (!ok) throw new Error(`Invalid BLSH snapshot: ${reason}`); };

function safeNumbers(value: unknown): void {
  if (typeof value === "number") requireValue(Number.isFinite(value), "nonfinite number");
  else if (Array.isArray(value)) value.forEach(safeNumbers);
  else if (isRecord(value)) Object.values(value).forEach(safeNumbers);
}

/** Fail closed on identity, chronology, availability, version or list-state drift. */
export function parseHistoricalResearchSnapshot(input: unknown): BlshResearchSnapshot {
  requireValue(isRecord(input), "object required");
  const s = input as BlshResearchSnapshot;
  requireValue(s.schemaVersion === BLSH_SNAPSHOT_VERSION && s.scoreVersion === BLSH_SCORE_VERSION, "version");
  requireValue(s.eventThroughDate === BLSH_SNAPSHOT_DATE && s.seasonId === 20232024 && s.scope === "historical_development", "frozen development scope");
  requireValue(s.productionAdopted === false && s.trusted === false && s.confidenceProbability === null, "research only");
  requireValue(s.issuedAtUTC === null && s.sourceAvailableThroughUTC === null && s.retrievedAtUTC === null, "no historical issuance/availability claim");
  requireValue(Array.isArray(s.profiles) && s.profiles.length > 0 && s.profiles.length <= 1000, "bounded profiles");
  requireValue(Array.isArray(s.limits) && typeof s.scoringProfile === "string", "limitations/scoring profile");
  const ids = new Set<number>(); const ranks = { BL: new Set<number>(), SH: new Set<number>() };
  for (const p of s.profiles) {
    requireValue(Number.isSafeInteger(p.playerId) && p.playerId > 0 && !ids.has(p.playerId), "unique player identity"); ids.add(p.playerId);
    requireValue(p.snapshotDate === s.eventThroughDate && Number.isSafeInteger(p.sourceLine) && p.sourceLine > 0, "profile origin");
    requireValue(p.score.version === s.scoreVersion && p.score.trusted === false && p.score.confidenceProbability === null, "profile semantics");
    requireValue(finiteOrNull(p.score.value) && finiteOrNull(p.score.productionP), "numeric score or null");
    requireValue(["concordant_research_candidate", "conflicting_baseline_and_support", "unavailable"].includes(p.score.status), "score state");
    requireValue(["measured_process_personal_reference", "provisional_estimated_or_extrapolated", "unavailable"].includes(p.score.evidenceTier), "coverage tier");
    requireValue(typeof p.coverage.freshProxy === "boolean" && typeof p.coverage.noCurrent === "boolean", "freshness/participation");
    for (const v of [p.score.actual, p.score.baseline, p.score.support, p.score.adjustment]) {
      requireValue(v === null || Array.isArray(v) && v.length === 3 && v.every(n => typeof n === "number" && Number.isFinite(n)), "three-track vector or unavailable");
    }
    for (const [dates, sourceIds] of [[p.reference.currentDates, p.reference.currentSourceIds], [p.reference.referenceDates, p.reference.referenceSourceIds]] as const) {
      requireValue(Array.isArray(dates) && Array.isArray(sourceIds) && dates.length === sourceIds.length, "window membership");
      requireValue(dates.every((d, i) => day(d) && d <= s.eventThroughDate && (i === 0 || dates[i - 1] <= d)), "as-of window dates");
      requireValue(new Set(sourceIds).size === sourceIds.length && sourceIds.every(Number.isSafeInteger), "window source identities");
    }
    if (p.reference.currentDates.length && p.reference.referenceDates.length) requireValue(p.reference.referenceDates.at(-1)! < p.reference.currentDates[0], "reference strictly before current window");
    requireValue(p.score.value !== null || p.score.status === "unavailable", "null is unavailable");
    if (p.score.list !== null) {
      const side = p.score.list;
      requireValue(side === "BL" || side === "SH", "list side");
      requireValue(p.score.value !== null && p.score.status === "concordant_research_candidate" && p.coverage.freshProxy && !p.coverage.noCurrent, "list eligibility");
      requireValue(side === p.score.sourceResearchList && (side === "BL" ? p.score.value! > 0 : p.score.value! < 0), "signed list");
      requireValue(Number.isSafeInteger(p.score.rank) && p.score.rank! > 0 && !ranks[side].has(p.score.rank!), "unique saved rank"); ranks[side].add(p.score.rank!);
    } else requireValue(p.score.rank === null, "withheld rank");
    for (const weight of [p.reference.personalWeight, p.reference.cohortWeight]) requireValue(weight === null || typeof weight === "number" && weight >= 0 && weight <= 1, "weight");
    if (p.streak) {
      const t = p.streak;
      requireValue(t.playerId === p.playerId && t.eventThroughDate === p.snapshotDate && t.detectorVersion === BLSH_STREAK_VERSION && t.researchOption === "block5", "exact streak match");
      requireValue(t.productionAdopted === false && t.issuedAtUTC === null && t.saved.version === t.detectorVersion && t.saved.researchOption === "block5", "streak research semantics");
      for (const key of ["fantasy_points", "raw_points", "wigo_game_score", "composite"]) {
        const track = t.saved.tracks[key];
        requireValue(track && track.issuedAtUTC === null && track.retrospectivePhaseLabelsIncluded === false, "no backdated alert");
        requireValue(!track.observation || day(track.observation.gameDate) && track.observation.gameDate <= s.eventThroughDate, "streak observation cutoff");
      }
    }
  }
  for (const side of ["BL", "SH"] as const) for (let rank = 1; rank <= ranks[side].size; rank++) requireValue(ranks[side].has(rank), "contiguous saved ranks");
  safeNumbers(s);
  return s;
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const utc = (v: unknown): v is string => typeof v === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const hash = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const currentStates = ["concordant_research_candidate", "conflicting_baseline_and_support", "support_direction_without_baseline_concordance", "balanced_model_estimate", "unavailable"];

/** Validate saved display values only. No ranking, estimation or missing-value substitution. */
export function parseCurrentResearchSnapshot(input: unknown): DisplaySnapshot {
  requireValue(isRecord(input), "object required");
  const s = input as DisplaySnapshot;
  requireValue(s.schemaVersion === BLSH_CURRENT_SNAPSHOT_VERSION && s.scoreVersion === BLSH_SCORE_VERSION, "current version");
  requireValue(s.scope === "current_season_research" && s.seasonId === 20262027 && ["2026-10-26", "2026-10-28"].includes(s.eventThroughDate), "frozen current scope");
  requireValue(s.provisional === true && s.exploratory === true && s.trusted === false && s.productionAdopted === false && s.confidenceProbability === null && s.issuedAtUTC === null, "current research only");
  requireValue(utc(s.asOfUTC) && utc(s.packagedAtUTC) && Date.parse(s.packagedAtUTC) > Date.parse(s.asOfUTC) && s.eventThroughDate <= s.asOfUTC.slice(0, 10), "capture/packaging chronology");
  const policy = s.referencePolicy;
  requireValue(isRecord(policy) && policy.arm === "A_development_reference" && policy.inputs === "official_receipt_overlay" && policy.stale === true && policy.provisional === true && policy.selectedBy === "TJ" && utc(policy.selectedAtUTC), "selected provisional reference");
  requireValue(Date.parse(policy.selectedAtUTC) <= Date.parse(s.packagedAtUTC), "selection before packaging");
  requireValue(typeof policy.label === "string" && typeof s.historyGate === "string" && typeof s.overlay === "string" && Array.isArray(s.limits), "current limitations");
  requireValue(isRecord(s.sourcePins) && Object.keys(s.sourcePins).length > 0 && Object.values(s.sourcePins).every(hash), "source pins");
  requireValue(Array.isArray(s.profiles) && s.profiles.length > 0 && s.profiles.length <= 1000, "bounded current profiles");
  const ids = new Set<number>(), ranks = { BL: new Set<number>(), SH: new Set<number>() };
  for (const p of s.profiles) {
    requireValue(Number.isSafeInteger(p.playerId) && p.playerId > 0 && !ids.has(p.playerId), "unique current identity"); ids.add(p.playerId);
    const score = p.score, evidence = p.evidence, w = evidence.window, ref = evidence.reference;
    requireValue(score.version === s.scoreVersion && score.trusted === false && score.calibratedProbability === null && evidence.calibratedProbability === null, "profile research semantics");
    requireValue(isRecord(p.claims) && ["luckIdentified", "marketValue", "forecast", "trusted"].every(k => p.claims[k as keyof typeof p.claims] === false) && p.streak === null, "no unsupported claims or streak");
    requireValue(currentStates.includes(score.status) && finiteOrNull(score.value) && finiteOrNull(score.normalizedGap) && finiteOrNull(score.baselineNormalizedGap), "current score state");
    requireValue(typeof w.fresh === "boolean" && w.recordedThroughDate === s.eventThroughDate, "recorded-through freshness anchor");
    for (const member of [w, ref]) {
      requireValue(Array.isArray(member.dates) && Array.isArray(member.sourceIds) && member.dates.length === member.sourceIds.length, "current window membership");
      requireValue(member.dates.every((d, i) => day(d) && d <= s.eventThroughDate && (i === 0 || member.dates[i - 1] <= d)), "current as-of dates");
      requireValue(member.sourceIds.every(n => Number.isSafeInteger(n) && n > 0) && new Set(member.sourceIds).size === member.sourceIds.length, "current source identities");
    }
    requireValue(!ref.dates.length || w.dates.length && ref.dates.at(-1)! < w.dates[0], "current reference strictly before window");
    requireValue(ref.dates.every(d => d <= "2024-04-18") && ref.seasons.every(n => n === 20222023 || n === 20232024), "development reference custody");
    for (const weight of [ref.estimatorWeight, ref.cohortEstimatorWeight]) requireValue(weight === null || typeof weight === "number" && weight >= 0 && weight <= 1, "current estimator weight");
    requireValue(Array.isArray(p.tracks), "display tracks");
    if (score.value === null) requireValue(score.status === "unavailable" && score.normalizedGap === null && evidence.tier === null && p.tracks.length === 0 && score.list === null && typeof score.reason === "string", "unavailable stays unavailable");
    else {
      requireValue(score.status !== "unavailable" && evidence.tier !== null && ["measured_process_personal_reference", "provisional_estimated_or_extrapolated"].includes(evidence.tier) && p.tracks.length === 3, "numeric score coverage");
      requireValue(typeof score.normalizedGap === "number" && close(score.value, 100 * score.normalizedGap / (1 + Math.abs(score.normalizedGap))), "saved index transform");
      const labels = new Set<string>();
      for (const t of p.tracks) {
        requireValue(!labels.has(t.track), "unique production track"); labels.add(t.track);
        requireValue([t.observed, t.referenceAtCurrentTOI, t.supportConditioned, t.gap, t.componentSum, t.normalizationMultiplier, t.normalizedGapContribution, t.baselineNormalizedGapContribution].every(n => typeof n === "number" && Number.isFinite(n)), "finite track values");
        requireValue(Array.isArray(t.components) && t.components.every(c => typeof c.value === "number" && Number.isFinite(c.value)), "finite components");
        requireValue(close(t.components.reduce((sum, c) => sum + c.value, 0), t.gap) && close(t.componentSum, t.gap) && close(t.supportConditioned - t.observed, t.gap), "additive track components");
        requireValue(close(t.gap * t.normalizationMultiplier, t.normalizedGapContribution), "normalized contribution");
      }
      requireValue(close(p.tracks.reduce((sum, t) => sum + t.normalizedGapContribution, 0), score.normalizedGap!), "joint normalized gap");
    }
    if (score.list !== null) {
      const side = score.list;
      requireValue(side === "BL" || side === "SH", "current list side");
      requireValue(score.status === "concordant_research_candidate" && score.value !== null && w.fresh && (side === "BL" ? score.value! > 0 : score.value! < 0), "current signed fresh list");
      requireValue(Number.isSafeInteger(score.rank) && score.rank! > 0 && !ranks[side].has(score.rank!), "unique current rank"); ranks[side].add(score.rank!);
    } else requireValue(score.rank === null, "current withheld rank");
    requireValue(p.coverage.notes.every(n => typeof n.text === "string" && n.text.length > 0 && (n.games === null || ["current_window_slot", "reference_slot"].includes(n.component) && Number.isSafeInteger(n.games) && n.games > 0)), "coverage note units");
    requireValue(Object.values(p.coverage.context).every(c => typeof c.verified === "boolean" && (c.verified || typeof c.reason === "string" && typeof c.text === "string")), "recorded context reason");
    requireValue(p.context.signals.every(c => c.scoreInput === false && c.interpretation === "hypothesis"), "context is not a score input");
  }
  for (const side of ["BL", "SH"] as const) for (let rank = 1; rank <= ranks[side].size; rank++) requireValue(ranks[side].has(rank), "contiguous current ranks");
  const counts = s.counts;
  requireValue(counts.profiles === s.profiles.length && counts.BL === ranks.BL.size && counts.SH === ranks.SH.size && counts.withheld === s.profiles.length - ranks.BL.size - ranks.SH.size && counts.numeric === s.profiles.filter(p => p.score.value !== null).length && counts.unavailableTier === s.profiles.filter(p => p.evidence.tier === null).length, "saved population counts");
  safeNumbers(s);
  return s;
}

export function parseResearchSnapshot(input: BlshResearchSnapshot): BlshResearchSnapshot;
export function parseResearchSnapshot(input: DisplaySnapshot): DisplaySnapshot;
export function parseResearchSnapshot(input: unknown): BlshPreviewSnapshot;
export function parseResearchSnapshot(input: unknown): BlshPreviewSnapshot {
  return isRecord(input) && input.schemaVersion === BLSH_CURRENT_SNAPSHOT_VERSION ? parseCurrentResearchSnapshot(input) : parseHistoricalResearchSnapshot(input);
}

export function currentResearchLists(snapshot: DisplaySnapshot) {
  const rows = (side: "BL" | "SH") => snapshot.profiles.filter(p => p.score.list === side).sort((a, b) => a.score.rank! - b.score.rank!);
  return { BL: rows("BL"), SH: rows("SH"), withheld: snapshot.profiles.filter(p => p.score.list === null) };
}
export function currentStateLabel(p: DisplayProfile) {
  return `${p.score.reasonText ?? p.score.statusLabel} · ${p.evidence.tierLabel}; stale reference`;
}

/** Saved event age only: `fresh` also requires production and is not an age flag. */
export function currentWindowAgeText(w: DisplayProfile["evidence"]["window"]) {
  const age = w.lastGameDaysBeforeRecordedThrough;
  if (age === null || !Number.isSafeInteger(age) || age < 0) {
    return `Last game age unknown at the recorded-through date (${w.recordedThroughDate}); window-age eligibility unknown`;
  }
  return `Last game ${age} ${age === 1 ? "day" : "days"} before the recorded-through date (${w.recordedThroughDate}); ${age <= 7 ? "within" : "outside"} the saved seven-day window-age limit`;
}

export function savedResearchLists(snapshot: BlshResearchSnapshot) {
  const rows = (side: "BL" | "SH") => snapshot.profiles.filter(p => p.score.list === side).sort((a, b) => a.score.rank! - b.score.rank!);
  return { BL: rows("BL"), SH: rows("SH"), withheld: snapshot.profiles.filter(p => p.score.list === null) };
}
export function profileName(p: BlshResearchProfile) { return p.displayName || `Player ${p.playerId} (name unavailable)`; }
export function stateLabel(p: BlshResearchProfile): string {
  if (p.coverage.noCurrent) return "No current-window evidence";
  if (p.score.status === "conflicting_baseline_and_support") return "Conflicting production/support evidence";
  if (p.score.value === null) return "Insufficient evidence";
  if (!p.coverage.freshProxy) return "Stale historical window; withheld";
  if (p.score.value === 0) return "Balanced evidence";
  return p.score.evidenceTier === "measured_process_personal_reference" ? "Personal-reference process coverage" : "Provisional / estimated support";
}
export function numberText(value: number | string | null | undefined, digits = 2, signed = false) {
  if (value === null || value === undefined) return "Unavailable";
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? `${signed && n > 0 ? "+" : ""}${n.toFixed(digits)}` : "Unavailable";
}
