/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\index.tsx

import { useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import {
  isForward,
  isDefense,
  getColor,
  parseTime,
  PlayerData,
} from "./utilities";
import styles from "./index.module.scss";
import Tooltip from "components/Tooltip";
import { teamsInfo } from "lib/NHL/teamsInfo";
import { useTOI } from "./useTOIData";

export type Mode = "line-combination" | "full-roster" | "total-toi";
export type Team = { id: number; name: string };

export type TOIData = {
  toi: number;
  p1: PlayerData;
  p2: PlayerData;
};

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

type Props = {
  id: keyof typeof teamsInfo;
  gameIds: number[];
  mode: Mode;
  onModeChanged?: (newMode: Mode) => void;
  aggregatedData: any[];
  startDate: string;
  endDate: string;
  lines: PlayerData[][];
  pairs: PlayerData[][];
};

export const OPTIONS = [
  { label: "Line Combination", value: "line-combination" },
  { label: "Total TOI", value: "total-toi" },
  { label: "Full Roster", value: "full-roster" },
] as const;

export default function DateRangeMatrix({
  id,
  mode,
  aggregatedData,
  startDate,
  endDate,
  lines,
  pairs,
}: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [toiData, rosters, team, loadingData, homeAwayInfo, playerATOI] =
    useTOI(id, startDate, endDate);

  const teamId = teamsInfo[id]?.id;

  useEffect(() => {
    setLoading(loadingData);
  }, [loadingData]);

  const convertedPlayerATOI: Record<number, string> = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(playerATOI).map(([key, value]) => [
          Number(key),
          String(value),
        ])
      ),
    [playerATOI]
  );

  const sortedRoster = useMemo(() => {
    if (!aggregatedData || aggregatedData.length === 0) return [];
    const roster = aggregatedData.map((item) => ({
      id: item.playerId,
      teamId: item.teamId,
      franchiseId: item.franchiseId,
      position: item.primaryPosition,
      sweaterNumber: item.sweaterNumber,
      name: item.playerName,
      playerAbbrevName: item.playerAbbrevName,
      lastName: item.lastName,
      totalTOI: item.regularSeasonData.totalTOI,
      timesOnLine: item.regularSeasonData.timesOnLine,
      timesOnPair: item.regularSeasonData.timesOnPair,
      percentToiWith: item.regularSeasonData.percentToiWith,
      percentToiWithMixed: item.regularSeasonData.percentToiWithMixed || {},
      timeSpentWith: item.regularSeasonData.timeSpentWith || {},
      timeSpentWithMixed: item.regularSeasonData.timeSpentWithMixed || {},
      GP: item.regularSeasonData.GP,
      timesPlayedWith: item.regularSeasonData.timesPlayedWith,
      ATOI: item.regularSeasonData.ATOI,
      percentOfSeason: item.regularSeasonData.percentOfSeason,
      displayPosition: item.regularSeasonData.displayPosition,
      mutualSharedToi: {},
      comboPoints: item.comboPoints || 0,
    }));
    // console.log("Sorted Roster in DateRangeMatrix:", roster);
    return roster;
  }, [aggregatedData, startDate, endDate]); // Make sure startDate and endDate are dependencies

  const fullRoster = useMemo(() => {
    if (mode === "line-combination") {
      return sortByLineCombination(sortedRoster, { lines, pairs });
    } else if (mode === "full-roster") {
      return sortByFullRoster(sortedRoster, { lines, pairs });
    } else if (mode === "total-toi") {
      return sortByTotalTOI(sortedRoster);
    } else {
      console.error("Mode not implemented:", mode);
      return [];
    }
  }, [mode, sortedRoster, lines, pairs]);

  if (!id || !teamId) {
    return <div>Please select a valid team to view the matrix.</div>;
  }

  return (
    <div>
      {!loading && (
        <div className={styles.gridWrapper}>
          <DateRangeMatrixInternal
            teamId={teamId}
            teamName={teamsInfo[id].name}
            roster={fullRoster}
            toiData={toiData}
            mode={mode}
            homeAwayInfo={homeAwayInfo}
            playerATOI={convertedPlayerATOI}
            loading={loading}
            lines={lines}
            pairs={pairs}
          />
        </div>
      )}
    </div>
  );
}

function sortByFullRoster(
  players: PlayerData[],
  linesAndPairs: { lines: PlayerData[][]; pairs: PlayerData[][] }
): PlayerData[] {
  const { lines, pairs } = linesAndPairs;

  const linePlayers = lines.flat();
  const pairPlayers = pairs.flat();

  const remainingPlayers = players.filter(
    (player) =>
      !linePlayers.some((lp) => lp.id === player.id) &&
      !pairPlayers.some((pp) => pp.id === player.id)
  );

  const sortedRemainingPlayers = remainingPlayers.sort((a, b) => {
    const atoia = parseTime(a.ATOI);
    const atoib = parseTime(b.ATOI);
    return atoib - atoia;
  });

  return [...linePlayers, ...pairPlayers, ...sortedRemainingPlayers];
}

function sortByTotalTOI(players: PlayerData[]): PlayerData[] {
  return players.sort((a, b) => {
    const atoia = parseTime(a.ATOI);
    const atoib = parseTime(b.ATOI);
    return atoib - atoia;
  });
}

