import React, { useEffect, useState } from "react";

import PanelStatus from "components/common/PanelStatus";
import WigoSectionCard from "components/WiGO/WigoSectionCard";
import supabase from "lib/supabase";
import styles from "./TeamPerformanceDrivers.module.scss";
import {
  TeamPerformanceDriverResult,
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
  const [result, setResult] = useState<TeamPerformanceDriverResult | null>(
    null,
  );
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >("idle");

  useEffect(() => {
    let cancelled = false;

    if (!teamId || !teamAbbreviation || !seasonId) {
      setResult(null);
      setState("idle");
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      setState("loading");
      setResult(null);

      const [fiveOnFiveLatest, specialTeamsLatest] = await Promise.all([
        supabase
          .from("nst_team_5v5")
          .select("date")
          .eq("team_abbreviation", teamAbbreviation)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("wgo_team_stats")
          .select("date")
          .eq("team_id", teamId)
          .eq("season_id", seasonId)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (fiveOnFiveLatest.error || specialTeamsLatest.error) {
        throw fiveOnFiveLatest.error ?? specialTeamsLatest.error;
      }
      if (!fiveOnFiveLatest.data?.date || !specialTeamsLatest.data?.date) {
        if (!cancelled) setState("empty");
        return;
      }

      const windowStartDate = (date: string) => {
        const start = new Date(`${date}T00:00:00Z`);
        start.setUTCDate(start.getUTCDate() - 21);
        return start.toISOString().slice(0, 10);
      };
      const fiveOnFiveWindowStartDate = windowStartDate(
        fiveOnFiveLatest.data.date,
      );
      const specialTeamsWindowStartDate = windowStartDate(
        specialTeamsLatest.data.date,
      );

      // Each inclusive 22-day window is bounded to at most 704 rows
      // (32 active teams x 22 dates), below PostgREST's page cap. The model
      // keeps only each team's freshest row and exposes the resulting date range.
      const [fiveOnFiveRows, specialTeamsRows] = await Promise.all([
        supabase
          .from("nst_team_5v5")
          .select("team_abbreviation,date,gp,xgf,xga,gf")
          .gte("date", fiveOnFiveWindowStartDate)
          .lte("date", fiveOnFiveLatest.data.date)
          .order("date", { ascending: false }),
        supabase
          .from("wgo_team_stats")
          .select("team_id,date,power_play_pct,penalty_kill_pct")
          .gte("date", specialTeamsWindowStartDate)
          .lte("date", specialTeamsLatest.data.date)
          .eq("season_id", seasonId)
          .order("date", { ascending: false }),
      ]);

      if (fiveOnFiveRows.error || specialTeamsRows.error) {
        throw fiveOnFiveRows.error ?? specialTeamsRows.error;
      }

      const nextResult = buildTeamPerformanceDrivers({
        teamAbbreviation,
        teamId,
        fiveOnFiveRows: fiveOnFiveRows.data ?? [],
        specialTeamsRows: specialTeamsRows.data ?? [],
      });

      if (!cancelled) {
        setResult(nextResult);
        setState(nextResult ? "ready" : "empty");
      }
    };

    load().catch(() => {
      if (!cancelled) setState("error");
    });

    return () => {
      cancelled = true;
    };
  }, [seasonId, teamAbbreviation, teamId]);

  return (
    <WigoSectionCard
      title="Team Performance Drivers"
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
        <PanelStatus
          state="empty"
          message="A complete league snapshot is not available for this team."
        />
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
                <p className={styles.driverExplanation}>{driver.explanation}</p>
              </article>
            ))}
          </div>
          <p className={styles.sourceNote}>
            Five-on-five through {result.fiveOnFiveDate} (league comparison rows{" "}
            {result.fiveOnFiveOldestDate}–{result.fiveOnFiveDate}); special
            teams through {result.specialTeamsDate} (rows{" "}
            {result.specialTeamsOldestDate}–{result.specialTeamsDate}); league
            sample {result.leagueSample} teams.
          </p>
        </>
      )}
    </WigoSectionCard>
  );
};

export default TeamPerformanceDrivers;
