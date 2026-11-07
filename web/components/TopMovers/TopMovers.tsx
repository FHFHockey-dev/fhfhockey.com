import React from "react";
import { fallbackTeamLogo } from "lib/images";
import styles from "./TopMovers.module.scss";

type Mover = {
  id: string;
  name: string;
  logo?: string;
  delta: number;
  current?: number;
};

// Bar = change out of 100% on a grey track. Past 100% the fill loops back from the
// start in a brighter shade of the same colour (TJ, 2026-11-06).
function DeltaBar({ delta, tone }: { delta: number; tone: "positive" | "negative" }) {
  const size = Math.abs(delta);
  const base = Math.min(size, 100);
  const lap = Math.min(Math.max(size - 100, 0), 100);
  return (
    <span className={styles.deltaTrack} aria-hidden>
      <span className={`${styles.deltaFill} ${styles[tone]}`} style={{ width: `${base}%` }} />
      {lap > 0 ? (
        <span
          className={`${styles.deltaFill} ${styles.deltaLap} ${styles[tone]}`}
          style={{ width: `${lap}%` }}
        />
      ) : null}
    </span>
  );
}

export default function TopMovers({
  improved,
  degraded
}: {
  improved: Mover[];
  degraded: Mover[];
}) {
  return (
    <section className={styles.panel} aria-label="Top movers">
      <div>
        <div className={styles.columnHeader}>Most Improved (last 5 GP)</div>
        {improved.length === 0 ? (
          <div className={styles.empty}>Not enough data</div>
        ) : (
          <ul className={styles.list}>
            {improved.map((m, i) => (
              <li key={m.id} className={styles.item}>
                <div className={styles.rank}>{i + 1}</div>
                {/* Mover sources may use the NHL CMS host outside the Next image allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.logo ?? fallbackTeamLogo}
                  alt={`${m.name} logo`}
                  width={28}
                  height={28}
                  className={styles.logo}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = fallbackTeamLogo;
                  }}
                />
                <div className={styles.name}>{m.name}</div>
                <div className={styles.deltaGroup}>
                  <DeltaBar delta={m.delta} tone="positive" />
                  <div className={`${styles.delta} ${styles.positive}`}>
                    ▲{Math.abs(m.delta).toFixed(1)}%
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className={styles.columnHeader}>Most Degraded (last 5 GP)</div>
        {degraded.length === 0 ? (
          <div className={styles.empty}>Not enough data</div>
        ) : (
          <ul className={styles.list}>
            {degraded.map((m, i) => (
              <li key={m.id} className={styles.item}>
                <div className={styles.rank}>{i + 1}</div>
                {/* Mover sources may use the NHL CMS host outside the Next image allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.logo ?? fallbackTeamLogo}
                  alt={`${m.name} logo`}
                  width={28}
                  height={28}
                  className={styles.logo}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = fallbackTeamLogo;
                  }}
                />
                <div className={styles.name}>{m.name}</div>
                <div className={styles.deltaGroup}>
                  <DeltaBar delta={m.delta} tone="negative" />
                  <div className={`${styles.delta} ${styles.negative}`}>
                    ▼{Math.abs(m.delta).toFixed(1)}%
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
