/**
 * Manager-entered trade comparison over shared interpretation records (FR-10..13).
 * Advisory only: raw projected production from unmodified FORGE horizon totals.
 * No roster, replacement or acceptance logic; incomplete inputs never yield a winner.
 */
import { LOWER_IS_BETTER, TARGET_LABELS, type InterpretationRecord } from "lib/skoElement/contract";
import { FHFH_WEIGHTS } from "./productionReference";

export type TradeScoring =
  | { mode: "points"; scoringBasis: string; weights: Record<string, number> }
  | { mode: "categories"; categories: string[] };

/** FHFH Standard (3G + 2A + PPP + .2SOG + .2HIT + .25BLK) on FORGE targets: the default league scoring. Skaters only. */
export const FHFH_STANDARD_SCORING: Extract<TradeScoring, { mode: "points" }> = { mode: "points", scoringBasis: "points:fhfh-standard", weights: {
  GOALS: FHFH_WEIGHTS.goals, ASSISTS: FHFH_WEIGHTS.assists, PP_POINTS: FHFH_WEIGHTS.pp_points,
  SHOTS_ON_GOAL: FHFH_WEIGHTS.shots, HITS: FHFH_WEIGHTS.hits, BLOCKED_SHOTS: FHFH_WEIGHTS.blocked_shots } };

/** Whether a record's forecast may be shown as a forecast: qualified, experimental (labelled) or unavailable (never a number). */
export type ForecastQualification = { status: "qualified" | "experimental" | "unavailable"; reasons: string[] };

/** Consume the interpretation's admission decision without re-running or changing its policy. */
export function forecastAdmissionReason(record: InterpretationRecord, target?: string): string | null {
  const admission = record.forecastAdmission;
  if (!admission || admission.status !== "admitted") return admission?.reasons.join("; ") || admission?.status || "forecast_admission_missing";
  if (!target) return null;
  const decision = admission.targets[target];
  if (!decision || decision.status !== "admitted") return decision?.reasons.join("; ") || "target_not_admitted";
  return null;
}

export function forecastQualification(record: InterpretationRecord): ForecastQualification {
  const admissionReason = forecastAdmissionReason(record);
  if (admissionReason) return { status: "unavailable", reasons: [`Forecast not admitted: ${admissionReason.replace(/_/g, " ")}`] };
  const unavailable = [
    ...(record.freshness.forecastStatus === "expired" ? ["Forecast expired"] : []),
    ...(!record.horizon.complete ? [`Only ${record.horizon.scheduledGames} of ${record.horizon.requestedGames} scheduled team games are covered`] : []),
  ];
  if (unavailable.length) return { status: "unavailable", reasons: unavailable };
  const experimental = [
    ...(record.fixture ? ["Fixture forecast: synthetic values, not a FORGE issuance"] : []),
    ...(record.freshness.forecastStatus === "unknown" ? ["Forecast expiry unknown"] : []),
  ];
  return experimental.length ? { status: "experimental", reasons: experimental } : { status: "qualified", reasons: [] };
}

export type TradeInput = { give: string[]; receive: string[]; scoring: TradeScoring };

export type TradeIssue = { code: string; message: string; blocking: boolean };

type SideValue = { value: number | null; missingPlayerIds: string[]; reason: string | null };

export type TradeComparison = {
  issues: TradeIssue[];
  complete: boolean;
  horizonGames: number | null;
  /** True when any player's forecast is experimental; the whole comparison is then labelled experimental. */
  experimental: boolean;
  players: Array<{ playerId: string; side: "give" | "receive"; name: string; modelClass: string; startDate: string | null; endDate: string | null; scheduledGames: number;
    qualification: ForecastQualification;
    /** Participation assumptions already inside the forecast totals (uncalibrated FORGE probabilities); null is unknown. */
    expectedAppearances: number | null; expectedStarts: number | null }>;
  rows: Array<{ key: string; label: string; lowerIsBetter: boolean; give: SideValue; receive: SideValue;
    /** receive − give in raw units. */
    net: number | null; favorableForReceiver: boolean | null }>;
  summary: string;
};

