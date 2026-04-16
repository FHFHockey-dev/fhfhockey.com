import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, UIEvent } from "react";

import type {
  SkaterBucket,
  SkaterMetricsRow,
  SkaterValueOverviewRow
} from "./skaterTypes";

import styles from "pages/variance/variance.module.scss";

type SortDirection = "ascending" | "descending";
type SkaterTableVariant = "value" | "metrics";

type SkaterTableRow = SkaterValueOverviewRow | SkaterMetricsRow;

interface Column {
  key: string;
  label: string;
  format?: (value: unknown, row: SkaterTableRow) => string;
}

interface SkaterTableProps {
  rows: SkaterTableRow[];
  variant: SkaterTableVariant;
  sortKey: string;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
}

type ResolvedTableRows = {
  sortedRows: SkaterTableRow[];
};

const VIRTUAL_ROW_HEIGHT = 46;
const VIRTUAL_OVERSCAN_ROWS = 12;
const VIRTUALIZATION_THRESHOLD = 120;

const formatNumber = (value: unknown, digits = 2) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "N/A";

const formatPercent = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)}%`
    : "N/A";

const formatToi = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getWeekCounts = (row: SkaterTableRow) =>
  "weekCounts" in row ? row.weekCounts : null;

const valueColumns: Column[] = [
  { key: "playerName", label: "Name" },
  { key: "team", label: "Team" },
  { key: "tier", label: "Tier" },
  {
    key: "valuation",
    label: "OWN%/ADP",
    format: (value, row) =>
      row.valuationLabel === "OWN%" ? formatPercent(value) : formatNumber(value, 1)
  },
  { key: "weekCounts", label: "Elite", format: (_value, row) => formatNumber(getWeekCounts(row)?.Elite, 1) },
  { key: "weekCounts", label: "Quality", format: (_value, row) => formatNumber(getWeekCounts(row)?.Quality, 1) },
  { key: "weekCounts", label: "AVG", format: (_value, row) => formatNumber(getWeekCounts(row)?.Average, 1) },
  { key: "weekCounts", label: "Bad", format: (_value, row) => formatNumber(getWeekCounts(row)?.Bad, 1) },
  { key: "weekCounts", label: "Really Bad", format: (_value, row) => formatNumber(getWeekCounts(row)?.["Really Bad"], 1) },
  { key: "percentOkWeeks", label: "% OK", format: formatPercent },
  { key: "percentGoodWeeks", label: "% Good", format: formatPercent },
  { key: "weeklyVariance", label: "Week Var", format: (value) => formatNumber(value) },
  { key: "gameToGameVariance", label: "Game Var", format: (value) => formatNumber(value) },
  {
    key: "averageFantasyPointsPerGame",
    label: "FP/G",
    format: (value) => formatNumber(value)
  },
  {
    key: "averageFantasyPointsPerWeek",
    label: "FP/Wk",
    format: (value) => formatNumber(value)
  },
  {
    key: "fantasyPointsAboveAverage",
    label: "+/- Avg",
    format: (value) => formatNumber(value)
  },
  { key: "gamesPlayed", label: "GP", format: (value) => formatNumber(value, 0) },
  { key: "totalFantasyPoints", label: "Total FP", format: (value) => formatNumber(value) }
];

const metricsColumns: Column[] = [
  { key: "playerName", label: "Name" },
  { key: "team", label: "Team" },
  {
    key: "valuation",
    label: "OWN%/ADP",
    format: (value, row) =>
      row.valuationLabel === "OWN%" ? formatPercent(value) : formatNumber(value, 1)
  },
  { key: "gamesPlayed", label: "GP", format: (value) => formatNumber(value, 0) },
  { key: "averageTimeOnIce", label: "ATOI", format: formatToi },
  { key: "goals", label: "G", format: (value) => formatNumber(value, 1) },
  { key: "assists", label: "A", format: (value) => formatNumber(value, 1) },
  { key: "points", label: "PTS", format: (value) => formatNumber(value, 1) },
  { key: "shots", label: "SOG", format: (value) => formatNumber(value, 1) },
  { key: "shootingPercentage", label: "S%", format: (value) => formatPercent(typeof value === "number" ? value * 100 : value) },
  { key: "averagePowerPlayTimeOnIce", label: "PPTOI", format: formatToi },
  { key: "powerPlayGoals", label: "PPG", format: (value) => formatNumber(value, 1) },
  { key: "powerPlayAssists", label: "PPA", format: (value) => formatNumber(value, 1) },
  { key: "powerPlayPoints", label: "PPP", format: (value) => formatNumber(value, 1) },
  { key: "hits", label: "HIT", format: (value) => formatNumber(value, 1) },
  { key: "blocks", label: "BLK", format: (value) => formatNumber(value, 1) },
  { key: "penaltyMinutes", label: "PIM", format: (value) => formatNumber(value, 1) },
  { key: "plusMinus", label: "+/-", format: (value) => formatNumber(value, 1) }
];

const getSortValue = (row: SkaterTableRow, key: PropertyKey) => {
  if (key === "weekCounts" && "weekCounts" in row) {
    return row.weekCounts.Elite;
  }

  return row[key as keyof typeof row];
};

const compareValues = (
  aValue: unknown,
  bValue: unknown,
  direction: SortDirection
) => {
  const aMissing =
    aValue == null || (typeof aValue === "number" && !Number.isFinite(aValue));
  const bMissing =
    bValue == null || (typeof bValue === "number" && !Number.isFinite(bValue));

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  if (typeof aValue === "string" && typeof bValue === "string") {
    const result = aValue.localeCompare(bValue);
    return direction === "ascending" ? result : -result;
  }

  const result = Number(aValue) - Number(bValue);
  return direction === "ascending" ? result : -result;
};

const isBucketSortKey = (sortKey: string) =>
  sortKey === "tier" || sortKey === "valuation";

const getBucketKindPriority = (bucket: SkaterBucket) => {
  if (bucket.kind === "ownership" || bucket.kind === "adp-round") {
    return 0;
  }

  if (bucket.kind === "low-percent-drafted") {
    return 1;
  }

  return 2;
};

const compareBuckets = (
  leftBucket: SkaterBucket,
  rightBucket: SkaterBucket,
  direction: SortDirection
) => {
  const kindPriorityDelta =
    getBucketKindPriority(leftBucket) - getBucketKindPriority(rightBucket);

  if (kindPriorityDelta !== 0) {
    return kindPriorityDelta;
  }

  const result = leftBucket.sortOrder - rightBucket.sortOrder;

  if (
    leftBucket.kind === "low-percent-drafted" ||
    leftBucket.kind === "waiver-wire" ||
    leftBucket.kind === "unknown"
  ) {
    return result;
  }

  return direction === "ascending" ? result : -result;
};

const resolveTableRows = (
  rows: SkaterTableRow[],
  sortKey: string,
  sortDirection: SortDirection
) : ResolvedTableRows => {
  const playerRows = rows.filter((row) => row.rowType === "player");
  const averageRows = rows.filter((row) => row.rowType === "bucket-average");

  if (!isBucketSortKey(sortKey)) {
    const sortedPlayerRows = [...playerRows].sort((a, b) =>
      compareValues(
        getSortValue(a, sortKey),
        getSortValue(b, sortKey),
        sortDirection
      )
    );

    return {
      sortedRows: [...sortedPlayerRows, ...averageRows]
    };
  }

  const byBucket = new Map<string, SkaterTableRow[]>();

  rows.forEach((row) => {
    const bucketRows = byBucket.get(row.bucket.key) ?? [];
    bucketRows.push(row);
    byBucket.set(row.bucket.key, bucketRows);
  });

  return {
    sortedRows: Array.from(byBucket.values())
      .sort((a, b) => compareBuckets(a[0].bucket, b[0].bucket, sortDirection))
      .flatMap((bucketRows) => {
        const playerRows = bucketRows.filter((row) => row.rowType === "player");
        const averageRows = bucketRows.filter(
          (row) => row.rowType === "bucket-average"
        );
        const sortedPlayerRows = [...playerRows].sort((a, b) =>
          compareValues(
            getSortValue(a, sortKey),
            getSortValue(b, sortKey),
            sortDirection
          )
        );

        return [...sortedPlayerRows, ...averageRows];
      })
  };
};

const getBucketHue = (bucket: SkaterBucket) => {
  if (bucket.kind === "ownership") {
    return 150 + Math.min(bucket.sortOrder, 90) * 1.6;
  }

  if (bucket.kind === "adp-round") {
    return 20 + (bucket.sortOrder % 12) * 24;
  }

  if (bucket.kind === "low-percent-drafted") {
    return 45;
  }

  if (bucket.kind === "waiver-wire") {
    return 205;
  }

  return 0;
};

const getRowClassName = (row: SkaterTableRow) => {
  const classNames = [styles.bucketTintRow];

  if (row.rowType === "bucket-average") {
    classNames.push(styles.bucketAverageRow);
  }

  if (row.bucket.kind === "low-percent-drafted") {
    classNames.push(styles.lowPercentDraftedRow);
  } else if (row.bucket.kind === "waiver-wire") {
    classNames.push(styles.waiverWireRow);
  }

  return classNames.join(" ");
};

export default function SkaterTable({
  rows,
  variant,
  sortKey,
  sortDirection,
  onSort
}: SkaterTableProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const columns = variant === "value" ? valueColumns : metricsColumns;

  const { sortedRows } = useMemo(
    () => resolveTableRows(rows, sortKey, sortDirection),
    [rows, sortDirection, sortKey]
  );
  const shouldVirtualize = sortedRows.length > VIRTUALIZATION_THRESHOLD;
  const columnCount = columns.length + 1;
  const visibleRange = useMemo(() => {
    if (!shouldVirtualize || viewportHeight <= 0) {
      return {
        startIndex: 0,
        endIndex: sortedRows.length,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0
      };
    }

    const visibleStart = Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT);
    const visibleCount = Math.ceil(viewportHeight / VIRTUAL_ROW_HEIGHT);
    const startIndex = Math.max(0, visibleStart - VIRTUAL_OVERSCAN_ROWS);
    const endIndex = Math.min(
      sortedRows.length,
      visibleStart + visibleCount + VIRTUAL_OVERSCAN_ROWS
    );

    return {
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * VIRTUAL_ROW_HEIGHT,
      bottomSpacerHeight: Math.max(0, sortedRows.length - endIndex) * VIRTUAL_ROW_HEIGHT
    };
  }, [scrollTop, shouldVirtualize, sortedRows.length, viewportHeight]);
  const visibleRows = shouldVirtualize
    ? sortedRows.slice(visibleRange.startIndex, visibleRange.endIndex)
    : sortedRows;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const updateViewportHeight = () => setViewportHeight(scroller.clientHeight);
    updateViewportHeight();

    const resizeObserver = new ResizeObserver(updateViewportHeight);
    resizeObserver.observe(scroller);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setScrollTop(0);
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [sortDirection, sortKey, variant]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (shouldVirtualize) {
      setScrollTop(event.currentTarget.scrollTop);
    }
  };

  return (
    <div
      className={`${styles.tableScroller} ${styles.virtualTableScroller}`}
      onScroll={handleScroll}
      ref={scrollerRef}
    >
      <table className={`${styles.dataTable} ${styles.virtualizedDataTable}`}>
        <thead>
          <tr>
            <th>Rank</th>
            {columns.map((column, index) => (
              <th key={`${String(column.key)}-${index}`} onClick={() => onSort(column.key)}>
                {column.label}
                {sortKey === column.key
                  ? sortDirection === "ascending"
                    ? " ▲"
                    : " ▼"
                  : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shouldVirtualize && visibleRange.topSpacerHeight > 0 ? (
            <tr className={styles.virtualSpacerRow}>
              <td
                colSpan={columnCount}
                style={{ height: visibleRange.topSpacerHeight }}
              />
            </tr>
          ) : null}
          {visibleRows.map((row, index) => {
            const rowIndex = shouldVirtualize
              ? visibleRange.startIndex + index
              : index;

            return (
            <tr
              key={`${row.rowType}-${row.playerId ?? row.bucket.key}-${rowIndex}`}
              className={getRowClassName(row)}
              style={
                {
                  "--bucket-hue": getBucketHue(row.bucket)
                } as CSSProperties
              }
            >
              <td>{row.rowType === "bucket-average" ? "Avg" : rowIndex + 1}</td>
              {columns.map((column, columnIndex) => {
                const value = row[column.key as keyof typeof row];
                const formatted = column.format
                  ? column.format(value, row)
                  : String(value ?? "N/A");

                return <td key={`${String(column.key)}-${columnIndex}`}>{formatted}</td>;
              })}
            </tr>
          );
          })}
          {shouldVirtualize && visibleRange.bottomSpacerHeight > 0 ? (
            <tr className={styles.virtualSpacerRow}>
              <td
                colSpan={columnCount}
                style={{ height: visibleRange.bottomSpacerHeight }}
              />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
