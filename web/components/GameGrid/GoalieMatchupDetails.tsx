import React from "react";
import type { GameData } from "lib/NHL/types";
import { formatGoaliePercent, GOALIE_START_DEFINITION, GOALIE_WIN_DEFINITION, type GoalieCellView } from "./utils/goalieGameView";
import styles from "./GameGrid.module.scss";

export default function GoalieMatchupDetails({ view, game, teamName, opponentName, home }: {
  view: GoalieCellView; game: GameData; teamName: string; opponentName: string; home: boolean;
}) {
  const status = view.candidate?.status;
  return <section className={styles.goalieDetails} aria-label="Goalie matchup details">
    <h2>{view.candidate?.name ?? (view.phase === "final" ? "Final game" : view.phase === "in_progress" ? "Pregame window ended" : "Goalie unavailable")}</h2>
    <p>{teamName} {home ? "vs" : "at"} {opponentName} · {home ? "Home" : "Away"}</p>
    {game.startTimeUTC && <p>Scheduled start: <time dateTime={game.startTimeUTC}>{new Date(game.startTimeUTC).toLocaleString()}</time></p>}
    <p><strong>{GOALIE_WIN_DEFINITION}</strong></p>
    <p>{GOALIE_START_DEFINITION} Neither percentage is team win odds.</p>
    {view.reason && <p>{view.reason}</p>}
    <dl>
      <dt>Win % · if starting</dt><dd>{view.win.value === null ? "Unavailable" : formatGoaliePercent(view.win.value)}{view.win.reason && ` — ${view.win.reason}`}</dd>
      <dt>Start %</dt><dd>{view.start.value === null ? "Unavailable" : formatGoaliePercent(view.start.value)}{view.start.reason && ` — ${view.start.reason}`}</dd>
      <dt>Overall credited-win probability</dt><dd>Unavailable. A qualified forecast including supported relief outcomes is required.</dd>
      <dt>Status</dt><dd>{status ? status[0].toUpperCase() + status.slice(1) : "Unknown"}. Confirmation alone does not establish a 100% start forecast.</dd>
      <dt>Candidate coverage</dt><dd>{view.candidateCoverage}</dd>
      <dt>Unresolved start probability</dt><dd>{view.unresolvedStartMass === null ? "Unavailable" : formatGoaliePercent(view.unresolvedStartMass)}. This is not an inferred backup probability.</dd>
    </dl>
    {view.candidates.length > 0 && <>
      <h3>Reported candidates</h3>
      <ul>{view.candidates.map(candidate => <li key={candidate.playerId}>
        <strong>{candidate.name}</strong> — reported {candidate.status}.
        <div>Win if starting: {view.candidateMetrics[candidate.playerId]?.win.value == null ? "Unavailable" : formatGoaliePercent(view.candidateMetrics[candidate.playerId].win.value)};
          Start: {view.candidateMetrics[candidate.playerId]?.start.value == null ? "Unavailable" : formatGoaliePercent(view.candidateMetrics[candidate.playerId].start.value)}.</div>
        {view.candidateMetrics[candidate.playerId]?.reason && <div>{view.candidateMetrics[candidate.playerId].reason}</div>}
        <details><summary>Source and timing for {candidate.name}</summary>
          <p>Source: {candidate.source.source}; revision {candidate.source.revision}. Issued {candidate.source.issuedAt};
            observation time {candidate.source.observedAt ?? "unavailable"}; input availability {candidate.source.availableAt ?? "unavailable"};
            cutoff {candidate.source.cutoffAt ?? "unavailable"}; expires {candidate.source.expiresAt}.
            {candidate.source.freshnessBasis && ` ${candidate.source.freshnessBasis}`}</p>
          {([["Win if starting", candidate.winIfStarting], ["Start", candidate.start]] as const).map(([label, forecast]) => forecast && <p key={label}>
            {label} forecast: {forecast.source.source}; artifact {forecast.source.artifactId}; revision {forecast.source.revision}; cutoff {forecast.source.cutoffAt};
            issued {forecast.source.issuedAt}; published {forecast.publishedAt}; qualification {forecast.qualification.status}; receipt {forecast.qualification.reportId ?? "unavailable"}.
          </p>)}
        </details>
      </li>)}</ul>
    </>}
    <p>Current forecasts stop at game start. Final scores, official starters and credited decisions require their own verified outcome records; this view does not reconstruct historical forecasts.</p>
  </section>;
}
