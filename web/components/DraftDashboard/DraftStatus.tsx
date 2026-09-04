import styles from "./DraftWorkspace.module.scss";

interface DraftStatusProps {
  round: number;
  rounds: number;
  currentPick: number;
  totalPicks: number;
  teamName: string;
  nextPick: number;
  picksUntilNext: number;
}

export default function DraftStatus({
  round,
  rounds,
  currentPick,
  totalPicks,
  teamName,
  nextPick,
  picksUntilNext,
}: DraftStatusProps) {
  const complete = currentPick > totalPicks;
  const hasNextPick =
    !complete && Number.isFinite(nextPick) && nextPick <= totalPicks;
  return (
    <section className={styles.status} aria-label="Draft Status">
      <h2>Draft Graph</h2>
      <div className={styles.statusMetrics}>
        <div>
          <span>Round</span>
          <strong>
            {Math.min(round, rounds)} <small>of {rounds}</small>
          </strong>
        </div>
        <div>
          <span>Pick</span>
          <strong>
            {complete ? "—" : currentPick} <small>of {totalPicks}</small>
          </strong>
        </div>
        <div>
          <span>On clock</span>
          <strong className={styles.onClock}>
            {complete ? "Complete" : teamName}
          </strong>
        </div>
        <div>
          <span aria-label="Your next pick">Next pick</span>
          <strong>{hasNextPick ? nextPick : "—"}</strong>
        </div>
        <div aria-live="polite">
          <span aria-label="Picks until your turn">Until turn</span>
          <strong>{hasNextPick ? picksUntilNext : "—"}</strong>
          {hasNextPick && picksUntilNext === 0 ? (
            <small className={styles.srOnly}>You’re on the clock</small>
          ) : null}
        </div>
      </div>
    </section>
  );
}
