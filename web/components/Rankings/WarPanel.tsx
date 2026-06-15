import type { WarSurfaceResponse } from "lib/rankings/war";

import styles from "styles/Rankings.module.scss";

type WarPanelProps = {
  payload: WarSurfaceResponse | null;
  isLoading: boolean;
  errorMessage?: string;
};

function statusLabel(status: WarSurfaceResponse["prerequisites"][number]["status"]) {
  if (status === "available_not_joined") return "Available, not joined";
  if (status === "needs_validation") return "Needs validation";
  return "Missing";
}

export default function WarPanel({
  payload,
  isLoading,
  errorMessage,
}: WarPanelProps) {
  if (isLoading) {
    return (
      <section className={styles.statePanel} aria-label="Wins Above Replacement status">
        <h2>Wins Above Replacement</h2>
        <p>Loading WAR availability contract...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className={styles.statePanel} aria-label="Wins Above Replacement status">
        <h2>Wins Above Replacement</h2>
        <p>{errorMessage}</p>
      </section>
    );
  }

  if (!payload) {
    return (
      <section className={styles.statePanel} aria-label="Wins Above Replacement status">
        <h2>Wins Above Replacement</h2>
        <p>WAR availability is unavailable for this filter context.</p>
      </section>
    );
  }

  return (
    <section className={styles.statePanel} aria-label="Wins Above Replacement status">
      <h2>{payload.methodology.label}</h2>
      <p>{payload.summary}</p>
      <div className={styles.secondaryTabGrid}>
        {payload.prerequisites.map((item) => (
          <article key={item.key}>
            <span className={styles.secondaryTabPlanned}>
              {statusLabel(item.status)}
            </span>
            <h3>{item.label}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <div className={styles.sourcePendingList}>
        <strong>Source Pending</strong>
        <ul>
          <li>{payload.sourcePendingReason}</li>
          {payload.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
