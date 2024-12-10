// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\LinemateMatrix\index.tsx

import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import Fetch from "lib/cors-fetch";
import { Shift, getAvg, getPairwiseTOI } from "./utilities";
import getPowerPlayBlocks, {
  Block,
  formatTime,
} from "utils/getPowerPlayBlocks";
import groupBy from "utils/groupBy";

import styles from "./index.module.scss";
import Tooltip from "components/Tooltip";
import Select from "components/Select";
import { isGameFinished } from "pages/api/v1/db/update-stats/[gameId]";

// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\components\LinemateMatrix\index.tsx

async function getRostersMap(gameId: number, _teamId?: number) {
  const rostersMap: Record<number, PlayerData> = {};

  let boxscore;
  try {
    const response = await Fetch(
      `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
    );

    // Check if the response is JSON
    const contentType = response.headers.get("Content-Type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    boxscore = await response.json();
  } catch (e: any) {
    throw new Error(
      `Failed to fetch or parse boxscore for game ${gameId}: ${e.message}`
    );
  }

  // Check gameScheduleState
  if (boxscore.gameScheduleState !== "OK") {
    throw new Error(
      `Skipping game ${gameId} because gameScheduleState is ${boxscore.gameScheduleState}`
    );
  }

  // Existing gameState check
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

  const players: PlayerData[] = [];
  let teams: { id: number; name: string }[] = [
    boxscore.homeTeam,
    boxscore.awayTeam,
  ].map((team) => ({
    id: team.id,
    name: team.commonName.default,
  }));

  if (_teamId) {
    teams = teams.filter((team) => team.id === _teamId);
    if (_teamId === boxscore.homeTeam.id) {
      const homeTeamPlayers = [
        ...playerByGameStats.homeTeam.forwards,
        ...playerByGameStats.homeTeam.defense,
      ].map(transform(boxscore.homeTeam.id));
      players.push(...homeTeamPlayers);
    } else if (_teamId === boxscore.awayTeam.id) {
      const awayTeamPlayers = [
        ...playerByGameStats.awayTeam.forwards,
        ...playerByGameStats.awayTeam.defense,
      ].map(transform(boxscore.awayTeam.id));
      players.push(...awayTeamPlayers);
    }
  } else {
    const homeTeamPlayers = [
      ...playerByGameStats.homeTeam.forwards,
      ...playerByGameStats.homeTeam.defense,
    ].map(transform(boxscore.homeTeam.id));
    const awayTeamPlayers = [
      ...playerByGameStats.awayTeam.forwards,
      ...playerByGameStats.awayTeam.defense,
    ].map(transform(boxscore.awayTeam.id));
    players.push(...homeTeamPlayers, ...awayTeamPlayers);
  }

  players.forEach((p) => {
    rostersMap[p.id] = p;
  });

  return {
    rostersMap,
    teams,
  };
}

function processShifts(
  shifts: Shift[],
  rosters: Record<number, PlayerData[]>,
  ppBlocks: Block[] | undefined
) {
  const teamIds = Object.keys(rosters).map(Number);
  const result: Record<number, { toi: number; p1: number; p2: number }[]> = {};
  teamIds.forEach((teamId) => {
    const teamRosters = [...rosters[teamId]];
    const teamShifts = shifts.filter((shift) => shift.teamId === teamId);
    for (let i = 0; i < teamRosters.length; i++) {
      for (let j = i; j < teamRosters.length; j++) {
        if (result[teamId] === undefined) result[teamId] = [];
        const p1 = teamRosters[i].id;
        const p2 = teamRosters[j].id;
        result[teamId].push({
          toi: getPairwiseTOI(teamShifts, p1, p2, ppBlocks),
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

async function fetchTOIRawData(id: number) {
  const [{ data: shiftsData }, { rostersMap, teams }, { plays }] =
    await Promise.all([
      Fetch(
        `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${id}`
      ).then((res) => res.json()),
      getRostersMap(id),
      Fetch(`https://api-web.nhle.com/v1/gamecenter/${id}/play-by-play`).then(
        (res) => res.json()
      ),
    ]);

  return [{ data: shiftsData }, { rostersMap, teams }, { plays }] as const;
}

export async function simpleGetTOIData(id: number) {
  const rawData = await fetchTOIRawData(id);
  // @ts-ignore
  return getTOIData(rawData, "line-combination");
}

