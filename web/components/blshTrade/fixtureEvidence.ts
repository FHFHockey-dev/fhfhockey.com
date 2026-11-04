/**
 * Synthetic Buy Low / Sell High display profiles for the Sko fixture players, typed against the
 * BLSH display contract. Fictional values only: not a research snapshot, not NHL data and not advice.
 * Several fixture players deliberately have no profile, so the view shows missing evidence as missing.
 */
import type { DisplayProfile } from "lib/buyLowSellHigh/displayProfile";
import { SUPPORT_GAP_VERSION } from "lib/buyLowSellHigh/supportGap";

export const FIXTURE_EVIDENCE_THROUGH = "2026-10-15";

type Spec = {
  playerId: number; name: string; team: string; position: "F" | "D";
  value: number | null; list: "BL" | "SH" | null; rank: number | null; status: string; statusLabel: string;
  reason?: string; reasonText?: string;
  /** Recorded FHFH Standard points and the reference at current TOI, both window totals. */
  fp?: { observed: number; reference: number };
  games: number; fresh: boolean; personalGames: number;
};

const TRACKS = [["FP", 1], ["G+A", 0.3], ["FHFH WiGO Game Score", 0.6]] as const;

function profile(spec: Spec): DisplayProfile {
  const g = spec.value === null ? null : spec.value / (100 - Math.abs(spec.value));
  const tracks = spec.fp && g !== null ? TRACKS.map(([label, scale]) => {
    const observed = spec.fp!.observed * scale, reference = spec.fp!.reference * scale, gap = reference - observed;
    return { track: label, label, observed, referenceAtCurrentTOI: reference, supportConditioned: reference, gap,
      components: [{ id: "reference_gap", kind: "reference_gap", kindLabel: "Reference vs recorded", value: gap, note: "Fixture component", processDelta: null, referenceKind: null }],
      componentSum: gap, normalizationMultiplier: 1, normalizedGapContribution: g / 3, baselineNormalizedGapContribution: g / 3 };
  }) : [];
  const gapSign = g === null ? null : g > 0 ? "buy_low_evidence" as const : g < 0 ? "sell_high_evidence" as const : "balanced" as const;
  return {
    playerId: spec.playerId, name: spec.name, displayName: spec.name, team: spec.team, position: spec.position,
    score: {
      version: SUPPORT_GAP_VERSION, value: spec.value, normalizedGap: g, baselineNormalizedGap: g, gapSign,
      gapSignLabel: gapSign === "buy_low_evidence" ? "Buy-low evidence" : gapSign === "sell_high_evidence" ? "Sell-high evidence" : gapSign === "balanced" ? "Balanced" : null,
      status: spec.status, statusLabel: spec.statusLabel, list: spec.list,
      listLabel: spec.list === "BL" ? "Buy-low research candidate" : spec.list === "SH" ? "Sell-high research candidate" : "Withheld; inspect evidence",
      rank: spec.rank, reason: spec.reason ?? null, reasonText: spec.reasonText ?? null,
      trusted: false, calibratedProbability: null, indexTransform: "100·g / (1 + |g|) of the normalized gap g",
    },
    tracks,
    evidence: {
      window: { games: spec.games, spanDays: spec.games * 2, dates: [], sourceIds: [], seconds: null, minutes: null,
        lastGameDaysBeforeRecordedThrough: spec.fresh ? 1 : 8, recordedThroughDate: FIXTURE_EVIDENCE_THROUGH, fresh: spec.fresh,
        freshnessText: `Last game ${spec.fresh ? 1 : 8} days before the recorded-through date (${FIXTURE_EVIDENCE_THROUGH})${spec.fresh ? "" : "; stale window; withheld from lists"}` },
      reference: { personalGames: spec.personalGames, estimatorWeight: spec.personalGames ? 0.7 : null, cohortEstimatorWeight: spec.personalGames ? 0.3 : null,
        estimatorWeightNote: "Estimator weights, shown as decimals; not confidence percentages",
        ageDays: spec.personalGames ? 20 : null, ageText: spec.personalGames ? "Reference ends 20 days before the window (fixture)" : "No personal reference window",
        seasons: [], staleDevelopmentReference: false, sourceIds: [], dates: [] },
      donorPlayers: null,
      tier: tracks.length ? "measured_process_personal_reference" : null,
      tierLabel: tracks.length ? "Measured process, personal reference" : "Unavailable: no score", tierNote: "A coverage tier, not calibrated confidence",
      outsidePriorSpan: null, outsidePriorComponentRange: null, extrapolationText: null,
      calibratedProbability: null, calibratedProbabilityText: "Unavailable (no calibrated probability exists)",
    },
    coverage: { notes: [], imputedProcesses: [], physicalFloors: [], context: { current: { verified: true, reason: null, text: null }, reference: { verified: true, reason: null, text: null } } },
    context: { heading: "Context, not part of the score", opportunity: [], signals: [] },
    streak: null, streakText: "No current-season streak is saved; streak unavailable",
    claims: { luckIdentified: false, marketValue: false, forecast: false, trusted: false },
    claimsText: "Not a luck finding, a market value, a forecast or a trusted recommendation.",
  };
}

const concordant = { status: "concordant_research_candidate", statusLabel: "Production and support agree in direction" };

/** Keyed by Sko fixture player id. Missing keys have no BLSH evidence. */
export const FIXTURE_BLSH_EVIDENCE: Record<string, DisplayProfile> = {
  "fx-f1": profile({ playerId: 900001, name: "Fixture Forward One", team: "FX1", position: "F", value: -21, list: "SH", rank: 9, ...concordant,
    fp: { observed: 21.4, reference: 15.8 }, games: 5, fresh: true, personalGames: 140 }),
  "fx-f3": profile({ playerId: 900003, name: "Fixture Forward Three", team: "FX3", position: "F", value: 34, list: "BL", rank: 4, ...concordant,
    fp: { observed: 4.6, reference: 12.9 }, games: 5, fresh: true, personalGames: 210 }),
  "fx-f5": profile({ playerId: 900005, name: "Fixture Forward Five", team: "FX2", position: "F", value: -38, list: "SH", rank: 2, ...concordant,
    fp: { observed: 26.2, reference: 14.1 }, games: 5, fresh: true, personalGames: 188 }),
  "fx-f6": profile({ playerId: 900006, name: "Fixture Forward Six", team: "FX3", position: "F", value: 2, list: null, rank: null,
    status: "balanced_model_estimate", statusLabel: "Balanced", fp: { observed: 5.9, reference: 6.1 }, games: 5, fresh: true, personalGames: 96 }),
  "fx-d1": profile({ playerId: 900011, name: "Fixture Defense One", team: "FX4", position: "D", value: 18, list: null, rank: null, ...concordant,
    reason: "no_personal_history_list_withheld",
    reasonText: "Withheld from lists: no personal history, so the gap is measured against the position-cohort average, not the player's own level",
    fp: { observed: 7.2, reference: 9.8 }, games: 5, fresh: true, personalGames: 0 }),
  "fx-d2": profile({ playerId: 900012, name: "Fixture Defense Two", team: "FX1", position: "D", value: null, list: null, rank: null,
    status: "unavailable", statusLabel: "Unavailable", reason: "fewer_than_five_recorded_slots", reasonText: "Fewer than five current games recorded",
    games: 2, fresh: true, personalGames: 75 }),
  "fx-d3": profile({ playerId: 900013, name: "Fixture Defense Three", team: "FX3", position: "D", value: 12, list: null, rank: null, ...concordant,
    fp: { observed: 8.1, reference: 9.4 }, games: 5, fresh: false, personalGames: 160 }),
};
