import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { formatPlayerStatsValue } from "lib/underlying-stats/playerStatsFormatting";
import {
  PLAYER_STATS_TABLE_RENDERING_STRATEGY,
  type PlayerStatsSortState,
  type PlayerStatsTableFamily,
  type PlayerStatsTablePaginationMeta,
} from "lib/underlying-stats/playerStatsTypes";

import {
  getPlayerStatsIdentityColumns,
  type PlayerStatsColumnDefinition,
} from "./playerStatsColumns";
import { getPlayerStatsSortableHeaders, getPlayerStatsNextSortState } from "./playerStatsSorting";
import PlayerStatsTableState, { type PlayerStatsTableViewState } from "./PlayerStatsTableState";
import styles from "./PlayerStatsTable.module.scss";

export type PlayerStatsTableRow = {
  rowKey: string;
  [key: string]: unknown;
};

export type PlayerStatsTableProps<Row extends PlayerStatsTableRow = PlayerStatsTableRow> = {
  family: PlayerStatsTableFamily;
  rows: Row[];
  sortState: PlayerStatsSortState;
  state?: PlayerStatsTableViewState | null;
  pagination?: PlayerStatsTablePaginationMeta | null;
  onSortChange?: (nextSort: PlayerStatsSortState) => void;
  onPageChange?: (page: number) => void;
  showRankColumn?: boolean;
  extraColumns?: PlayerStatsColumnDefinition[];
  loadingMoreIndicator?: ReactNode;
  expandedRowKey?: string | null;
  renderExpandedRow?: (args: {
    row: Row;
    colSpan: number;
    viewportWidth: number | null;
  }) => ReactNode;
  renderCell?: (args: {
    row: Row;
    columnKey: string;
    rawValue: unknown;
    formattedValue: string;
  }) => ReactNode;
  className?: string;
};

const STICKY_COLUMN_WIDTHS: Record<string, number> = {
  rank: 64,
  playerName: 188,
  teamLabel: 72,
  positionCode: 56,
  windowStartDate: 96,
  windowEndDate: 96,
  gamesPlayed: 48,
  toiSeconds: 96,
};

type HeaderState = {
  column: PlayerStatsColumnDefinition;
  sortable: boolean;
  isActive: boolean;
  direction: "asc" | "desc" | null;
};

function getStickyOffsets(headers: readonly HeaderState[]): Map<string, number> {
  const offsets = new Map<string, number>();
  let currentOffset = 0;

  for (const header of headers) {
    if (header.column.isIdentity !== true) {
      continue;
    }

    offsets.set(header.column.key, currentOffset);
    currentOffset += STICKY_COLUMN_WIDTHS[header.column.key] ?? 96;
  }

  return offsets;
}

function getNextSortStateForColumn(
  family: PlayerStatsTableFamily,
  currentSort: PlayerStatsSortState,
  header: HeaderState,
  extraColumns: readonly PlayerStatsColumnDefinition[]
): PlayerStatsSortState {
  const isExtraColumn = extraColumns.some(
    (column) => column.key === header.column.key
  );

  if (!isExtraColumn) {
    return getPlayerStatsNextSortState(family, currentSort, header.column.key);
  }

  if (currentSort.sortKey === header.column.sortKey) {
    return {
      sortKey: header.column.sortKey,
      direction: currentSort.direction === "desc" ? "asc" : "desc",
    };
  }

  return {
    sortKey: header.column.sortKey,
    direction: "desc",
  };
}

