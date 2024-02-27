import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { Shift, getPairwiseTOI, sortByLineCombination } from "./utilities";
import { formatTime } from "utils/getPowerPlayBlocks";
import groupBy from "utils/groupBy";

import styles from "./index.module.scss";
import Tooltip from "components/Tooltip";
import Select from "components/Select";

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

export type PlayerData = {
  id: number;
  teamId: number;
  position: string;
  sweaterNumber: number;
  firstName: string;
  lastName: string;
};

export type TOIData = {
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

const OPTIONS = [
  {
    label: "Total TOI",
    value: "total-toi",
  },
  { label: "Sweater Number", value: "number" },
  { label: "Line Combination", value: "line-combination" },
] as const;
export default function LinemateMatrix({ id }: Props) {
  const [mode, setMode] =
    useState<LinemateMatrixInternalProps["mode"]>("total-toi");
  const [toiData, rosters, loading] = useTOI(id);
  const gameInfo = useGame(id);
  if (!gameInfo || !toiData || loading) return <div>loading...</div>;
  const [homeTeam, awayTeam] = gameInfo;

  return (
    <div>
      <div style={{ margin: "0 auto", width: "200px" }}>
        <Select
          options={OPTIONS}
          option={mode}
          onOptionChange={(newOption) => {
            setMode(newOption);
          }}
        />
      </div>
      <div
        style={{
          margin: "0 10%",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <LinemateMatrixInternal
          teamName={homeTeam.name}
          roster={rosters[homeTeam.id]}
          toiData={toiData[homeTeam.id]}
          mode={mode}
        />
        <LinemateMatrixInternal
          teamName={awayTeam.name}
          roster={rosters[awayTeam.id]}
          toiData={toiData[awayTeam.id]}
          mode={mode}
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
  const [selectedCell, setSelectedCell] = useState({ row: -1, col: -1 });
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
      return sortByLineCombination(table, roster);
    } else {
      console.error("not implemented");
      return [];
    }
  }, [table, mode, roster]);
  const avgSharedToi = useMemo(() => {
    let sum = 0;
    sortedRoster.forEach((player) => {
      sum += table[getKey(player.id, player.id)].toi;
    });
    return sum / sortedRoster.length;
  }, [table, sortedRoster]);

  return (
    <section className={styles.container}>
      <h4>{teamName}</h4>
      <div
        style={{
          backgroundColor: "white",
          color: "black",
          display: "grid",
          gridTemplateRows: `var(--player-info-size) repeat( ${roster.length}, 1fr)`,
          gridTemplateColumns: `var(--player-info-size) repeat(${roster.length}, 1fr)`,
        }}
      >
        {sortedRoster.length > 0 &&
          new Array(sortedRoster.length + 1).fill(0).map((_, row) => {
            if (row === 0) {
              return [
                <div key="left-up"></div>,
                ...sortedRoster.map((player, col) => (
                  <div
                    key={player.id}
                    className={classNames(styles.topPlayerName, {
                      [styles.active]: col === selectedCell.col - 1,
                    })}
                  >
                    <div className={styles.inner}>
                      {player.sweaterNumber}
                      <>&nbsp;</>
                      {player.lastName}
                    </div>
                  </div>
                )),
              ];
            } else {
              return new Array(sortedRoster.length + 1)
                .fill(0)
                .map((_, col) => {
                  const p1 = sortedRoster[col - 1];
                  const p2 = sortedRoster[row - 1];
                  if (col === 0) {
                    return (
                      <div
                        key={p2.id}
                        className={classNames(styles.leftPlayerName, {
                          [styles.active]: selectedCell.row === row,
                        })}
                      >
                        {p2.sweaterNumber}
                        <>&nbsp;</>
                        {p2.lastName}
                      </div>
                    );
                  } else {
                    return (
                      <Cell
                        key={`${row}-${col}`}
                        teamAvgToi={avgSharedToi}
                        sharedToi={table[getKey(p1.id, p2.id)].toi}
                        p1={p1}
                        p2={p2}
                        onPointerEnter={() => setSelectedCell({ row, col })}
                        onPointerLeave={() =>
                          setSelectedCell({ row: -1, col: -1 })
                        }
                      />
                    );
                  }
                });
            }
          })}
      </div>
    </section>
  );
}

type CellProps = {
  teamAvgToi: number;
  sharedToi: number;

  p1: PlayerData;
  p2: PlayerData;

  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
};

const RED = "rgb(214, 39, 40)";
const BLUE = "rgb(31, 119, 180)";
const PURPLE = "rgb(148, 103, 189)";
const FORWARDS_POSITIONS = ["L", "R", "C"];
const DEFENSE_POSITIONS = ["D"];

function isForward(position: string) {
  return FORWARDS_POSITIONS.includes(position);
}

function isDefense(position: string) {
  return DEFENSE_POSITIONS.includes(position);
}

function isMixing(p1Pos: string, p2Pos: string) {
  return (
    (isForward(p1Pos) && isDefense(p2Pos)) ||
    (isForward(p2Pos) && isDefense(p1Pos))
  );
}

/**
 * Blue is defensemen, red is forwards, purple is forwards mixing with defensemen
 */
function getColor(p1Pos: string, p2Pos: string) {
  if (isForward(p1Pos) && isForward(p2Pos)) return RED;
  if (isDefense(p1Pos) && isDefense(p2Pos)) return BLUE;
  if (isMixing(p1Pos, p2Pos)) return PURPLE; // the check can be omitted
  throw new Error("impossible");
}

function Cell({
  teamAvgToi,
  sharedToi,
  p1,
  p2,
  onPointerEnter = () => {},
  onPointerLeave = () => {},
}: CellProps) {
  const opacity = sharedToi / teamAvgToi;
  const color = getColor(p1.position, p2.position);
  return (
    <div
      className={styles.cell}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Tooltip
        onHoverText={formatTime(sharedToi)}
        style={{ width: "100%", height: "100%" }}
      >
        <div
          className={styles.content}
          style={{
            opacity: opacity,
            backgroundColor: color,
          }}
        ></div>
      </Tooltip>
    </div>
  );
}
