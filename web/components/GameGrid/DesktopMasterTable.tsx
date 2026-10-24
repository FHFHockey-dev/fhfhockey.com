import { parseISO } from "date-fns";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import MetricInfoDisclosure from "./MetricInfoDisclosure";
import OpportunitySparkline from "./OpportunitySparkline";
import RatingMeter from "./RatingMeter";
import { LoadingCell, LoadingRows } from "./LoadingCells";
import { RATING_INFO, OPPORTUNITY_INFO, formatOpportunity, type OpponentRating, type TeamOpportunity } from "./utils/scheduleOpportunity";

import { DAYS, EXTENDED_DAY_ABBREVIATION, EXTENDED_DAYS, WeekData } from "lib/NHL/types";
import { useTeamsMap } from "hooks/useTeams";
import { TeamNumeric, toRankMaps } from "./utils/metricRanks";
import { getOpponentViewDirections, OpponentRole } from "./utils/opponentCategoryEffects";
import { FOUR_WEEK_COLOR_LEGEND, toFourWeekMetricBands } from "./utils/fourWeekMetricBands";
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
  scheduleReady?: boolean;
  scheduleLoading?: boolean;
  fourWeekLoading?: boolean;
  opponentRatings?: Record<number, OpponentRating>;
  opportunityByTeamId?: Record<number, TeamOpportunity>;
  sharedOpportunityScale?: number;
  metricInfoTarget?: HTMLElement | null;
  warningTarget?: HTMLElement | null;
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
  | "atk" | "def"
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
  opponentMetrics: OpponentMetricAverages & { atk: number | null; def: number | null };
  fourWeekGamesPlayed: number | null;
  fourWeekOffNights: number | null;
  fourWeekOpponentPointPct: number | null;
  fourWeekScore: number | null;
};

const DESKTOP_STICKY_BREAKPOINT = 1024;
// Side and summary columns scale with the pinned Game Grid; minimums are the narrowest legible cell.
export type MasterColumnSpec = { base: number; min: number };
export const MASTER_COLUMNS = {
  rating: { base: 72, min: 60 },
  metric: { base: 50, min: 40 },
  percent: { base: 64, min: 50 },
  team: { base: 72, min: 56 },
  day: { base: 80, min: 50 },
  summary: { base: 72, min: 40 },
  score: { base: 104, min: 56 },
  fourWeek: { base: 64, min: 48 },
  fourWeekValue: { base: 72, min: 56 },
  trend: { base: 104, min: 78 },
} satisfies Record<string, MasterColumnSpec>;

