import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import PanelStatus from "components/common/PanelStatus";
import WigoSectionCard from "components/WiGO/WigoSectionCard";
import WigoHelp from "./WigoHelp";
import { useSeasonPendingMessage } from "hooks/useCurrentSeason";
import { fetchTeamDriverSnapshots } from "./fetchTeamDriverSnapshots";
import styles from "./TeamPerformanceDrivers.module.scss";
import {
  buildTeamPerformanceDrivers,
  formatPercentileOrdinal,
  type TeamDriverCoverage,
} from "./teamPerformanceDriverModel";

const coverageLabel = ({ coveredGames, expectedGames }: TeamDriverCoverage) =>
  `${coveredGames} of ${expectedGames} games`;

interface TeamPerformanceDriversProps {
  teamId: number | null;
  teamAbbreviation: string | null;
  seasonId: number | null;
  /** A player is selected; without a team that means no current team (A-05). */
  hasPlayer?: boolean;
}

const TeamPerformanceDrivers: React.FC<TeamPerformanceDriversProps> = ({
  teamId,
  teamAbbreviation,
  seasonId,
  hasPlayer = false,
}) => {
  const seasonPending = useSeasonPendingMessage();
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
      title={`${teamAbbreviation || "Team"} performance drivers`}
      toolbar={result ? <WigoHelp label="Team driver definitions and source context">{result.drivers.map(driver => <p key={driver.key}><strong>{driver.label}:</strong> {driver.explanation}</p>)}<p>League sample: {result.leagueSample} teams. Five-on-five rows {result.fiveOnFiveOldestDate}–{result.fiveOnFiveDate}; special teams rows {result.specialTeamsOldestDate}–{result.specialTeamsDate}.</p></WigoHelp> : undefined}
      bodyClassName={styles.body}
    >
      {state === "idle" ? (
        <PanelStatus
          state="empty"
          message={!hasPlayer
            ? "Select a player"
            : !teamId || !teamAbbreviation
              ? "No current team, so no team drivers."
              : seasonPending}
          className={styles.emptyPrompt}
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
            {result.fiveOnFiveCoverage
              ? <>Regular season · 5v5: {coverageLabel(result.fiveOnFiveCoverage)} to {result.fiveOnFiveDate}</>
              : <>Regular season · 5v5: {result.fiveOnFiveDate}</>}
            <br />
            {result.specialTeamsCoverage
              ? <>Special teams: {coverageLabel(result.specialTeamsCoverage)} to {result.specialTeamsDate}</>
              : <>Special teams through: {result.specialTeamsDate}</>}
          </p>
          {(result.fiveOnFiveCoverage || result.specialTeamsCoverage) && (
            <p className={styles.sourceNote}>Partial coverage: rates use covered games only.</p>
          )}
        </>
      )}
    </WigoSectionCard>
  );
};

export default TeamPerformanceDrivers;
