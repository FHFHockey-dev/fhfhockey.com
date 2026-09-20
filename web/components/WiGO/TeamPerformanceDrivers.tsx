import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import PanelStatus from "components/common/PanelStatus";
import WigoSectionCard from "components/WiGO/WigoSectionCard";
import { fetchTeamDriverSnapshots } from "./fetchTeamDriverSnapshots";
import styles from "./TeamPerformanceDrivers.module.scss";
import {
  buildTeamPerformanceDrivers,
  formatPercentileOrdinal,
} from "./teamPerformanceDriverModel";

interface TeamPerformanceDriversProps {
  teamId: number | null;
  teamAbbreviation: string | null;
  seasonId: number | null;
}

const TeamPerformanceDrivers: React.FC<TeamPerformanceDriversProps> = ({
  teamId,
  teamAbbreviation,
  seasonId,
}) => {
  const enabled = !!teamId && !!teamAbbreviation && !!seasonId;
  const snapshots = useQuery({
    queryKey: ["wigoTeamDriverSnapshots", seasonId],
    queryFn: () => fetchTeamDriverSnapshots(seasonId!),
    enabled,
    staleTime: 60_000
  });
  const result = useMemo(() => snapshots.data && enabled ? buildTeamPerformanceDrivers({
    teamAbbreviation: teamAbbreviation!, teamId: teamId!, ...snapshots.data
  }) : null, [snapshots.data, enabled, teamAbbreviation, teamId]);
  const state = !enabled ? "idle" : snapshots.isLoading ? "loading" : snapshots.error ? "error" : result ? "ready" : "empty";

  return (
    <WigoSectionCard
      title={`${teamAbbreviation || "Team"} Performance Drivers`}
      toolbar={result ? <details className={styles.driverHelp}><summary aria-label="Team driver definitions and source context">ⓘ</summary><div>{result.drivers.map(driver => <p key={driver.key}><strong>{driver.label}:</strong> {driver.explanation}</p>)}<p>League sample: {result.leagueSample} teams. Five-on-five rows {result.fiveOnFiveOldestDate}–{result.fiveOnFiveDate}; special teams rows {result.specialTeamsOldestDate}–{result.specialTeamsDate}.</p></div></details> : undefined}
      bodyClassName={styles.body}
    >
      {state === "idle" ? (
        <PanelStatus
          state="empty"
          message="Select a player to load team drivers."
        />
      ) : state === "loading" ? (
        <PanelStatus state="loading" message="Loading team driver context..." />
      ) : state === "error" ? (
        <PanelStatus
          state="error"
          message="Team driver context is temporarily unavailable."
        />
      ) : state === "empty" || !result ? (
        <>
          <div className={styles.driverGrid}>
            {["Chance Generation", "Chance Suppression", "Finishing", "Special Teams"].map(label => (
              <article key={label} className={styles.driverCard}>
                <span className={styles.driverLabel}>{label}</span>
                <span className={styles.driverValue}>—</span>
              </article>
            ))}
          </div>
          <p className={styles.sourceNote} role="status">Incomplete regular-season coverage; ratings unavailable.</p>
        </>
      ) : (
        <>
          <div className={styles.driverGrid}>
            {result.drivers.map((driver) => (
              <article key={driver.key} className={styles.driverCard}>
                <div className={styles.driverHeader}>
                  <span className={styles.driverLabel}>{driver.label}</span>
                  <span className={styles.driverValue}>
                    {driver.valueLabel}
                  </span>
                </div>
                <span
                  className={`${styles.driverBand} ${styles[driver.status]}`}
                >
                  {driver.status} · {formatPercentileOrdinal(driver.percentile)}{" "}
                  pct
                </span>

              </article>
            ))}
          </div>
          <p className={styles.sourceNote}>
            Regular season · 5v5: {result.fiveOnFiveDate}<br />Special teams through: {result.specialTeamsDate}
          </p>
        </>
      )}
    </WigoSectionCard>
  );
};

export default TeamPerformanceDrivers;