function sortByLineCombination(
  players: PlayerData[],
  linesAndPairs: { lines: PlayerData[][]; pairs: PlayerData[][] }
): PlayerData[] {
  const { lines, pairs } = linesAndPairs;

  const flattenedLines = lines.flat();
  const flattenedPairs = pairs.flat();

  const sortedPlayers: PlayerData[] = [...flattenedLines, ...flattenedPairs];

  const remainingPlayers = players.filter(
    (player) =>
      !flattenedLines.some((lp) => lp.id === player.id) &&
      !flattenedPairs.some((pp) => pp.id === player.id)
  );

  const finalSortedPlayers = [...sortedPlayers, ...remainingPlayers];
  // console.log("Sorted Players by Line Combination:", finalSortedPlayers);
  return finalSortedPlayers;
}

type DateRangeMatrixInternalProps = {
  teamId: number;
  teamName: string;
  toiData: TOIData[];
  roster: PlayerData[];
  mode: Mode;
  homeAwayInfo: { gameId: number; homeOrAway: string }[];
  playerATOI: Record<number, string>;
  loading: boolean;
  lines: PlayerData[][];
  pairs: PlayerData[][];
};

export function DateRangeMatrixInternal({
  teamId,
  teamName,
  roster = [],
  toiData = [],
  mode,
  homeAwayInfo,
  playerATOI,
  loading,
  lines,
  pairs,
}: DateRangeMatrixInternalProps) {
  const [selectedCell, setSelectedCell] = useState({ row: -1, col: -1 });

  const containerClass = classNames(styles.container, {
    [styles.totalToiMode]: mode === "total-toi",
    [styles.fullRosterMode]: mode === "full-roster",
  });

  const sortedRoster = useMemo(() => {
    if (mode === "line-combination") {
      const sortedLines = lines.flat();
      const sortedPairs = pairs.flat();
      return [...sortedLines, ...sortedPairs];
    } else if (mode === "total-toi") {
      return sortByTotalTOI(roster);
    } else if (mode === "full-roster") {
      return sortByFullRoster(roster, { lines, pairs });
    } else {
      console.error("not implemented");
      return [];
    }
  }, [mode, roster, lines, pairs]);

  const avgSharedToi = useMemo(() => {
    let sum = 0;
    sortedRoster.forEach((player: PlayerData) => {
      sum += player.totalTOI ?? 0;
    });
    return sum / sortedRoster.length;
  }, [sortedRoster]);

  return (
    <section id={`date-range-matrix-${teamId}`} className={containerClass}>
      <div
        className={classNames(styles.grid, "content")}
        style={{
          gridTemplateRows: `var(--player-info-size) repeat(${sortedRoster.length}, 1fr)`,
          gridTemplateColumns: `var(--player-info-size) repeat(${sortedRoster.length}, 1fr)`,
        }}
      >
        {sortedRoster.length > 0 &&
          new Array(sortedRoster.length + 1).fill(0).map((_, row) => {
            if (row === 0) {
              return [
                <div key="left-up"></div>,
                ...sortedRoster.map((player: PlayerData, col: number) => (
                  <div
                    key={player.id}
                    className={classNames(styles.topPlayerName, {
                      [styles.active]: col === selectedCell.col - 1,
                    })}
                  >
                    <div className={styles.inner}>
                      {player.playerAbbrevName}
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
                        {p2.playerAbbrevName}
                      </div>
                    );
                  } else {
                    if (col !== 0 && row !== 0) {
                      const isSelf = p1.id === p2.id;
                      const sharedToi = isSelf
                        ? parseFloat(playerATOI[p1.id])
                        : p1.percentToiWith[p2.id] || 0;

                      return (
                        <Cell
                          key={`${p1.id}-${p2.id}`}
                          teamAvgToi={avgSharedToi}
                          sharedToi={sharedToi}
                          p1={p1}
                          p2={p2}
                          highlight={isSelf}
                          onPointerEnter={() => setSelectedCell({ row, col })}
                          onPointerLeave={() =>
                            setSelectedCell({ row: -1, col: -1 })
                          }
                          isSelf={isSelf}
                          ATOI={isSelf ? p1.ATOI : undefined}
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
  isSelf: boolean;
  ATOI?: string;
};

function Cell({
  teamAvgToi,
  sharedToi,
  p1,
  p2,
  highlight,
  onPointerEnter = () => {},
  onPointerLeave = () => {},
  isSelf,
  ATOI,
}: CellProps) {
  const mixedToi = p1.percentToiWithMixed?.[p2.id] || 0;
  const effectiveToi = sharedToi || mixedToi;
  const opacity = (isSelf ? 1 : effectiveToi / 100) * 1.5;
  const color = getColor(p1.position, p2.position);

  return (
    <div
      className={classNames(styles.cell, { [styles.highlight]: highlight })}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Tooltip
        onHoverText={
          isSelf
            ? `${formatATOI(ATOI || "N/A")} ATOI`
            : `${effectiveToi.toFixed(2)}% Shared Ice Time`
        }
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

function formatATOI(atoi: string): string {
  const [minutes, rest] = atoi.split(":");
  const seconds = rest ? rest.split(".")[0] : "00";
  return `${minutes}:${seconds}`;
}

// At the bottom or top of your file
export { isForward, isDefense };