const GOALIE_RATIOS: Record<string, { numerator: string; denominator: string; multiplier: number; label: string }> = {
  SAVE_PERCENTAGE: { numerator: "SAVES_GOALIE", denominator: "SHOTS_AGAINST_GOALIE", multiplier: 1, label: "SV%" },
  GOALS_AGAINST_AVERAGE: { numerator: "GOALS_AGAINST_GOALIE", denominator: "GOALIE_MINUTES", multiplier: 60, label: "GAA" },
};
const GOALIE_KEYS = new Set(["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES", "WINS_GOALIE", "SHUTOUTS_GOALIE", ...Object.keys(GOALIE_RATIOS)]);
const applies = (record: InterpretationRecord, key: string) => (record.identity.modelClass === "G") === GOALIE_KEYS.has(key);

function sumTarget(records: InterpretationRecord[], key: string): SideValue {
  const relevant = records.filter(record => applies(record, key));
  const missing = relevant.flatMap(record => {
    const reason = forecastAdmissionReason(record, key)
      ?? (record.forecastTotals[key]?.expected == null || !Number.isFinite(record.forecastTotals[key]?.expected)
        || record.forecastTotals[key]?.unit == null ? "missing_projection" : null);
    return reason ? [{ record, reason }] : [];
  });
  if (missing.length) return { value: null, missingPlayerIds: missing.map(({ record }) => record.identity.playerId),
    reason: [...new Set(missing.map(item => item.reason))].join("; ") };
  return { value: relevant.reduce((sum, record) => sum + record.forecastTotals[key].expected!, 0), missingPlayerIds: [], reason: null };
}

const isScored = (record: InterpretationRecord, scoring: Extract<TradeScoring, { mode: "points" }>) =>
  Object.entries(scoring.weights).some(([target, weight]) => weight && applies(record, target));

function sideValue(records: InterpretationRecord[], key: string, scoring: TradeScoring): SideValue {
  if (scoring.mode === "points") {
    const missing: string[] = [], reasons: string[] = [];
    let total = 0;
    // A player with no scored statistic is withheld, never counted as zero points.
    const unscored = records.filter(record => !isScored(record, scoring)).map(record => record.identity.playerId);
    if (unscored.length) return { value: null, missingPlayerIds: unscored, reason: "unscored_player" };
    for (const record of records) for (const [target, weight] of Object.entries(scoring.weights)) {
      if (!weight || !applies(record, target)) continue;
      const value = sumTarget([record], target);
      if (value.value === null) { missing.push(record.identity.playerId); reasons.push(value.reason!); }
      else total += weight * value.value;
    }
    return missing.length ? { value: null, missingPlayerIds: [...new Set(missing)], reason: [...new Set(reasons)].join("; ") } : { value: total, missingPlayerIds: [], reason: null };
  }
  const ratio = GOALIE_RATIOS[key];
  if (!ratio) return sumTarget(records, key);
  const goalies = records.filter(record => record.identity.modelClass === "G");
  if (!goalies.length) return { value: null, missingPlayerIds: [], reason: "no_goalies" };
  const numerator = sumTarget(goalies, ratio.numerator), denominator = sumTarget(goalies, ratio.denominator);
  if (numerator.value === null || denominator.value === null) return { value: null, missingPlayerIds: [...new Set([...numerator.missingPlayerIds, ...denominator.missingPlayerIds])], reason: [numerator.reason, denominator.reason].filter(reason => reason && reason !== "missing_projection").join("; ") || "incomplete_primitives" };
  if (denominator.value <= 0) return { value: null, missingPlayerIds: [], reason: "zero_denominator" };
  return { value: ratio.multiplier * numerator.value / denominator.value, missingPlayerIds: [], reason: null };
}

