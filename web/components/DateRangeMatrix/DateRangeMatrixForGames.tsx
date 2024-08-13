/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\DateRangeMatrixForGames.tsx

import { useEffect, useState, useMemo } from "react";
import {
  DateRangeMatrixInternal,
  TOIData,
  Team,
  Mode,
} from "components/DateRangeMatrix/index";
import { getTOIDataForGames } from "./useTOIData";
import PulsatingGrid from "./PulsatingGrid"; // Import the PulsatingGrid component
import { calculateLinesAndPairs } from "components/DateRangeMatrix/lineCombinationHelper";
import { PlayerData } from "components/DateRangeMatrix/utilities";

type DateRangeMatrixForGamesProps = {
  gameIds: number[];
  teamId: number;
  startDate: string;
  endDate: string;
  mode: Mode;
};

export default function DateRangeMatrixForGames({
  gameIds,
  teamId,
  startDate,
  endDate,
  mode,
}: DateRangeMatrixForGamesProps) {
  const [toi, setToi] = useState<TOIData[]>([]);
  const [roster, setRoster] = useState<PlayerData[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    setToi([]); // Clear previous data
    setRoster([]); // Clear previous data
    setTeam(null); // Clear previous data
    (async () => {
      const data = await getTOIDataForGames(
        teamId.toString(),
        startDate,
        endDate
      );
      setToi(data.toiData);
      setRoster(data.roster);
      setTeam(data.team ?? null);
      setLoading(false);
    })();
  }, [gameIds, teamId, startDate, endDate]);

  // Log roster data to inspect
  useEffect(() => {
    if (roster.length > 0) {
      console.log("Roster Data:", roster);
    }
  }, [roster]);

  const linesAndPairs = useMemo(() => {
    if (mode === "line-combination" || mode === "full-roster") {
      return calculateLinesAndPairs(roster, mode);
    }
    return { lines: [], pairs: [] }; // If mode is not relevant, return empty arrays
  }, [roster, mode]);

  return (
    <>
      {loading && <PulsatingGrid rows={18} cols={18} pulsating={true} />}
      {team && !loading && (
        <DateRangeMatrixInternal
          teamId={team.id}
          mode={mode}
          teamName={team.name}
          toiData={toi}
          roster={roster}
          homeAwayInfo={[]}
          playerATOI={toi.reduce<Record<number, string>>((acc, item) => {
            [item.p1.id, item.p2.id].forEach((playerId) => {
              if (!acc[playerId]) {
                acc[playerId] = "0";
              }
              acc[playerId] = (parseFloat(acc[playerId]) + item.toi).toString();
            });
            return acc;
          }, {})}
          loading={loading}
          lines={linesAndPairs.lines} // Pass lines separately
          pairs={linesAndPairs.pairs} // Pass pairs separately
        />
      )}
    </>
  );
}
