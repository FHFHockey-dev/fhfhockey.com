import type { GameForecast, PlanEvaluation, PlanningSnapshot, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";
import { validForecastCalendarPolicy } from "./contributions";

export type PlanScenario = {
  id: string;
  label: string;
  /** A shared draw keyed by player/game. Reuse this exact draw for both complete plans. */
  games: Array<{ playerId: string; gameId: string; stats: StatLine }>;
};
export type PairedPlanComparison = {
  basis: "sensitivity";
  scenarios: Array<{ id: string; label: string; baseline: number | null; candidate: number | null; difference: number | null }>;
  direction: "candidate" | "baseline" | "sensitive" | "equal" | "unavailable";
  limitations: string[];
};
const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
const keyOf = (row: { playerId: string; gameId: string }) => `${row.playerId}:${row.gameId}`;
const scoringTargets = (snapshot: PlanningSnapshot) => snapshot.rules.scoring.mode === "points"
  ? Object.entries(snapshot.rules.scoring.weights).filter(([, weight]) => weight !== 0).map(([key]) => key).sort()
  : [...new Set(snapshot.rules.scoring.categories.flatMap((category) =>
    [category.numerator ?? category.key, ...(category.denominator ? [category.denominator] : [])]))].sort();

function forecastLineage(row: GameForecast, targets: string[]): string {
  return JSON.stringify({ revisionId: row.revisionId, issuedAt: row.issuedAt,
    cutoffAt: row.cutoffAt ?? null, expiresAt: row.expiresAt ?? null,
    sourceKind: row.sourceKind ?? null, issuedContext: row.issuedContext ?? null, sourceWatermark: row.sourceWatermark ?? null,
    appearanceProbability: row.appearanceProbability ?? null,
    startProbability: row.startProbability, confirmedStart: row.confirmedStart,
    targets: targets.map((target) => {
      const contribution = row.contributions?.[target];
      return { target, mean: row.stats[target], permission: contribution?.allowedUses ?? row.allowedUses,
        inputs: contribution?.inputs ?? null,
        sourceIds: [...(contribution?.sourceIds ?? [row.revisionId])].sort(),
        participationRevisionId: contribution?.participationRevisionId ?? null,
        resolverVersion: contribution?.resolverVersion ?? null, unit: contribution?.unit ?? null,
        basis: contribution?.basis ?? null, blendWeight: contribution?.blendWeight ?? null };
    }) }, (_key, value) => value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
}

function comparisonInputs(snapshot: PlanningSnapshot, baseline: PlanEvaluation, candidate: PlanEvaluation): Map<string, GameForecast> | null {
  const manifestId = snapshot.forecastManifest?.id ?? snapshot.id;
  const policy = snapshot.forecastManifest?.calendarPolicy;
  if (policy && !validForecastCalendarPolicy(policy)) return null;
  if (!manifestId || baseline.forecastManifestId !== manifestId || candidate.forecastManifestId !== manifestId ||
    baseline.comparisonEligible !== true || candidate.comparisonEligible !== true ||
    !baseline.forecastInputs || !candidate.forecastInputs) return null;
  const targets = scoringTargets(snapshot);
  if (!targets.length) return null;
  const union = new Map<string, GameForecast>();
  for (const plan of [baseline, candidate]) {
    if (!plan.legal || plan.projectedValue === null || plan.recommendation?.eligible !== true) return null;
    const forecastInputs = plan.forecastInputs;
    if (!forecastInputs) return null;
    const assigned = new Set(plan.assignments.map(keyOf));
    if (assigned.size !== plan.assignments.length || forecastInputs.length !== assigned.size) return null;
    const seen = new Set<string>();
    for (const row of forecastInputs) {
      const key = keyOf(row);
      if (!assigned.has(key) || seen.has(key) || row.conditioning !== "unconditional") return null;
      seen.add(key);
      const relevant = targets.filter((target) => Object.prototype.hasOwnProperty.call(row.stats, target));
      if (policy && row.contributions && relevant.some(target => {
        const inputs = row.contributions?.[target]?.inputs;
        return !inputs?.calendarPolicy || !validForecastCalendarPolicy(inputs.calendarPolicy)
          || inputs.calendarPolicy.calendarDays !== policy.calendarDays || inputs.horizonDays !== policy.calendarDays;
      })) return null;
      if (relevant.some((target) => !finite(row.stats[target]) ||
        (row.contributions ? row.contributions[target]?.allowedUses.comparison !== true ||
          row.contributions[target]?.allowedUses.totals !== true
          : row.allowedUses?.comparison !== true || row.allowedUses?.totals !== true))) return null;
      const existing = union.get(key);
      if (existing && forecastLineage(existing, targets) !== forecastLineage(row, targets)) return null;
      union.set(key, row);
    }
  }
  return union;
}

function score(stats: StatLine, snapshot: PlanningSnapshot, evaluation: PlanEvaluation): number | null {
  if (!evaluation.legal || evaluation.recommendation?.eligible !== true ||
    evaluation.comparisonEligible !== true || evaluation.projectedValue === null) return null;
  const scoring = snapshot.rules.scoring;
  if (scoring.mode === "points") {
    const weights = Object.entries(scoring.weights).filter(([, weight]) => weight !== 0);
    return weights.length && weights.every(([key]) => finite(stats[key]))
      ? weights.reduce((sum, [key, weight]) => sum + stats[key]! * weight, 0) : null;
  }
  if (!snapshot.opponent?.remaining) return null;
  let value = 0;
  for (const category of scoring.categories) {
    const key = category.numerator ?? category.key;
    const opponent = (stat: string) => {
      const realized = snapshot.opponent!.realized[stat], remaining = snapshot.opponent!.remaining![stat];
      return finite(realized) && finite(remaining) ? realized + remaining : null;
    };
    let own = stats[key], other = opponent(key);
    if (!finite(own) || !finite(other)) return null;
    if (category.denominator) {
      const denominator = stats[category.denominator], otherDenominator = opponent(category.denominator);
      if (!finite(denominator) || denominator <= 0 || !finite(otherDenominator) || otherDenominator <= 0) return null;
      own /= denominator; other /= otherDenominator;
    }
    const difference = (own - other) * (category.multiplier ?? 1) * (category.direction === "higher" ? 1 : -1);
    value += Math.sign(difference);
  }
  return scoring.categories.length ? value : null;
}

/** Compare fixed complete lineups, preserving shared-player/game dependence and issued inputs. */
export function comparePlanScenarios(snapshot: PlanningSnapshot, baseline: PlanEvaluation, candidate: PlanEvaluation, scenarios: PlanScenario[]): PairedPlanComparison {
  const inputs = comparisonInputs(snapshot, baseline, candidate);
  const targets = scoringTargets(snapshot);
  const evaluate = (plan: PlanEvaluation, scenario: Map<string, StatLine>) => {
    if (!inputs) return null;
    const stats = { ...plan.projectedStats };
    for (const assignment of plan.assignments) {
      const key = keyOf(assignment);
      const original = inputs.get(key)?.stats, draw = scenario.get(key);
      if (!original || !draw) return null;
      for (const stat of targets) {
        if (!Object.prototype.hasOwnProperty.call(original, stat)) continue;
        const value = original[stat];
        if (!finite(stats[stat]) || !finite(value) || !finite(draw[stat])) return null;
        stats[stat] = stats[stat]! - value + draw[stat]!;
      }
    }
    return score(stats, snapshot, plan);
  };
  const rows = scenarios.map(scenario => {
    const draws = new Map(scenario.games.map(row => [keyOf(row), row.stats]));
    const complete = draws.size === scenario.games.length;
    const before = complete ? evaluate(baseline, draws) : null;
    const after = complete ? evaluate(candidate, draws) : null;
    return { id: scenario.id, label: scenario.label, baseline: before, candidate: after, difference: finite(before) && finite(after) ? after - before : null };
  });
  const differences = rows.map(row => row.difference);
  const direction = !rows.length || differences.some(value => !finite(value)) ? "unavailable"
    : differences.every(value => value === 0) ? "equal"
      : differences.every(value => value! >= 0) ? "candidate"
        : differences.every(value => value! <= 0) ? "baseline" : "sensitive";
  return { basis: "sensitivity", scenarios: rows, direction,
    limitations: ["These are stress scenarios, not calibrated probabilities or confidence intervals.",
      "Lineups, participation, and opponent remaining totals are held fixed; future availability and goalie minimum uncertainty remain separate.",
      ...(inputs ? [] : ["Complete comparable resolved forecast inputs are unavailable."])] };
}

/** Explicit ±20% counting-stat stresses. No invented forecast distribution or probability. */
export function comparePlanSensitivity(snapshot: PlanningSnapshot, baseline: PlanEvaluation, candidate: PlanEvaluation): PairedPlanComparison {
  const inputs = comparisonInputs(snapshot, baseline, candidate);
  const scenarios = [0.8, 1, 1.2].map(factor => ({
    id: `counting:${factor}`, label: factor === 1 ? "Resolved means" : `${factor < 1 ? "−" : "+"}20% counting contributions`,
    games: [...(inputs?.values() ?? [])].map(forecast => ({ playerId: forecast.playerId, gameId: forecast.gameId,
      stats: Object.fromEntries(Object.entries(forecast.stats).map(([key, value]) => [key,
        finite(value) && !/MINUTES|TIME_ON_ICE|PERCENTAGE|AVERAGE/.test(key) ? value * factor : value])),
    })),
  }));
  return comparePlanScenarios(snapshot, baseline, candidate, scenarios);
}
