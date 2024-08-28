import { useEffect, useState, useMemo } from "react";
import {
  DateRangeMatrixInternal,
  TOIData,
  Team,
  Mode,
} from "components/DateRangeMatrix/index";
import { getTOIDataForGames } from "./useTOIData";
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
  const [lines, setLines] = useState<PlayerData[][]>([]);
  const [pairs, setPairs] = useState<PlayerData[][]>([]);

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

  // Recalculate lines and pairs when roster, startDate, endDate, or mode changes
  useEffect(() => {
    if (roster.length > 0 && startDate && endDate) {
      const recalculateLinesAndPairs = () => {
        if (mode === "line-combination" || mode === "full-roster") {
          const { lines: newLines, pairs: newPairs } = calculateLinesAndPairs(
            roster,
            mode
          );
          setLines(newLines);
          setPairs(newPairs);
          // console.log("Recalculated Lines:", newLines);
          // console.log("Recalculated Pairs:", newPairs);
        } else {
          // Clear lines and pairs if the mode is not relevant
          setLines([]);
          setPairs([]);
        }
      };

      recalculateLinesAndPairs();
    }
  }, [roster, startDate, endDate, mode]);

  return (
    <>
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
          lines={lines} // Pass lines separately
          pairs={pairs} // Pass pairs separately
        />
      )}
    </>
  );
}
