import { Mode } from "components/DateRangeMatrix/index";
import DateRangeMatrixView from "components/DateRangeMatrix/DateRangeMatrixView";
import { useDateRangeMatrixData } from "components/DateRangeMatrix/useDateRangeMatrixData";

type DateRangeMatrixForGamesProps = {
  teamAbbreviation: string; // e.g., "EDM"
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  mode: Mode;
};

export default function DateRangeMatrixForGames({
  teamAbbreviation,
  startDate,
  endDate,
  mode,
}: DateRangeMatrixForGamesProps) {
  const {
    loading,
    status,
    error,
    stale,
    source,
    coverage,
    teamId,
    teamName,
    roster,
    toiData,
    playerATOI,
    lines,
    pairs,
  } = useDateRangeMatrixData({
    teamAbbreviation,
    startDate,
    endDate,
    mode,
    source: "raw",
  });

  if (!teamId || !teamName) return null;

  return (
    <DateRangeMatrixView
      teamId={teamId}
      teamName={teamName}
      roster={roster}
      toiData={toiData}
      mode={mode}
      playerATOI={playerATOI}
      loading={loading}
      status={status}
      error={error}
      stale={stale}
      source={source}
      coverage={coverage}
      lines={lines}
      pairs={pairs}
    />
  );
}
