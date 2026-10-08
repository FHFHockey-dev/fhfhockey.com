import { parseISO } from "date-fns";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

import { MatchUpCell } from "./TeamRow";
import Toggle from "./Toggle/Toggle";
import {
  calcTotalGP,
  calcTotalOffNights,
  getGamesPerDayIntensity,
} from "./TotalGamesPerDayRow";
import { addDays, formatDate, getDayStr } from "./utils/date-func";
import styles from "./GameGrid.module.scss";
import detailStyles from "./TeamDetails.module.scss";

import { DAYS, EXTENDED_DAY_ABBREVIATION, EXTENDED_DAYS, WeekData } from "lib/NHL/types";
import { useTeamsMap } from "hooks/useTeams";
import { TeamNumeric, toRankMaps } from "./utils/metricRanks";
import type { FourWeekCalendar } from "./utils/useFourWeekSchedule";
import {
  OpponentMetricAverages,
  OpponentMetricColumn,
  OpponentMetricCoverage,
} from "./utils/useOpponentMetricsData";

type TeamScheduleRow = WeekData & {
  teamId: number;
  totalGamesPlayed: number;
  totalOffNights: number;
  weekScore: number;
};

type FourWeekSummary = {
  gamesPlayed: number | null;
  offNights: number | null;
  avgOpponentPointPct: number | null;
  score: number | null;
  opponentCoverage?: { known: number; expected: number };
  scheduleCoverage?: { known: number; expected: number };
};

type DesktopMasterTableProps = {
  start: string;
  extended: boolean;
  scheduleRows: TeamScheduleRow[];
  gamesPerDay: number[];
  excludedDays: EXTENDED_DAY_ABBREVIATION[];
  setExcludedDays: React.Dispatch<React.SetStateAction<EXTENDED_DAY_ABBREVIATION[]>>;
  hidePreseason?: boolean;
  opponentMetricsByTeamId: Record<number, OpponentMetricAverages>;
  opponentMetricColumns: OpponentMetricColumn[];
  opponentLeagueAverages: Record<keyof OpponentMetricAverages, number | null>;
  opponentMetricsLoading: boolean;
  opponentMetricsError: string | null;
  opponentCoverageByTeamId?: Record<number, OpponentMetricCoverage>;
  opponentLeagueCoverage?: OpponentMetricCoverage;
  opponentSourceLabel?: string;
  fourWeekSummaryByTeamId: Record<number, FourWeekSummary>;
  fourWeekAverages: FourWeekSummary;
  fourWeekCalendar?: FourWeekCalendar;
  expandedTeamIds?: ReadonlySet<number>;
  onToggleTeam?: (teamId: number) => void;
  renderTeamDetails?: (teamId: number) => ReactNode;
};

type SortKey =
  | "teamName"
  | "totalGamesPlayed"
  | "totalOffNights"
  | "weekScore"
  | keyof OpponentMetricAverages
  | "fourWeekGamesPlayed"
  | "fourWeekOffNights"
  | "fourWeekOpponentPointPct"
  | "fourWeekScore";

type SortConfig = {
  key: SortKey;
  direction: "ascending" | "descending";
};

type MasterRow = TeamScheduleRow & {
  teamName: string;
  teamAbbreviation: string;
  logo: string;
  opponentMetrics: OpponentMetricAverages;
  fourWeekGamesPlayed: number | null;
  fourWeekOffNights: number | null;
  fourWeekOpponentPointPct: number | null;
  fourWeekScore: number | null;
};

const DESKTOP_STICKY_BREAKPOINT = 1024;
const MASTER_METRIC_COL_BASE_WIDTH = 50;
const MASTER_PERCENT_METRIC_COL_BASE_WIDTH = 80;
const MASTER_TEAM_COL_BASE_WIDTH = 72;
const MASTER_DAY_COL_BASE_WIDTH = 80;
const MASTER_FOUR_WEEK_COL_BASE_WIDTH = 72;
const MASTER_FOUR_WEEK_COLLAPSED_BASE_WIDTH = 36;
const MASTER_SUMMARY_COL_BASE_WIDTH = 72;
const MASTER_SCORE_COL_BASE_WIDTH = 104;

type StickyHeaderState = {
  active: boolean;
  left: number;
  width: number;
  scrollLeft: number;
  tableWidth: number;
};

function getCurrentSummaryIntensity(
  type: "gp" | "off",
  value: number,
): string | undefined {
  if (type === "gp") {
    if (value <= 1) return "low";
    if (value === 2) return "medium-low";
    if (value === 3) return "medium-high";
    return "high";
  }

  if (value === 0) return "low";
  if (value === 1) return "medium-low";
  if (value === 2) return "medium-high";
  return "high";
}

function getDefaultDirection(key: SortKey): SortConfig["direction"] {
  if (
    key === "teamName" ||
    key === "avgXga" ||
    key === "avgSa" ||
    key === "avgGoalAgainst" ||
    key === "avgWinPct" ||
    key === "fourWeekOpponentPointPct"
  ) {
    return "ascending";
  }

  return "descending";
}

