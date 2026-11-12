import type { PlanEvaluation, PlanningSnapshot } from "./planningTypes";

const finite = (value: number | null | undefined): value is number => value !== null && value !== undefined && Number.isFinite(value);

/** Ratio categories (those with a denominator) in which `plan` is worse than `reference`, or unknown in either; exact,
 * direction-aware and with no materiality threshold (decision 51): more starts never outrank them. */
export function ratioCategoriesWorse(snapshot: Pick<PlanningSnapshot, "rules">, plan: Pick<PlanEvaluation, "categoryResults">,
  reference: Pick<PlanEvaluation, "categoryResults">): string[] {
  return snapshot.rules.scoring.categories.filter(category => category.denominator).flatMap(category => {
    const own = plan.categoryResults.find(row => row.key === category.key)?.own, base = reference.categoryResults.find(row => row.key === category.key)?.own;
    return !finite(own) || !finite(base) || (own - base) * (category.direction === "higher" ? 1 : -1) < 0 ? [category.key] : [];
  });
}
const same = (left: readonly string[], right: readonly string[]) => left.length === right.length && left.every((key, index) => key === right[index]);
/** The points difference between two evaluations of one snapshot, or null when it isn't known. Both fully priced: the
 * difference of totals. Otherwise (TJ, 2026-11-12) only when both known parts price, the unknown-valued roster players
 * are the same and their active plays are identical, so the same unknown contribution cancels; when unknown
 * contributions differ (one is added, dropped, started or benched) the comparison is unavailable. */
export function comparablePointsDelta(plan: PlanEvaluation, baseline: PlanEvaluation): number | null {
  if (plan.comparisonEligible && baseline.comparisonEligible && finite(plan.projectedValue) && finite(baseline.projectedValue))
    return plan.projectedValue - baseline.projectedValue;
  const a = plan.knownComparison, b = baseline.knownComparison;
  if (!a || !b || !same(a.unknownActive, b.unknownActive) || !same(a.unknownPlayerIds, b.unknownPlayerIds)) return null;
  const delta = a.knownValue - b.knownValue;
  return finite(delta) ? delta : null;
}
