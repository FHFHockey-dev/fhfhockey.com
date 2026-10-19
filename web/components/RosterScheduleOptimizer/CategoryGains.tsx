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
const formatPoints = (value: number) => new Intl.NumberFormat("en-US", { maximumSignificantDigits: 5,
  notation: value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1e6) ? "scientific" : "standard" }).format(value);

export default function CategoryGains({ baseline, plan, scoring, label, reviewed }: Props) {
  const comparable = baseline?.legal && plan?.legal && baseline.budgetVerified && plan.budgetVerified
    && baseline.comparisonEligible === true && plan.comparisonEligible === true
    && !!baseline.forecastManifestId && baseline.forecastManifestId === plan.forecastManifestId;
  if (scoring.mode === "points") {
    const before = baseline?.projectedValue, after = plan?.projectedValue;
    const known = comparable && finite(before) && finite(after);
    const denominator = known ? Math.max(Math.abs(before), Math.abs(after)) : 0;
    // Normalize before comparing. Subtract the threshold from the larger
    // normalized operand so the exact 95/100 display boundary stays inclusive.
    const similar = known && (denominator === 0
      || Math.min(before / denominator, after / denominator) >= Math.max(before / denominator, after / denominator) - 0.05);
    const absoluteDifference = known ? Math.abs(after - before) : null;
    return <details className={styles.settings}>
      <summary>{label} · projected points comparison</summary>
      <p>Actual startable plan totals over this date range, including displaced roster contributions and league scoring.</p>
      {known ? <>
        <p>No move {formatPoints(before)} → plan {formatPoints(after)}</p>
        <p>{finite(absoluteDifference) ? `Absolute point difference ${formatPoints(absoluteDifference)}`
          : "Absolute point difference exceeds the numeric display range."}</p>
        {similar && <p>Similar projected points · provisional 5% display rule</p>}
        <p>Five percent uses the larger absolute plan total; two supported zero totals are equal. This is not a confidence interval or an automatic decision.{!reviewed && " Review planning inputs before acting."}</p>
      </> : <p>Projected points comparison unavailable. Review forecast coverage, scope, acquisition rules and goalie minimums.</p>}
    </details>;
  }
  return <details className={styles.settings}>
    <summary>{label} · category gains</summary>
    <p>Change from the no-move lineup, using starting assignments after acquisition timing, locks and eligibility checks. Displaced roster contributions are included. Ratios use each full lineup&apos;s numerator and denominator.</p>
    {!comparable && <p>{baseline?.legal === false
      ? baseline.limitations.some(text => text.startsWith("Locked assignment for"))
        ? "Category gains unavailable: the no-move lineup cannot satisfy the current lineup locks."
        : "Category gains unavailable: the no-move plan fails current league or roster rules."
      : "Category gains unavailable. Review forecast coverage, opponent inputs, acquisition rules and goalie minimums."}</p>}
    {[...scoring.categories].sort((a, b) => {
      const losing = (key: string) => comparable && baseline?.categoryResults.find(row => row.key === key)?.result === "loss" ? 1 : 0;
      return losing(b.key) - losing(a.key);
    }).map(category => {
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
    <p>Losing categories appear first using provisional mean comparisons. Category changes are not win probabilities; a matchup win-probability model is unavailable. Review the category tradeoffs and choose the plan.{!reviewed && " Review planning inputs before acting."}</p>
  </details>;
}
