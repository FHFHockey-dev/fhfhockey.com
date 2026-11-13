import type { DeploymentMatrixResponse } from "lib/drm/types";
import { sharedClock } from "./ObservedUnits";
import styles from "./drm.module.scss";
import { SHOW_DIAGNOSTICS } from "./diagnostics";

export default function MatrixCoverage({ coverage }: { coverage: DeploymentMatrixResponse["coverage"] }) {
  const excluded = coverage.games.filter(game => game.state !== "accepted");
  // Group by reason so a repeated reason is stated once, with its games under it.
  const excludedByReason = new Map<string, typeof excluded>();
  for (const game of excluded) excludedByReason.set(game.reason, [...(excludedByReason.get(game.reason) ?? []), game]);
  return <section className={styles.coverage} aria-label="Matrix coverage">
    <p role="status">{coverage.acceptedGames} of {coverage.knownFinalGames} completed games have full shift data ({coverage.scheduledGames} scheduled in this range).</p>
    <p>Only those games count toward ice time and averages. A zero means no time at this strength; games without full data aren&apos;t counted either way.</p>
    {SHOW_DIAGNOSTICS && excluded.length > 0 && <details open={coverage.acceptedGames === 0}><summary>Games outside the matrix ({excluded.length})</summary>
      {[...excludedByReason].map(([reason, games]) => <div key={reason} className={styles.coverageGroup}>
        <p>{reason.replace(/\.$/, "")} ({games.length})</p>
        <ul>{games.map(game => <li key={game.gameId}>{game.date.slice(5)} · {game.gameId}</li>)}</ul>
      </div>)}
    </details>}
    {SHOW_DIAGNOSTICS && coverage.unrepresentedFiveOnFiveSeconds > 0 && <p>{sharedClock(coverage.unrepresentedFiveOnFiveSeconds)} of 5-on-5 play used a formation other than three forwards and two defenders. That time is in the matrix, but cannot form a standard line and pair.</p>}
    {SHOW_DIAGNOSTICS && coverage.excludedSpecialTeamsSeconds > 0 && <p>{sharedClock(coverage.excludedSpecialTeamsSeconds)} of special-teams play could not form a complete supported unit. Player time remains in the relevant matrix.</p>}
  </section>;
}
