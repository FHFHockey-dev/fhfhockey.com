import { defineShareModule, type SharePostEvidence, type SharePostLoadResult, type SharePostSource } from "./contract";
import { pooledGaa, pooledSavePct } from "./shared/definitions";
import type { GoalieAppearance } from "./shared/goalieLedger";

/**
 * Ratio Impact (SS 12.0, SS-R15): what aggregate SV% and GAA come to when an entered hypothetical line joins a base.
 * Rates always come from summed saves/SA and GA/TOI seconds, never a mean of percentages. Inputs are minutes, converted once.
 */
export type RatioImpactSettings = {
  baseGoalieId: number | null; baseShots: number | null; baseGoals: number | null; baseMinutes: number | null;
  scenarioShots: number; scenarioGoals: number; scenarioMinutes: number;
  sensitivityGoalsFrom: number; sensitivityGoalsTo: number;
};
export type RatioTotals = { saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null; toiSeconds: number | null };
export type RatioRates = { savePct: number | null; gaa: number | null };
export type RatioBase = { kind: "none" | "manual" | "goalie"; goalieId: number | null; name: string | null; appearances: number | null; through: string | null; totals: RatioTotals | null };
export type RatioSensitivityRow = { goals: number; saves: number; after: RatioRates; savePctChange: number | null; gaaChange: number | null };
export type RatioImpactData = { base: RatioBase; line: RatioTotals; lineRates: RatioRates; before: RatioRates; after: RatioTotals; afterRates: RatioRates; savePctChange: number | null; gaaChange: number | null; sensitivity: RatioSensitivityRow[] };

export const SENSITIVITY_MAX_STEPS = 20;
export const RATIO_NOTE = "Arithmetic on the numbers entered, pooled from summed totals rather than averaged percentages. It predicts nothing and changes no roster.";
const emptyNumbers = (...values: (number | null)[]) => values.every(value => value === null);
const isCount = (value: number | null) => value === null || Number.isInteger(value);

export function validateRatioSettings(settings: RatioImpactSettings): string | null {
  const manual = !emptyNumbers(settings.baseShots, settings.baseGoals, settings.baseMinutes);
  if (settings.baseGoalieId !== null && manual) return "Use a goalie id or entered base totals, not both.";
  if (![settings.baseGoalieId, settings.baseShots, settings.baseGoals, settings.scenarioShots, settings.scenarioGoals, settings.sensitivityGoalsFrom, settings.sensitivityGoalsTo].every(isCount)) return "Goalie id, shots and goals must be whole numbers.";
  if (settings.baseShots !== null && settings.baseGoals !== null && settings.baseGoals > settings.baseShots) return "Base goals against cannot exceed base shots against.";
  if (settings.scenarioGoals > settings.scenarioShots) return "Hypothetical goals against cannot exceed hypothetical shots against.";
  if (settings.sensitivityGoalsFrom > settings.sensitivityGoalsTo) return "The sensitivity range must run from low to high.";
  if (settings.sensitivityGoalsTo - settings.sensitivityGoalsFrom >= SENSITIVITY_MAX_STEPS) return `The sensitivity range can hold at most ${SENSITIVITY_MAX_STEPS} steps.`;
  return null;
}

/** Minutes become seconds here, and only here. Saves are shots less goals, so a line cannot contradict itself. */
export const minutesToSeconds = (minutes: number | null) => minutes === null ? null : minutes * 60;
export const lineTotals = (shots: number | null, goals: number | null, minutes: number | null): RatioTotals => ({ saves: shots === null || goals === null ? null : shots - goals, shotsAgainst: shots, goalsAgainst: goals, toiSeconds: minutesToSeconds(minutes) });
export const ratesOf = (totals: RatioTotals | null): RatioRates => ({ savePct: pooledSavePct(totals?.saves, totals?.shotsAgainst), gaa: pooledGaa(totals?.goalsAgainst, totals?.toiSeconds) });
const add = (left: number | null, right: number | null) => left === null || right === null ? null : left + right;
/** No base leaves the line alone. A base with a missing part stays unknown in the rate that needs it, never a smaller total. */
export const addTotals = (base: RatioTotals | null, line: RatioTotals): RatioTotals => base === null ? line : { saves: add(base.saves, line.saves), shotsAgainst: add(base.shotsAgainst, line.shotsAgainst), goalsAgainst: add(base.goalsAgainst, line.goalsAgainst), toiSeconds: add(base.toiSeconds, line.toiSeconds) };
const change = (before: number | null, after: number | null) => before === null || after === null ? null : after - before;

export function manualBase(settings: RatioImpactSettings): RatioBase {
  if (emptyNumbers(settings.baseShots, settings.baseGoals, settings.baseMinutes)) return { kind: "none", goalieId: null, name: null, appearances: null, through: null, totals: null };
  return { kind: "manual", goalieId: null, name: null, appearances: null, through: null, totals: lineTotals(settings.baseShots, settings.baseGoals, settings.baseMinutes) };
}
/** A goalie's season totals in WGO seconds. One null stat leaves that part unknown. */
export function goalieBase(goalieId: number, rows: readonly GoalieAppearance[], through: string): RatioBase {
  const total = (pick: (row: GoalieAppearance) => number | null) => rows.reduce<number | null>((sum, row) => add(sum, pick(row)), 0);
  const named = [...rows].reverse().find(row => row.name)?.name ?? null;
  return { kind: "goalie", goalieId, name: named, appearances: rows.length, through, totals: rows.length ? { saves: total(row => row.saves), shotsAgainst: total(row => row.shotsAgainst), goalsAgainst: total(row => row.goalsAgainst), toiSeconds: total(row => row.toiSeconds) } : null };
}

