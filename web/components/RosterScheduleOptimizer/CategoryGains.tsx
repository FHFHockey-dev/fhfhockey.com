import type { LeagueRules, PlanEvaluation } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./RosterScheduleOptimizer.module.scss";

type Props = {
  baseline?: PlanEvaluation;
  plan?: PlanEvaluation;
  scoring: LeagueRules["scoring"];
  label: string;
  reviewed: boolean;
};
const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
const format = (value: number) => new Intl.NumberFormat("en-US", { maximumSignificantDigits: 5 }).format(value);

export default function CategoryGains({ baseline, plan, scoring, label, reviewed }: Props) {
  if (scoring.mode !== "categories") return null;
  const comparable = baseline?.legal && plan?.legal && baseline.budgetVerified && plan.budgetVerified
    && baseline.comparisonEligible === true && plan.comparisonEligible === true
    && !!baseline.forecastManifestId && baseline.forecastManifestId === plan.forecastManifestId;
  return <details className={styles.settings}>
    <summary>{label} · category gains</summary>
    <p>Change from the optimized no-move lineup, using starting assignments after acquisition timing, locks and eligibility checks. Displaced roster contributions are included. Ratios use each full lineup&apos;s numerator and denominator.</p>
    {!comparable && <p>Category gains unavailable. Review forecast coverage, opponent inputs, acquisition rules and goalie minimums.</p>}
    {scoring.categories.map(category => {
      const before = baseline?.categoryResults.find(row => row.key === category.key);
      const after = plan?.categoryResults.find(row => row.key === category.key);
      const available = comparable && !!before && !!after && finite(before.own) && finite(after.own)
        && finite(after.opponent) && before?.opponent === after.opponent
        && before.result !== "unknown" && after.result !== "unknown";
      const difference = available ? after.own! - before.own! : null;
      return <article className={styles.categoryGain} key={category.key} aria-label={`${label} ${category.key} gain`}>
        <strong>{category.key} · {category.direction} is better</strong>
        {difference === null ? <span>Change unavailable</span> : <>
          <span>No move {format(before!.own!)} → plan {format(after!.own!)} · Δ {difference > 0 ? "+" : ""}{format(difference)}</span>
          <span>Opponent {format(after!.opponent!)} · {before!.result} → {after!.result}</span>
        </>}
      </article>;
    })}
    <p>Provisional estimates; category changes are not win probabilities.{!reviewed && " Review planning inputs before acting."}</p>
  </details>;
}
