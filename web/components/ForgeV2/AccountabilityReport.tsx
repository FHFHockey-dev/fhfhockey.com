import type { PublicAccountability } from "../../lib/forge-v2/contracts";

const metric = (value: number | null) => value === null ? "Unavailable" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);

/** Every row names its evidence, checkpoint, units and scoring scope. */
export default function AccountabilityReport({ value }: { value: PublicAccountability }) {
  if (!value.strata?.length) return <p>Detailed accountability is unavailable for this scoring profile.</p>;
  return <>
    <p>{value.uniqueTargets} distinct player/game targets. Counts below are checkpoint observations; repeated horizons are dependent. Final-pregame results are a separate series.</p>
    {value.strata.map((row, index) => <details key={index}>
      <summary>{row.dimensions.valueKind} · {row.dimensions.series === "locked_final" ? "Locked-final" : `H${row.dimensions.horizon}`} · {row.dimensions.period} · {row.dimensions.cohort} · {row.dimensions.modelVersion ?? "No model"}</summary>
      <p>Evidence: {row.dimensions.evidenceClass.replaceAll("_", " ")} · {row.dimensions.label.replaceAll("_", " ")}. {row.requested} requested; {metric(row.forecastCoverage * 100)}% forecast coverage; {metric(row.outcomeCoverage * 100)}% outcome coverage; {row.abstentions} abstentions.</p>
      <p>{row.missingHorizons} missing horizons · {row.unresolvedOutcomes} unresolved outcomes · {row.integrityExclusions} integrity exclusions · {row.artifactFailures ?? 0} artifact failures · {row.corrections} corrections.</p>
      <p>MAE {metric(row.accuracy.mae)} · RMSE {metric(row.accuracy.rmse)} · bias {metric(row.accuracy.bias)} ({row.accuracy.count} graded).</p>
      <h3>Matched baselines</h3>
      <ul>{row.paired.map(b => <li key={b.name}>{b.name.replaceAll("_", " ")}: {b.paired} / {b.requested} paired; candidate MSE {metric(b.candidate.mse)}, baseline MSE {metric(b.baseline.mse)}, MSE improvement {metric(b.mseImprovement)}. Candidate / baseline MAE {metric(b.candidate.mae)} / {metric(b.baseline.mae)}; RMSE {metric(b.candidate.rmse)} / {metric(b.baseline.rmse)}; bias {metric(b.candidate.bias)} / {metric(b.baseline.bias)}.</li>)}</ul>
      <h3>Interval performance</h3>
      <ul>{row.intervals.map(i => <li key={i.level}>{i.level * 100}% intervals: {i.count} evaluated, {i.missing} missing; coverage {i.coverage === null ? "Unavailable" : `${metric(i.coverage * 100)}%`}, mean width {metric(i.width)}, proper interval score {metric(i.intervalScore)}.</li>)}</ul>
      <h3>Participation reliability</h3>
      <p>{row.participation.count} evaluated, {row.participation.missing} missing; Brier score {metric(row.participation.brier)}; log loss {metric(row.participation.logLoss)} ({row.participation.logLossState.replaceAll("_", " ")}); {row.participation.impossibleEvents} zero-probability realized events.</p>
      <ul>{row.participation.reliability.filter(bin => bin.count > 0).map(bin => <li key={bin.bin}>Bin {bin.bin}: {bin.count} observations; predicted {metric(bin.predicted)}, observed {metric(bin.observed)}.</li>)}</ul>
    </details>)}
  </>;
}
