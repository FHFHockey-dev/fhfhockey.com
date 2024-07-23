// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\index.tsx
// WORKING VERSION STOP UNDO HERE

import { useEffect, useMemo, useState, useCallback } from "react";
import classNames from "classnames";
import Fetch from "lib/cors-fetch";
import {
  Shift,
  getPairwiseTOI,
  isForward,
  isDefense,
  getColor,
} from "./utilities";
import { formatTime } from "utils/getPowerPlayBlocks";
import groupBy from "utils/groupBy";
import styles from "./index.module.scss";
import Tooltip from "components/Tooltip";
import Select from "components/Select";
import { isGameFinished } from "pages/api/v1/db/update-stats/[gameId]";
import { teamsInfo } from "lib/NHL/teamsInfo";

export type Mode = "number" | "total-toi" | "line-combination";
export type Team = { id: number; name: string };

export type PlayerData = {
  id: number;
  teamId: number;
  position: string;
  sweaterNumber: number;
  name: string;
  totalTOI?: number;
};

export type TOIData = {
  toi: number;
  p1: PlayerData;
  p2: PlayerData;
};

export async function getTOIDataForGames(gameIds: number[], teamId: number) {
  const allTOIData: Record<number, TOIData[]> = {};
  const allRosters: Record<number, PlayerData[]> = {};
  const allTeams: Set<Team> = new Set();
  const allHomeAwayInfo: { gameId: number; homeOrAway: string }[] = [];
  const playerTOI: Record<
    number,
    { totalTOI: number; gamesPlayed: Set<number> }
  > = {};

  const gameDataPromises = gameIds.map(async (id) => {
    const shiftDataUrl = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${id}`;
    try {
      const [{ data: shiftsData }, { rostersMap, teams }, boxscore] =
        await Promise.all([
          Fetch(shiftDataUrl).then((res) => res.json()),
          getRostersMap(id, teamId),
          Fetch(`https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`).then(
            (res) => res.json()
          ),
        ]);

      if (!shiftsData) {
        console.error(
          `No shifts data found for game ID ${id}. URL: ${shiftDataUrl}`
        );
        return;
      }
      if (!rostersMap) {
        console.error(`No rosters data found for game ID ${id}`);
        return;
      }

      if (boxscore.gameType !== 2) {
        return;
      }

      let rosters = groupBy(
        Object.values(rostersMap),
        (player: PlayerData) => player.teamId
      );
      if (teamId) {
        rosters = { [teamId]: rosters[teamId] };
      }

      const data: Record<number, TOIData[]> = {};
      const pairwiseTOIForTwoTeams = processShifts(shiftsData, rosters);
      const teamIds = teamId
        ? [teamId]
        : Object.keys(pairwiseTOIForTwoTeams).map(Number);

      teamIds.forEach((teamId) => {
        if (data[teamId] === undefined) data[teamId] = [];
        pairwiseTOIForTwoTeams[teamId].forEach((item) => {
          if (!rostersMap[item.p1] || !rostersMap[item.p2]) return;
          data[teamId].push({
            toi: item.toi,
            p1: rostersMap[item.p1],
            p2: rostersMap[item.p2],
          });

          [item.p1, item.p2].forEach((playerId) => {
            if (!playerTOI[playerId]) {
              playerTOI[playerId] = {
                totalTOI: 0,
                gamesPlayed: new Set<number>(),
              };
            }
            playerTOI[playerId].totalTOI += item.toi;
            playerTOI[playerId].gamesPlayed.add(id);
          });
        });
      });

      Object.entries(data).forEach(([teamId, toiData]) => {
        if (!allTOIData[Number(teamId)]) {
          allTOIData[Number(teamId)] = [];
        }
        allTOIData[Number(teamId)] = allTOIData[Number(teamId)].concat(toiData);
      });

      Object.entries(rosters).forEach(([teamId, players]) => {
        if (!allRosters[Number(teamId)]) {
          allRosters[Number(teamId)] = [];
        }
        allRosters[Number(teamId)] = players;
      });

      teams.forEach((team) => allTeams.add(team));

      const isHome = boxscore.homeTeam.id === teamId;
      allHomeAwayInfo.push({
        gameId: id,
        homeOrAway: isHome ? "home" : "away",
      });
    } catch (error) {
      console.error(
        `Error fetching TOI data for game ID ${id}. URL: ${shiftDataUrl}. Error:`,
        error
      );
    }
  });

  await Promise.all(gameDataPromises);

  const avgToi = new Map<string, TOIData>();
  Object.values(allTOIData).forEach((array) => {
    array.forEach((item) => {
      const key = generateKey(item.p1.id, item.p2.id);
      if (!avgToi.has(key)) {
        avgToi.set(key, { toi: 0, p1: item.p1, p2: item.p2 });
      }
      avgToi.get(key)!.toi += item.toi;
    });
  });

  avgToi.forEach((item, key) => {
    const gamesCount = Math.min(
      playerTOI[item.p1.id].gamesPlayed.size,
      playerTOI[item.p2.id].gamesPlayed.size
    );
    if (gamesCount > 0) {
      item.toi /= gamesCount;
    }
  });

  return {
    toiData: [...avgToi.values()],
    roster: allRosters[teamId] ?? [],
    team: [...allTeams].find((team) => team.id === teamId),
    homeAwayInfo: allHomeAwayInfo,
    playerTOI,
  };
}

export function generateKey(p1: number, p2: number): string {
  return p1 > p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
}

export class MySet<T> {
  getKey: (item: T) => string | number;
  data: Map<string | number, T> = new Map<string, T>();
  constructor(getKey: (item: T) => string | number) {
    this.getKey = getKey;
  }
  add(item: T) {
    const key = this.getKey(item);
    this.data.set(key, item);
  }
  remove(item: T) {
    const key = this.getKey(item);
    return this.data.delete(key);
  }

  toArray() {
    return [...this.data.values()];
  }
}

export async function getRostersMap(gameId: number, _teamId?: number) {
  const rostersMap: Record<number, PlayerData> = {};
  const goalies: PlayerData[] = [];
  try {
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
      toi: item.toi,
      starter: item.starter,
    });

    const players: PlayerData[] = [];
    let teams: { id: number; name: string }[] = [
      boxscore.homeTeam,
      boxscore.awayTeam,
    ].map((team) => ({
      id: team.id,
      name: team.name.default,
    }));

    if (_teamId) {
      teams = teams.filter((team) => team.id === _teamId);
      const homeTeam = boxscore.homeTeam.id === _teamId;
      const relevantTeamStats = homeTeam
        ? playerByGameStats.homeTeam
        : playerByGameStats.awayTeam;

      if (relevantTeamStats) {
        const forwards = relevantTeamStats.forwards.map(transform(_teamId));
        const defense = relevantTeamStats.defense.map(transform(_teamId));
        const teamGoalies = relevantTeamStats.goalies.map(transform(_teamId));

        players.push(...forwards, ...defense);
        goalies.push(...teamGoalies);
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
      const homeGoalies = playerByGameStats.homeTeam.goalies.map(
        transform(boxscore.homeTeam.id)
      );
      const awayGoalies = playerByGameStats.awayTeam.goalies.map(
        transform(boxscore.awayTeam.id)
      );

      players.push(...homeTeamPlayers, ...awayTeamPlayers);
      goalies.push(...homeGoalies, ...awayGoalies);
    }

    players.forEach((p) => {
      rostersMap[p.id] = p;
    });

    return { rostersMap, teams, goalies };
  } catch (error) {
    console.error("Error fetching roster map:", error);
    return { rostersMap, teams: [], goalies: [] };
  }
}

export function processShifts(
  shifts: Shift[] = [],
  rosters: Record<number, PlayerData[]> = {}
) {
  if (!shifts.length) {
    console.error("No shifts data provided.");
  }
  if (!Object.keys(rosters).length) {
    console.error("No rosters data provided.");
  }

  const teamIds = Object.keys(rosters).map(Number);
  const result: Record<number, { toi: number; p1: number; p2: number }[]> = {};
  teamIds.forEach((teamId) => {
    const teamRosters = rosters[teamId];
    if (!teamRosters) {
      console.error(`No rosters found for team ID ${teamId}`);
      return;
    }

    for (let i = 0; i < teamRosters.length; i++) {
      for (let j = i; j < teamRosters.length; j++) {
        if (result[teamId] === undefined) result[teamId] = [];
        const p1 = teamRosters[i].id;
        const p2 = teamRosters[j].id;
        result[teamId].push({ toi: getPairwiseTOI(shifts, p1, p2), p1, p2 });
      }
    }
  });
  return result;
}

function useTOI(gameIds: number[], teamId: number) {
  const [toi, setTOI] = useState<Record<number, TOIData[]>>({});
  const [rosters, setRosters] = useState<Record<number, PlayerData[]>>({});
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [homeAwayInfo, setHomeAwayInfo] = useState<
    { gameId: number; homeOrAway: string }[]
  >([]);
  const [playerTOI, setPlayerTOI] = useState<
    Record<number, { totalTOI: number; gamesPlayed: Set<number> }>
  >({});

  useEffect(() => {
    let mounted = true;
    if (gameIds.length === 0) {
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const {
          toiData: newToi,
          roster: newRosters,
          team: newTeam,
          homeAwayInfo: newHomeAwayInfo,
          playerTOI: newPlayerTOI,
        } = await getTOIDataForGames(gameIds, teamId);
        if (mounted) {
          setTOI((prevToi) => {
            const updatedToi = { ...prevToi };
            newToi.forEach((item) => {
              const key = `${teamId}`;
              if (!updatedToi[teamId]) {
                updatedToi[teamId] = [];
              }
              updatedToi[teamId].push(item);
            });
            return updatedToi;
          });
          setRosters((prevRosters) => ({
            ...prevRosters,
            [teamId]: newRosters,
          }));
          if (newTeam) {
            setTeam(newTeam);
          }
          setHomeAwayInfo(newHomeAwayInfo);
          setPlayerTOI(newPlayerTOI);
        }
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [gameIds, teamId]);

  return [toi, rosters, team, loading, homeAwayInfo, playerTOI] as const;
}

type Props = {
  id: keyof typeof teamsInfo;
  gameIds: number[];
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

export default function DateRangeMatrix({
  id,
  gameIds,
  mode,
  onModeChanged = () => {},
}: Props) {
  const teamId = teamsInfo[id].id;

  const [toiData, rosters, team, loading, homeAwayInfo, playerTOI] = useTOI(
    gameIds,
    teamId
  );

  // Ensure hooks are called unconditionally
  const toiDataArray = useMemo(() => Object.values(toiData).flat(), [toiData]);

  const table = useMemo(() => {
    const tbl: Record<string, TOIData> = {};
    toiDataArray.forEach((item) => {
      const key = generateKey(item.p1.id, item.p2.id);
      tbl[key] = item;
    });
    return tbl;
  }, [toiDataArray]);

  // DateRangeMatrix Component
  const sortedRoster = useMemo(() => {
    if (!team) return [];
    if (mode === "number") {
      return rosters[team.id].sort((a, b) => a.sweaterNumber - b.sweaterNumber);
    } else if (mode === "total-toi") {
      return Object.values(table)
        .filter((item) => item.p1.id === item.p2.id)
        .sort((a, b) => b.toi - a.toi)
        .map((item) => item.p1);
    } else if (mode === "line-combination") {
      return sortByLineCombination(
        table,
        rosters[team.id],
        toiDataArray.reduce<
          Record<number, { totalTOI: number; gamesPlayed: Set<number> }>
        >((acc, item) => {
          [item.p1.id, item.p2.id].forEach((playerId) => {
            if (!acc[playerId]) {
              acc[playerId] = { totalTOI: 0, gamesPlayed: new Set<number>() };
            }
            acc[playerId].totalTOI += item.toi;
            acc[playerId].gamesPlayed.add(gameIds[0]);
          });
          return acc;
        }, {})
      );
    } else {
      console.error("not implemented");
      return [];
    }
  }, [table, mode, rosters, team, toiDataArray, gameIds]);

  // DateRangeMatrixInternal Component
  useEffect(() => {
    if (team && toiDataArray.length > 0) {
      const logLinesAndPairs = () => {
        const linesAndPairs: {
          FWD: Record<string, any>;
          D: Record<string, any>;
        } = { FWD: {}, D: {} };

        const calculateTotalMinsTogether = (players: PlayerData[]) => {
          let totalMinsTogether = 0;
          for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
              const key = generateKey(players[i].id, players[j].id);
              totalMinsTogether += table[key]?.toi || 0;
            }
          }
          return totalMinsTogether;
        };

        const lines = groupBy(sortedRoster, (player: PlayerData) =>
          isForward(player.position) ? "forwards" : "defensemen"
        );

        const fwdLines = lines.forwards || [];
        const defPairs = lines.defensemen || [];

        // Log Forward Lines
        for (let i = 0; i < fwdLines.length; i += 3) {
          const line = fwdLines.slice(i, i + 3);
          if (line.length < 3) continue;
          const lineAvg =
            line.reduce(
              (sum, player) =>
                sum +
                playerTOI[player.id].totalTOI /
                  playerTOI[player.id].gamesPlayed.size,
              0
            ) / line.length;
          const totalMinsTogether = calculateTotalMinsTogether(line);

          linesAndPairs.FWD[`L${i / 3 + 1}`] = {
            player1:
              playerTOI[line[0].id].totalTOI /
              playerTOI[line[0].id].gamesPlayed.size,
            player2:
              playerTOI[line[1].id].totalTOI /
              playerTOI[line[1].id].gamesPlayed.size,
            player3:
              playerTOI[line[2].id].totalTOI /
              playerTOI[line[2].id].gamesPlayed.size,
            lineAvg,
            totalMinsTogether,
          };
        }

        // Log Defense Pairs
        for (let i = 0; i < defPairs.length; i += 2) {
          const pair = defPairs.slice(i, i + 2);
          if (pair.length < 2) continue;
          const pairAvg =
            pair.reduce(
              (sum, player) =>
                sum +
                playerTOI[player.id].totalTOI /
                  playerTOI[player.id].gamesPlayed.size,
              0
            ) / pair.length;
          const totalMinsTogether = calculateTotalMinsTogether(pair);

          linesAndPairs.D[`P${i / 2 + 1}`] = {
            player1:
              playerTOI[pair[0].id].totalTOI /
              playerTOI[pair[0].id].gamesPlayed.size,
            player2:
              playerTOI[pair[1].id].totalTOI /
              playerTOI[pair[1].id].gamesPlayed.size,
            pairAvg,
            totalMinsTogether,
          };
        }

        console.log(linesAndPairs);
      };

      logLinesAndPairs();
    }
  }, [team, toiDataArray, table, sortedRoster, playerTOI]);

  if (!team) return null;

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
        <DateRangeMatrixInternal
          teamId={team.id}
          teamName={team.name}
          roster={rosters[team.id]}
          toiData={toiData[team.id]}
          mode={mode}
          homeAwayInfo={homeAwayInfo}
          playerTOI={playerTOI}
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
  players: PlayerData[],
  playerTOI: Record<number, { totalTOI: number; gamesPlayed: Set<number> }>
): PlayerData[] {
  if (players.length === 0) return [];
  const groups = groupBy(players, (player: PlayerData) =>
    isForward(player.position) ? "forwards" : "defensemen"
  );

  const sortPlayers = (playerType: PlayerType, numPlayersPerLine: number) => {
    const playerList = groups[playerType] || [];
    const lines = [];

    for (let i = 0; i < playerList.length; i += numPlayersPerLine) {
      const line = playerList.slice(i, i + numPlayersPerLine);
      const avgTOI =
        line.reduce(
          (sum, player) =>
            sum +
            playerTOI[player.id].totalTOI /
              playerTOI[player.id].gamesPlayed.size,
          0
        ) / line.length;

      line.sort(
        (a, b) =>
          playerTOI[b.id].totalTOI / playerTOI[b.id].gamesPlayed.size -
          playerTOI[a.id].totalTOI / playerTOI[a.id].gamesPlayed.size
      );

      lines.push({ line, avgTOI });
    }

    lines.sort((a, b) => b.avgTOI - a.avgTOI);

    return lines.flatMap((lineData) => lineData.line);
  };

  return [...sortPlayers("forwards", 3), ...sortPlayers("defensemen", 2)];
}

type DateRangeMatrixInternalProps = {
  teamId: number;
  teamName: string;
  toiData: TOIData[];
  roster: PlayerData[];
  mode: Mode;
  homeAwayInfo: { gameId: number; homeOrAway: string }[];
  playerTOI: Record<number, { totalTOI: number; gamesPlayed: Set<number> }>;
};

export function DateRangeMatrixInternal({
  teamId,
  teamName,
  roster = [],
  toiData = [],
  mode,
  homeAwayInfo,
  playerTOI,
}: DateRangeMatrixInternalProps) {
  const [selectedCell, setSelectedCell] = useState({ row: -1, col: -1 });
  const [viewMode, setViewMode] = useState<"top-lineup" | "full-roster">(
    "top-lineup"
  );

  const table = useMemo(() => {
    const tbl: Record<string, TOIData> = {};
    toiData.forEach((item) => {
      const key = generateKey(item.p1.id, item.p2.id);
      tbl[key] = item;
    });

    return tbl;
  }, [toiData]);

  const groupPlayersBySharedToi = useCallback(
    (players: PlayerData[], groupSize: number) => {
      const groups: PlayerData[][] = [];
      const usedPlayers = new Set<number>();

      while (players.length > 0) {
        let group: PlayerData[] = [];
        let totalGroupToi = 0;

        for (let i = 0; i < players.length && group.length < groupSize; i++) {
          const player = players[i];
          if (!usedPlayers.has(player.id)) {
            group.push(player);
            usedPlayers.add(player.id);
            totalGroupToi += table[generateKey(player.id, player.id)]?.toi ?? 0;
          }
        }

        if (group.length === groupSize) {
          group.sort(
            (a, b) =>
              (table[generateKey(a.id, a.id)]?.toi ?? 0) -
              (table[generateKey(b.id, b.id)]?.toi ?? 0)
          );
          groups.push(group);
        }

        players = players.filter((player) => !usedPlayers.has(player.id));
      }

      return groups.flat();
    },
    [table]
  );

  const sortedRoster = useMemo(() => {
    if (mode === "number") {
      return roster.sort((a, b) => a.sweaterNumber - b.sweaterNumber);
    } else if (mode === "total-toi") {
      return Object.values(table)
        .filter((item) => item.p1.id === item.p2.id)
        .sort((a, b) => b.toi - a.toi)
        .map((item) => item.p1);
    } else if (mode === "line-combination") {
      return sortByLineCombination(table, roster, playerTOI);
    } else {
      console.error("not implemented");
      return [];
    }
  }, [table, mode, roster, playerTOI]);

  const topLineupRoster = useMemo(() => {
    const forwards = groupPlayersBySharedToi(
      sortedRoster.filter((player) => isForward(player.position)),
      3
    ).slice(0, 12);
    const defensemen = groupPlayersBySharedToi(
      sortedRoster.filter((player) => isDefense(player.position)),
      2
    ).slice(0, 6);

    forwards.sort(
      (a, b) =>
        playerTOI[b.id].totalTOI / playerTOI[b.id].gamesPlayed.size -
        playerTOI[a.id].totalTOI / playerTOI[a.id].gamesPlayed.size
    );

    defensemen.sort(
      (a, b) =>
        playerTOI[b.id].totalTOI / playerTOI[b.id].gamesPlayed.size -
        playerTOI[a.id].totalTOI / playerTOI[a.id].gamesPlayed.size
    );

    return [...forwards, ...defensemen];
  }, [sortedRoster, groupPlayersBySharedToi, playerTOI]);

  const fullRoster = useMemo(() => {
    const forwards = groupPlayersBySharedToi(
      sortedRoster.filter((player) => isForward(player.position)),
      3
    );
    const defensemen = groupPlayersBySharedToi(
      sortedRoster.filter((player) => isDefense(player.position)),
      2
    );

    forwards.sort(
      (a, b) =>
        playerTOI[b.id].totalTOI / playerTOI[b.id].gamesPlayed.size -
        playerTOI[a.id].totalTOI / playerTOI[a.id].gamesPlayed.size
    );

    defensemen.sort(
      (a, b) =>
        playerTOI[b.id].totalTOI / playerTOI[b.id].gamesPlayed.size -
        playerTOI[a.id].totalTOI / playerTOI[a.id].gamesPlayed.size
    );

    return [...forwards, ...defensemen];
  }, [sortedRoster, groupPlayersBySharedToi, playerTOI]);

  const displayRoster =
    viewMode === "top-lineup" ? topLineupRoster : fullRoster;

  const avgSharedToi = useMemo(() => {
    let sum = 0;
    displayRoster.forEach((player) => {
      sum += table[generateKey(player.id, player.id)]?.toi ?? 0;
    });
    return sum / displayRoster.length;
  }, [table, displayRoster]);

  return (
    <section id={`date-range-matrix-${teamId}`} className={styles.container}>
      <h4>{teamName}</h4>
      <div className={styles.toggleWrapper}>
        <button
          onClick={() => setViewMode("top-lineup")}
          className={viewMode === "top-lineup" ? styles.active : ""}
        >
          Top Lineup
        </button>
        <button
          onClick={() => setViewMode("full-roster")}
          className={viewMode === "full-roster" ? styles.active : ""}
        >
          Full Roster
        </button>
      </div>
      <div
        className={classNames(styles.grid, "content")}
        style={{
          gridTemplateRows: `var(--player-info-size) repeat(${displayRoster.length}, 1fr)`,
          gridTemplateColumns: `var(--player-info-size) repeat(${displayRoster.length}, 1fr)`,
        }}
      >
        {displayRoster.length > 0 &&
          new Array(displayRoster.length + 1).fill(0).map((_, row) => {
            if (row === 0) {
              return [
                <div key="left-up"></div>,
                ...displayRoster.map((player, col) => (
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
              return new Array(displayRoster.length + 1)
                .fill(0)
                .map((_, col) => {
                  const p1 = displayRoster[col - 1];
                  const p2 = displayRoster[row - 1];

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
                    if (col !== 0 && row !== 0) {
                      const isHighlight = p1.id === p2.id;
                      const cellData = table[generateKey(p1.id, p2.id)];
                      const sharedToi = cellData ? cellData.toi : 0;

                      return (
                        <Cell
                          key={`${p1.id}-${p2.id}`}
                          teamAvgToi={avgSharedToi}
                          sharedToi={sharedToi}
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
  highlight: boolean;
};

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