function getTOIData(
  rawData: [
    {
      data: any;
    },
    {
      rostersMap: Record<number, PlayerData>;
      teams: {
        id: number;
        name: string;
      }[];
    },
    {
      plays: any;
    }
  ],
  mode: Mode
) {
  const [{ data: shiftsData }, { rostersMap, teams }, { plays }] = rawData;

  let rosters = groupBy(Object.values(rostersMap), (player) => player.teamId);

  const data: Record<number, TOIData[]> = {};
  let ppBlocks: Block[] = [];
  if (mode === "pp-toi") {
    ppBlocks = getPowerPlayBlocks(plays);
  }
  const pairwiseTOIForTwoTeams = processShifts(
    shiftsData,
    rosters,
    mode !== "pp-toi" ? undefined : ppBlocks
  );
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
function useTOI(id: number, mode: Mode) {
  const [toi, setTOI] = useState<Record<number, TOIData[]>>({});
  const [rosters, setRosters] = useState<Record<number, PlayerData[]>>({});
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<[Team, Team] | null>(null);
  const [rawData, setRawData] = useState<
    | [
        {
          data: any;
        },
        {
          rostersMap: Record<number, PlayerData>;
          teams: {
            id: number;
            name: string;
          }[];
        },
        {
          plays: any;
        }
      ]
    | null
  >(null);

  useEffect(() => {
    setLoading(false);
    let mounted = true;
    if (!id || rawData === null) {
      mounted = false;
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { toi, rosters, teams } = getTOIData(rawData, mode);
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
  }, [id, rawData, mode]);

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
        const rawData = await fetchTOIRawData(id);

        if (mounted) {
          // @ts-ignore
          setRawData(rawData);
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
  {
    label: "Power Play TOI",
    value: "pp-toi",
  },
  { label: "Sweater Number", value: "number" },
  { label: "Line Combination", value: "line-combination" },
] as const;
export default function LinemateMatrix({
  id,
  mode,
  onModeChanged = () => {},
}: Props) {
  const [toiData, rosters, gameInfo, loading] = useTOI(id, mode);
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
          teamId={homeTeam.id}
          teamName={homeTeam.name}
          roster={rosters[homeTeam.id]}
          toiData={toiData[homeTeam.id]}
          mode={mode}
        />
        <LinemateMatrixInternal
          teamId={awayTeam.id}
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

function sortByPPTOI(data: Record<string, TOIData>): PlayerData[] {
  const getTOI = (playerId1: number, playerId2: number) =>
    data[getKey(playerId1, playerId2)]?.toi ?? 0;

  const sortPlayerSet = (playerIds: Set<number>) =>
    [...playerIds].sort((a, b) => getTOI(b, b) - getTOI(a, a));

  // Filter valid players
  const filteredPlayers = Object.values(data)
    .filter((item) => item.p1.id === item.p2.id && item.toi > 0)
    .sort((a, b) => b.toi - a.toi)
    .map((item) => item.p1.id);

  const allPlayers = new Set(filteredPlayers);

  const sortBySharedTOI = (pivotId: number, playerIds: number[]) =>
    [...playerIds].sort((a, b) => getTOI(pivotId, b) - getTOI(pivotId, a));

  const selectTopPlayers = (
    pivotId: number,
    playerIds: Set<number>,
    limit: number
  ): Set<number> => {
    const sortedPlayers = sortBySharedTOI(pivotId, [...playerIds]);
    return new Set(sortedPlayers.slice(0, limit));
  };

  // Step 1: Determine PP1 players
  const pp1Pivot = filteredPlayers[0]; // has been sorted by toi
  const pp1PlayerIds = selectTopPlayers(pp1Pivot, allPlayers, 5);

  // Step 2: Determine PP2 players
  const remainingPlayers = allPlayers.difference(pp1PlayerIds);
  // Find the player with the highest individual TOI as the PP2 pivot
  const pp2Pivot = sortPlayerSet(remainingPlayers)[0];

  const pp2PlayerIds = selectTopPlayers(pp2Pivot, remainingPlayers, 5);

  // Step 3: Sort the remaining players

  const sortedPP1Players = sortPlayerSet(pp1PlayerIds);
  const sortedPP2Players = sortPlayerSet(pp2PlayerIds);
  const sortedRemainingPlayers = sortPlayerSet(
    remainingPlayers.difference(pp2PlayerIds)
  );

  return [
    ...sortedPP1Players,
    ...sortedPP2Players,
    ...sortedRemainingPlayers,
  ].map((playerId) => data[getKey(playerId, playerId)].p1);
}

type Mode = "number" | "total-toi" | "pp-toi" | "line-combination";
type LinemateMatrixInternalProps = {
  teamId: number;
  teamName: string;
  toiData: TOIData[];
  roster: PlayerData[];
  mode: Mode;
};

export const getKey = (p1: number, p2: number) => `${[p1, p2].sort()}`;
export function LinemateMatrixInternal({
  teamId,
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
    } else if (mode === "pp-toi") {
      return sortByPPTOI(table);
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
    <section id={`linemate-matrix-${teamId}`} className={styles.container}>
      <h4>{teamName}</h4>
      <div
        className={classNames(styles.grid, "content")}
        style={{
          gridTemplateRows: `var(--player-info-size) repeat( ${sortedRoster.length}, 1fr)`,
          gridTemplateColumns: `var(--player-info-size) repeat(${sortedRoster.length}, 1fr)`,
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

                    if (col !== 0 && row !== 0) {
                      const p1 = sortedRoster[col - 1];
                      const p2 = sortedRoster[row - 1];
                      const isHighlight = p1.id === p2.id; // Check if it's the same player

                      return (
                        <Cell
                          key={`${p1.id}-${p2.id}`}
                          teamAvgToi={avgSharedToi}
                          sharedToi={table[getKey(p1.id, p2.id)].toi}
                          p1={p1}
                          p2={p2}
                          highlight={isHighlight}
                          onPointerEnter={() => setSelectedCell({ row, col })}
                          onPointerLeave={() =>
                            setSelectedCell({ row: -1, col: -1 })
                          }
                        />
                      );
                    }
                  }
                });
            }
          })}
      </div>

      {/* PPTOI mode only */}
      {mode === "pp-toi" && (
        <div style={{ width: "90%", marginTop: "0.5rem" }}>
          <PPTOIComparasion
            AVG_PPTOI1={getAvg(sortedRoster.slice(0, 5), table)}
            AVG_PPTOI2={getAvg(sortedRoster.slice(6, 10 + 1), table)}
          />
        </div>
      )}
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

  highlight: boolean; // New prop to indicate if the cell should be highlighted
};

