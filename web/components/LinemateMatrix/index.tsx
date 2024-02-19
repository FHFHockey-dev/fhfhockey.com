import { useEffect, useMemo, useState } from "react";
import supabase from "lib/supabase";
import styles from "./index.module.scss";

type Props = {
  id: number;
};

const getRosters = async (seasonId: number, teamId: number) => {
  const { data: players } = await supabase
    .from("rosters")
    .select("playerId, teamId, sweaterNumber")
    .eq("seasonId", seasonId)
    .eq("teamId", teamId);
  return players;
};

type TOIData = Record<
  number,
  {
    toi: string;
    player: {
      id: number;
      firstName: string;
      lastName: string;
      sweaterNumber: number;
    };
  }[]
>;

function useTOI(id: number) {
  const [data, setData] = useState<TOIData | null>(null);
  useEffect(() => {
    if (!id) return;
    (async () => {
      setData(null);
      // get game's season id
      const { data: gameInfo } = await supabase
        .from("games")
        .select("seasonId, homeTeamId, awayTeamId")
        .eq("id", id)
        .single();
      if (!gameInfo) return;
      const rostersMap: Record<
        number,
        { teamId: number; sweaterNumber: number }
      > = {};
      (
        await Promise.all([
          getRosters(gameInfo.seasonId, gameInfo.homeTeamId),
          getRosters(gameInfo.seasonId, gameInfo.awayTeamId),
        ])
      )
        .flat()
        .forEach(
          (player) =>
            player &&
            (rostersMap[player.playerId] = {
              teamId: player.teamId,
              sweaterNumber: player.sweaterNumber,
            })
        );

      const { data, error } = await supabase
        .from("skatersGameStats")
        .select("toi, player:players(id, firstName, lastName)")
        .eq("gameId", id);
      if (error) {
        console.log(error);
        return;
      }

      const result: TOIData = {
        [gameInfo.homeTeamId]: [],
        [gameInfo.awayTeamId]: [],
      };
      data.forEach((item) => {
        const playerTeamInfo = rostersMap[item.player!.id];
        result[playerTeamInfo.teamId].push({
          toi: item.toi,
          player: {
            ...item.player!,
            sweaterNumber: playerTeamInfo.sweaterNumber,
          },
        });
      });
      setData(result);
    })();
  }, [id]);
  return data;
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
  const toiData = useTOI(id);
  const gameInfo = useGame(id);
  if (gameInfo === null || toiData === null) return null;
  const [homeTeam, awayTeam] = gameInfo;
  console.log({ homeTeam, awayTeam, toiData });

  return (
    <div>
      <h3>Linemate Matrix :{id}</h3>
      <div style={{ margin: "0 10%" }}>
        <LinemateMatrixInternal
          teamName={homeTeam.name}
          toiData={toiData[homeTeam.id]}
          mode="number"
        />
        <LinemateMatrixInternal
          teamName={awayTeam.name}
          toiData={toiData[awayTeam.id]}
          mode="number"
        />
      </div>
    </div>
  );
}

type LinemateMatrixInternalProps = {
  teamName: string;
  toiData: TOIData[number];
  mode: "number" | "total-toi" | "line-combination";
};

/**
 * Transform a `n` dimension array into `n x n` array
 * @param toiData
 */
function getGridData(toiData: string[]): string[][] {
  const result: string[][] = [];
  // fill the result with 00:00
  for (let row = 0; row < toiData.length; row++) {
    result.push(new Array(toiData.length).fill("00:00"));
  }
  // fill the diagonal with toi data
  toiData.forEach((item, i) => {
    result[i][i] = item;
  });
  return result;
}

function LinemateMatrixInternal({
  teamName,
  toiData,
  mode,
}: LinemateMatrixInternalProps) {
  const grid = useMemo<string[][]>(() => {
    console.log(mode);
    return getGridData(toiData.map((item) => item.toi));
  }, [toiData, mode]);
  return (
    <section className={styles.container}>
      <h4>{teamName}</h4>
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateRows: `repeat( ${toiData.length}, 1fr)`,
          gridTemplateColumns: `repeat(${toiData.length}, 1fr)`,
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((col, colIndex) => (
            <div key={`${rowIndex}-${colIndex}`}>{col}</div>
          ))
        )}
      </div>
    </section>
  );
}
