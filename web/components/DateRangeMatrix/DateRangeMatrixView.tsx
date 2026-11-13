import React from "react";
import { DateRangeMatrixInternal } from "./index";
import type { Mode, TOIData } from "./index";
import type { PlayerData } from "./utilities";
import type { DRMDataCoverage, DRMDataStatus } from "./useDateRangeMatrixData";
import styles from "./index.module.scss";
import { SHOW_DIAGNOSTICS } from "./diagnostics";

type Props = {
  teamId: number;
  teamName: string;
  roster: PlayerData[];
  toiData: TOIData[];
  mode: Mode;
  homeAwayInfo?: { gameId: number; homeOrAway: string }[];
  playerATOI: Record<number, string>;
  loading: boolean;
  status?: DRMDataStatus;
  error?: string | null;
  stale?: boolean;
  source?: "raw" | "aggregated";
  coverage?: DRMDataCoverage;
  lines: PlayerData[][];
  pairs: PlayerData[][];
  strengthLabel?: string;
  /** Team short name for the section title, e.g. "Oilers". */
  teamShortName?: string;
};

export default function DateRangeMatrixView({
  teamId,
  teamName,
  roster,
  toiData,
  mode,
  homeAwayInfo = [],
  playerATOI,
  loading,
  status,
  error,
  stale = false,
  source,
  coverage,
  lines,
  pairs,
  strengthLabel = "all-strength",
  teamShortName,
}: Props) {
  const resolvedStatus =
    status ?? (loading ? "loading" : roster.length > 0 ? "success" : "empty");

  if (resolvedStatus === "idle") return null;
  // Every state keeps the section title, so the page always says what it is.
  const message =
    loading || resolvedStatus === "loading" ? <p className={styles.matrixMessage} role="status">Loading matrix data…</p>
    : resolvedStatus === "error" || error ? <p className={styles.matrixMessage} role="alert">Unable to load matrix data.</p>
    : resolvedStatus === "empty" ? <p className={styles.matrixMessage} role="status">No matrix data is available for this selection.</p>
    : resolvedStatus === "partial" && roster.length === 0 ? <p className={styles.matrixMessage} role="status">No games in this range have full shift data yet. Shift data for these games is still being processed; check back after tonight&apos;s update.</p>
    : null;

  return (
    <div className={message ? `${styles.matrixFrame} ${styles.matrixFrameMessage}` : styles.matrixFrame} data-source={source} data-stale={stale ? "true" : "false"}>
      <h2 className={styles.sectionTitle}>{teamShortName ? `${teamShortName} line combo matrix` : "Line combo matrix"}</h2>
      {message}
      {!message && (resolvedStatus === "partial" || stale) && (
        <p className={styles.matrixStatus} role="status">
          {stale
            ? "Refreshing matrix data…"
            : `Partial data: some games in this range aren't included yet${SHOW_DIAGNOSTICS && coverage?.skippedRows ? `; ${coverage.skippedRows} row${coverage.skippedRows === 1 ? " was" : "s were"} skipped` : ""}.`}
        </p>
      )}
      {!message && <DateRangeMatrixInternal
        strengthLabel={strengthLabel}
        teamId={teamId}
        teamName={teamName}
        roster={roster}
        toiData={toiData}
        mode={mode}
        homeAwayInfo={homeAwayInfo}
        playerATOI={playerATOI}
        loading={loading}
        lines={lines}
        pairs={pairs}
      />}
    </div>
  );
}
