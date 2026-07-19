import React from "react";
import { DateRangeMatrixInternal } from "./index";
import type { Mode, TOIData } from "./index";
import type { PlayerData } from "./utilities";
import type { DRMDataCoverage, DRMDataStatus } from "./useDateRangeMatrixData";

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
}: Props) {
  const resolvedStatus =
    status ?? (loading ? "loading" : roster.length > 0 ? "success" : "empty");

  if (loading || resolvedStatus === "loading") {
    return <p role="status">Loading matrix data…</p>;
  }
  if (resolvedStatus === "error" || error) {
    return <p role="alert">Unable to load matrix data.</p>;
  }
  if (resolvedStatus === "idle") return null;
  if (resolvedStatus === "empty") {
    return <p role="status">No matrix data is available for this selection.</p>;
  }

  return (
    <div data-source={source} data-stale={stale ? "true" : "false"}>
      {(resolvedStatus === "partial" || stale) && (
        <p role="status">
          {stale
            ? "Refreshing matrix data…"
            : `Matrix data is partial${coverage?.skippedRows ? `; ${coverage.skippedRows} row${coverage.skippedRows === 1 ? " was" : "s were"} skipped` : ""}.`}
        </p>
      )}
      <DateRangeMatrixInternal
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
      />
    </div>
  );
}
