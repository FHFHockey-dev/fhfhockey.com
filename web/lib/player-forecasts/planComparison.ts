import type { PlanEvaluation, PlanningSnapshot, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";

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

function score(stats: StatLine, snapshot: PlanningSnapshot, evaluation: PlanEvaluation): number | null {
  if (!evaluation.legal || evaluation.projectedValue === null) return null;
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
  const issued = new Map(snapshot.forecasts.map(row => [`${row.playerId}:${row.gameId}`, row.stats]));
  const evaluate = (plan: PlanEvaluation, scenario: Map<string, StatLine>) => {
    const stats = { ...plan.projectedStats };
    for (const assignment of plan.assignments) {
      const key = `${assignment.playerId}:${assignment.gameId}`;
      const original = issued.get(key), draw = scenario.get(key);
      if (!original || !draw) return null;
      for (const [stat, value] of Object.entries(original)) {
        if (finite(stats[stat]) && finite(value) && finite(draw[stat])) stats[stat] = stats[stat]! - value + draw[stat]!;
        else stats[stat] = null;
      }
    }
    return score(stats, snapshot, plan);
  };
  const rows = scenarios.map(scenario => {
    const draws = new Map(scenario.games.map(row => [`${row.playerId}:${row.gameId}`, row.stats]));
    const before = evaluate(baseline, draws), after = evaluate(candidate, draws);
    return { id: scenario.id, label: scenario.label, baseline: before, candidate: after, difference: finite(before) && finite(after) ? after - before : null };
  });
  const differences = rows.map(row => row.difference);
  const direction = !rows.length || differences.some(value => !finite(value)) ? "unavailable"
    : differences.every(value => value === 0) ? "equal"
      : differences.every(value => value! >= 0) ? "candidate"
        : differences.every(value => value! <= 0) ? "baseline" : "sensitive";
  return { basis: "sensitivity", scenarios: rows, direction,
    limitations: ["These are stress scenarios, not calibrated probabilities or confidence intervals.", "Lineups and opponent remaining totals are held fixed; future availability and goalie minimum uncertainty remain separate."] };
}

/** Explicit ±20% counting-stat stresses. No invented forecast distribution or probability. */
export function comparePlanSensitivity(snapshot: PlanningSnapshot, baseline: PlanEvaluation, candidate: PlanEvaluation): PairedPlanComparison {
  const scenarios = [0.8, 1, 1.2].map(factor => ({
    id: `counting:${factor}`, label: factor === 1 ? "Issued means" : `${factor < 1 ? "−" : "+"}20% counting contributions`,
    games: snapshot.forecasts.map(forecast => ({ playerId: forecast.playerId, gameId: forecast.gameId,
      stats: Object.fromEntries(Object.entries(forecast.stats).map(([key, value]) => [key,
        finite(value) && !/MINUTES|TIME_ON_ICE|PERCENTAGE|AVERAGE/.test(key) ? value * factor : value])),
    })),
  }));
  return comparePlanScenarios(snapshot, baseline, candidate, scenarios);
}
