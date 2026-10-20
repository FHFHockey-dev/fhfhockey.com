import { categoryFormatter } from "lib/rosterScheduleOptimizer/categoryFormat";
import { swapCategoryBreakdown } from "lib/rosterScheduleOptimizer/planning";
import type { LeagueRules, PlanEvaluation, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./RosterScheduleOptimizer.module.scss";

type Props = {
  baseline?: PlanEvaluation;
  plan?: PlanEvaluation;
  scoring: LeagueRules["scoring"];
  label: string;
  reviewed: boolean;
  /** Needed for the whole-swap gain/sacrifice breakdown; without it category changes stay unavailable. */
  snapshot?: PlanningSnapshot | null;
};
const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);
const format = (value: number) => new Intl.NumberFormat("en-US", { maximumSignificantDigits: 5 }).format(value);
const formatPoints = (value: number) => new Intl.NumberFormat("en-US", { maximumSignificantDigits: 5,
  notation: value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1e6) ? "scientific" : "standard" }).format(value);

const signed = (value: number) => `${value > 0 ? "+" : ""}${format(value)}`;

export default function CategoryGains({ baseline, plan, scoring, label, reviewed, snapshot }: Props) {
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
  // The planner's own values, split into gains and sacrifices (R8). Null when the plans can't be compared at all.
  const rows = snapshot && baseline && plan ? swapCategoryBreakdown(snapshot, baseline, plan) : null;
  return <details className={styles.settings}>
    <summary>{label} · category gains</summary>
    <p>Change from the no-move lineup, using starting assignments after acquisition timing, locks and eligibility checks. Gains are what added players contribute on days they start; sacrifices are what dropped or displaced players no longer contribute. Ratios use each full lineup&apos;s numerator and denominator.</p>
    {!rows && <p>{baseline?.legal === false
      ? baseline.limitations.some(text => text.startsWith("Locked assignment for"))
        ? "Category gains unavailable: the no-move lineup cannot satisfy the current lineup locks."
        : "Category gains unavailable: the no-move plan fails current league or roster rules."
      : "Category gains unavailable. Review forecast coverage, opponent inputs, acquisition rules and goalie minimums."}</p>}
    {[...scoring.categories].sort((a, b) => {
      const losing = (key: string) => rows && baseline?.categoryResults.find(row => row.key === key)?.result === "loss" ? 1 : 0;
      return losing(b.key) - losing(a.key);
    }).map(category => {
      const row = rows?.find(item => item.key === category.key);
      const before = baseline?.categoryResults.find(item => item.key === category.key);
      const after = plan?.categoryResults.find(item => item.key === category.key);
      const known = row?.coverage === "known" && finite(row.before) && finite(row.after) && finite(row.delta);
      const opponent = known && finite(row.opponent) && before?.opponent === after?.opponent && before?.result !== "unknown" && after?.result !== "unknown";
      const unit = row && categoryFormatter(row, format);
      const change = known ? `No move ${unit!.value(row.before!)} → plan ${unit!.value(row.after!)} · Δ ${unit!.delta(row.delta!)}` : "";
      const split = known && !row.ratio && finite(row.gain) && finite(row.sacrifice) ? `gain ${format(row.gain)} / sacrifice ${format(row.sacrifice)}` : null;
      return <article className={styles.categoryGain} key={category.key} aria-label={`${label} ${category.key} gain`}>
        <strong>{category.key} · {category.direction} is better</strong>
        {!row ? <span>Change unavailable</span> : !known ? <span>Incomplete: {row.reason}</span> : <>
          {opponent ? <span>{change}</span> : <span>{[change, split, "no opponent scoreboard"].filter(Boolean).join(" · ")}</span>}
          {opponent && split && <span>{split}</span>}
          {row.components && <span>{category.key}: pooled {unit!.value(row.before!)} → {unit!.value(row.after!)} · components {row.components.numerator.key} {signed(row.components.numerator.net)} / {row.components.denominator.key} {signed(row.components.denominator.net)}</span>}
          {opponent && <span>Opponent {unit!.value(after!.opponent!)} · {before!.result} → {after!.result}</span>}
        </>}
      </article>;
    })}
    <p>Losing categories appear first using provisional mean comparisons. Category changes are not win probabilities; a matchup win-probability model is unavailable. Review the category tradeoffs and choose the plan.{!reviewed && " Review planning inputs before acting."}</p>
  </details>;
}