export default function PlayerStatsTable<Row extends PlayerStatsTableRow>({
  family,
  rows,
  sortState,
  state,
  pagination,
  onSortChange,
  onPageChange,
  showRankColumn = false,
  extraColumns = [],
  loadingMoreIndicator,
  expandedRowKey = null,
  renderExpandedRow,
  renderCell,
  className,
}: PlayerStatsTableProps<Row>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateViewportWidth = () => {
      setViewportWidth(viewport.clientWidth);
    };

    updateViewportWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportWidth);
      return () => {
        window.removeEventListener("resize", updateViewportWidth);
      };
    }

    const observer = new ResizeObserver(() => {
      updateViewportWidth();
    });
    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (state) {
    return (
      <div className={[styles.shell, className].filter(Boolean).join(" ")}>
        <PlayerStatsTableState state={state} />
      </div>
    );
  }

  const identityColumnCount = getPlayerStatsIdentityColumns(family).length;
  const headers = getPlayerStatsSortableHeaders(family, sortState);
  const extraHeaderStates: HeaderState[] = extraColumns.map((column) => ({
    column,
    sortable: true,
    isActive: sortState.sortKey === column.sortKey,
    direction: sortState.sortKey === column.sortKey ? sortState.direction : null,
  }));
  const mergedHeaders = [
    ...headers.slice(0, identityColumnCount),
    ...extraHeaderStates,
    ...headers.slice(identityColumnCount),
  ];
  const visibleHeaders: HeaderState[] = showRankColumn
    ? [
        {
          column: {
            key: "rank",
            label: "Rank",
            sortKey: "rank",
            format: "integer",
            align: "center",
            isIdentity: true,
          },
          sortable: false,
          isActive: false,
          direction: null,
        },
        ...mergedHeaders,
      ]
    : mergedHeaders;
  const stickyOffsets = getStickyOffsets(visibleHeaders);
  const shouldRenderPagination =
    PLAYER_STATS_TABLE_RENDERING_STRATEGY === "pagination" &&
    typeof onPageChange === "function" &&
    pagination != null &&
    pagination.totalPages > 1;
  const visibleRowStart =
    pagination == null || pagination.totalRows === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;
  const visibleRowEnd =
    pagination == null || pagination.totalRows === 0
      ? 0
      : Math.min(pagination.page * pagination.pageSize, pagination.totalRows);

  return (
    <div className={[styles.shell, className].filter(Boolean).join(" ")}>
      <div className={styles.viewport} ref={viewportRef}>
        <table className={styles.table}>
          <thead className={styles.head}>
            <tr>
              {visibleHeaders.map((header) => {
                const isRankColumn = header.column.key === "rank";
                const isSticky = header.column.isIdentity === true;
                const stickyStyle: CSSProperties | undefined = isSticky
                  ? {
                      left: `${stickyOffsets.get(header.column.key) ?? 0}px`,
                      minWidth: `${STICKY_COLUMN_WIDTHS[header.column.key] ?? 96}px`,
                    }
                  : undefined;

                return (
                  <th
                    key={header.column.key}
                    className={[
                      styles.headerCell,
                      styles[`align${capitalize(header.column.align ?? "left")}`],
                      isSticky ? styles.stickyCell : "",
                      isRankColumn ? styles.rankHeaderCell : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={stickyStyle}
                    scope="col"
                    data-active={header.isActive === true ? "true" : "false"}
                  >
                    {isRankColumn ? (
                      <span className={styles.rankHeaderLabel}>Rank</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.headerButton}
                        onClick={() =>
                          onSortChange?.(
                            getNextSortStateForColumn(
                              family,
                              sortState,
                              header,
                              extraColumns
                            )
                          )
                        }
                        aria-pressed={header.isActive}
                        aria-label={`Sort by ${header.column.label}`}
                      >
                        <span>{getVisibleHeaderLabel(header.column.key, header.column.label)}</span>
                        <span className={styles.sortIndicator} aria-hidden="true">
                          {header.isActive
                            ? header.direction === "desc"
                              ? "↓"
                              : "↑"
                            : "↕"}
                        </span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const isExpanded = expandedRowKey === row.rowKey;

              return (
                <Fragment key={row.rowKey}>
                  <tr className={styles.row} data-expanded={isExpanded ? "true" : "false"}>
                    {visibleHeaders.map((header) => {
                      const isRankColumn = header.column.key === "rank";
                      const rawValue = row[header.column.key];
                      const formattedValue = isRankColumn
                        ? String(rowIndex + 1)
                        : formatPlayerStatsValue(
                            rawValue as string | number | null | undefined,
                            header.column.format
                          );
                      const isSticky = header.column.isIdentity === true;
                      const stickyStyle: CSSProperties | undefined = isSticky
                        ? {
                            left: `${stickyOffsets.get(header.column.key) ?? 0}px`,
                            minWidth: `${STICKY_COLUMN_WIDTHS[header.column.key] ?? 96}px`,
                          }
                        : undefined;

                      return (
                        <td
                          key={`${row.rowKey}:${header.column.key}`}
                          className={[
                            styles.bodyCell,
                            styles[`align${capitalize(header.column.align ?? "left")}`],
                            isSticky ? styles.stickyCell : "",
                            isRankColumn ? styles.rankBodyCell : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={stickyStyle}
                          data-active={header.isActive === true ? "true" : "false"}
                        >
                          {isRankColumn ? (
                            <span className={styles.rankValue}>{rowIndex + 1}</span>
                          ) : renderCell
                            ? renderCell({
                                row,
                                columnKey: header.column.key,
                                rawValue,
                                formattedValue,
                              })
                            : formattedValue}
                        </td>
                      );
                    })}
                  </tr>
                  {isExpanded && renderExpandedRow ? (
                    <tr className={styles.expandedRow}>
                      <td className={styles.expandedCell} colSpan={visibleHeaders.length}>
                        <div
                          className={styles.expandedViewportShell}
                          style={
                            viewportWidth != null
                              ? ({
                                  width: `${viewportWidth}px`,
                                  minWidth: `${viewportWidth}px`,
                                  maxWidth: `${viewportWidth}px`,
                                } as CSSProperties)
                              : undefined
                          }
                        >
                          {renderExpandedRow({
                            row,
                            colSpan: visibleHeaders.length,
                            viewportWidth,
                          })}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {loadingMoreIndicator ? (
              <tr className={styles.loadingRow}>
                <td
                  className={styles.loadingCell}
                  colSpan={visibleHeaders.length}
                >
                  {loadingMoreIndicator}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {shouldRenderPagination ? (
        <div className={styles.footer}>
          <p className={styles.paginationSummary}>
            Showing {visibleRowStart}-{visibleRowEnd} of {pagination.totalRows}
          </p>
          <div
            className={styles.pagination}
            aria-label="Player stats table pagination"
          >
            <button
              type="button"
              className={styles.paginationButton}
              onClick={() => onPageChange?.(Math.max(pagination.page - 1, 1))}
              disabled={pagination.page <= 1}
            >
              Previous
            </button>
            <span className={styles.paginationMeta}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              className={styles.paginationButton}
              onClick={() =>
                onPageChange?.(
                  Math.min(pagination.page + 1, pagination.totalPages)
                )
              }
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getVisibleHeaderLabel(columnKey: string, label: string): string {
  if (columnKey === "positionCode") {
    return "POS";
  }

  return label;
}
