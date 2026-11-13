/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\index.tsx

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import classNames from "classnames";
import {
  isForward,
  isDefense,
  getColor,
  parseTime,
  PlayerData,
} from "./utilities";
import styles from "./index.module.scss";
import { teamsInfo } from "lib/teamsInfo";
import { useTOI } from "./useTOIData";

export type Mode = "line-combination" | "full-roster" | "total-toi";
export type Team = { id: number; name: string };

export type TOIData = {
  toi: number;
  p1: PlayerData;
  p2: PlayerData;
};

const EMPTY_PLAYER_ATOI: Readonly<Record<number, string>> = Object.freeze({});

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
  id: keyof typeof teamsInfo | ""; // allow blank when no team selected
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
  // Always call hook (React rule) with a string; pass empty string if no id
  const [
    rawToiData,
    rawRosters,
    rawTeam,
    loadingData,
    rawHomeAwayInfo,
    rawPlayerATOI,
  ] = useTOI((id as string) || "", startDate, endDate);
  const toiData = id ? rawToiData : [];
  const rosters = id ? rawRosters : [];
  const team = id ? rawTeam : null;
  const homeAwayInfo = id ? rawHomeAwayInfo : [];
  const playerATOI = id ? rawPlayerATOI : EMPTY_PLAYER_ATOI;

  const teamId = id ? teamsInfo[id]?.id : undefined;

  useEffect(() => {
    setLoading(loadingData);
  }, [loadingData]);

  const convertedPlayerATOI: Record<number, string> = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(playerATOI).map(([key, value]) => [
          Number(key),
          String(value),
        ]),
      ),
    [playerATOI],
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
      displayPosition: item.displayPosition ?? item.primaryPosition ?? "",
      mutualSharedToi: {},
      comboPoints: item.comboPoints || 0,
      playerType: item.playerType,
    }));
    return roster;
  }, [aggregatedData]);

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
  linesAndPairs: { lines: PlayerData[][]; pairs: PlayerData[][] },
): PlayerData[] {
  const { lines, pairs } = linesAndPairs;

  const linePlayers = lines.flat();
  const pairPlayers = pairs.flat();

  const remainingPlayers = players.filter(
    (player) =>
      !linePlayers.some((lp) => lp.id === player.id) &&
      !pairPlayers.some((pp) => pp.id === player.id),
  );

  const sortedRemainingPlayers = remainingPlayers.sort((a, b) => {
    const atoia = parseTime(a.ATOI);
    const atoib = parseTime(b.ATOI);
    return atoib - atoia;
  });

  return [...linePlayers, ...pairPlayers, ...sortedRemainingPlayers];
}

function sortByTotalTOI(players: PlayerData[]): PlayerData[] {
  return [...players].sort((a, b) => b.totalTOI - a.totalTOI || a.id - b.id);
}

function sortByLineCombination(
  players: PlayerData[],
  linesAndPairs: { lines: PlayerData[][]; pairs: PlayerData[][] },
): PlayerData[] {
  const { lines, pairs } = linesAndPairs;

  const flattenedLines = lines.flat();
  const flattenedPairs = pairs.flat();

  const sortedPlayers: PlayerData[] = [...flattenedLines, ...flattenedPairs];

  const remainingPlayers = players.filter(
    (player) =>
      !flattenedLines.some((lp) => lp.id === player.id) &&
      !flattenedPairs.some((pp) => pp.id === player.id),
  );

  const finalSortedPlayers = [...sortedPlayers, ...remainingPlayers];
  return finalSortedPlayers;
}