/** One player's raw expected league points over the horizon, for a market-reference comparison. */
export function playerPointsTotal(record: InterpretationRecord, scoring: Extract<TradeScoring, { mode: "points" }>) {
  const reason = forecastAdmissionReason(record);
  if (reason) return { value: null, missingPlayerIds: [record.identity.playerId], reason };
  if (!record.horizon.complete) return { value: null, missingPlayerIds: [record.identity.playerId], reason: record.horizon.reason ?? "incomplete_horizon" };
  if (record.freshness.forecastStatus === "expired") return { value: null, missingPlayerIds: [record.identity.playerId], reason: "expired_forecast" };
  return sideValue([record], "FANTASY_POINTS", scoring);
}

/** One player's scored forecast values (league points, or each category), with the same withholding rules as a trade side. */
export function playerScoredValues(record: InterpretationRecord, scoring: TradeScoring) {
  const keys = scoring.mode === "points" ? ["FANTASY_POINTS"] : scoring.categories;
  return keys.map(key => ({ key, label: key === "FANTASY_POINTS" ? "League points" : GOALIE_RATIOS[key]?.label ?? TARGET_LABELS[key as keyof typeof TARGET_LABELS] ?? key,
    applies: scoring.mode === "points" || applies(record, GOALIE_RATIOS[key]?.numerator ?? key),
    ...sideValue([record], key, scoring) }));
}

