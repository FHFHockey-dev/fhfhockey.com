import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EXTENDED_DAY_ABBREVIATION } from "lib/NHL/types";

import DateRangeTeamGrid from "./DateRangeTeamGrid";
import DesktopMasterTable, {
  distributeMasterTableWidths,
  sizeMasterTableColumns,
  MASTER_COLUMNS,
} from "./DesktopMasterTable";
import {
  getGameGridLayout,
  isGameGridDesktopViewport,
} from "./GameGrid";
import Header from "./Header";
import switchStyles from "./Switch/Switch.module.scss";
import TransposedGrid from "./TransposedGrid";
import { OPPONENT_METRIC_COLUMNS } from "./utils/useOpponentMetricsData";
import calcWeekScore from "./utils/calcWeekScore";

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
  vi.unstubAllEnvs();
});

describe("Game Grid sortable column headers", () => {
  it("keeps the master breakpoint and legacy vertical fallback explicit", () => {
    expect(isGameGridDesktopViewport(1023)).toBe(false);
    expect(isGameGridDesktopViewport(1024)).toBe(true);
    expect(getGameGridLayout(false, "horizontal")).toBe("stacked");
    expect(getGameGridLayout(false, "vertical")).toBe("stacked");
    expect(getGameGridLayout(true, "horizontal")).toBe("master");
    expect(getGameGridLayout(true, "vertical")).toBe("legacy-vertical");
  });

  it("preserves master-column minimums and expands only with extra space", () => {
    expect(distributeMasterTableWidths([50, 72, 80], 180)).toEqual([
      50, 72, 80,
    ]);
    expect(distributeMasterTableWidths([50, 50], 103)).toEqual([52, 51]);
    expect(distributeMasterTableWidths([], 500)).toEqual([]);
  });

  it.each([7, 10])("pins the %s-day Game Grid widths and fits the side groups around them", (dayCount) => {
    const { rating, metric, percent } = MASTER_COLUMNS;
    const sum = (widths: number[]) => widths.reduce((a, b) => a + b, 0);
    for (const containerWidth of [1354, 1582, 1920]) {
      const original = distributeMasterTableWidths([50, 50, 50, 50, 50, 50, 80, 72, ...Array(dayCount).fill(80), 72, 72, 104, 72, 72, 72, 72], containerWidth);
      const originalGrid = original.slice(7, 8 + dayCount);
      for (const expanded of [false, true]) for (const fourWeekCollapsed of [false, true]) {
        const metricColumns = [rating, rating, ...(expanded ? [metric, metric, metric, metric, metric, metric, percent] : [])];
        const widths = sizeMasterTableColumns({ metricColumns, dayCount, fourWeekCollapsed, containerWidth });
        expect(widths).toHaveLength(metricColumns.length + 1 + dayCount + 3 + (fourWeekCollapsed ? 2 : 5));
        expect(widths.slice(metricColumns.length, metricColumns.length + 1 + dayCount)).toEqual(originalGrid);
        // Never stretched past the pre-redesign footprint; clipped only when the minimums cannot fit.
        expect(sum(widths)).toBeLessThanOrEqual(Math.max(sum(original), containerWidth));
        const minimums = sum(metricColumns.map((spec) => spec.min)) + sum(originalGrid) + 40 + 40 + 56 + (fourWeekCollapsed ? 56 + 78 : 48 + 48 + 50 + 56 + 78);
        if (minimums <= containerWidth) expect(sum(widths)).toBeLessThanOrEqual(containerWidth);
      }
    }
  });

  it("keeps Header sorting on native columnheaders for pointer and keyboard users", () => {
    const setSortKeys = vi.fn();
    const setExcludedDays = vi.fn();
    const setHidePreseason = vi.fn();

    const header = (excludedDays: EXTENDED_DAY_ABBREVIATION[]) => (
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
      .replace(/ games$/, "") as EXTENDED_DAY_ABBREVIATION;
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
    const table = (excludedDays: EXTENDED_DAY_ABBREVIATION[], extended = false) => (
      <DesktopMasterTable
        start="2026-01-05"
        extended={extended}
        scheduleRows={[]}
        gamesPerDay={Array(extended ? 10 : 7).fill(0)}
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
        opponentMetricsError={null}
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
      .replace(/ games$/, "") as EXTENDED_DAY_ABBREVIATION;
    expect(firstDaySwitch.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(firstDaySwitch);
    const excludeFirstDay = setExcludedDays.mock.calls[0][0] as (
      days: EXTENDED_DAY_ABBREVIATION[],
    ) => EXTENDED_DAY_ABBREVIATION[];
    expect(excludeFirstDay([])).toEqual([firstDay]);

    rerender(table([firstDay]));
    expect(
      screen
        .getByRole("switch", { name: `Include ${firstDay} games` })
        .getAttribute("aria-checked"),
    ).toBe("false");

    rerender(table(["nMON"], true));
    expect(screen.getAllByRole("switch", { name: /^Include .+ games$/ })).toHaveLength(10);
    const nextMonday = screen.getByRole("switch", { name: "Include NEXT MON games" });
    expect(nextMonday.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(nextMonday);
    const includeNextMonday = setExcludedDays.mock.calls.at(-1)![0] as (
      days: EXTENDED_DAY_ABBREVIATION[],
    ) => EXTENDED_DAY_ABBREVIATION[];
    expect(includeNextMonday(["nMON"])).toEqual([]);
  });

  it("allows next-week day selection in both legacy grid orientations", () => {
    const setExcludedDays = vi.fn();
    const { unmount } = render(
      <table><Header start="2026-01-05" end="2026-01-11" extended
        setSortKeys={vi.fn()} excludedDays={["nMON"]} setExcludedDays={setExcludedDays}
        weekData={[]} gamesPerDay={Array(10).fill(0)} /></table>
    );
    expect(screen.getAllByRole("switch", { name: /^Include .+ games$/ })).toHaveLength(10);
    const nextMonday = screen.getByRole("switch", { name: "Include NEXT MON games" });
    expect(nextMonday.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(nextMonday);
    expect(setExcludedDays.mock.calls.at(-1)![0](["nMON"])).toEqual([]);
    unmount();

    render(<TransposedGrid start="2026-01-05" mode="10-Day-Forecast" extended
      sortedTeams={[]} games={Array(10).fill(0)} excludedDays={["nWED"]}
      setExcludedDays={setExcludedDays} />);
    expect(screen.getAllByRole("switch", { name: /^Include .+ games$/ })).toHaveLength(10);
    const nextWednesday = screen.getByRole("switch", { name: "Include NEXT WED games" });
    expect(nextWednesday.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(nextWednesday);
    expect(setExcludedDays.mock.calls.at(-1)![0](["nWED"])).toEqual([]);
    expect(screen.getByRole("columnheader", { name: /NEXT WED 1\/14/ })).toBeTruthy();
  });

  it("keeps compact metric order and independent four-week controls", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );

    render(
      <DesktopMasterTable
        start="2026-01-05"
        extended={false}
        scheduleRows={[]}
        gamesPerDay={[0, 0, 0, 0, 0, 0, 0]}
        excludedDays={[]}
        setExcludedDays={vi.fn()}
        opponentMetricsByTeamId={{}}
        opponentMetricColumns={OPPONENT_METRIC_COLUMNS}
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
        opponentMetricsError={null}
        fourWeekSummaryByTeamId={{}}
        fourWeekAverages={{
          gamesPlayed: null,
          offNights: null,
          avgOpponentPointPct: null,
          score: null,
        }}
      />,
    );

    const sortLabels = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
      .filter((label): label is string => label?.startsWith("Sort by ") === true)
      .map((label) => label.replace(/ (ascending|descending)$/, ""));

    expect(sortLabels).toEqual([
      "Sort by ATK", "Sort by DEF", "Sort by Team", "Sort by GP", "Sort by OFF", "Sort by Score", "Sort by 4WK Value",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Expand opponent details" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand four-week columns" }));
    expect(screen.queryByRole("button", { name: /^Sort by MON/ })).toBeNull();

    const collapse = screen.getAllByRole("button", {
      name: "Collapse four-week columns",
    })[0];
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(collapse);

    expect(
      screen.queryByRole("button", { name: /^Sort by 4WK GP/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Expand four-week columns" }),
    ).toBeTruthy();
  });

  it("sorts the bounded schedule scores in both directions and keeps one-decimal display", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    render(<DesktopMasterTable
      start="2026-01-05" extended={false}
      scheduleRows={[
        { teamId: 3, totalGamesPlayed: 3, totalOffNights: 2, weekScore: calcWeekScore([100, 100, 100], 2, 47, 3) },
        { teamId: 2, totalGamesPlayed: 4, totalOffNights: 1, weekScore: calcWeekScore([100, 100, 100, 100], 1, 47, 4) },
        { teamId: 1, totalGamesPlayed: 4, totalOffNights: 3, weekScore: calcWeekScore([0, 0, 0, 0], 3, 47, 4) },
      ]}
      gamesPerDay={[4, 9, 3, 10, 4, 14, 3]} excludedDays={[]} setExcludedDays={vi.fn()}
      opponentMetricsByTeamId={{}} opponentMetricColumns={[]}
      opponentLeagueAverages={{ avgXgf: null, avgXga: null, avgSf: null, avgSa: null,
        avgGoalFor: null, avgGoalAgainst: null, avgWinPct: null }}
      opponentMetricsLoading={false} opponentMetricsError={null}
      fourWeekSummaryByTeamId={{}} fourWeekAverages={{ gamesPlayed: null, offNights: null,
        avgOpponentPointPct: null, score: null }}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Score descending" }));
    const teamOrder = () => screen.getAllByRole("link", { name: "Open Team HQ" })
      .map((link) => link.getAttribute("href"));
    expect(teamOrder()).toEqual(["/stats/team/1", "/stats/team/2", "/stats/team/3"]);
    for (const score of ["17.9", "10.9", "8.9"]) expect(screen.getByText(score)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sort by Score ascending" }));
    expect(teamOrder()).toEqual(["/stats/team/3", "/stats/team/2", "/stats/team/1"]);
  });

  it("keeps the master row available when opponent metrics fail", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );

    render(
      <DesktopMasterTable
        start="2026-01-05"
        extended={false}
        scheduleRows={[
          {
            teamId: 1,
            totalGamesPlayed: 3,
            totalOffNights: 2,
            weekScore: 4.2,
          } as never,
        ]}
        gamesPerDay={[0, 0, 0, 0, 0, 0, 0]}
        excludedDays={[]}
        setExcludedDays={vi.fn()}
        opponentMetricsByTeamId={{}}
        opponentMetricColumns={OPPONENT_METRIC_COLUMNS}
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
        opponentMetricsError="provider detail must not render"
        fourWeekSummaryByTeamId={{
          1: {
            gamesPlayed: 12,
            offNights: 5,
            avgOpponentPointPct: 0.5,
            score: 1.5,
          },
        }}
        fourWeekAverages={{
          gamesPlayed: 12,
          offNights: 5,
          avgOpponentPointPct: 0.5,
          score: 0,
        }}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Opponent stats unavailable. Reload to retry.",
    );
    expect(screen.queryByText("provider detail must not render")).toBeNull();
    expect(screen.getByRole("link", { name: "Open Team HQ" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Sort by 4WK Value/ })).toBeTruthy();
  });
});


describe("public opponent and four-week cells", () => {
  it("removes diagnostics in production and shades ties by favorable direction through sorting", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const empty = Object.fromEntries(OPPONENT_METRIC_COLUMNS.map(({ key }) => [key, null])) as never;
    const coverage = Object.fromEntries(OPPONENT_METRIC_COLUMNS.map(({ key }) => [key, { known: 0, expected: 2 }])) as never;
    const summaries = {
      1: { gamesPlayed: 14, offNights: 7, avgOpponentPointPct: .4, score: 2 },
      2: { gamesPlayed: 14, offNights: 7, avgOpponentPointPct: .4, score: 2 },
      3: { gamesPlayed: 12, offNights: 5, avgOpponentPointPct: .5, score: 0 },
      4: { gamesPlayed: 10, offNights: 3, avgOpponentPointPct: .6, score: -2 },
      5: { gamesPlayed: null, offNights: null, avgOpponentPointPct: null, score: null },
    };
    const { container } = render(<DesktopMasterTable
      start="2026-10-05" extended={false}
      scheduleRows={Object.keys(summaries).map((id) => ({ teamId: Number(id), totalGamesPlayed: 2, totalOffNights: 0, weekScore: 1 }))}
      gamesPerDay={[0, 0, 0, 0, 0, 0, 0]} excludedDays={[]} setExcludedDays={vi.fn()}
      opponentMetricsByTeamId={{}} opponentMetricColumns={OPPONENT_METRIC_COLUMNS}
      opponentLeagueAverages={empty} opponentMetricsLoading={false} opponentMetricsError={null}
      opponentCoverageByTeamId={{ 1: coverage }} opponentLeagueCoverage={coverage}
      fourWeekSummaryByTeamId={summaries} fourWeekAverages={summaries[3]}
      opponentSourceLabel="2026–27 regular-season totals. Snapshot freshness unknown."
      fourWeekCalendar={{ start: "2026-10-05", end: "2026-11-01", knownDays: 28, expectedDays: 28, error: null }}
    />);
    expect(container.querySelectorAll("tbody small")).toHaveLength(0);
    const row = (id: number) => container.querySelector(`a[href="/stats/team/${id}"]`)!.closest("tr")!;
    fireEvent.click(screen.getByRole("button", { name: "Expand four-week columns" }));
    // GP · OFF · Opp% · 4WK Value · Trend
    const cells = (id: number) => Array.from(row(id).cells).slice(-5);
    const bands = (id: number) => cells(id).slice(0, 3).map((cell) => cell.getAttribute("data-favorability"));
    expect(bands(1)).toEqual(["high", "high", "high"]);
    expect(cells(2).map((cell) => cell.className)).toEqual(cells(1).map((cell) => cell.className));
    expect(bands(3)).toEqual(["middle", "middle", "middle"]);
    expect(bands(4)).toEqual(["low", "low", "low"]);
    expect(bands(5)).toEqual([null, null, null]);
    expect(cells(1)[3].className).toContain("masterMetricGoodStrong");
    expect(cells(4)[3].className).toContain("masterMetricBadStrong");
    expect(cells(5).map((cell) => cell.textContent)).toEqual(["-", "-", "-", "-", ""]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by 4WK Value descending" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort by 4WK Value ascending" }));
    expect(bands(1)).toEqual(["high", "high", "high"]);
    const info = container.querySelector("details")!;
    expect(info).toBeTruthy();
    expect(info.hasAttribute("open")).toBe(false);
    expect(info.querySelector("summary")?.getAttribute("aria-label")).toBe("Info about Game Grid metrics");
    expect(info.textContent).toContain("Lower OPP%");
    expect(info.textContent).toContain("Snapshot freshness unknown");
    expect(Array.from(container.querySelectorAll("p")).filter((p) => !p.closest("details"))).toHaveLength(0);
  });
});
