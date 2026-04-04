import type {
  PlayerStatsSortDirection,
  PlayerStatsSortState,
  PlayerStatsTableFamily,
} from "lib/underlying-stats/playerStatsTypes";

import {
  getPlayerStatsColumnByKey,
  getPlayerStatsColumns,
  getPlayerStatsDefaultSortForFamily,
  type PlayerStatsColumnDefinition,
} from "./playerStatsColumns";

export type PlayerStatsSortableHeaderState = {
  column: PlayerStatsColumnDefinition;
  sortable: boolean;
  isActive: boolean;
  direction: PlayerStatsSortDirection | null;
};

export function getPlayerStatsNextSortState(
  family: PlayerStatsTableFamily,
  currentSort: PlayerStatsSortState,
  clickedColumnKey: string
): PlayerStatsSortState {
  const column = getPlayerStatsColumnByKey(family, clickedColumnKey);
  if (!column) {
    return currentSort;
  }

  if (currentSort.sortKey === column.sortKey) {
    return {
      sortKey: column.sortKey,
      direction: currentSort.direction === "desc" ? "asc" : "desc",
    };
  }

  return {
    sortKey: column.sortKey,
    direction: "desc",
  };
}

export function getPlayerStatsSortableHeaders(
  family: PlayerStatsTableFamily,
  currentSort: PlayerStatsSortState
): PlayerStatsSortableHeaderState[] {
  return getPlayerStatsColumns(family).map((column) => ({
    column,
    sortable: true,
    isActive: currentSort.sortKey === column.sortKey,
    direction:
      currentSort.sortKey === column.sortKey ? currentSort.direction : null,
  }));
}

export function getPlayerStatsInitialSortState(
  family: PlayerStatsTableFamily
): PlayerStatsSortState {
  return getPlayerStatsDefaultSortForFamily(family);
}
