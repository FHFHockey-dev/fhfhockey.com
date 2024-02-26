import { useEffect, useMemo, useState } from "react";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { Shift, getPairwiseTOI } from "./utilities";
import { formatTime } from "utils/getPowerPlayBlocks";
import groupBy from "utils/groupBy";

import styles from "./index.module.scss";

async function getRostersMap(gameId: number) {
  // get skaters only
  const { data: players } = await supabase.rpc("get_skaters_info_by_game_id", {
    p_game_id: gameId,
  });
  const rostersMap: Record<number, PlayerData> = {};
  players?.forEach((player) => (rostersMap[player.id] = player));
  return rostersMap;
}

function processShifts(shifts: Shift[], rosters: Record<number, PlayerData[]>) {
  const teamIds = Object.keys(rosters).map(Number);
  const result: Record<number, { toi: number; p1: number; p2: number }[]> = {};
  teamIds.forEach((teamId) => {
    const teamRosters = [...rosters[teamId]];

    for (let i = 0; i < teamRosters.length; i++) {
      for (let j = i; j < teamRosters.length; j++) {
        if (result[teamId] === undefined) result[teamId] = [];
        const p1 = teamRosters[i].id;
        const p2 = teamRosters[j].id;
        result[teamId].push({
          toi: getPairwiseTOI(shifts, p1, p2),
          p1,
          p2,
        });
      }
    }
  });
  return result;
}

type PlayerData = {
  id: number;
  teamId: number;
  position: string;
  sweaterNumber: number;
  firstName: string;
  lastName: string;
};

type TOIData = {
  toi: number;
  p1: PlayerData;
  p2: PlayerData;
};

function useTOI(id: number) {
  const [toi, setTOI] = useState<Record<number, TOIData[]>>({});
  const [rosters, setRosters] = useState<Record<number, PlayerData[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
    let mounted = true;
    if (!id) {
      mounted = false;
      return;
    }
    (async () => {
      setLoading(true);
      const [{ data: shiftsData }, rostersMap] = await Promise.all([
        await Fetch(
          `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${id}`
        ).then((res) => res.json()),
        await getRostersMap(id),
      ]);

      if (mounted) {
        const rosters = groupBy(
          Object.values(rostersMap),
          (player) => player.teamId
        );
        const data: Record<number, TOIData[]> = {};
        const pairwiseTOIForTwoTeams = processShifts(shiftsData, rosters);
        const teamIds = Object.keys(pairwiseTOIForTwoTeams).map(Number);
        // populate player info
        teamIds.forEach((teamId) => {
          if (data[teamId] === undefined) data[teamId] = [];
          pairwiseTOIForTwoTeams[teamId].forEach((item) => {
            // skip for goalies
            if (!rostersMap[item.p1] || !rostersMap[item.p2]) {
              console.log(
                "skip for goalie",
                item,
                rostersMap[item.p1],
                rostersMap[item.p2]
              );
              return;
            }
            data[teamId].push({
              toi: item.toi,
              p1: rostersMap[item.p1],
              p2: rostersMap[item.p2],
            });
          });
        });

        setTOI(data);
        setRosters(rosters);
        setLoading(false);
      }
    })();
  }, [id]);
  return [toi, rosters, loading] as const;
}

type Team = { id: number; name: string };
function useGame(id: number) {
  const [game, setGame] = useState<[Team, Team] | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: teamIds } = await supabase
        .from("games")
        .select("homeTeamId, awayTeamId")
        .eq("id", id)
        .single();

      if (!teamIds) return;

      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", [teamIds.homeTeamId, teamIds.awayTeamId]);
      if (error) return;

      const result =
        data[0].id === teamIds.homeTeamId ? data : [data[1], data[0]];
      setGame(result as [Team, Team]);
    })();
  }, [id]);

  return game;
}

type Props = {
  id: number;
};

export default function LinemateMatrix({ id }: Props) {
  const [toiData, rosters, loading] = useTOI(id);
  const gameInfo = useGame(id);
  if (!gameInfo || !toiData || loading) return <div>loading...</div>;
  const [homeTeam, awayTeam] = gameInfo;

  return (
    <div>
      <h3>Linemate Matrix :{id}</h3>
      <div style={{ margin: "0 10%" }}>
        <LinemateMatrixInternal
          teamName={homeTeam.name}
          roster={rosters[homeTeam.id]}
          toiData={toiData[homeTeam.id]}
          mode="total-toi"
        />
        <LinemateMatrixInternal
          teamName={awayTeam.name}
          roster={rosters[awayTeam.id]}
          toiData={toiData[awayTeam.id]}
          mode="total-toi"
        />
      </div>
    </div>
  );
}

type LinemateMatrixInternalProps = {
  teamName: string;
  toiData: TOIData[];
  roster: PlayerData[];
  mode: "number" | "total-toi" | "line-combination";
};

const getKey = (p1: number, p2: number) => `${[p1, p2].sort()}`;
function LinemateMatrixInternal({
  teamName,
  roster = [],
  toiData = [],
  mode,
}: LinemateMatrixInternalProps) {
  const table = useMemo(() => {
    const table: Record<string, TOIData> = {};
    toiData.forEach((item) => {
      const key = getKey(item.p1.id, item.p2.id);
      table[key] = item;
    });

    return table;
  }, [toiData]);

  const sortedRoster = useMemo(() => {
    if (mode === "number") {
      const rosterSortedByNumber = roster.sort(
        (a, b) => a.sweaterNumber - b.sweaterNumber
      );
      return rosterSortedByNumber;
    } else if (mode === "total-toi") {
      return Object.values(table)
        .sort((a, b) => b.toi - a.toi)
        .filter((item) => item.p1.id === item.p2.id)
        .map((item) => item.p1);
    } else if (mode === "line-combination") {
      return [];
    } else {
      console.error("not implemented");
      return [];
    }
  }, [table, mode, roster]);

  return (
    <section className={styles.container}>
      <h4>{teamName}</h4>
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateRows: `repeat( ${roster.length}, 1fr)`,
          gridTemplateColumns: `repeat(${roster.length}, 1fr)`,
        }}
      >
        {sortedRoster.map((p1, rowIndex) =>
          sortedRoster.map((p2, colIndex) => (
            <div key={`${rowIndex}-${colIndex}`}>
              {formatTime(table[getKey(p1.id, p2.id)].toi)}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