type StickyHeaderState = {
  active: boolean;
  top: number;
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
  average = false,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  if (key === "avgWinPct" || key === "fourWeekOpponentPointPct") {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (key === "atk" || key === "def") return String(Math.round(value));
  if (key === "fourWeekScore") return formatOpportunity(value);
  if (key === "weekScore") {
    return value.toFixed(1);
  }

  if (
    key === "totalGamesPlayed" ||
    key === "totalOffNights" ||
    key === "fourWeekGamesPlayed" ||
    key === "fourWeekOffNights"
  ) {
    return average ? value.toFixed(1) : `${value}`;
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

// The pre-redesign table (7 source metrics, team, days, summary, four 72px four-week columns)
// fixes the Game Grid geometry, so team and day columns never change with side-group state.
const ORIGINAL_SIDE_METRIC_WIDTHS = [50, 50, 50, 50, 50, 50, 80];
const ORIGINAL_FOUR_WEEK_WIDTHS = [72, 72, 72, 72];

/**
 * Team and day columns keep the pre-redesign widths. The side groups and Week
 * Summary scale with them, then shrink toward their minimums so everything fits;
 * the table scrolls only when even the minimums do not fit.
 */
export function sizeMasterTableColumns({ metricColumns, dayCount, fourWeekCollapsed, containerWidth }: {
  metricColumns: MasterColumnSpec[]; dayCount: number; fourWeekCollapsed: boolean; containerWidth: number;
}) {
  const { team, day, summary, score, fourWeek, percent, fourWeekValue, trend } = MASTER_COLUMNS;
  const sum = (widths: number[]) => widths.reduce((total, width) => total + width, 0);
  const original = [...ORIGINAL_SIDE_METRIC_WIDTHS, team.base, ...Array(dayCount).fill(day.base),
    summary.base, summary.base, score.base, ...ORIGINAL_FOUR_WEEK_WIDTHS];
  const reference = distributeMasterTableWidths(original, containerWidth);
  const scale = sum(reference) / sum(original);
  const grid = reference.slice(ORIGINAL_SIDE_METRIC_WIDTHS.length, ORIGINAL_SIDE_METRIC_WIDTHS.length + 1 + dayCount);

  const fourWeekColumns = fourWeekCollapsed ? [fourWeekValue, trend] : [fourWeek, fourWeek, percent, fourWeekValue, trend];
  const flex = [...metricColumns, summary, summary, score, ...fourWeekColumns];
  const widths = flex.map((spec) => spec.base * scale);
  const available = containerWidth - sum(grid);
  const excess = sum(widths) - available;
  const room = sum(flex.map((spec, index) => widths[index] - spec.min));
  if (containerWidth > 0 && excess > 0 && room > 0) {
    const share = Math.min(excess, room) / room;
    flex.forEach((spec, index) => { widths[index] -= (widths[index] - spec.min) * share; });
  }

  // Round down, then hand the leftover pixels to the largest fractions so the total is exact.
  const rounded = widths.map(Math.floor);
  widths.map((width, index) => ({ index, fraction: width - Math.floor(width) }))
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, Math.round(sum(widths)) - sum(rounded))
    .forEach(({ index }) => { rounded[index] += 1; });

  const metricCount = metricColumns.length;
  return [...rounded.slice(0, metricCount), ...grid, ...rounded.slice(metricCount)];
}

export default function DesktopMasterTable({
  opponentRatings = {}, opportunityByTeamId = {}, sharedOpportunityScale = 1,
  metricInfoTarget,
  warningTarget,
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
  opponentSourceLabel,
  fourWeekSummaryByTeamId,
  fourWeekAverages,
  fourWeekCalendar,
  expandedTeamIds = new Set(),
  onToggleTeam,
  renderTeamDetails,
  scheduleReady = true,
  scheduleLoading = false,
  fourWeekLoading = false,
}: DesktopMasterTableProps) {
  const teamsMap = useTeamsMap();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "teamName",
    direction: "ascending",
  });
  const [isFourWeekCollapsed, setIsFourWeekCollapsed] = useState(true);
  const [opponentExpanded, setOpponentExpanded] = useState(false);
  const visibleMetricColumns = useMemo<{ label: string; key: keyof OpponentMetricAverages | "atk" | "def" }[]>(() => [
    { label: "Attack", key: "atk" }, { label: "Defense", key: "def" }, ...(opponentExpanded ? opponentMetricColumns : [])
  ], [opponentExpanded, opponentMetricColumns]);
  // The perspective control is hidden; retain the existing default and scoring semantics.
  const opponentRole: OpponentRole = "skater";
  const [containerWidth, setContainerWidth] = useState(0);
  const [stickyHeader, setStickyHeader] = useState<StickyHeaderState>({
    active: false,
    top: 0,
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
        opponentMetrics: { ...(opponentMetricsByTeamId[row.teamId] ?? {
          avgXgf: null,
          avgXga: null,
          avgSf: null,
          avgSa: null,
          avgGoalFor: null,
          avgGoalAgainst: null,
          avgWinPct: null,
        }), atk: opponentRatings[row.teamId]?.atk ?? null, def: opponentRatings[row.teamId]?.def ?? null },
        fourWeekGamesPlayed: fourWeek?.gamesPlayed ?? null,
        fourWeekOffNights: fourWeek?.offNights ?? null,
        fourWeekOpponentPointPct: fourWeek?.avgOpponentPointPct ?? null,
        fourWeekScore: fourWeek?.score ?? null,
      };
    });
  }, [
    fourWeekSummaryByTeamId,
    opponentMetricsByTeamId,
    opponentRatings,
    scheduleRows,
    teamsMap,
  ]);

  const renderFourWeekValue = (key: SortKey, value: number | null, average = false) => fourWeekLoading ? <LoadingCell /> : formatMetricValue(key, value, average);

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
    const directions = getOpponentViewDirections(opponentRole);

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

        const direction = directions[key];
        acc[key] = direction
          ? toRankMaps(entries, direction)
          : { best: new Map(), worst: new Map() };
        return acc;
      },
      {} as Record<
        keyof OpponentMetricAverages,
        { best: Map<number, number>; worst: Map<number, number> }
      >,
    );
  }, [opponentMetricColumns, opponentRole, rows]);

  const fourWeekBands = useMemo(() => ({
    gamesPlayed: toFourWeekMetricBands(rows.map((row) => ({ teamId: row.teamId, value: row.fourWeekGamesPlayed })), "desc"),
    offNights: toFourWeekMetricBands(rows.map((row) => ({ teamId: row.teamId, value: row.fourWeekOffNights })), "desc"),
    opponentPointPct: toFourWeekMetricBands(rows.map((row) => ({ teamId: row.teamId, value: row.fourWeekOpponentPointPct })), "asc"),
  }), [rows]);

  // 4WK Value uses the opponent-metric palette: top/bottom 5 strong, 6–10 soft.
  const fourWeekValueRanks = useMemo(() => toRankMaps(
    rows.flatMap((row) => typeof row.fourWeekScore === "number" ? [{ teamId: row.teamId, value: row.fourWeekScore }] : []),
    "desc",
  ), [rows]);
  const getFourWeekValueStateClass = (teamId: number) => {
    const best = fourWeekValueRanks.best.get(teamId);
    if (best != null) return best <= 5 ? styles.masterMetricGoodStrong : styles.masterMetricGoodSoft;
    const worst = fourWeekValueRanks.worst.get(teamId);
    if (worst != null) return worst <= 5 ? styles.masterMetricBadStrong : styles.masterMetricBadSoft;
    return undefined;
  };

  const getOpponentMetricStateClass = (
    key: keyof OpponentMetricAverages | "atk" | "def",
    teamId: number,
    value: number | null,
  ) => {
    if (key === "atk" || key === "def") return undefined;
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

  const fourWeekColumnSpan = isFourWeekCollapsed ? 2 : 5;
  const columnWidths = useMemo(() => sizeMasterTableColumns({
    metricColumns: visibleMetricColumns.map(({ key }) =>
      key === "atk" || key === "def" ? MASTER_COLUMNS.rating : key === "avgWinPct" ? MASTER_COLUMNS.percent : MASTER_COLUMNS.metric),
    dayCount: dayKeys.length, fourWeekCollapsed: isFourWeekCollapsed, containerWidth,
  }), [visibleMetricColumns, dayKeys.length, isFourWeekCollapsed, containerWidth]);

  const tableWidth = useMemo(
    () => columnWidths.reduce((sum, width) => sum + width, 0),
    [columnWidths],
  );

  const stickyMetricOffsets = useMemo(() => {
    let offset = 0;

    return Array.from({ length: visibleMetricColumns.length }, (_, index) => {
      const currentOffset = offset;
      offset += columnWidths[index] ?? 0;
      return currentOffset;
    });
  }, [columnWidths, visibleMetricColumns.length]);

  const stickyTeamOffset = useMemo(
    () =>
      stickyMetricOffsets[stickyMetricOffsets.length - 1] != null
        ? stickyMetricOffsets[stickyMetricOffsets.length - 1] +
          (columnWidths[visibleMetricColumns.length - 1] ?? 0)
        : 0,
    [columnWidths, visibleMetricColumns.length, stickyMetricOffsets],
  );

  const renderSortableHeader = (
    label: string,
    key: SortKey,
    className?: string,
    stickyLeft?: number,
    headerKey?: string,
    eyebrow?: string,
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
          aria-label={`Sort by ${key === "atk" ? "opponent attack strength" : key === "def" ? "opponent defense strength" : key === "fourWeekScore" ? "four-week opportunity" : label} ${nextDirection}`}
        >
          {eyebrow ? (
            <span className={styles.masterSortLabelStack}>
              <span className={styles.masterMetricEyebrow}>{eyebrow}</span>
              <span>{label}</span>
            </span>
          ) : (
            <span>{label}</span>
          )}
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
          colSpan={visibleMetricColumns.length}
          className={clsx(
            styles.masterSectionBanner,
            styles.masterSectionBannerMetrics,
            styles.masterStickyMetricGroup,
            styles.masterSectionBannerStart,
          )}
        >
          <button
            type="button"
            className={styles.masterGroupDisclosure}
            onClick={() => setOpponentExpanded((v) => !v)}
            aria-expanded={opponentExpanded}
            aria-label={opponentExpanded ? "Collapse opponent details" : "Expand opponent details"}
          >
            <span>Opponent strength</span>
            <span className={styles.masterGroupChevron} aria-hidden="true">{opponentExpanded ? "◂" : "▸"}</span>
          </button>
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
            styles.masterSectionBannerEnd,
          )}
        >
          <button
            type="button"
            className={styles.masterGroupDisclosure}
            onClick={() => setIsFourWeekCollapsed((v) => !v)}
            aria-expanded={!isFourWeekCollapsed}
            aria-label={isFourWeekCollapsed ? "Expand four-week columns" : "Collapse four-week columns"}
          >
            <span>4-Week Opportunity</span>
            <span className={styles.masterGroupChevron} aria-hidden="true">{isFourWeekCollapsed ? "▸" : "◂"}</span>
          </button>
        </th>
      </tr>
      <tr className={styles.masterHeaderMetricRow}>
        {visibleMetricColumns.map((column, index) =>
          renderSortableHeader(
            column.label,
            column.key,
            clsx(
              styles.masterMetricHeader,
              index === 0 && styles.masterMetricHeaderLead,
              index === visibleMetricColumns.length - 1 &&
                styles.masterGroupEdge,
            ),
            stickyMetricOffsets[index],
            `${keyPrefix}${column.key}`,
            column.key === "atk" || column.key === "def" ? "↑ Stronger" : undefined,
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
              data-intensity={scheduleReady ? getGamesPerDayIntensity(gamesPerDay[index] ?? 0) : undefined}
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
            {renderSortableHeader(
              "4WK GP",
              "fourWeekGamesPlayed",
              clsx(styles.masterFourWeekHeader, styles.masterFourWeekLead),
              undefined,
              `${keyPrefix}fourWeekGamesPlayed`,
            )}
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
              styles.masterFourWeekHeader,
              undefined,
              `${keyPrefix}fourWeekOpponentPointPct`,
            )}
          </>
        )}
        {renderSortableHeader(
          "Total",
          "fourWeekScore",
          clsx(styles.masterFourWeekHeader, isFourWeekCollapsed && styles.masterFourWeekLead),
          undefined,
          `${keyPrefix}fourWeekScore`,
          "↑ More",
        )}
        <th
          key={`${keyPrefix}fourWeekTrend`}
          className={clsx(styles.masterFourWeekHeader, styles.masterGroupEdge)}
        >
          <span className={styles.masterTrendLabel}>Weekly <small>↑ More</small></span>
          <span className={styles.matchupKey} aria-label="Line color: easier to harder skater matchups"><i /> Easy → Hard <i /></span>
        </th>
      </tr>
    </thead>
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameId = 0;
    const siteHeaders = Array.from(
      document.querySelectorAll<HTMLElement>("[data-site-header]"),
    );

    const updateStickyHeader = () => {
      const scrollEl = scrollRef.current;
      const tableEl = tableRef.current;
      const theadEl = theadRef.current;

      if (!scrollEl || !tableEl || !theadEl) return;

      const isDesktop = window.innerWidth >= DESKTOP_STICKY_BREAKPOINT;
      const tableRect = tableEl.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      const headerHeight = theadEl.getBoundingClientRect().height;
      const top = Math.max(
        0,
        ...siteHeaders.map((header) => header.getBoundingClientRect().bottom),
      );

      const nextState: StickyHeaderState = {
        active:
          isDesktop &&
          tableRect.top <= top &&
          tableRect.bottom - headerHeight > top,
        top,
        left: scrollRect.left + Math.max(0, (scrollEl.clientWidth - tableEl.offsetWidth) / 2),
        width: Math.min(scrollEl.clientWidth, tableEl.offsetWidth),
        scrollLeft: scrollEl.scrollLeft,
        tableWidth: tableEl.offsetWidth,
      };

      setStickyHeader((prev) => {
        if (
          prev.active === nextState.active &&
          prev.top === nextState.top &&
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
    siteHeaders.forEach((header) => resizeObserver.observe(header));

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      scrollEl?.removeEventListener("scroll", scheduleUpdate);
      resizeObserver.disconnect();
    };
  }, [dayKeys.length, isFourWeekCollapsed, visibleMetricColumns.length]);

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

  const metricInfo = (
    <MetricInfoDisclosure label="Game Grid metrics" warningTarget={warningTarget} warnings={[
        ...(opponentMetricsError ? ["Opponent stats unavailable. Reload to retry."]
          : !opponentMetricsLoading && Object.values(opponentCoverageByTeamId ?? {}).some((coverage) => Object.values(coverage).some(({ known, expected }) => known < expected))
            ? ["Some opponent averages are unavailable. Check back after the next stats update."] : []),
        ...(fourWeekLoading ? [] : fourWeekCalendar?.error ? ["Schedule unavailable. Reload to retry."]
          : Object.values(opportunityByTeamId).some((v) => v.weeks.some((w) => w.unknown > 0))
            ? ["Some fixture starts or states are unresolved. Affected opportunity totals are unavailable."]
          : (fourWeekCalendar && fourWeekCalendar.knownDays < fourWeekCalendar.expectedDays) || Object.values(fourWeekSummaryByTeamId).some((summary) => summary.scheduleCoverage && summary.scheduleCoverage.known < summary.scheduleCoverage.expected)
            ? ["Schedule incomplete. Affected totals are unavailable; check back after schedule updates."]
            : Object.values(fourWeekSummaryByTeamId).some((summary) => summary.opponentCoverage && summary.opponentCoverage.known < summary.opponentCoverage.expected)
              ? ["Some opponent strength values are unavailable. Check back after standings update."] : []),
      ]}>
        {opponentSourceLabel && <p>Opponent stats (Natural Stat Trick): {opponentSourceLabel}</p>}
        <p>Metrics per game; PTS% = points / (2 × GP). Missing or incomplete opponent averages show “-”.</p>
        <p>xG = expected goals; GF/GA = goals for/against; SF/SA = shots for/against.</p>
        <p>{RATING_INFO}</p>
        <p>{OPPORTUNITY_INFO}</p>
        {fourWeekCalendar && <p>Four weeks: {fourWeekCalendar.start}–{fourWeekCalendar.end}, selected Monday–Sunday week plus three weeks. {fourWeekLoading ? "Loading schedule…" : fourWeekCalendar.error ?? (fourWeekCalendar.knownDays === fourWeekCalendar.expectedDays ? "Schedule complete." : "Schedule incomplete; affected totals are unavailable.")}</p>}
        <p>GP = games played; OFF = games on nights with eight or fewer NHL games. OPP% uses current-season NHL regular-season team points percentages.</p>
        <p>{FOUR_WEEK_COLOR_LEGEND.replace("score", "Opportunity")}</p>
      </MetricInfoDisclosure>
  );

  return (
    <div className={styles.masterTableShell} data-schedule-state={scheduleLoading ? "loading" : scheduleReady ? "ready" : "unavailable"}>
      {stickyHeader.active && (
        <div
          className={styles.masterStickyHeaderOverlay}
          style={{
            top: `${stickyHeader.top}px`,
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
      {metricInfoTarget ? createPortal(metricInfo, metricInfoTarget) : metricInfo}
      <div ref={scrollRef} className={styles.masterTableScroll}>
        <table
          ref={tableRef}
          aria-busy={scheduleLoading}
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
            {!scheduleReady ? <LoadingRows columns={visibleMetricColumns.length + 1 + dayKeys.length + 3 + fourWeekColumnSpan} teamColumn={visibleMetricColumns.length} waiting={scheduleLoading} /> : <>
            <tr className={styles.masterTotalsRow}>
              {visibleMetricColumns.map((column, index) => (
                <td
                  key={column.key}
                  className={clsx(
                    styles.masterMetricCell,
                    styles.masterStickyMetric,
                    index === visibleMetricColumns.length - 1 &&
                      styles.masterGroupEdge,
                  )}
                  style={{ left: `${stickyMetricOffsets[index] ?? 0}px` }}
                >
                  {opponentMetricsLoading
                    ? <LoadingCell />
                    : opponentMetricsError
                      ? "-"
                    : formatMetricValue(
                        column.key,
                        column.key === "atk" || column.key === "def" ? null : opponentLeagueAverages[column.key],
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
                    {renderFourWeekValue(
                      "fourWeekGamesPlayed",
                      fourWeekAverages.gamesPlayed,
                      true,
                    )}
                  </td>
                  <td className={styles.masterFourWeekCell}>
                    {renderFourWeekValue(
                      "fourWeekOffNights",
                      fourWeekAverages.offNights,
                      true,
                    )}
                  </td>
                  <td className={styles.masterFourWeekCell}>
                    {renderFourWeekValue(
                      "fourWeekOpponentPointPct",
                      fourWeekAverages.avgOpponentPointPct,
                    )}
                  </td>
                </>
              )}
              <td className={isFourWeekCollapsed ? styles.masterFourWeekLeadCell : styles.masterFourWeekCell}>
                {renderFourWeekValue("fourWeekScore", fourWeekAverages.score)}
              </td>
              <td className={clsx(styles.masterFourWeekCell, styles.masterGroupEdge)} />
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
                  {visibleMetricColumns.map((column, index) => (
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
                        index === visibleMetricColumns.length - 1 &&
                          styles.masterGroupEdge,
                      )}
                      style={{ left: `${stickyMetricOffsets[index] ?? 0}px` }}
                    >
                      {opponentMetricsLoading
                        ? <LoadingCell />
                        : opponentMetricsError
                          ? "-"
                        : column.key === "atk" || column.key === "def"
                          ? <RatingMeter kind={column.key} value={row.opponentMetrics[column.key]} />
                        : formatMetricValue(
                            column.key,
                            row.opponentMetrics[column.key],
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
                    {onToggleTeam ? <div className={clsx(detailStyles.detailControls, styles.masterRowControls)}>
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
                      <td className={styles.masterFourWeekLeadCell} data-favorability={fourWeekBands.gamesPlayed.get(row.teamId)}>
                        {renderFourWeekValue(
                          "fourWeekGamesPlayed",
                          row.fourWeekGamesPlayed,
                        )}
                      </td>
                      <td className={styles.masterFourWeekCell} data-favorability={fourWeekBands.offNights.get(row.teamId)}>
                        {renderFourWeekValue(
                          "fourWeekOffNights",
                          row.fourWeekOffNights,
                        )}
                      </td>
                      <td className={styles.masterFourWeekCell} data-favorability={fourWeekBands.opponentPointPct.get(row.teamId)}>
                        {renderFourWeekValue(
                          "fourWeekOpponentPointPct",
                          row.fourWeekOpponentPointPct,
                        )}
                      </td>
                    </>
                  )}
                  <td
                    className={clsx(
                      styles.masterFourWeekValueCell,
                      isFourWeekCollapsed && styles.masterFourWeekLead,
                      getFourWeekValueStateClass(row.teamId),
                    )}
                  >
                    {renderFourWeekValue("fourWeekScore", row.fourWeekScore)}
                  </td>
                  <td className={clsx(styles.masterFourWeekCell, styles.masterTrendCell, styles.masterGroupEdge)}>
                    {fourWeekLoading ? <LoadingCell shape="trend" /> : <OpportunitySparkline value={opportunityByTeamId[row.teamId]} scale={sharedOpportunityScale} team={row.teamAbbreviation} />}
                  </td>
                </tr>
                {expandedTeamIds.has(row.teamId) && renderTeamDetails && (
                  <tr className={detailStyles.detailRow}>
                    <td colSpan={visibleMetricColumns.length + 1 + dayKeys.length + 3 + fourWeekColumnSpan} className={detailStyles.detailCell}>
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
            </>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
