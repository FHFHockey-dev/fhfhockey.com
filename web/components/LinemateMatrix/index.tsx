import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import Fetch from "lib/cors-fetch";
import { Shift, getPairwiseTOI } from "./utilities";
import { formatTime } from "utils/getPowerPlayBlocks";
import groupBy from "utils/groupBy";

import styles from "./index.module.scss";
import Tooltip from "components/Tooltip";
import Select from "components/Select";
import { isGameFinished } from "pages/api/v1/db/update-stats/[gameId]";

async function getRostersMap(gameId: number) {
  const rostersMap: Record<number, PlayerData> = {};

  // get skaters only
  const boxscore = await Fetch(
    `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
  ).then((res) => res.json());
  if (!isGameFinished(boxscore.gameState)) {
    throw new Error(
      `The gameState for the game ${gameId} is ` + boxscore.gameState
    );
  }
  const playerByGameStats = boxscore.playerByGameStats;
  const transform = (teamId: number) => (item: any) => ({
    id: item.playerId,
    teamId: teamId,
    sweaterNumber: item.sweaterNumber,
    position: item.position,
    name: item.name.default,
  });
  const homeTeamPlayers = [
    ...playerByGameStats.homeTeam.forwards,
    ...playerByGameStats.homeTeam.defense,
  ].map(transform(boxscore.homeTeam.id));
  const awayTeamPlayers = [
    ...playerByGameStats.awayTeam.forwards,
    ...playerByGameStats.awayTeam.defense,
  ].map(transform(boxscore.awayTeam.id));
  [...homeTeamPlayers, ...awayTeamPlayers].forEach((p) => {
    rostersMap[p.id] = p;
  });

  return {
    rostersMap,
    teams: [boxscore.homeTeam, boxscore.awayTeam].map((team) => ({
      id: team.id,
      name: team.name.default,
    })),
  };
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
  name: string;
};

export type TOIData = {
  toi: number;
  p1: PlayerData;
  p2: PlayerData;
};
export async function getTOIData(id: number) {
  const [{ data: shiftsData }, { rostersMap, teams }] = await Promise.all([
    await Fetch(
      `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${id}`
    ).then((res) => res.json()),
    await getRostersMap(id),
  ]);

  const rosters = groupBy(Object.values(rostersMap), (player) => player.teamId);
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

  return { toi: data, rosters, teams };
}
function useTOI(id: number) {
  const [toi, setTOI] = useState<Record<number, TOIData[]>>({});
  const [rosters, setRosters] = useState<Record<number, PlayerData[]>>({});
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<[Team, Team] | null>(null);
  useEffect(() => {
    setLoading(false);
    let mounted = true;
    if (!id) {
      mounted = false;
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { toi, rosters, teams } = await getTOIData(id);
        if (mounted) {
          setTOI(toi);
          setRosters(rosters);
          setTeams(teams as any);
          setLoading(false);
        }
      } catch (e: any) {
        console.error(e);
        setLoading(false);
      }
    })();
  }, [id]);
  return [toi, rosters, teams, loading] as const;
}

type Team = { id: number; name: string };
type Props = {
  id: number;
  mode: Mode;
  onModeChanged?: (newMode: Mode) => void;
};

export const OPTIONS = [
  {
    label: "Total TOI",
    value: "total-toi",
  },
  { label: "Sweater Number", value: "number" },
  { label: "Line Combination", value: "line-combination" },
] as const;
export default function LinemateMatrix({
  id,
  mode,
  onModeChanged = () => {},
}: Props) {
  const [toiData, rosters, gameInfo, loading] = useTOI(id);
  if (!gameInfo) return <></>;
  const [homeTeam, awayTeam] = gameInfo;
  return (
    <div>
      <div style={{ margin: "0 auto", width: "200px" }}>
        <Select
          options={OPTIONS}
          option={mode}
          onOptionChange={(newOption) => {
            onModeChanged(newOption);
          }}
        />
      </div>
      <div className={styles.gridWrapper}>
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

type PlayerType = "forwards" | "defensemen";
export const NUM_PLAYERS_PER_LINE = {
  forwards: 3,
  defensemen: 2,
} as const;
export function sortByLineCombination(
  data: Record<string, TOIData>,
  players: PlayerData[]
): PlayerData[] {
  // TJ: I think that would be the three fwds w most shared toi, then 2nd, 3rd, 4th etc
  if (players.length === 0) return [];
  const groups = groupBy(players, (player) =>
    isForward(player.position) ? "forwards" : "defensemen"
  );
  const result: PlayerData[] = [];
  ["forwards", "defensemen"].forEach((playerType) => {
    const players = [...groups[playerType]];
    const numPlayersPerLine = NUM_PLAYERS_PER_LINE[playerType as PlayerType];
    const numLines = players.length / numPlayersPerLine;
    for (let line = 0; line < numLines; line++) {
      const pivotPlayer = players
        .sort(
          (a, b) => data[getKey(b.id, b.id)].toi - data[getKey(a.id, a.id)].toi
        )
        .shift();
      if (!pivotPlayer) break;
      result.push(pivotPlayer);
      for (let i = 0; i < numPlayersPerLine - 1; i++) {
        const p = players
          .sort(
            (a, b) =>
              data[getKey(pivotPlayer!.id, b.id)].toi -
              data[getKey(pivotPlayer!.id, a.id)].toi
          )
          .shift();
        if (!p) break;
        result.push(p);
      }
    }
  });
  return result;
}
type Mode = "number" | "total-toi" | "line-combination";
type LinemateMatrixInternalProps = {
  teamName: string;
  toiData: TOIData[];
  roster: PlayerData[];
  mode: Mode;
};

export const getKey = (p1: number, p2: number) => `${[p1, p2].sort()}`;
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
        .filter((item) => item.p1.id === item.p2.id)
        .sort((a, b) => b.toi - a.toi)
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
      sum += table[getKey(player.id, player.id)]?.toi ?? 0;
    });
    return sum / sortedRoster.length;
  }, [table, sortedRoster]);

  return (
    <section className={styles.container}>
      <h4>{teamName}</h4>
      <div
        className={styles.grid}
        style={{
          gridTemplateRows: `var(--player-info-size) repeat( ${roster.length}, 1fr)`,
          gridTemplateColumns: `var(--player-info-size) repeat(${roster.length}, 1fr)`,
        }}
      >
        {sortedRoster.length > 0 &&
          new Array(sortedRoster.length + 1).fill(0).map((_, row) => {
            // Render the top row aka. player names
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
                      {player.name}
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
                  // Render the first column aka. player names
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
                        {p2.name}
                      </div>
                    );
                  } else {
                    // Render the colored cells
                    return (
                      <Cell
                        key={`${p1.id}-${p2.id}}`}
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

export function isForward(position: string) {
  return FORWARDS_POSITIONS.includes(position);
}

export function isDefense(position: string) {
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
