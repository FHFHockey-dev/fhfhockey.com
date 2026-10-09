import type { BenchDecision } from "lib/rosterScheduleOptimizer/planningTypes";
import styles from "./RosterScheduleOptimizer.module.scss";

const reasons: Record<BenchDecision["reason"], string> = {
  locked_bench: "Preserved bench lock.",
  locked_capacity: "Eligible active slots are locked.",
  ineligible: "No eligible active slot under these league rules.",
  unresolved_quality: "Start/sit unresolved: comparable forecast evidence is missing.",
  negative_value: "Benching this appearance avoids a negative scoring contribution.",
  whole_lineup_scoring: "Start/sit unresolved: scoring explanation unavailable.",
  schedule_capacity: "Schedule-capacity assignment; player quality remains unresolved.",
  lower_lineup_value: "The checked legal placement reduces the complete-plan score.",
  equal_lineup_value: "The checked scores are equal; this comparison does not resolve the tie.",
  category_tradeoff: "Category tradeoff under provisional contribution means.",
  minimum_priority: "The selected assignment favors projected goalie coverage. Expected starts do not satisfy a minimum.",
  decision_unresolved: "Start/sit needs review: the checked placement does not support the selected decision.",
  explanation_incomplete: "Start/sit unresolved: placement checking reached its work or time limit.",
};
const scoringReasons = new Set<BenchDecision["reason"]>(["negative_value", "lower_lineup_value", "equal_lineup_value",
  "category_tradeoff", "minimum_priority", "decision_unresolved"]);
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
  month: "short", day: "numeric", timeZone: "UTC",
});
const number = (value: number | null) => value === null ? "unknown" : value.toLocaleString("en-US", { maximumFractionDigits: 3 });
const sourceName = (kind: string) => kind === "detailed" ? "detailed game estimate"
  : kind === "baseline" ? "baseline rate estimate" : kind === "blended" ? "blended detailed/baseline estimate" : "source unspecified";

export default function BenchDecisions({ decisions, nameOf, date }: {
  decisions?: BenchDecision[]; nameOf: (id: string) => string; date?: string;
}) {
  // The existing date control bounds rendered rows even for a long custom range.
  const visible = decisions?.filter(row => !date || row.date === date) ?? [];
  if (!visible.length) return null;
  return <details className={styles.settings}>
    <summary>Why players are outside this assignment</summary>
    <p>Scoring explanations use provisional means and checked legal placements. They do not establish a global optimum or calibrated confidence.</p>
    {visible.map(row => {
      const evidence = row.evidence;
      const supported = !scoringReasons.has(row.reason) || !!evidence;
      return <article key={`${row.date}:${row.playerId}:${row.gameId}`} aria-label={`${nameOf(row.playerId)} bench decision`}>
        <p><strong>{dateLabel(row.date)} · {nameOf(row.playerId)}</strong><br />
          {supported ? reasons[row.reason] : reasons.whole_lineup_scoring}</p>
        {evidence ? <>
          <p>{evidence.lineupMode === "weekly" ? "Weekly" : "Daily"} placement window: {dateLabel(evidence.startDate)}
            {evidence.endDate !== evidence.startDate ? `–${dateLabel(evidence.endDate)}` : ""}.</p>
          <p>{evidence.scoreBasis === "category_outcomes" ? "Complete-plan category score"
            : evidence.scoreBasis === "category_assignment" ? "Complete-plan category assignment score" : "Complete-plan start/sit score"}
            {`: selected ${number(evidence.selectedScore)}; with ${nameOf(row.playerId)} ${number(evidence.withPlayerScore)}.`}</p>
          {evidence.scoreBasis !== "category_outcomes" ? <p>This assignment score is not an approved projected total or acquisition comparison.</p> : null}
          {evidence.slotChanges.length ? <ul aria-label="Changed assignments">{evidence.slotChanges.map(change => <li key={`${change.date}:${change.slotId}`}>
            {dateLabel(change.date)} · {change.slotId}: {change.selectedPlayerId ? nameOf(change.selectedPlayerId) : "Empty"}
            {" → "}{change.withPlayerId ? nameOf(change.withPlayerId) : "Empty"}
          </li>)}</ul> : null}
          {evidence.categories.length ? <ul aria-label="Category tradeoffs">{evidence.categories.map(category => <li key={category.key}>
            {category.key}: {number(category.selected)} ({category.selectedResult}) → {number(category.withPlayer)} ({category.withPlayerResult})
            {` · opponent ${number(category.opponent)}`}
          </li>)}</ul> : null}
          {evidence.goalie ? <p>Recorded goalie minimum: {number(evidence.goalie.credited)} credited / {number(evidence.goalie.required)} required {evidence.goalie.counts}.
            {` Projected progress including credited results: selected ${number(evidence.goalie.selectedProjected)}; with ${nameOf(row.playerId)} ${number(evidence.goalie.withPlayerProjected)}.`}
            {" Expected starts or appearances do not establish a satisfied minimum."}</p> : null}
          {evidence.sources.length ? <ul aria-label="Scoring source assumptions">{evidence.sources.map(source => <li key={source.playerId}>
            {nameOf(source.playerId)} · {source.kinds.map(sourceName).join(", ") || "source unspecified"}
            {source.participation?.map(input => <div key={input.gameId}>
              Game {input.gameId} · {input.basis === "start" ? "Start" : "Appearance"} assumption: {input.probability === null
                ? "separate probability unavailable; contribution already unconditional" : `${number(input.probability * 100)}%`}
              {input.basis === "start" ? input.confirmed ? " · confirmed starter evidence" : " · projected, not confirmed" : ""}.
            </div>)}
          </li>)}</ul> : <p>Source assumptions unavailable.</p>}
        </> : null}
      </article>;
    })}
  </details>;
}