const RED = "#D65108";
const BLUE = "#0267C1";
const PURPLE = "#EFA00B";
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
  if (isForward(p1Pos) && isForward(p2Pos)) return BLUE;
  if (isDefense(p1Pos) && isDefense(p2Pos)) return RED;
  if (isMixing(p1Pos, p2Pos)) return PURPLE; // the check can be omitted
  throw new Error("impossible");
}

function Cell({
  teamAvgToi,
  sharedToi,
  p1,
  p2,
  highlight,
  onPointerEnter = () => {},
  onPointerLeave = () => {},
}: CellProps) {
  const opacity = sharedToi / teamAvgToi;
  const color = getColor(p1.position, p2.position);

  return (
    <div
      className={classNames(styles.cell, { [styles.highlight]: highlight })}
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

type PPTOIComparasionProps = {
  /**
   *  Average PPTOI in seconds
   */
  AVG_PPTOI1: number;
  /**
   * Average PPTOI in seconds
   */
  AVG_PPTOI2: number;
};

const PP1_COLOR = "#0167C1";
const PP2_COLOR = "#D55008";

function PPTOIComparasion({ AVG_PPTOI1, AVG_PPTOI2 }: PPTOIComparasionProps) {
  const total = AVG_PPTOI1 + AVG_PPTOI2;
  const pp1Percent = (AVG_PPTOI1 / total) * 100;
  const pp2Percent = (AVG_PPTOI2 / total) * 100;
  const CUT_LENGTH = 30;
  return (
    <div style={{ fontWeight: "700" }}>
      {/* average PPTOI comparasion*/}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div style={{ color: PP1_COLOR }}>{formatTime(AVG_PPTOI1)} PPTOI</div>
        <div style={{ color: PP2_COLOR }}>{formatTime(AVG_PPTOI2)} PPTOI</div>
      </div>

      {/* comparasion bar */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${pp1Percent}% ${pp2Percent}%`,
          height: "2rem",
          marginTop: "0.5rem",
        }}
      >
        {/* Left Section */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            height: "100%",
            backgroundColor: PP1_COLOR,
            paddingRight: "1.8rem",
            paddingLeft: "0.5rem",
            clipPath: `polygon(0 0, 100% 0, calc(100% - ${CUT_LENGTH}px) 100%, 0 100%)`,
            // work around for minimizing the large gap
            width: `calc(100% + ${CUT_LENGTH - 8}px)`,
          }}
        >
          <div>PP1</div>
          <div>{pp1Percent.toFixed(1)}</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            height: "100%",
            backgroundColor: PP2_COLOR,
            paddingLeft: "1.8rem",
            paddingRight: "0.5rem",
            clipPath: `polygon(${CUT_LENGTH}px 0, 100% 0, 100% 100%, 0 100%)`,
          }}
        >
          <div>PP2</div>
          <div>{pp2Percent.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}