export function ratioImpact(base: RatioBase, settings: RatioImpactSettings): RatioImpactData {
  const line = lineTotals(settings.scenarioShots, settings.scenarioGoals, settings.scenarioMinutes), before = ratesOf(base.totals), after = addTotals(base.totals, line), afterRates = ratesOf(after);
  const sensitivity: RatioSensitivityRow[] = [];
  // Goals beyond the entered shots cannot happen, so the stated range stops at them rather than printing a negative save count.
  for (let goals = settings.sensitivityGoalsFrom; goals <= Math.min(settings.sensitivityGoalsTo, settings.scenarioShots); goals++) {
    const rates = ratesOf(addTotals(base.totals, lineTotals(settings.scenarioShots, goals, settings.scenarioMinutes)));
    sensitivity.push({ goals, saves: settings.scenarioShots - goals, after: rates, savePctChange: change(before.savePct, rates.savePct), gaaChange: change(before.gaa, rates.gaa) });
  }
  return { base, line, lineRates: ratesOf(line), before, after, afterRates, savePctChange: change(before.savePct, afterRates.savePct), gaaChange: change(before.gaa, afterRates.gaa), sensitivity };
}

export const formatRatioSavePct = (value: number | null) => value === null ? "—" : value.toFixed(3).replace(/^0/, "");
export const formatRatioGaa = (value: number | null) => value === null ? "—" : value.toFixed(2);
export const formatToi = (seconds: number | null) => seconds === null ? "—" : `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;
const sign = (value: number) => value >= 0 ? "+" : "−";
export const formatSavePctChange = (value: number | null) => value === null ? "—" : `${sign(value)}${Math.abs(value).toFixed(3).replace(/^0/, "")}`;
export const formatGaaChange = (value: number | null) => value === null ? "—" : `${sign(value)}${Math.abs(value).toFixed(2)}`;
export const baseLabel = (base: RatioBase) => base.kind === "none" ? "No base entered" : base.kind === "manual" ? "Entered base" : `${base.name ?? `Goalie ${base.goalieId}`} season to date`;

export function buildRatioImpact(settings: RatioImpactSettings, base: RatioBase, source: SharePostSource | null): SharePostLoadResult<RatioImpactData> {
  const data = ratioImpact(base, settings), reasons: string[] = [];
  if (base.kind === "goalie" && base.totals === null) reasons.push(`Goalie ${base.goalieId} has no appearances this season, so no base was added.`);
  if (base.totals && Object.values(base.totals).some(value => value === null)) reasons.push("A base total is missing, so a rate that needs it is unknown.");
  const evidence: SharePostEvidence = {
    sources: [{ name: "Entered hypothetical inputs", tables: [], state: "ready", asOf: null, updatedAt: null }, ...(source ? [source] : [])],
    sample: `Hypothetical line: ${settings.scenarioShots} SA, ${settings.scenarioGoals} GA, ${formatToi(data.line.toiSeconds)} TOI. Base: ${baseLabel(base)}${base.appearances === null ? "" : `, ${base.appearances} appearances through ${base.through}`}`,
    strength: base.kind === "goalie" ? "All situations (base); line as entered" : "As entered",
    cohort: base.kind === "goalie" ? "One goalie" : "Entered totals only",
    coverage: null,
  };
  return { state: reasons.length ? "partial" : "ready", reasons, data, evidence };
}

export const ratioImpactModule = defineShareModule<RatioImpactSettings, RatioImpactData>({
  id: "ratio-impact", title: "Ratio Impact", summary: "Before and after SV% and GAA for an entered hypothetical line, pooled from totals.", group: "goalies", basis: "hypothetical",
  fields: [
    { id: "baseGoalieId", label: "Base goalie id (optional)", kind: "number", default: null, min: 1, max: 9999999, step: 1 },
    { id: "baseShots", label: "Base shots against (optional)", kind: "number", default: null, min: 0, max: 5000, step: 1 },
    { id: "baseGoals", label: "Base goals against (optional)", kind: "number", default: null, min: 0, max: 1000, step: 1 },
    { id: "baseMinutes", label: "Base minutes (optional)", kind: "number", default: null, min: 0, max: 10000, step: 1 },
    { id: "scenarioShots", label: "Hypothetical shots against", kind: "number", default: 30, min: 0, max: 500, step: 1 },
    { id: "scenarioGoals", label: "Hypothetical goals against", kind: "number", default: 3, min: 0, max: 100, step: 1 },
    { id: "scenarioMinutes", label: "Hypothetical minutes", kind: "number", default: 60, min: 0, max: 1000, step: 0.5 },
    { id: "sensitivityGoalsFrom", label: "Sensitivity: goals from", kind: "number", default: 0, min: 0, max: 100, step: 1 },
    { id: "sensitivityGoalsTo", label: "Sensitivity: goals to", kind: "number", default: 6, min: 0, max: 100, step: 1 },
  ],
  validate: validateRatioSettings,
  load: () => import("./ratioImpact.sources").then(sources => sources.loadRatioImpact),
  card: () => import("components/SocialShare/modules/RatioImpactCard").then(card => card.default),
  hasRows: data => data.afterRates.savePct !== null || data.afterRates.gaa !== null,
  altText: (snapshot, data) => `FHFH hypothetical ratio scenario. ${snapshot.evidence.sample}. Before: SV% ${formatRatioSavePct(data.before.savePct)}, GAA ${formatRatioGaa(data.before.gaa)}. After: SV% ${formatRatioSavePct(data.afterRates.savePct)}, GAA ${formatRatioGaa(data.afterRates.gaa)}. ${RATIO_NOTE}`,
});