function formatMetricValue(
  key: SortKey,
  value: number | null | undefined,
): string {
  if (typeof value !== "number") {
    return "-";
  }

  if (key === "avgWinPct" || key === "fourWeekOpponentPointPct") {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (key === "weekScore" || key === "fourWeekScore") {
    return value.toFixed(1);
  }

  if (
    key === "totalGamesPlayed" ||
    key === "totalOffNights" ||
    key === "fourWeekGamesPlayed" ||
    key === "fourWeekOffNights"
  ) {
    return `${value}`;
  }

  return value.toFixed(1);
}

function compareValues(
  aValue: number | string | null | undefined,
  bValue: number | string | null | undefined,
  direction: SortConfig["direction"],
) {
  if (typeof aValue === "string" && typeof bValue === "string") {
    return direction === "ascending"
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  }

  const aNum = typeof aValue === "number" ? aValue : null;
  const bNum = typeof bValue === "number" ? bValue : null;

  if (aNum == null && bNum == null) return 0;
  if (aNum == null) return 1;
  if (bNum == null) return -1;
  return direction === "ascending" ? aNum - bNum : bNum - aNum;
}

export function distributeMasterTableWidths(
  baseWidths: number[],
  targetWidth: number,
): number[] {
  if (!baseWidths.length) return [];

  const totalBaseWidth = baseWidths.reduce((sum, width) => sum + width, 0);
  if (targetWidth <= totalBaseWidth) {
    return baseWidths;
  }

  const scaledWidths = baseWidths.map(
    (width) => (width / totalBaseWidth) * targetWidth,
  );
  const widths = scaledWidths.map((width) => Math.floor(width));
  let remainder = targetWidth - widths.reduce((sum, width) => sum + width, 0);

  const byFraction = scaledWidths
    .map((width, index) => ({
      index,
      fraction: width - Math.floor(width),
    }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let cursor = 0; remainder > 0; cursor += 1, remainder -= 1) {
    widths[byFraction[cursor % byFraction.length].index] += 1;
  }

  return widths;
}

export default function DesktopMasterTable({
  start,
  extended,
  scheduleRows,
  gamesPerDay,
  excludedDays,
  setExcludedDays,
  hidePreseason,
  opponentMetricsByTeamId,
  opponentMetricColumns,
  opponentLeagueAverages,
  opponentMetricsLoading,
  opponentMetricsError,
  opponentCoverageByTeamId,
  opponentLeagueCoverage,
  opponentSourceLabel,
  fourWeekSummaryByTeamId,
  fourWeekAverages,
  fourWeekCalendar,
  expandedTeamIds = new Set(),
  onToggleTeam,
  renderTeamDetails,
}: DesktopMasterTableProps) {
  const teamsMap = useTeamsMap();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "teamName",
    direction: "ascending",
  });
  const [isFourWeekCollapsed, setIsFourWeekCollapsed] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [stickyHeader, setStickyHeader] = useState<StickyHeaderState>({
    active: false,
    left: 0,
    width: 0,
    scrollLeft: 0,
    tableWidth: 0,
  });

  const days = extended ? EXTENDED_DAYS : DAYS;
  const dayKeys = useMemo(
    () =>
      days.map((_, index) =>
        getDayStr(parseISO(start), addDays(parseISO(start), index)),
      ),
    [days, start],
  );
  const rows = useMemo<MasterRow[]>(() => {
    return scheduleRows.map((row) => {
      const team = teamsMap[row.teamId];
      const fourWeek = fourWeekSummaryByTeamId[row.teamId];

      return {
        ...row,
        teamName: team?.name ?? "",
        teamAbbreviation: team?.abbreviation ?? String(row.teamId),
        logo: team?.logo ?? `/teamLogos/${row.teamId}.png`,
        opponentMetrics: opponentMetricsByTeamId[row.teamId] ?? {
          avgXgf: null,
          avgXga: null,
          avgSf: null,
          avgSa: null,
          avgGoalFor: null,
          avgGoalAgainst: null,
          avgWinPct: null,
        },
        fourWeekGamesPlayed: fourWeek?.gamesPlayed ?? null,
        fourWeekOffNights: fourWeek?.offNights ?? null,
        fourWeekOpponentPointPct: fourWeek?.avgOpponentPointPct ?? null,
        fourWeekScore: fourWeek?.score ?? null,
      };
    });
  }, [
    fourWeekSummaryByTeamId,
    opponentMetricsByTeamId,
    scheduleRows,
    teamsMap,
  ]);

  const totalLeagueGames = calcTotalGP(gamesPerDay, excludedDays, days);
  const totalLeagueOffNights = calcTotalOffNights(gamesPerDay, excludedDays, days);

  const sortedRows = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      let aValue: number | string | null | undefined;
      let bValue: number | string | null | undefined;

      switch (sortConfig.key) {
        case "teamName":
          aValue = a.teamName;
          bValue = b.teamName;
          break;
        case "totalGamesPlayed":
        case "totalOffNights":
        case "weekScore":
        case "fourWeekGamesPlayed":
        case "fourWeekOffNights":
        case "fourWeekOpponentPointPct":
        case "fourWeekScore":
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
          break;
        default:
          aValue = a.opponentMetrics[sortConfig.key];
          bValue = b.opponentMetrics[sortConfig.key];
      }

      const result = compareValues(aValue, bValue, sortConfig.direction);
      if (result !== 0) return result;
      return a.teamName.localeCompare(b.teamName);
    });

    return copy;
  }, [rows, sortConfig]);

  const scoreRanking = useMemo(() => {
    return [...rows]
      .filter((row) => row.weekScore !== -100)
      .sort((a, b) => b.weekScore - a.weekScore)
      .reduce<Map<number, number>>((acc, row, index) => {
        acc.set(row.teamId, index + 1);
        return acc;
      }, new Map<number, number>());
  }, [rows]);

  const topTenTeams = useMemo(
    () =>
      new Set(
        [...scoreRanking.entries()]
          .filter(([, rank]) => rank <= 10)
          .map(([teamId]) => teamId),
      ),
    [scoreRanking],
  );

  const bottomTenTeams = useMemo(
    () =>
      new Set(
        [...scoreRanking.entries()]
          .sort((a, b) => a[1] - b[1])
          .filter(([, rank]) => rank > 10)
          .slice(-10)
          .map(([teamId]) => teamId),
      ),
    [scoreRanking],
  );

  const opponentMetricRankMaps = useMemo(() => {
    const directions: Record<keyof OpponentMetricAverages, "asc" | "desc"> = {
      avgXgf: "asc",
      avgXga: "desc",
      avgSf: "asc",
      avgSa: "desc",
      avgGoalFor: "asc",
      avgGoalAgainst: "desc",
      avgWinPct: "asc",
    };

    return opponentMetricColumns.reduce<
      Record<
        keyof OpponentMetricAverages,
        { best: Map<number, number>; worst: Map<number, number> }
      >
    >(
      (acc, { key }) => {
        const entries: TeamNumeric[] = [];

        rows.forEach((row) => {
          const value = row.opponentMetrics[key];
          if (typeof value === "number") {
            entries.push({ teamId: row.teamId, value });
          }
        });

        acc[key] = toRankMaps(entries, directions[key]);
        return acc;
      },
      {} as Record<
        keyof OpponentMetricAverages,
        { best: Map<number, number>; worst: Map<number, number> }
      >,
    );
  }, [opponentMetricColumns, rows]);

  const getOpponentMetricStateClass = (
    key: keyof OpponentMetricAverages,
    teamId: number,
    value: number | null,
  ) => {
    if (opponentMetricsError || typeof value !== "number") return undefined;

    const bestRank = opponentMetricRankMaps[key]?.best.get(teamId);
    if (bestRank != null) {
      return bestRank <= 5
        ? styles.masterMetricGoodStrong
        : styles.masterMetricGoodSoft;
    }

    const worstRank = opponentMetricRankMaps[key]?.worst.get(teamId);
    if (worstRank != null) {
      return worstRank <= 5
        ? styles.masterMetricBadStrong
        : styles.masterMetricBadSoft;
    }

    return undefined;
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction:
            prev.direction === "ascending" ? "descending" : "ascending",
        };
      }

      return {
        key,
        direction: getDefaultDirection(key),
      };
    });
  };

  const toggleExcludedDay = (day: EXTENDED_DAY_ABBREVIATION) => {
    setExcludedDays((prev) => {
      const set = new Set(prev);
      if (set.has(day)) {
        set.delete(day);
      } else {
        set.add(day);
      }
      return Array.from(set);
    });
  };

  const fourWeekColumnSpan = isFourWeekCollapsed ? 1 : 4;
  const baseColumnWidths = useMemo(() => {
    const widths = [
      ...opponentMetricColumns.map(({ key }) =>
        key === "avgWinPct"
          ? MASTER_PERCENT_METRIC_COL_BASE_WIDTH
          : MASTER_METRIC_COL_BASE_WIDTH,
      ),
      MASTER_TEAM_COL_BASE_WIDTH,
      ...Array(dayKeys.length).fill(MASTER_DAY_COL_BASE_WIDTH),
      MASTER_SUMMARY_COL_BASE_WIDTH,
      MASTER_SUMMARY_COL_BASE_WIDTH,
      MASTER_SCORE_COL_BASE_WIDTH,
    ];

    if (isFourWeekCollapsed) {
      widths.push(MASTER_FOUR_WEEK_COLLAPSED_BASE_WIDTH);
    } else {
      widths.push(
        MASTER_FOUR_WEEK_COL_BASE_WIDTH,
        MASTER_FOUR_WEEK_COL_BASE_WIDTH,
        MASTER_FOUR_WEEK_COL_BASE_WIDTH,
        MASTER_FOUR_WEEK_COL_BASE_WIDTH,
      );
    }

    return widths;
  }, [dayKeys.length, isFourWeekCollapsed, opponentMetricColumns]);

  const columnWidths = useMemo(
    () => distributeMasterTableWidths(baseColumnWidths, containerWidth),
    [baseColumnWidths, containerWidth],
  );

  const tableWidth = useMemo(
    () => columnWidths.reduce((sum, width) => sum + width, 0),
    [columnWidths],
  );

  const stickyMetricOffsets = useMemo(() => {
    let offset = 0;

    return Array.from({ length: opponentMetricColumns.length }, (_, index) => {
      const currentOffset = offset;
      offset += columnWidths[index] ?? 0;
      return currentOffset;
    });
  }, [columnWidths, opponentMetricColumns.length]);

  const stickyTeamOffset = useMemo(
    () =>
      stickyMetricOffsets[stickyMetricOffsets.length - 1] != null
        ? stickyMetricOffsets[stickyMetricOffsets.length - 1] +
          (columnWidths[opponentMetricColumns.length - 1] ?? 0)
        : 0,
    [columnWidths, opponentMetricColumns.length, stickyMetricOffsets],
  );

  const renderSortableHeader = (
    label: string,
    key: SortKey,
    className?: string,
    stickyLeft?: number,
    headerKey?: string,
  ) => {
    const isSorted = sortConfig.key === key;
    const nextDirection = isSorted
      ? sortConfig.direction === "ascending"
        ? "descending"
        : "ascending"
      : getDefaultDirection(key);
    const directionGlyph =
      isSorted && sortConfig.direction === "ascending" ? "▲" : "▼";

    return (
      <th
        key={headerKey ?? key}
        className={clsx(
          className,
          stickyLeft != null && styles.masterStickyMetric,
        )}
        style={stickyLeft != null ? { left: `${stickyLeft}px` } : undefined}
      >
        <button
          type="button"
          className={styles.masterSortButton}
          onClick={() => handleSort(key)}
          aria-label={`Sort by ${label} ${nextDirection}`}
        >
          <span>{label}</span>
          {isSorted && (
            <span
              className={clsx(
                styles.masterSortGlyph,
                styles.masterSortGlyphActive,
              )}
              aria-hidden="true"
            >
              {directionGlyph}
            </span>
          )}
        </button>
      </th>
    );
  };

  const renderColGroup = () => {
    if (!columnWidths.length) {
      return null;
    }

    return (
      <colgroup>
        {columnWidths.map((width, index) => (
          <col key={`col-${index}`} style={{ width: `${width}px` }} />
        ))}
      </colgroup>
    );
  };

  const renderTableHeader = (keyPrefix = "") => (
    <thead ref={keyPrefix ? undefined : theadRef}>
      <tr className={styles.masterHeaderGroupRow}>
        <th
          colSpan={opponentMetricColumns.length}
          className={clsx(
            styles.masterSectionBanner,
            styles.masterSectionBannerMetrics,
            styles.masterStickyMetricGroup,
            styles.masterSectionBannerStart,
          )}
        >
          <span className={styles.masterSectionLabel}>Opponent Metrics</span>
        </th>
        <th colSpan={1 + dayKeys.length} className={styles.masterSectionBanner}>
          <span className={styles.masterSectionLabel}>Game Grid</span>
        </th>
        <th
          colSpan={3}
          className={clsx(
            styles.masterSectionBanner,
            styles.masterSectionBannerSummary,
          )}
        >
          <span className={styles.masterSectionLabel}>Week Summary</span>
        </th>
        <th
          colSpan={fourWeekColumnSpan}
          className={clsx(
            styles.masterSectionBanner,
            styles.masterSectionBannerFourWeek,
            isFourWeekCollapsed && styles.masterSectionBannerCollapsed,
            styles.masterSectionBannerEnd,
          )}
        >
          <span className={styles.masterSectionLabel}>
            {isFourWeekCollapsed ? "4WK" : "Four Week Forecast"}
          </span>
        </th>
      </tr>
      <tr className={styles.masterHeaderMetricRow}>
        {opponentMetricColumns.map((column, index) =>
          renderSortableHeader(
            column.label,
            column.key,
            clsx(
              styles.masterMetricHeader,
              index === 0 && styles.masterMetricHeaderLead,
              index === opponentMetricColumns.length - 1 &&
                styles.masterGroupEdge,
            ),
            stickyMetricOffsets[index],
            `${keyPrefix}${column.key}`,
          ),
        )}
        <th
          key={`${keyPrefix}teamName`}
          className={clsx(
            styles.masterTeamHeader,
            styles.masterStickyCol,
            styles.masterStickyTeamCol,
          )}
          style={{ left: `${stickyTeamOffset}px` }}
        >
          <div className={styles.masterTeamHeaderInner}>
            <button
              type="button"
              className={styles.masterSortButton}
              onClick={() => handleSort("teamName")}
              aria-label={`Sort by Team ${
                sortConfig.key === "teamName" &&
                sortConfig.direction === "ascending"
                  ? "descending"
                  : "ascending"
              }`}
            >
              <span>Team</span>
              {sortConfig.key === "teamName" && (
                <span
                  className={clsx(
                    styles.masterSortGlyph,
                    styles.masterSortGlyphActive,
                  )}
                  aria-hidden="true"
                >
                  {sortConfig.direction === "ascending" ? "▲" : "▼"}
                </span>
              )}
            </button>
          </div>
        </th>
        {dayKeys.map((day, index) => {
          const currentDate = addDays(parseISO(start), index);
          const weekDay = day as EXTENDED_DAY_ABBREVIATION;
          const isExcluded = excludedDays.includes(weekDay);

          return (
            <th
              key={`${keyPrefix}${day}`}
              className={clsx(isExcluded && styles.masterDayHeaderExcluded)}
              data-intensity={getGamesPerDayIntensity(gamesPerDay[index] ?? 0)}
            >
              <div className={styles.masterDayHeader}>
                <div className={styles.masterDayHeaderLabel}>
                  <div className={styles.masterDayAndDate}>
                    <span className={styles.masterDayName}>
                      {String(day).replace(/^n/, "N")}
                    </span>
                    <span className={styles.masterDayDate}>
                      {formatDate(currentDate)}
                    </span>
                  </div>
                  <div
                    className={clsx(styles.dayToggle, styles.masterDayToggle)}
                  >
                    <Toggle
                      size="small"
                      checked={!isExcluded}
                      onChange={() => toggleExcludedDay(weekDay)}
                      aria-label={`Include ${String(day).replace(/^n/, "NEXT ")} games`}
                    />
                  </div>
                </div>
              </div>
            </th>
          );
        })}
        {renderSortableHeader(
          "GP",
          "totalGamesPlayed",
          styles.masterBlueHeader,
          undefined,
          `${keyPrefix}totalGamesPlayed`,
        )}
        {renderSortableHeader(
          "OFF",
          "totalOffNights",
          clsx(styles.masterBlueHeader, styles.masterGroupEdge),
          undefined,
          `${keyPrefix}totalOffNights`,
        )}
        {renderSortableHeader(
          "Score",
          "weekScore",
          clsx(styles.masterSummaryScore, styles.masterScoreHeader),
          undefined,
          `${keyPrefix}weekScore`,
        )}
        {!isFourWeekCollapsed && (
          <>
            <th
              key={`${keyPrefix}fourWeekGamesPlayed`}
              className={clsx(
                styles.masterFourWeekHeader,
                styles.masterFourWeekLead,
                styles.masterFourWeekColumn,
              )}
            >
              <div className={styles.masterFourWeekHeaderActions}>
                <button
                  type="button"
                  className={styles.masterSortButton}
                  onClick={() => handleSort("fourWeekGamesPlayed")}
                  aria-label={`Sort by 4WK GP ${
                    sortConfig.key === "fourWeekGamesPlayed"
                      ? sortConfig.direction === "ascending"
                        ? "descending"
                        : "ascending"
                      : getDefaultDirection("fourWeekGamesPlayed")
                  }`}
                >
                  <span>4WK GP</span>
                  {sortConfig.key === "fourWeekGamesPlayed" && (
                    <span
                      className={clsx(
                        styles.masterSortGlyph,
                        styles.masterSortGlyphActive,
                      )}
                      aria-hidden="true"
                    >
                      {sortConfig.direction === "ascending" ? "▲" : "▼"}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={styles.masterFourWeekCollapseControl}
                  onClick={() => setIsFourWeekCollapsed(true)}
                  aria-expanded={true}
                  aria-label="Collapse four-week columns"
                >
                  <span aria-hidden="true">◂</span>
                </button>
              </div>
            </th>
            {renderSortableHeader(
              "4WK OFF",
              "fourWeekOffNights",
              styles.masterFourWeekHeader,
              undefined,
              `${keyPrefix}fourWeekOffNights`,
            )}
            {renderSortableHeader(
              "Opp %",
              "fourWeekOpponentPointPct",
              clsx(styles.masterFourWeekHeader, styles.masterGroupEdge),
              undefined,
              `${keyPrefix}fourWeekOpponentPointPct`,
            )}
            {renderSortableHeader(
              "4WK Score",
              "fourWeekScore",
              clsx(styles.masterFourWeekHeader, styles.masterGroupEdge),
              undefined,
              `${keyPrefix}fourWeekScore`,
            )}
          </>
        )}
        {isFourWeekCollapsed && (
          <th
            key={`${keyPrefix}fourWeekCollapsed`}
            className={clsx(
              styles.masterFourWeekHeader,
              styles.masterFourWeekColumn,
              styles.masterFourWeekCollapsedHeader,
              styles.masterGroupEdge,
            )}
          >
            <button
              type="button"
              className={clsx(
                styles.masterCollapseButton,
                styles.masterFourWeekCollapsedButton,
              )}
              onClick={() => setIsFourWeekCollapsed((value) => !value)}
              aria-expanded={!isFourWeekCollapsed}
              aria-label="Expand four-week columns"
            >
              <span className={styles.masterCollapseLabel}>4WK</span>
              <span aria-hidden="true">◂|▸</span>
            </button>
          </th>
        )}
      </tr>
    </thead>
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameId = 0;

    const updateStickyHeader = () => {
      const scrollEl = scrollRef.current;
      const tableEl = tableRef.current;
      const theadEl = theadRef.current;

      if (!scrollEl || !tableEl || !theadEl) return;

      const isDesktop = window.innerWidth >= DESKTOP_STICKY_BREAKPOINT;
      const tableRect = tableEl.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      const headerHeight = theadEl.getBoundingClientRect().height;

      const nextState: StickyHeaderState = {
        active:
          isDesktop &&
          tableRect.top <= 0 &&
          tableRect.bottom - headerHeight > 0,
        left: scrollRect.left,
        width: scrollEl.clientWidth,
        scrollLeft: scrollEl.scrollLeft,
        tableWidth: tableEl.offsetWidth,
      };

      setStickyHeader((prev) => {
        if (
          prev.active === nextState.active &&
          prev.left === nextState.left &&
          prev.width === nextState.width &&
          prev.scrollLeft === nextState.scrollLeft &&
          prev.tableWidth === nextState.tableWidth
        ) {
          return prev;
        }

        return nextState;
      });
    };

    const scheduleUpdate = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(updateStickyHeader);
    };

    const scrollEl = scrollRef.current;
    const resizeObserver = new ResizeObserver(scheduleUpdate);

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scrollEl?.addEventListener("scroll", scheduleUpdate, { passive: true });

    if (scrollEl) resizeObserver.observe(scrollEl);
    if (tableRef.current) resizeObserver.observe(tableRef.current);
    if (theadRef.current) resizeObserver.observe(theadRef.current);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      scrollEl?.removeEventListener("scroll", scheduleUpdate);
      resizeObserver.disconnect();
    };
  }, [dayKeys.length, isFourWeekCollapsed, opponentMetricColumns.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameId = 0;

    const updateContainerWidth = () => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;

      const nextWidth = Math.round(scrollEl.clientWidth);
      setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    const scheduleUpdate = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(updateContainerWidth);
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    const scrollEl = scrollRef.current;

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);

    if (scrollEl) {
      resizeObserver.observe(scrollEl);
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={styles.masterTableShell}>
      {opponentMetricsError && (
        <div className={styles.masterMetricsUnavailable} role="status">
          Opponent metrics unavailable. Schedule and four-week data remain
          available.
        </div>
      )}
      {stickyHeader.active && (
        <div
          className={styles.masterStickyHeaderOverlay}
          style={{
            left: `${stickyHeader.left}px`,
            width: `${stickyHeader.width}px`,
          }}
        >
          <div className={styles.masterStickyHeaderViewport}>
            <table
              className={clsx(
                styles.masterTable,
                styles.masterStickyHeaderTable,
              )}
              aria-describedby="weekScoreDesc"
              style={{
                width: `${tableWidth || stickyHeader.tableWidth}px`,
                minWidth: `${tableWidth || stickyHeader.tableWidth}px`,
                transform: `translateX(-${stickyHeader.scrollLeft}px)`,
              }}
            >
              {renderColGroup()}
              {renderTableHeader("sticky-")}
            </table>
          </div>
        </div>
      )}
      {opponentSourceLabel && (
        <p className={styles.masterSourceContext}>
          Opponent stats: {opponentSourceLabel} Metrics per game; PTS% = points / (2 × GP). Coverage counts available scheduled opponents; incomplete means are unavailable.
        </p>
      )}
      {fourWeekCalendar && (
        <p className={styles.masterSourceContext}>
          {fourWeekCalendar.error ?? `Four weeks: ${fourWeekCalendar.start}–${fourWeekCalendar.end}, selected Monday–Sunday week plus three weeks. Schedule coverage ${fourWeekCalendar.knownDays}/${fourWeekCalendar.expectedDays} days.`}
        </p>
      )}
      <div ref={scrollRef} className={styles.masterTableScroll}>
        <table
          ref={tableRef}
          className={styles.masterTable}
          aria-describedby="weekScoreDesc"
          style={
            tableWidth
              ? { width: `${tableWidth}px`, minWidth: `${tableWidth}px` }
              : undefined
          }
        >
          {renderColGroup()}
          {renderTableHeader()}
          <tbody>
            <tr className={styles.masterTotalsRow}>
              {opponentMetricColumns.map((column, index) => (
                <td
                  key={column.key}
                  className={clsx(
                    styles.masterMetricCell,
                    styles.masterStickyMetric,
                    index === opponentMetricColumns.length - 1 &&
                      styles.masterGroupEdge,
                  )}
                  style={{ left: `${stickyMetricOffsets[index] ?? 0}px` }}
                >
                  {opponentMetricsLoading
                    ? "..."
                    : opponentMetricsError
                      ? "-"
                    : formatMetricValue(
                        column.key,
                        opponentLeagueAverages[column.key],
                      )}
                  {!opponentMetricsLoading && !opponentMetricsError && opponentLeagueCoverage && (
                    <small className={styles.masterMetricCoverage} title="Complete displayed team means">
                      {opponentLeagueCoverage[column.key].known}/{opponentLeagueCoverage[column.key].expected} teams
                    </small>
                  )}
                </td>
              ))}
              <td
                className={clsx(
                  styles.masterStickyCol,
                  styles.masterStickyTeamCol,
                  styles.masterTeamCell,
                  styles.masterAverageLabel,
                )}
                style={{ left: `${stickyTeamOffset}px` }}
              >
                <span className={styles.masterAverageTitle}>GP/Day</span>
                <span className={styles.masterAverageSubtitle}>AVG</span>
              </td>
              {dayKeys.map((day, index) => (
                <td
                  key={`avg-${day}`}
                  className={styles.masterAverageDash}
                  data-intensity={getGamesPerDayIntensity(
                    gamesPerDay[index] ?? 0,
                  )}
                >
                  {gamesPerDay[index] ?? "-"}
                </td>
              ))}
              <td
                data-intensity={getCurrentSummaryIntensity(
                  "gp",
                  totalLeagueGames,
                )}
              >
                {totalLeagueGames}
              </td>
              <td
                className={styles.masterGroupEdge}
                data-intensity={getCurrentSummaryIntensity(
                  "off",
                  totalLeagueOffNights,
                )}
              >
                {totalLeagueOffNights}
              </td>
              <td className={styles.masterSummaryScore}>-</td>
              {!isFourWeekCollapsed && (
                <>
                  <td className={styles.masterFourWeekLeadCell}>
                    {formatMetricValue(
                      "fourWeekGamesPlayed",
                      fourWeekAverages.gamesPlayed,
                    )}
                  </td>
                  <td className={styles.masterFourWeekCell}>
                    {formatMetricValue(
                      "fourWeekOffNights",
                      fourWeekAverages.offNights,
                    )}
                  </td>
                  <td className={styles.masterFourWeekCell}>
                    {formatMetricValue(
                      "fourWeekOpponentPointPct",
                      fourWeekAverages.avgOpponentPointPct,
                    )}
                  </td>
                  <td
                    className={clsx(
                      styles.masterFourWeekCell,
                      styles.masterGroupEdge,
                    )}
                  >
                    {formatMetricValue(
                      "fourWeekScore",
                      fourWeekAverages.score,
                    )}
                  </td>
                </>
              )}
              {isFourWeekCollapsed && (
                <td className={styles.masterCollapseSpacer}></td>
              )}
            </tr>
            {sortedRows.map((row) => {
              const isTopTen = topTenTeams.has(row.teamId);
              const isBottomTen = bottomTenTeams.has(row.teamId);
              const rowHighlightClass = isTopTen
                ? styles.masterRowBest
                : isBottomTen
                  ? styles.masterRowWorst
                  : undefined;

              return (
                <Fragment key={row.teamId}>
                <tr className={rowHighlightClass}>
                  {opponentMetricColumns.map((column, index) => (
                    <td
                      key={`${row.teamId}-${column.key}`}
                      className={clsx(
                        styles.masterMetricCell,
                        styles.masterStickyMetric,
                        getOpponentMetricStateClass(
                          column.key,
                          row.teamId,
                          row.opponentMetrics[column.key],
                        ),
                        index === opponentMetricColumns.length - 1 &&
                          styles.masterGroupEdge,
                      )}
                      style={{ left: `${stickyMetricOffsets[index] ?? 0}px` }}
                    >
                      {opponentMetricsLoading
                        ? "..."
                        : opponentMetricsError
                          ? "-"
                        : formatMetricValue(
                            column.key,
                            row.opponentMetrics[column.key],
                          )}
                      {!opponentMetricsLoading && !opponentMetricsError && opponentCoverageByTeamId?.[row.teamId] && (
                        <small className={styles.masterMetricCoverage} title="Available scheduled opponents; incomplete means are unavailable">
                          {opponentCoverageByTeamId[row.teamId][column.key].known}/{opponentCoverageByTeamId[row.teamId][column.key].expected}
                        </small>
                      )}
                    </td>
                  ))}
                  <td
                    className={clsx(
                      styles.masterStickyCol,
                      styles.masterStickyTeamCol,
                      styles.masterTeamCell,
                    )}
                    style={{ left: `${stickyTeamOffset}px` }}
                  >
                    {onToggleTeam ? <div className={detailStyles.detailControls}>
                      <button
                        id={`game-grid-master-trigger-${row.teamId}`}
                        type="button"
                        className={detailStyles.teamDisclosure}
                        aria-label={`${expandedTeamIds.has(row.teamId) ? "Hide" : "Show"} ${row.teamName} team preview`}
                        aria-expanded={expandedTeamIds.has(row.teamId)}
                        aria-controls={`game-grid-team-details-${row.teamId}`}
                        onClick={() => onToggleTeam(row.teamId)}
                      >
                        <Image src={row.logo} alt="" width={34} height={34} className={styles.masterTeamLogo} />
                      </button>
                    </div> : <Link
                      href={`/stats/team/${row.teamAbbreviation}`}
                      aria-label={`Open ${row.teamName} Team HQ`}
                      className={styles.masterTeamIdentity}
                    >
                      <span className={styles.masterTeamLogoWrap}>
                        <Image
                          src={row.logo}
                          alt={`${row.teamName} logo`}
                          width={34}
                          height={34}
                          className={styles.masterTeamLogo}
                        />
                      </span>
                    </Link>}
                  </td>
                  {dayKeys.map((day, index) => {
                    const matchup = row[day];
                    const isPreseason = !!matchup && matchup.gameType === 1;
                    const excluded = excludedDays.includes(
                      day as EXTENDED_DAY_ABBREVIATION,
                    );
                    let dayIntensityClass = "";

                    if ((gamesPerDay[index] ?? 0) >= 9) {
                      dayIntensityClass = styles["heavy-day"];
                    } else if ((gamesPerDay[index] ?? 0) >= 7) {
                      dayIntensityClass = styles["medium-heavy-day"];
                    } else {
                      dayIntensityClass = styles["off-night-day"];
                    }

                    return (
                      <td
                        key={`${row.teamId}-${day}`}
                        className={clsx(
                          styles.cellInnerBorder,
                          dayIntensityClass,
                        )}
                      >
                        {matchup && !(isPreseason && hidePreseason) ? (
                          <MatchUpCell
                            gameId={matchup.id}
                            home={matchup.homeTeam.id === row.teamId}
                            homeTeam={matchup.homeTeam}
                            awayTeam={matchup.awayTeam}
                            excluded={excluded}
                          />
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  })}
                  <td
                    data-intensity={getCurrentSummaryIntensity(
                      "gp",
                      row.totalGamesPlayed,
                    )}
                  >
                    {row.totalGamesPlayed}
                  </td>
                  <td
                    className={styles.masterGroupEdge}
                    data-intensity={getCurrentSummaryIntensity(
                      "off",
                      row.totalOffNights,
                    )}
                  >
                    {row.totalOffNights}
                  </td>
                  <td
                    className={clsx(
                      styles.masterSummaryScore,
                      isTopTen && styles.masterScoreBest,
                      isBottomTen && styles.masterScoreWorst,
                    )}
                  >
                    {row.weekScore === -100 ? "-" : row.weekScore.toFixed(1)}
                  </td>
                  {!isFourWeekCollapsed && (
                    <>
                      <td className={styles.masterFourWeekLeadCell}>
                        {formatMetricValue(
                          "fourWeekGamesPlayed",
                          row.fourWeekGamesPlayed,
                        )}
                      </td>
                      <td className={styles.masterFourWeekCell}>
                        {formatMetricValue(
                          "fourWeekOffNights",
                          row.fourWeekOffNights,
                        )}
                      </td>
                      <td className={styles.masterFourWeekCell}>
                        {formatMetricValue(
                          "fourWeekOpponentPointPct",
                          row.fourWeekOpponentPointPct,
                        )}
                        {fourWeekSummaryByTeamId[row.teamId]?.opponentCoverage && (
                          <small className={styles.masterMetricCoverage} title="Available scheduled opponents; incomplete means are unavailable">
                            {fourWeekSummaryByTeamId[row.teamId].opponentCoverage!.known}/{fourWeekSummaryByTeamId[row.teamId].opponentCoverage!.expected}
                          </small>
                        )}
                      </td>
                      <td
                        className={clsx(
                          styles.masterFourWeekCell,
                          styles.masterGroupEdge,
                        )}
                      >
                        {formatMetricValue(
                          "fourWeekScore",
                          row.fourWeekScore,
                        )}
                      </td>
                    </>
                  )}
                  {isFourWeekCollapsed && (
                    <td className={styles.masterCollapseSpacer}></td>
                  )}
                </tr>
                {expandedTeamIds.has(row.teamId) && renderTeamDetails && (
                  <tr className={detailStyles.detailRow}>
                    <td colSpan={opponentMetricColumns.length + 1 + dayKeys.length + 3 + fourWeekColumnSpan} className={detailStyles.detailCell}>
                      <div id={`game-grid-team-details-${row.teamId}`}>
                        <div className={detailStyles.detailControls}>
                          <Link href={`/stats/team/${row.teamAbbreviation}`} className={detailStyles.teamHqLink}>Team HQ</Link>
                          <button type="button" className={detailStyles.closeButton} onClick={() => {
                            document.getElementById(`game-grid-master-trigger-${row.teamId}`)?.focus();
                            onToggleTeam?.(row.teamId);
                          }}>Close preview</button>
                        </div>
                        {renderTeamDetails(row.teamId)}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
