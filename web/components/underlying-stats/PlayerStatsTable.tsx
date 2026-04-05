import type { CSSProperties, ReactNode } from "react";

import { formatPlayerStatsValue } from "lib/underlying-stats/playerStatsFormatting";
import {
  PLAYER_STATS_TABLE_RENDERING_STRATEGY,
  type PlayerStatsSortState,
  type PlayerStatsTableFamily,
  type PlayerStatsTablePaginationMeta,
} from "lib/underlying-stats/playerStatsTypes";

import { getPlayerStatsIdentityColumns } from "./playerStatsColumns";
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
  renderCell?: (args: {
    row: Row;
    columnKey: string;
    rawValue: unknown;
    formattedValue: string;
  }) => ReactNode;
  className?: string;
};

const STICKY_COLUMN_WIDTHS: Record<string, number> = {
  playerName: 188,
  teamLabel: 72,
  positionCode: 56,
  gamesPlayed: 48,
  toiSeconds: 96,
};

function getStickyOffsets(family: PlayerStatsTableFamily): Map<string, number> {
  const offsets = new Map<string, number>();
  let currentOffset = 0;

  for (const column of getPlayerStatsIdentityColumns(family)) {
    offsets.set(column.key, currentOffset);
    currentOffset += STICKY_COLUMN_WIDTHS[column.key] ?? 96;
  }

  return offsets;
}

export default function PlayerStatsTable<Row extends PlayerStatsTableRow>({
  family,
  rows,
  sortState,
  state,
  pagination,
  onSortChange,
  onPageChange,
  renderCell,
  className,
}: PlayerStatsTableProps<Row>) {
  if (state) {
    return (
      <div className={[styles.shell, className].filter(Boolean).join(" ")}>
        <PlayerStatsTableState state={state} />
      </div>
    );
  }

  const headers = getPlayerStatsSortableHeaders(family, sortState);
  const stickyOffsets = getStickyOffsets(family);
  const shouldRenderPagination =
    PLAYER_STATS_TABLE_RENDERING_STRATEGY === "pagination" &&
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
      <div className={styles.viewport}>
        <table className={styles.table}>
          <thead className={styles.head}>
            <tr>
              {headers.map((header) => {
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
                      styles[`align${capitalize(header.column.align)}`],
                      isSticky ? styles.stickyCell : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={stickyStyle}
                    scope="col"
                  >
                    <button
                      type="button"
                      className={styles.headerButton}
                      onClick={() =>
                        onSortChange?.(
                          getPlayerStatsNextSortState(
                            family,
                            sortState,
                            header.column.key
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
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowKey} className={styles.row}>
                {headers.map((header) => {
                  const rawValue = row[header.column.key];
                  const formattedValue = formatPlayerStatsValue(
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
                        styles[`align${capitalize(header.column.align)}`],
                        isSticky ? styles.stickyCell : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={stickyStyle}
                    >
                      {renderCell
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
            ))}
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
