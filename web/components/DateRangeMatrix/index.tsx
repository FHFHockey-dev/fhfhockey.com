// web\components\DateRangeMatrix\index.tsx

import { useEffect, useState } from "react";
import {
  getRostersMap,
  processShifts,
  getTOIData,
  PlayerData,
  TOIData,
} from "./utilities"; // Adjust the import path as necessary
import LinemateMatrix, { Mode } from "../LinemateMatrix"; // Adjust the import path as necessary

type DateRangeMatrixProps = {
  gameIds: number[];
  mode: Mode;
};

export default function DateRangeMatrix({
  gameIds,
  mode,
}: DateRangeMatrixProps) {
  const [toiData, setTOIData] = useState<Record<number, TOIData[]>>({});
  const [rosters, setRosters] = useState<Record<number, PlayerData[]>>({});
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allToiData: Record<number, TOIData[]> = {};
        const allRosters: Record<number, PlayerData[]> = {};
        const allTeams: { id: number; name: string }[] = [];

        for (const gameId of gameIds) {
          const { toi, rosters, teams } = await getTOIData(gameId);
          Object.keys(toi).forEach((teamId) => {
            if (!allToiData[teamId]) {
              allToiData[teamId] = [];
            }
            allToiData[teamId].push(...toi[teamId]);
          });

          Object.keys(rosters).forEach((teamId) => {
            if (!allRosters[teamId]) {
              allRosters[teamId] = [];
            }
            allRosters[teamId].push(...rosters[teamId]);
          });

          teams.forEach((team) => {
            if (!allTeams.find((t) => t.id === team.id)) {
              allTeams.push(team);
            }
          });
        }

        setTOIData(allToiData);
        setRosters(allRosters);
        setTeams(allTeams);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gameIds]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!teams.length) {
    return <div>No data available</div>;
  }

  return (
    <div>
      {teams.map((team) => (
        <LinemateMatrix
          key={team.id}
          id={team.id}
          mode={mode}
          toiData={toiData[team.id]}
          roster={rosters[team.id]}
          teamName={team.name}
        />
      ))}
    </div>
  );
}
