import React from "react";
import useSWR from "swr";
import Link from "next/link";

import type { SplitsApiResponse } from "lib/splits/splitsSurface";

import styles from "./TeamPpPersonnelSnapshot.module.scss";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : "Unable to load PP personnel snapshot."
    );
  }

  return payload as SplitsApiResponse;
};

type TeamPpPersonnelSnapshotProps = {
  teamAbbrev: string;
};

export default function TeamPpPersonnelSnapshot({
  teamAbbrev,
}: TeamPpPersonnelSnapshotProps) {
  const { data, error, isLoading } = useSWR(
    teamAbbrev ? `/api/v1/splits?team=${encodeURIComponent(teamAbbrev)}` : null,
    fetcher
  );

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>PP Personnel Split</h3>
          <p className={styles.description}>
            Current team-level power-play shot role, separated from simple PP TOI share.
          </p>
        </div>
        <Link href={`/lines/${teamAbbrev}`} className={styles.link}>
          Open Team Lines
        </Link>
      </div>

      {isLoading ? (
        <div className={styles.status}>Loading PP personnel snapshot...</div>
      ) : error ? (
        <div className={styles.statusError}>{error.message}</div>
      ) : (
        <div className={styles.rows}>
          {(data?.ppShotShare ?? []).slice(0, 6).map((row) => (
            <div key={row.playerId} className={styles.row}>
              <div>
                <strong>{row.playerName}</strong>
                {row.positionCode ? (
                  <span className={styles.position}>{row.positionCode}</span>
                ) : null}
              </div>
              <span className={styles.share}>
                {row.ppShotSharePct == null
                  ? "—"
                  : `${(row.ppShotSharePct * 100).toFixed(1)}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
