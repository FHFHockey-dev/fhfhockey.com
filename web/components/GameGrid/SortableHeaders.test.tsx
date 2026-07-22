import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DAY_ABBREVIATION } from "lib/NHL/types";

import DateRangeTeamGrid from "./DateRangeTeamGrid";
import DesktopMasterTable from "./DesktopMasterTable";
import Header from "./Header";
import switchStyles from "./Switch/Switch.module.scss";
import TransposedGrid from "./TransposedGrid";

const { dateRangeState } = vi.hoisted(() => ({
  dateRangeState: {
    dates: ["2026-01-02"],
    teamDateGames: {},
    dateMetaByDate: {
      "2026-01-02": { regularSeasonGames: 0 },
    },
    loading: false,
    error: null,
  },
}));

vi.mock("hooks/useTeams", () => ({
  useTeamsMap: () => ({}),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("./utils/useDateRangeTeamGrid", () => ({
  default: () => dateRangeState,
}));

vi.mock("./utils/useSchedule", () => ({
  default: () => [{}, []],
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Game Grid sortable column headers", () => {
  it("keeps Header sorting on native columnheaders for pointer and keyboard users", () => {
    const setSortKeys = vi.fn();
    const setExcludedDays = vi.fn();
    const setHidePreseason = vi.fn();

    const header = (excludedDays: DAY_ABBREVIATION[]) => (
      <table>
        <Header
          start="2026-01-02"
          end="2026-01-08"
          extended={false}
          setSortKeys={setSortKeys}
          excludedDays={excludedDays}
          setExcludedDays={setExcludedDays}
          weekData={[]}
          gamesPerDay={[]}
          hasPreseason
          hidePreseason={false}
          setHidePreseason={setHidePreseason}
        />
      </table>
    );
    const { rerender } = render(header([]));

    const teamHeader = screen.getByRole("columnheader", { name: "Team" });
    expect(teamHeader.getAttribute("role")).toBeNull();
    expect(teamHeader.getAttribute("aria-sort")).toBeNull();
    const teamSortButton = within(teamHeader).getByRole("button", {
      name: "Sort by team",
    });

    fireEvent.click(teamSortButton, { detail: 1 });
    expect(teamHeader.getAttribute("aria-sort")).toBe("ascending");
    expect(
      teamSortButton
        .querySelector("[data-sort-direction]")
        ?.getAttribute("data-sort-direction"),
    ).toBe("ascending");
    expect(
      teamSortButton
        .querySelector("[data-sort-direction]")
        ?.classList.contains(switchStyles.unchecked),
    ).toBe(true);
    expect(setSortKeys).toHaveBeenLastCalledWith([
      { key: "teamName", ascending: true },
    ]);

    teamSortButton.focus();
    fireEvent.keyDown(teamSortButton, { key: "Enter" });
    expect(document.activeElement).toBe(teamSortButton);
    expect(teamHeader.getAttribute("aria-sort")).toBe("descending");
    expect(
      teamSortButton
        .querySelector("[data-sort-direction]")
        ?.getAttribute("data-sort-direction"),
    ).toBe("descending");
    expect(
      teamSortButton
        .querySelector("[data-sort-direction]")
        ?.classList.contains(switchStyles.checked),
    ).toBe(true);
    expect(setSortKeys).toHaveBeenLastCalledWith([
      { key: "teamName", ascending: false },
    ]);
    expect(
      fireEvent.keyDown(teamSortButton, { key: "Enter", repeat: true }),
    ).toBe(false);
    expect(teamHeader.getAttribute("aria-sort")).toBe("descending");
    expect(setSortKeys).toHaveBeenCalledTimes(2);

    const preseasonSwitch = within(teamHeader).getByRole("switch", {
      name: "Hide preseason games",
    });
    expect(teamSortButton.contains(preseasonSwitch)).toBe(false);
    fireEvent.click(preseasonSwitch);
    expect(setHidePreseason).toHaveBeenCalledTimes(1);
    expect(setSortKeys).toHaveBeenCalledTimes(2);
    expect(
      screen.getAllByRole("switch", { name: /^Include .+ games$/ }),
    ).toHaveLength(7);
    const firstDaySwitch = screen.getAllByRole("switch", {
      name: /^Include .+ games$/,
    })[0];
    const firstDay = firstDaySwitch
      .getAttribute("aria-label")
      ?.replace(/^Include /, "")
      .replace(/ games$/, "") as DAY_ABBREVIATION;
    expect(firstDaySwitch.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(firstDaySwitch);
    const excludeFirstDay = setExcludedDays.mock.calls[0][0] as (
      days: string[],
    ) => string[];
    expect(excludeFirstDay([])).toEqual([firstDay]);
    rerender(header([firstDay]));
    expect(
      screen
        .getByRole("switch", { name: `Include ${firstDay} games` })
        .getAttribute("aria-checked"),
    ).toBe("false");

    const gamesPlayedButton = screen.getByRole("button", {
      name: "Sort by games played",
    });
    const gamesPlayedHeader = gamesPlayedButton.closest("th");
    expect(gamesPlayedHeader?.getAttribute("role")).toBeNull();
    fireEvent.click(gamesPlayedButton);
    expect(gamesPlayedHeader?.getAttribute("aria-sort")).toBe("descending");
  });

  it("keeps date-range metric sorting on native columnheaders", () => {
    render(<DateRangeTeamGrid start="2026-01-02" end="2026-01-02" />);

    for (const name of [
      "Sort by off-night games",
      "Sort by back-to-back games",
      "Sort by home games",
      "Sort by away games",
    ]) {
      const button = screen.getByRole("button", { name });
      expect(button.closest("th")?.getAttribute("role")).toBeNull();
    }

    const offButton = screen.getByRole("button", {
      name: "Sort by off-night games",
    });
    const offHeader = offButton.closest("th") as HTMLTableCellElement;
    expect(offHeader.getAttribute("aria-sort")).toBeNull();

    fireEvent.click(offButton, { detail: 1 });
    expect(offHeader.getAttribute("aria-sort")).toBe("descending");

    offButton.focus();
    fireEvent.keyDown(offButton, { key: " " });
    expect(document.activeElement).toBe(offButton);
    expect(offHeader.getAttribute("aria-sort")).toBe("ascending");
    expect(fireEvent.keyDown(offButton, { key: " ", repeat: true })).toBe(
      false,
    );
    expect(offHeader.getAttribute("aria-sort")).toBe("ascending");
  });

  it("names transposed day switches by their stable on-state meaning", () => {
    const setExcludedDays = vi.fn();
    render(
      <TransposedGrid
        sortedTeams={[]}
        games={[0, 0, 0, 0, 0, 0, 0]}
        excludedDays={["MON"]}
        setExcludedDays={setExcludedDays}
        extended={false}
        start="2026-01-02"
        mode="7-Day"
      />,
    );

    const monday = screen.getByRole("switch", { name: "Include MON games" });
    expect(monday.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(monday);
    const includeMonday = setExcludedDays.mock.calls[0][0] as (
      days: string[],
    ) => string[];
    expect(includeMonday(["MON"])).toEqual([]);

    const includedDays = screen
      .getAllByRole("switch", { name: /^Include .+ games$/ })
      .filter((control) => control.getAttribute("aria-checked") === "true");
    expect(includedDays).toHaveLength(6);
  });

  it("keeps DesktopMasterTable day-switch names stable across included state", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const setExcludedDays = vi.fn();
    const table = (excludedDays: DAY_ABBREVIATION[]) => (
      <DesktopMasterTable
        start="2026-01-05"
        extended={false}
        scheduleRows={[]}
        gamesPerDay={[0, 0, 0, 0, 0, 0, 0]}
        excludedDays={excludedDays}
        setExcludedDays={setExcludedDays}
        opponentMetricsByTeamId={{}}
        opponentMetricColumns={[]}
        opponentLeagueAverages={{
          avgXgf: null,
          avgXga: null,
          avgSf: null,
          avgSa: null,
          avgGoalFor: null,
          avgGoalAgainst: null,
          avgWinPct: null,
        }}
        opponentMetricsLoading={false}
        fourWeekSummaryByTeamId={{}}
        fourWeekAverages={{
          gamesPlayed: null,
          offNights: null,
          avgOpponentPointPct: null,
          score: null,
        }}
      />
    );
    const { rerender } = render(table([]));

    const firstDaySwitch = screen.getAllByRole("switch", {
      name: /^Include .+ games$/,
    })[0];
    const firstDay = firstDaySwitch
      .getAttribute("aria-label")
      ?.replace(/^Include /, "")
      .replace(/ games$/, "") as DAY_ABBREVIATION;
    expect(firstDaySwitch.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(firstDaySwitch);
    const excludeFirstDay = setExcludedDays.mock.calls[0][0] as (
      days: DAY_ABBREVIATION[],
    ) => DAY_ABBREVIATION[];
    expect(excludeFirstDay([])).toEqual([firstDay]);

    rerender(table([firstDay]));
    expect(
      screen
        .getByRole("switch", { name: `Include ${firstDay} games` })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });
});
