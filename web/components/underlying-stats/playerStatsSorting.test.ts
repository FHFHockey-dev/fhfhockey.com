import { describe, expect, it } from "vitest";
import { getAllPlayerStatsTableFamilies } from "./playerStatsColumns";

import {
  getPlayerStatsInitialSortState,
  getPlayerStatsNextSortState,
  getPlayerStatsSortableHeaders,
} from "./playerStatsSorting";

describe("getPlayerStatsInitialSortState", () => {
  it("returns the canonical default sort for each family", () => {
    expect(getPlayerStatsInitialSortState("individualCounts")).toEqual({
      sortKey: "totalPoints",
      direction: "desc",
    });
    expect(getPlayerStatsInitialSortState("individualRates")).toEqual({
      sortKey: "totalPointsPer60",
      direction: "desc",
    });
    expect(getPlayerStatsInitialSortState("onIceCounts")).toEqual({
      sortKey: "xgfPct",
      direction: "desc",
    });
    expect(getPlayerStatsInitialSortState("onIceRates")).toEqual({
      sortKey: "xgfPct",
      direction: "desc",
    });
    expect(getPlayerStatsInitialSortState("goalieCounts")).toEqual({
      sortKey: "savePct",
      direction: "desc",
    });
    expect(getPlayerStatsInitialSortState("goalieRates")).toEqual({
      sortKey: "savePct",
      direction: "desc",
    });
  });

  it("returns an initial sort for every visible family", () => {
    for (const family of getAllPlayerStatsTableFamilies()) {
      expect(getPlayerStatsInitialSortState(family).sortKey).toBeTruthy();
    }
  });
});

describe("getPlayerStatsNextSortState", () => {
  it("starts a newly clicked column in descending order", () => {
    expect(
      getPlayerStatsNextSortState(
        "individualCounts",
        { sortKey: "totalPoints", direction: "desc" },
        "shots"
      )
    ).toEqual({
      sortKey: "shots",
      direction: "desc",
    });
  });

  it("toggles the direction when the same column is clicked again", () => {
    expect(
      getPlayerStatsNextSortState(
        "onIceRates",
        { sortKey: "xgfPct", direction: "desc" },
        "xgfPct"
      )
    ).toEqual({
      sortKey: "xgfPct",
      direction: "asc",
    });

    expect(
      getPlayerStatsNextSortState(
        "onIceRates",
        { sortKey: "xgfPct", direction: "asc" },
        "xgfPct"
      )
    ).toEqual({
      sortKey: "xgfPct",
      direction: "desc",
    });
  });

  it("ignores unknown column keys", () => {
    expect(
      getPlayerStatsNextSortState(
        "goalieCounts",
        { sortKey: "savePct", direction: "desc" },
        "notARealColumn"
      )
    ).toEqual({
      sortKey: "savePct",
      direction: "desc",
    });
  });
});

describe("getPlayerStatsSortableHeaders", () => {
  it("marks every visible column as sortable and tracks the active column state", () => {
    const headers = getPlayerStatsSortableHeaders("individualRates", {
      sortKey: "toiPerGameSeconds",
      direction: "asc",
    });

    const activeHeader = headers.find(
      (header) => header.column.key === "toiPerGameSeconds"
    );
    const inactiveHeader = headers.find((header) => header.column.key === "goalsPer60");

    expect(headers.length).toBeGreaterThan(0);
    expect(headers.every((header) => header.sortable)).toBe(true);
    expect(activeHeader).toEqual({
      column: expect.objectContaining({
        key: "toiPerGameSeconds",
        label: "TOI/GP",
      }),
      sortable: true,
      isActive: true,
      direction: "asc",
    });
    expect(inactiveHeader).toEqual({
      column: expect.objectContaining({
        key: "goalsPer60",
        label: "Goals/60",
      }),
      sortable: true,
      isActive: false,
      direction: null,
    });
  });
});
