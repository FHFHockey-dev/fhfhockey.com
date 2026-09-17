import type { BoardValidationDisclosure } from "lib/projections/starterBoardValidation";

const metricNames = { mae: "mean absolute error", brier: "Brier score", log_loss: "log loss",
  crps: "distribution score (CRPS)", interval_score: "interval score", opportunity_loss: "lineup opportunity loss" };
const readable = (value: string) => value.replace(/_/g, " ");

export default function StarterBoardValidation({ validation, className }: { validation: BoardValidationDisclosure; className?: string }) {
  return <details className={className}>
    <summary>{validation.latestReview ? "Early validation · FORGE retained · review available" : "Early validation · FORGE retained pending review"}</summary>
    <p>Early validation: projections use the best supported model available. We are collecting game results to assess accuracy and uncertainty. First review after 14 days; broader review after 30 days.</p>
    {validation.status === "unavailable" ? <p role="status">Validation records are temporarily unavailable. Accuracy and calibration status cannot be confirmed.</p> : null}
    {validation.release ? <p>Release {validation.release.key} · {validation.release.modelIdentity} · evaluation {validation.release.evaluationVersion}</p> : null}
    {validation.startedOn ? <>
      <p>Regular-season validation began {validation.startedOn} · day {validation.elapsedDays} · {validation.liveRegularSlates ?? "—"} live slates observed.</p>
      <p>{validation.evaluatedGames == null ? "Settled evaluation counts are not yet available."
        : `${validation.evaluatedGames} settled games across ${validation.evaluatedSlates} slates · ${validation.evaluatedForecasts} evaluated forecasts.`}</p>
      <ul>{validation.milestones.map((milestone) => <li key={milestone.day}>
        Day {milestone.day} review · {milestone.dueOn} · {readable(milestone.status)}
      </li>)}</ul>
    </> : <p>Regular-season validation start and settled sample counts are not yet available.</p>}
    {validation.latestReview ? <section aria-label="Latest projection review">
      <p>Latest review: {validation.latestReview.kind === "weekly" ? "weekly" : readable(validation.latestReview.kind.replace("day", "day "))} · {validation.latestReview.asOf}</p>
      <p>{validation.latestReview.evidenceClass === "captured_live" && validation.latestReview.gameType === "regular_season"
        ? "Prospective regular-season results" : "Historical or preseason results; excluded from prospective promotion requirements"}.</p>
      {validation.latestReview.metrics.length ? <ul>{validation.latestReview.metrics.map((entry, index) => <li key={index}>
        {readable(entry.target)} · {metricNames[entry.metric]}: {entry.value.toFixed(3)} ({entry.samples} forecasts; lower is better)
      </li>)}</ul> : <p>Measured accuracy and probability calibration are not yet available.</p>}
      <ul>{validation.latestReview.decisions.map((decision) => <li key={decision.component}>
        {readable(decision.component)}: {decision.decision === "eligible_for_promotion_review" ? "candidate meets comparison gates; serving component remains in place" : "serving component retained"}
        {decision.reasons.length ? <span> · {decision.reasons.map(readable).join("; ")}</span> : null}
      </li>)}</ul>
    </section> : null}
    <p>Historical and preseason results do not count toward prospective promotion requirements. Uncertainty ranges remain withheld until evaluated. Calendar time alone does not establish calibration.</p>
  </details>;
}