export function compareTrade(input: TradeInput, records: readonly InterpretationRecord[]): TradeComparison {
  const issues: TradeIssue[] = [];
  const byId = new Map(records.map(record => [record.identity.playerId, record]));
  if (!input.give.length) issues.push({ code: "empty_give", message: "Add at least one player you give.", blocking: true });
  if (!input.receive.length) issues.push({ code: "empty_receive", message: "Add at least one player you receive.", blocking: true });
  for (const [side, ids] of [["give", input.give], ["receive", input.receive]] as const) {
    if (new Set(ids).size !== ids.length) issues.push({ code: `duplicate_${side}`, message: `A player appears twice on the ${side} side.`, blocking: true });
  }
  const both = input.give.filter(id => input.receive.includes(id));
  if (both.length) issues.push({ code: "both_sides", message: `${both.join(", ")} appears on both sides.`, blocking: true });
  const unknown = [...input.give, ...input.receive].filter(id => !byId.has(id));
  if (unknown.length) issues.push({ code: "unknown_player", message: `No shared record for ${[...new Set(unknown)].join(", ")}; the comparison is incomplete.`, blocking: true });
  const give = [...new Set(input.give)].flatMap(id => byId.get(id) ?? []);
  const receive = [...new Set(input.receive)].flatMap(id => byId.get(id) ?? []);
  const all = [...give, ...receive];
  const horizons = new Set(all.map(record => record.horizon.requestedGames));
  if (horizons.size > 1) issues.push({ code: "mixed_horizons", message: "Players use different horizons; totals are not comparable.", blocking: true });
  const bases = new Set(all.map(record => `${record.identity.forecastVersion}|${record.identity.forecastManifestId}|${record.identity.forecastReadAsOf}`));
  if (bases.size > 1) issues.push({ code: "mixed_forecast_basis", message: "Players come from different forecast issuances.", blocking: true });
  const expired = all.filter(record => record.freshness.forecastStatus === "expired");
  if (expired.length) issues.push({ code: "expired_forecast", message: `Forecast expired for ${expired.map(record => record.identity.name).join(", ")}.`, blocking: true });
  const incomplete = all.filter(record => !record.horizon.complete);
  if (incomplete.length) issues.push({ code: "incomplete_horizon", message: `${incomplete.map(record => `${record.identity.name} has ${record.horizon.scheduledGames} of ${record.horizon.requestedGames} scheduled games`).join("; ")}.`, blocking: true });
  if (input.scoring.mode === "points") {
    const scoring = input.scoring, unscored = all.filter(record => !isScored(record, scoring));
    if (unscored.length) issues.push({ code: "unscored_player", message: `${unscored.map(record => record.identity.name).join(", ")} ${unscored.length > 1 ? "have" : "has"} no scored statistic under this league scoring; add weights for ${unscored.length > 1 ? "them" : "that player"} or remove ${unscored.length > 1 ? "them" : "the player"}.`, blocking: true });
  }
  if (give.length && receive.length && give.length !== receive.length) {
    issues.push({ code: "uneven_roster", message: `Uneven sides (${give.length} for ${receive.length}); roster-slot and replacement effects are not included.`, blocking: false });
  }

  const keys = input.scoring.mode === "points" ? ["FANTASY_POINTS"] : input.scoring.categories;
  const targets = input.scoring.mode === "points"
    ? Object.entries(input.scoring.weights).filter(([, weight]) => weight !== 0).map(([key]) => key)
    : keys.flatMap(key => GOALIE_RATIOS[key] ? [GOALIE_RATIOS[key].numerator, GOALIE_RATIOS[key].denominator] : [key]);
  const refused = all.flatMap(record => {
    const overall = forecastAdmissionReason(record);
    const reasons = overall ? [overall] : [...new Set(targets)].filter(target => applies(record, target)).flatMap(target => {
      const reason = forecastAdmissionReason(record, target);
      return reason ? [`${target}: ${reason}`] : [];
    });
    return reasons.length ? [`${record.identity.name} (${reasons.join("; ").replace(/_/g, " ")})`] : [];
  });
  if (refused.length) issues.push({ code: "forecast_not_admitted", message: `Forecast not admitted for ${refused.join(", ")}; affected totals are withheld.`, blocking: true });
  const rows = keys.map(key => {
    const g = sideValue(give, key, input.scoring), r = sideValue(receive, key, input.scoring);
    const lowerIsBetter = LOWER_IS_BETTER.has(key);
    const net = g.value !== null && r.value !== null ? r.value - g.value : null;
    return { key, label: key === "FANTASY_POINTS" ? "Fantasy points" : GOALIE_RATIOS[key]?.label ?? TARGET_LABELS[key as keyof typeof TARGET_LABELS] ?? key,
      lowerIsBetter, give: g, receive: r, net, favorableForReceiver: net === null || net === 0 ? null : lowerIsBetter ? net < 0 : net > 0 };
  });
  const missing = rows.some(row => [row.give, row.receive].some(side => side.value === null && side.reason !== "no_goalies" && side.reason !== "unscored_player"));
  if (missing) issues.push({ code: "missing_projection", message: "Some players lack a projection for a scored category; affected totals are withheld.", blocking: true });
  const complete = !issues.some(issue => issue.blocking);
  const horizonGames = horizons.size === 1 ? [...horizons][0] : null;
  const qualifications = new Map(all.map(record => [record.identity.playerId, forecastQualification(record)]));
  const experimental = [...qualifications.values()].some(item => item.status === "experimental");
  const summary = !complete ? "Comparison incomplete: no result is shown until the issues above are resolved."
    : (experimental ? "Experimental forecast. " : "") + (input.scoring.mode === "categories" ? `Category vectors over each player's next ${horizonGames} scheduled team games. No overall winner without a defined league utility.`
      : `Raw projected production over each player's next ${horizonGames} scheduled team games: the receive side is ${rows[0].net! >= 0 ? "ahead" : "behind"} by ${Math.abs(rows[0].net!).toFixed(2)} fantasy points. Offer scenario only; not roster-aware and not proof the other manager accepts.`);
  return {
    issues, complete, horizonGames, experimental,
    players: [...give.map(record => ["give", record] as const), ...receive.map(record => ["receive", record] as const)].map(([side, record]) => ({
      playerId: record.identity.playerId, side, name: record.identity.name, modelClass: record.identity.modelClass,
      startDate: record.horizon.startDate, endDate: record.horizon.endDate, scheduledGames: record.horizon.scheduledGames,
      qualification: qualifications.get(record.identity.playerId)!, expectedAppearances: record.horizon.expectedAppearances, expectedStarts: record.horizon.expectedStarts })),
    rows, summary,
  };
}
