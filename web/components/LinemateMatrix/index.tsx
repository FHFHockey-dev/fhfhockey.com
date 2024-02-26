import { useEffect, useMemo, useState } from "react";
import supabase from "lib/supabase";
import styles from "./index.module.scss";
import Fetch from "lib/cors-fetch";
import { Shift, getPairwiseTOI } from "./utilities";
import { formatTime } from "utils/getPowerPlayBlocks";

type Props = {
  id: number;
};

const getPlayersInfo = async (seasonId: number, teamId: number) => {
  const { data: players } = await supabase
    .from("rosters")
    .select(
      "playerId, teamId, sweaterNumber, details:players(firstName, lastName)"
    )
    .eq("seasonId", seasonId)
    .eq("teamId", teamId);
  return players;
};

async function getRostersMap(gameId: number) {
  // get game's season id
  const { data: gameInfo } = await supabase
    .from("games")
    .select("seasonId, homeTeamId, awayTeamId")
    .eq("id", gameId)
    .single();
  if (!gameInfo) throw new Error("Cannot find the game " + gameId);
  const rostersMap: Record<
    number,
    {
      teamId: number;
      sweaterNumber: number;
      firstName: string;
      lastName: string;
    }
  > = {};
  (
    await Promise.all([
      getPlayersInfo(gameInfo.seasonId, gameInfo.homeTeamId),
      getPlayersInfo(gameInfo.seasonId, gameInfo.awayTeamId),
    ])
  )
    .flat()
    .forEach(
      (player) =>
        player &&
        (rostersMap[player.playerId] = {
          teamId: player.teamId,
          sweaterNumber: player.sweaterNumber,
          firstName: player.details!.firstName,
          lastName: player.details!.lastName,
        })
    );
  return rostersMap;
}

const getRosters = (shifts: Shift[]) => {
  const rosters: Record<number, Set<number>> = {};
  for (const shift of shifts) {
    if (rosters[shift.teamId] === undefined) rosters[shift.teamId] = new Set();
    rosters[shift.teamId].add(shift.playerId);
  }

  return rosters;
};

function processShifts(shifts: Shift[], rosters: Record<number, Set<number>>) {
  const teamIds = Object.keys(rosters).map(Number);
  const result: Record<number, { toi: number; p1: number; p2: number }[]> = {};
  teamIds.forEach((teamId) => {
    const teamRosters = [...rosters[teamId]];

    for (let i = 0; i < teamRosters.length; i++) {
      for (let j = i; j < teamRosters.length; j++) {
        if (result[teamId] === undefined) result[teamId] = [];
        const p1 = teamRosters[i];
        const p2 = teamRosters[j];
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

type TOIData = {
  toi: number;
  p1: {
    id: number;
    teamId: number;
    firstName: string;
    lastName: string;
    sweaterNumber: number;
  };
  p2: {
    id: number;
    teamId: number;
    firstName: string;
    lastName: string;
    sweaterNumber: number;
  };
};

type Rosters = Record<
  number,
  {
    id: number;
    teamId: number;
    sweaterNumber: number;
    firstName: string;
    lastName: string;
  }[]
>;

function useTOI(id: number) {
  const [toi, setTOI] = useState<Record<number, TOIData[]>>({});
  const [rosters, setRosters] = useState<Rosters>({});
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
      const rosters: any = {};
      if (mounted) {
        const data: Record<number, TOIData[]> = {};
        const playerIds = getRosters(shiftsData);
        const pairwiseTOIForTwoTeams = processShifts(shiftsData, playerIds);
        const teamIds = Object.keys(pairwiseTOIForTwoTeams).map(Number);

        // populate player info
        teamIds.forEach((teamId) => {
          if (data[teamId] === undefined) data[teamId] = [];
          pairwiseTOIForTwoTeams[teamId].forEach((item) => {
            data[teamId].push({
              toi: item.toi,
              p1: { id: item.p1, ...rostersMap[item.p1] },
              p2: { id: item.p2, ...rostersMap[item.p2] },
            });
            if (rosters[teamId] === undefined) rosters[teamId] = {};
            rosters[teamId][item.p1] = { id: item.p1, ...rostersMap[item.p1] };
            rosters[teamId][item.p2] = { id: item.p2, ...rostersMap[item.p2] };
          });
        });
        Object.keys(rosters).forEach(
          (teamId) => (rosters[teamId] = Object.values(rosters[teamId]))
        );
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
      console.log("start fetching");
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

export default function LinemateMatrix({ id }: Props) {
  const [toiData, rosters, loading] = useTOI(id);
  const gameInfo = useGame(id);
  if (!gameInfo || !toiData) return <div>loading...</div>;
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
  roster: Rosters[number];
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
      return rosterSortedByNumber.slice(1);
    } else if (mode === "total-toi") {
      return Object.values(table)
        .sort((a, b) => b.toi - a.toi)
        .filter((item) => item.p1.id === item.p2.id)
        .map((item) => item.p1)
        .slice(1);
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
          gridTemplateRows: `repeat( ${roster.length - 1}, 1fr)`,
          gridTemplateColumns: `repeat(${roster.length - 1}, 1fr)`,
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
