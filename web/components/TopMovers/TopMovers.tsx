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

const clampWidth = (delta: number) =>
  Math.min(100, Math.max(12, Math.abs(delta) * 8));

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
                  <div
                    className={`${styles.deltaBar} ${styles.positive}`}
                    style={{ width: `${clampWidth(m.delta)}%` }}
                    aria-hidden
                  />
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
                  <div
                    className={`${styles.deltaBar} ${styles.negative}`}
                    style={{ width: `${clampWidth(m.delta)}%` }}
                    aria-hidden
                  />
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