type DateRangeMatrixInternalProps = {
  strengthLabel?: string;
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

type GroupEdges = { top: boolean; right: boolean; bottom: boolean; left: boolean };

type CellIdentity = {
  rowPlayerId: number;
  columnPlayerId: number;
};

function getCellKey(rowPlayerId: number, columnPlayerId: number): string {
  return `${rowPlayerId}:${columnPlayerId}`;
}

function describeCell(column: PlayerData, row: PlayerData, strength: string) {
  if (column.id === row.id) {
    const atoi = formatATOI(column.ATOI);
    return atoi === "N/A"
      ? `${column.name}: average ice time per game not available (${strength})`
      : `${column.name}: ${atoi} average ice time per game (${strength})`;
  }
  if (!(column.totalTOI > 0)) return `${column.name} has no ice time in these games (${strength}).`;
  const share = column.percentToiWith[row.id] || column.percentToiWithMixed?.[row.id] || 0;
  return `${row.name} shared ${share.toFixed(2)}% of ${column.name}'s ice time (${strength})`;
}

export function DateRangeMatrixInternal({
  strengthLabel = "all-strength",
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
  const [rovingCell, setRovingCell] = useState<CellIdentity | null>(null);
  const [focusedCell, setFocusedCell] = useState<CellIdentity | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellIdentity | null>(null);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // Shade scales to the largest pair share shown, so shares above 66.7% no
  // longer all saturate (W2-6 D8, M-LINE-014). Presentation only.
  const shadeMax = useMemo(() => {
    let max = 0;
    sortedRoster.forEach((columnPlayer: PlayerData) => {
      sortedRoster.forEach((rowPlayer: PlayerData) => {
        if (columnPlayer.id === rowPlayer.id) return;
        const share =
          columnPlayer.percentToiWith?.[rowPlayer.id] ||
          columnPlayer.percentToiWithMixed?.[rowPlayer.id] ||
          0;
        if (share > max) max = share;
      });
    });
    return max;
  }, [sortedRoster]);

  // Line Combination: forward lines (3x3) and defence pairs (2x2) sit on the
  // diagonal; each block gets a white outline (TJ). Presentation only.
  const unitOf = useMemo(() => {
    const map = new Map<number, { unit: number; index: number; size: number }>();
    if (mode !== "line-combination") return map;
    [...lines, ...pairs].forEach((unit, unitIndex) => {
      if (unit.length < 2) return;
      unit.forEach((player, index) =>
        map.set(player.id, { unit: unitIndex, index, size: unit.length }),
      );
    });
    return map;
  }, [mode, lines, pairs]);
  const groupEdgesFor = (rowId: number, columnId: number): GroupEdges | undefined => {
    const row = unitOf.get(rowId);
    const column = unitOf.get(columnId);
    if (!row || !column || row.unit !== column.unit) return undefined;
    return {
      top: row.index === 0,
      bottom: row.index === row.size - 1,
      left: column.index === 0,
      right: column.index === column.size - 1,
    };
  };

  const rosterPlayerIds = useMemo(
    () => new Set(sortedRoster.map(({ id }) => id)),
    [sortedRoster],
  );
  const defaultCell = useMemo<CellIdentity | null>(() => {
    const firstPlayerId = sortedRoster[0]?.id;
    return firstPlayerId === undefined
      ? null
      : {
          rowPlayerId: firstPlayerId,
          columnPlayerId: firstPlayerId,
        };
  }, [sortedRoster]);
  const isCellAvailable = (cell: CellIdentity | null): cell is CellIdentity =>
    cell !== null &&
    rosterPlayerIds.has(cell.rowPlayerId) &&
    rosterPlayerIds.has(cell.columnPlayerId);

  useEffect(() => {
    const remainsAvailable = (cell: CellIdentity | null) =>
      cell !== null &&
      rosterPlayerIds.has(cell.rowPlayerId) &&
      rosterPlayerIds.has(cell.columnPlayerId);

    setRovingCell((current) =>
      remainsAvailable(current) ? current : defaultCell,
    );
    setFocusedCell((current) => (remainsAvailable(current) ? current : null));
    setHoveredCell((current) => (remainsAvailable(current) ? current : null));
  }, [defaultCell, rosterPlayerIds]);

  const effectiveRovingCell = isCellAvailable(rovingCell)
    ? rovingCell
    : defaultCell;
  const activeCell = isCellAvailable(hoveredCell)
    ? hoveredCell
    : isCellAvailable(focusedCell)
      ? focusedCell
      : null;
  const matrixId = `date-range-matrix-${teamId}`;

  const moveCellFocus = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    row: number,
    col: number,
  ) => {
    const lastIndex = sortedRoster.length - 1;
    let nextRow = row;
    let nextCol = col;

    switch (event.key) {
      case "ArrowUp":
        nextRow = Math.max(0, row - 1);
        break;
      case "ArrowDown":
        nextRow = Math.min(lastIndex, row + 1);
        break;
      case "ArrowLeft":
        nextCol = Math.max(0, col - 1);
        break;
      case "ArrowRight":
        nextCol = Math.min(lastIndex, col + 1);
        break;
      case "Home":
        nextCol = 0;
        break;
      case "End":
        nextCol = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextRowPlayer = sortedRoster[nextRow];
    const nextColumnPlayer = sortedRoster[nextCol];
    if (!nextRowPlayer || !nextColumnPlayer) return;

    const nextCell = {
      rowPlayerId: nextRowPlayer.id,
      columnPlayerId: nextColumnPlayer.id,
    };
    setRovingCell(nextCell);
    cellRefs.current
      .get(getCellKey(nextRowPlayer.id, nextColumnPlayer.id))
      ?.focus();
  };

  return (
    <section id={matrixId} className={containerClass}>
      <p className={styles.matrixExplanation}>Each cell shows how much of the column player’s ice time ({strengthLabel}) the row player shared. Diagonal cells show each player’s average ice time per game.</p>
      {sortedRoster.length > 0 && (
        <p className={styles.matrixLegend}>
          <span>Brighter cell = bigger share.</span>
          <span className={styles.legendKey}><span className={styles.legendSwatch} style={{ backgroundColor: getColor("C", "C") }} aria-hidden="true" />Forward + forward</span>
          <span className={styles.legendKey}><span className={styles.legendSwatch} style={{ backgroundColor: getColor("C", "D") }} aria-hidden="true" />Forward + defense</span>
          <span className={styles.legendKey}><span className={styles.legendSwatch} style={{ backgroundColor: getColor("D", "D") }} aria-hidden="true" />Defense + defense</span>
          {mode === "line-combination" && (
            <span className={styles.legendKey}><span className={`${styles.legendSwatch} ${styles.legendOutline}`} aria-hidden="true" />Line or pair</span>
          )}
        </p>
      )}
      <output className={styles.matrixReadout} aria-label="Selected cell value" aria-live="polite">
        {activeCell ? describeCell(
          sortedRoster.find(player => player.id === activeCell.columnPlayerId)!,
          sortedRoster.find(player => player.id === activeCell.rowPlayerId)!, strengthLabel,
        ) : "Hover or tap a cell to see its value."}
      </output>
      {sortedRoster.length > 0 && (
        <p className={styles.scrollHint}>Scroll sideways to see all {sortedRoster.length} players.</p>
      )}
      {sortedRoster.length === 0 && <p role="status">No full lines or pairs were found at this strength. Switch the layout to Full Roster or Total TOI to see each player’s time.</p>}
      <div
        className={classNames(styles.grid, "content")}
        role="grid"
        aria-label={`${teamName} shared ice time matrix`}
        aria-rowcount={sortedRoster.length + 1}
        aria-colcount={sortedRoster.length + 1}
        style={{
          gridTemplateRows: `var(--player-info-size) repeat(${sortedRoster.length}, minmax(var(--matrix-cell-min), 1fr))`,
          gridTemplateColumns: `var(--player-info-size) repeat(${sortedRoster.length}, minmax(var(--matrix-cell-min), 1fr))`,
        }}
      >
        {sortedRoster.length > 0 && (
          <>
            <div className={styles.row} role="row" aria-rowindex={1}>
              <div
                className={styles.cornerCell}
                role="columnheader"
                aria-colindex={1}
              >
                <span className={styles.visuallyHidden}>Players</span>
              </div>
              {sortedRoster.map((player: PlayerData, col: number) => (
                <div
                  key={player.id}
                  id={`${matrixId}-column-${player.id}`}
                  role="columnheader"
                  aria-colindex={col + 2}
                  aria-label={player.name}
                  className={classNames(styles.topPlayerName, {
                    [styles.active]: activeCell?.columnPlayerId === player.id,
                  })}
                >
                  <div className={styles.inner}>{player.playerAbbrevName}</div>
                </div>
              ))}
            </div>

            {sortedRoster.map((rowPlayer, row) => (
              <div
                className={styles.row}
                role="row"
                aria-rowindex={row + 2}
                key={`row-${rowPlayer.id}`}
              >
                <div
                  id={`${matrixId}-row-${rowPlayer.id}`}
                  role="rowheader"
                  aria-colindex={1}
                  aria-label={rowPlayer.name}
                  className={classNames(styles.leftPlayerName, {
                    [styles.active]: activeCell?.rowPlayerId === rowPlayer.id,
                  })}
                >
                  {rowPlayer.playerAbbrevName}
                </div>

                {sortedRoster.map((columnPlayer, col) => {
                  const isSelf = columnPlayer.id === rowPlayer.id;
                  const sharedToi = isSelf
                    ? parseFloat(playerATOI[columnPlayer.id])
                    : columnPlayer.percentToiWith[rowPlayer.id] || 0;
                  const cellKey = getCellKey(rowPlayer.id, columnPlayer.id);
                  const cellIdentity = {
                    rowPlayerId: rowPlayer.id,
                    columnPlayerId: columnPlayer.id,
                  };

                  return (
                    <Cell
                      key={`${columnPlayer.id}-${rowPlayer.id}`}
                      cellRef={(node) => {
                        if (node) cellRefs.current.set(cellKey, node);
                        else cellRefs.current.delete(cellKey);
                      }}
                      rowIndex={row + 2}
                      colIndex={col + 2}
                      tabIndex={
                        effectiveRovingCell?.rowPlayerId === rowPlayer.id &&
                        effectiveRovingCell?.columnPlayerId === columnPlayer.id
                          ? 0
                          : -1
                      }
                      teamAvgToi={avgSharedToi}
                      strengthLabel={strengthLabel}
                      shadeMax={shadeMax}
                      sharedToi={sharedToi}
                      p1={columnPlayer}
                      p2={rowPlayer}
                      highlight={isSelf}
                      groupEdges={groupEdgesFor(rowPlayer.id, columnPlayer.id)}
                      onPointerEnter={() => setHoveredCell(cellIdentity)}
                      onPointerLeave={() => setHoveredCell(null)}
                      onFocus={() => {
                        setRovingCell(cellIdentity);
                        setHoveredCell(null);
                        setFocusedCell(cellIdentity);
                      }}
                      onBlur={() => setFocusedCell(null)}
                      onKeyDown={(event) => moveCellFocus(event, row, col)}
                      isSelf={isSelf}
                      ATOI={isSelf ? columnPlayer.ATOI : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

type CellProps = {
  strengthLabel: string;
  teamAvgToi: number;
  /** Largest non-self share in the matrix; the shade scale's maximum. */
  shadeMax: number;
  sharedToi: number;
  p1: PlayerData;
  p2: PlayerData;
  cellRef?: (node: HTMLDivElement | null) => void;
  rowIndex: number;
  colIndex: number;
  tabIndex: number;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  highlight: boolean;
  groupEdges?: GroupEdges;
  isSelf: boolean;
  ATOI?: string;
};

function Cell({
  strengthLabel,
  teamAvgToi,
  shadeMax,
  sharedToi,
  p1,
  p2,
  cellRef,
  rowIndex,
  colIndex,
  tabIndex,
  highlight,
  groupEdges,
  onPointerEnter = () => {},
  onPointerLeave = () => {},
  onFocus = () => {},
  onBlur = () => {},
  onKeyDown = () => {},
  isSelf,
  ATOI,
}: CellProps) {
  const mixedToi = p1.percentToiWithMixed?.[p2.id] || 0;
  const effectiveToi = sharedToi || mixedToi;
  const denominatorKnown = p1.totalTOI > 0;
  const opacity = isSelf ? 1 : denominatorKnown && shadeMax > 0 ? effectiveToi / shadeMax : 0;
  const color = getColor(p1.position, p2.position);
  const meaning = describeCell(p1, p2, strengthLabel);
  const accessibleName = isSelf
    ? `${p1.name} average time on ice`
    : `${p2.name} with ${p1.name}`;
  const tooltipId = `matrix-cell-${p2.id}-${p1.id}-meaning`;

  return (
    <div
      ref={cellRef}
      role="gridcell"
      aria-rowindex={rowIndex}
      aria-colindex={colIndex}
      aria-label={accessibleName}
      aria-describedby={tooltipId}
      tabIndex={tabIndex}
      className={classNames(styles.cell, {
        [styles.highlight]: highlight,
        [styles.unitTop]: groupEdges?.top,
        [styles.unitRight]: groupEdges?.right,
        [styles.unitBottom]: groupEdges?.bottom,
        [styles.unitLeft]: groupEdges?.left,
      })}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <span id={tooltipId} role="tooltip" className={styles.cellTooltip}>
        {meaning}
      </span>
      <div
        className={styles.content}
        aria-hidden="true"
        style={{
          opacity: opacity,
          backgroundColor: color,
        }}
      ></div>
    </div>
  );
}

function formatATOI(atoi: string): string {
  const match = /^(\d+):([0-5]\d)(?:\.\d+)?$/.exec(atoi);
  return match ? `${match[1]}:${match[2]}` : "N/A";
}

// At the bottom or top of your file
export { isForward, isDefense };
