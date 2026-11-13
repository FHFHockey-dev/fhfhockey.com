import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useCallback, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DRMPage, {
  getDRMPresetRange,
  parseDRMDate,
  sanitizeDRMMode,
  sanitizeDRMSeasonId,
  toDateKey,
} from "pages/drm";

const mocks = vi.hoisted(() => ({
  fetchDeploymentMatrix: vi.fn(),
  fetchCurrentSeason: vi.fn(),
  fetchSeasonById: vi.fn(),
  datePickerProps: vi.fn(),
  linePairGridProps: vi.fn(),
  setDateRangeMatrixMode: vi.fn(),
  setQueryState: vi.fn(),
  useDateRangeMatrixData: vi.fn(),
  queryReady: true,
  queryValues: {} as Record<string, string | null>,
  canonicalLines: [[{ id: 9001 }]],
  canonicalPairs: [[{ id: 9002 }]],
}));

vi.mock("components/DateRangeMatrix/index", () => ({
  OPTIONS: [
    { label: "Line Combination", value: "line-combination" },
    { label: "Total TOI", value: "total-toi" },
    { label: "Full Roster", value: "full-roster" },
  ],
}));

vi.mock("components/DateRangeMatrix/useDateRangeMatrixData", () => ({
  useDateRangeMatrixData: mocks.useDateRangeMatrixData,
}));

vi.mock("components/DateRangeMatrix/fetchAggregatedData", () => ({
  EMPTY_SCOPED_CARD_STATS: {
    scopeGameIds: [],
    skatersByPlayerId: {},
    goaliesByPlayerId: {},
  },
}));

vi.mock("components/DateRangeMatrix/fetchDeploymentMatrix", () => ({ fetchDeploymentMatrix: mocks.fetchDeploymentMatrix }));
vi.mock("components/DateRangeMatrix/ObservedUnits", () => ({ default: () => null }));
vi.mock("components/DateRangeMatrix/MatrixCoverage", () => ({ default: () => null }));

vi.mock("components/DateRangeMatrix/utilities", () => ({
  getTeamColors: () => ({
    primary: "#000000",
    secondary: "#111111",
    jersey: "#ffffff",
    accentColor: "#00aaff",
  }),
}));

vi.mock("utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: mocks.fetchCurrentSeason,
  fetchSeasonById: mocks.fetchSeasonById,
}));

vi.mock("components/TeamSelect", () => ({
  default: ({ onTeamChange }: { onTeamChange: (team: string) => void }) => (
    <div>
      <button onClick={() => onTeamChange("EDM")}>Select EDM</button>
      <button onClick={() => onTeamChange("TOR")}>Select TOR</button>
    </div>
  ),
}));

vi.mock("components/DateRangeMatrix/TeamDropdown", () => ({
  default: ({
    id,
    name,
    selectedTeam,
    onSelect,
  }: {
    id: string;
    name: string;
    selectedTeam: string;
    onSelect: (team: string) => void;
  }) => (
    <select
      id={id}
      name={name}
      value={selectedTeam}
      data-testid="team-dropdown"
      onChange={(event) => onSelect(event.target.value)}
    >
      <option value="">Select a team</option>
      <option value="EDM">EDM</option>
      <option value="TOR">TOR</option>
    </select>
  ),
}));

vi.mock("components/DateRangeMatrix/LinePairGrid", () => ({
  default: (props: {
    scopeKey: string;
    lines: unknown[][];
    pairs: unknown[][];
  }) => {
    mocks.linePairGridProps(props);
    return <div data-testid="line-pair-grid" data-scope-key={props.scopeKey} />;
  },
}));

vi.mock("components/DateRangeMatrix/DateRangeMatrixView", () => ({
  default: () => null,
}));

vi.mock("components/DateRangeMatrix/lineCombinationHelper", () => ({
  calculateLinesAndPairs: () => ({ lines: [], pairs: [] }),
}));

vi.mock("react-datepicker", () => ({
  default: ({
    id,
    name,
    selected,
    onChange,
    className,
    wrapperClassName,
    calendarClassName,
    withPortal,
  }: {
    id: string;
    name: string;
    selected?: Date;
    onChange: (date: Date | null) => void;
    className?: string;
    wrapperClassName?: string;
    calendarClassName?: string;
    withPortal?: boolean;
  }) => {
    mocks.datePickerProps({
      id,
      className,
      wrapperClassName,
      calendarClassName,
      withPortal,
    });

    return (
      <input
        id={id}
        name={name}
        type="date"
        className={className}
        data-wrapper-class={wrapperClassName}
        data-calendar-class={calendarClassName}
        value={
          selected
            ? `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`
            : ""
        }
        onChange={(event) => {
          const [year, month, day] = event.target.value.split("-").map(Number);
          onChange(event.target.value ? new Date(year, month - 1, day) : null);
        }}
      />
    );
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("hooks/useUrlQueryState", () => ({
  useUrlQueryState: (key: string, defaultValue: string | null = null) => {
    const fallback = defaultValue;
    const [value, setValue] = useState<string | null>(
      mocks.queryValues[key] ?? fallback,
    );
    useEffect(() => {
      const sync = () => setValue(mocks.queryValues[key] ?? fallback);
      window.addEventListener("popstate", sync);
      return () => window.removeEventListener("popstate", sync);
    }, [fallback, key]);
    const setter = useCallback(
      (nextValue: string | null) => {
        mocks.queryValues[key] = nextValue;
        mocks.setQueryState(key, nextValue);
        if (key === "daterange-matrix-mode") {
          mocks.setDateRangeMatrixMode(nextValue);
        }
        setValue(nextValue ?? fallback);
      },
      [fallback, key],
    );
    return [value, setter, mocks.queryReady];
  },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T17:00:00Z"));
  mocks.queryReady = true;
  for (const key of Object.keys(mocks.queryValues)) {
    delete mocks.queryValues[key];
  }
  mocks.queryValues["daterange-matrix-mode"] = "line-combination";
  mocks.fetchCurrentSeason.mockResolvedValue({
    id: 20252026,
    startDate: "2025-10-01T00:00:00.000Z",
    regularSeasonEndDate: "2026-04-15T00:00:00.000Z",
    endDate: "2026-06-24T00:00:00.000Z",
    playoffsStartDate: Date.UTC(1999, 0, 1),
    playoffsEndDate: Date.UTC(1999, 0, 2),
  });
  mocks.fetchSeasonById.mockResolvedValue({
    id: 20242025,
    startDate: "2024-10-04T00:00:00.000Z",
    regularSeasonEndDate: "2025-04-17T00:00:00.000Z",
    endDate: "2025-06-17T00:00:00.000Z",
    playoffsStartDate: Date.UTC(1999, 0, 1),
    playoffsEndDate: Date.UTC(1999, 0, 2),
  });
  mocks.useDateRangeMatrixData.mockImplementation((args) => {
    const roster = (args.aggregatedData ?? []).map(
      (player: { playerId: number }) => ({ id: player.playerId }),
    );
    return {
      loading: args.aggregateStatus === "loading",
      status: args.aggregateStatus,
      error: args.aggregateError,
      stale: false,
      source: "aggregated",
      coverage: {
        inputRows: roster.length,
        rosterRows: roster.length,
        skippedRows: 0,
      },
      teamId: roster.length > 0 ? 22 : undefined,
      teamName: roster.length > 0 ? "Edmonton Oilers" : undefined,
      roster,
      toiData: [],
      homeAwayInfo: [],
      playerATOI: {},
      lines: roster.length > 0 ? mocks.canonicalLines : [],
      pairs: roster.length > 0 ? mocks.canonicalPairs : [],
    };
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function aggregateResponse(
  playerId: number,
  matchedGameIds: number[] = [playerId],
) {
  const player = {
    playerId,
    regularSeasonData: { gameIds: [playerId] },
    playoffData: { gameIds: [] },
  };
  return {
    byStrength: Object.fromEntries(["all", "fiveOnFive", "otherEs", "pp", "pk"].map(strength => [strength, { [playerId]: player }])),
    units: [],
    coverage: { inputRows: 1, rosterRows: 1, skippedRows: 0, games: [] },
    matchedGameIds,
    cardStats: {
      scopeGameIds: Array.from(new Set(matchedGameIds)),
      skatersByPlayerId: {},
      goaliesByPlayerId: {},
    },
  };
}

const emptyAggregateResponse = {
  byStrength: { all: {}, fiveOnFive: {}, otherEs: {}, pp: {}, pk: {} },
  units: [],
  coverage: { inputRows: 0, rosterRows: 0, skippedRows: 0, games: [] },
  matchedGameIds: [],
  cardStats: {
    scopeGameIds: [],
    skatersByPlayerId: {},
    goaliesByPlayerId: {},
  },
};

async function waitForSeasonInitialization() {
  await waitFor(() => {
    const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
    expect(latest?.startDate).toBe("2025-10-01");
    expect(latest?.endDate).toBe("2026-04-15");
  });
}

describe("DRMPage latest-request ownership", () => {
  it.each([
    ["L7", "2026-03-09T02:00:00Z", "2026-03-02", "2026-03-08"],
    ["L14", "2026-11-02T03:30:00Z", "2026-10-19", "2026-11-01"],
    ["L30", "2024-03-01T03:30:00Z", "2024-01-31", "2024-02-29"],
  ] as const)("uses inclusive Eastern calendar dates for %s across DST/leap boundaries", (preset, now, start, end) => {
    const range = getDRMPresetRange(preset, {
      start: parseDRMDate("2023-10-01"), end: parseDRMDate("2027-06-30"),
    }, new Date(now));
    expect(toDateKey(range?.start)).toBe(start);
    expect(toDateKey(range?.end)).toBe(end);
  });

  it("clamps presets to the first season days and loads with fewer than seven games", async () => {
    vi.setSystemTime(new Date("2026-10-03T03:00:00Z")); // Still Oct 2 in New York.
    mocks.fetchCurrentSeason.mockResolvedValue({
      id: 20262027, startDate: "2026-10-01", regularSeasonEndDate: "2027-04-15", endDate: "2027-06-24",
    });
    Object.assign(mocks.queryValues, { team: "EDM", timeframe: "L7" });
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97, [2026020001]));
    render(<DRMPage />);
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(1));
    expect(mocks.fetchDeploymentMatrix).toHaveBeenLastCalledWith(expect.objectContaining({
      startDate: "2026-10-01", endDate: "2026-10-02", seasonId: 20262027,
    }));
    await waitFor(() => expect(screen.getByTestId("line-pair-grid")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Season to date" }));
    expect(mocks.fetchDeploymentMatrix).toHaveBeenLastCalledWith(expect.objectContaining({
      startDate: "2026-10-01", endDate: "2026-10-02",
    }));
  });

  it("round-trips date-only keys through local calendar dates", () => {
    const parsed = parseDRMDate("2026-03-10");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(2);
    expect(parsed.getDate()).toBe(10);
    expect(toDateKey(parsed)).toBe("2026-03-10");
    expect(toDateKey(new Date(2026, 2, 10))).toBe("2026-03-10");
    expect(toDateKey(parseDRMDate("2026-03-10T00:00:00.000Z"))).toBe(
      "2026-03-10",
    );
  });

  it("sanitizes unsupported mode and season query values", () => {
    expect(sanitizeDRMMode("total-toi")).toBe("total-toi");
    expect(sanitizeDRMMode("not-a-mode")).toBe("line-combination");
    expect(sanitizeDRMSeasonId("20242025")).toBe(20242025);
    expect(sanitizeDRMSeasonId("20242026")).toBeNull();
    expect(sanitizeDRMSeasonId("../../20242025")).toBeNull();
  });

  it("restores a historical Custom raw-QA scope without current-season overwrite", async () => {
    Object.assign(mocks.queryValues, {
      "daterange-matrix-mode": "total-toi",
      team: "edm",
      season: "20242025",
      seasonType: "playoffs",
      timeframe: "Custom",
      source: "raw",
      start: "2025-05-01",
      end: "2025-05-12",
    });

    render(<DRMPage />);

    await waitFor(() =>
      expect(mocks.fetchSeasonById).toHaveBeenCalledWith(20242025),
    );
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest).toEqual(
        expect.objectContaining({
          teamAbbreviation: "EDM",
          seasonId: 20242025,
          seasonType: "playoffs",
          source: "raw",
          mode: "total-toi",
          startDate: "2025-05-01",
          endDate: "2025-05-12",
        }),
      );
    });
    expect(mocks.fetchCurrentSeason).not.toHaveBeenCalled();
    expect(mocks.fetchDeploymentMatrix).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: "Custom" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByLabelText("Data source")).toHaveProperty("value", "raw");
  });

  it("switches QA sources without changing the bounded team, season, or dates", async () => {
    Object.assign(mocks.queryValues, {
      team: "EDM",
      season: "20242025",
      seasonType: "playoffs",
      timeframe: "Custom",
      source: "aggregated",
      start: "2025-05-01",
      end: "2025-05-12",
    });
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);

    await waitFor(() =>
      expect(mocks.useDateRangeMatrixData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          teamAbbreviation: "EDM",
          seasonId: 20242025,
          seasonType: "playoffs",
          source: "aggregated",
          startDate: "2025-05-01",
          endDate: "2025-05-12",
        }),
      ),
    );

    fireEvent.change(screen.getByLabelText("Data source"), {
      target: { value: "raw" },
    });

    await waitFor(() =>
      expect(mocks.useDateRangeMatrixData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          teamAbbreviation: "EDM",
          seasonId: 20242025,
          seasonType: "playoffs",
          source: "raw",
          startDate: "2025-05-01",
          endDate: "2025-05-12",
        }),
      ),
    );
    expect(mocks.setQueryState).toHaveBeenCalledWith("source", "raw");
    expect(mocks.queryValues).toEqual(
      expect.objectContaining({
        team: "EDM",
        season: "20242025",
        seasonType: "playoffs",
        timeframe: "Custom",
        source: "raw",
        start: "2025-05-01",
        end: "2025-05-12",
      }),
    );
  });

  it("does not clear restored Custom dates before query hydration completes", async () => {
    Object.assign(mocks.queryValues, {
      team: "EDM",
      season: "20242025",
      timeframe: "Custom",
      source: "raw",
      start: "2025-05-01",
      end: "2025-05-12",
    });
    mocks.queryReady = false;

    const { rerender } = render(<DRMPage />);

    expect(mocks.setQueryState).not.toHaveBeenCalledWith("start", null);
    expect(mocks.setQueryState).not.toHaveBeenCalledWith("end", null);
    mocks.queryReady = true;
    rerender(<DRMPage />);

    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest).toEqual(
        expect.objectContaining({
          startDate: "2025-05-01",
          endDate: "2025-05-12",
          source: "raw",
        }),
      );
    });
  });

  it("uses restored season bounds and identity for aggregated reads", async () => {
    Object.assign(mocks.queryValues, {
      team: "EDM",
      season: "20242025",
      seasonType: "regularSeason",
      timeframe: "Totals",
      source: "aggregated",
    });
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);

    await waitFor(() =>
      expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 22,
          seasonId: 20242025,
          seasonType: "regularSeason",
          startDate: "2024-10-04",
          endDate: "2025-04-17",
        }),
      ),
    );
    expect(mocks.fetchCurrentSeason).not.toHaveBeenCalled();
  });

  it("canonicalizes invalid URL controls before any team-scoped read", async () => {
    Object.assign(mocks.queryValues, {
      "daterange-matrix-mode": "unsafe-mode",
      team: "../../EDM",
      opponent: "not-a-team",
      season: "20242026",
      seasonType: "postseason-ish",
      timeframe: "Forever",
      source: "legacy",
      homeAway: "neutral",
      start: "2025-02-31",
      end: "not-a-date",
    });

    render(<DRMPage />);
    await waitFor(() => expect(mocks.fetchCurrentSeason).toHaveBeenCalled());
    await waitFor(() => {
      expect(mocks.setQueryState).toHaveBeenCalledWith("team", null);
      expect(mocks.setQueryState).toHaveBeenCalledWith("opponent", null);
      expect(mocks.setQueryState).toHaveBeenCalledWith("season", null);
      expect(mocks.setQueryState).toHaveBeenCalledWith(
        "seasonType",
        "regularSeason",
      );
      expect(mocks.setQueryState).toHaveBeenCalledWith("timeframe", "Totals");
      expect(mocks.setQueryState).toHaveBeenCalledWith("source", "aggregated");
      expect(mocks.setQueryState).toHaveBeenCalledWith("homeAway", null);
      expect(mocks.setQueryState).toHaveBeenCalledWith("start", null);
      expect(mocks.setQueryState).toHaveBeenCalledWith("end", null);
      expect(mocks.setDateRangeMatrixMode).toHaveBeenCalledWith(
        "line-combination",
      );
    });
    expect(mocks.fetchDeploymentMatrix).not.toHaveBeenCalled();
  });

  it("exposes labeled controls with pressed-state semantics", async () => {
    render(<DRMPage />);
    await waitForSeasonInitialization();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Line Combo Matrix/,
      }),
    ).toBeTruthy();
    expect(screen.getByRole("group", { name: "Timeframe" })).toBeTruthy();

    const seasonTimeframe = screen.getByRole("button", { name: "Season to date" });
    const l7Timeframe = screen.getByRole("button", { name: "Last 7 days" });
    expect(seasonTimeframe.getAttribute("aria-pressed")).toBe("true");
    expect(l7Timeframe.getAttribute("aria-pressed")).toBe("false");

    const team = screen.getByLabelText("Team");
    const opponent = screen.getByLabelText("Opponent");
    const startDate = screen.getByLabelText("Start date");
    const endDate = screen.getByLabelText("End date");
    const matrixLayout = screen.getByLabelText("Matrix layout");

    expect(team.id).toBe("drm-team");
    expect(team.getAttribute("name")).toBe("team");
    expect(opponent.id).toBe("drm-opponent");
    expect(opponent.getAttribute("name")).toBe("opponent");
    expect(startDate.id).toBe("drm-start-date");
    expect(startDate.getAttribute("name")).toBe("start");
    expect(startDate.className).not.toContain("undefined");
    expect(startDate.className).not.toBe("");
    expect(startDate.getAttribute("data-wrapper-class")).toBeTruthy();
    expect(startDate.getAttribute("data-calendar-class")).toBeTruthy();
    expect(endDate.id).toBe("drm-end-date");
    expect(endDate.getAttribute("name")).toBe("end");
    expect(endDate.className).not.toContain("undefined");
    expect(endDate.getAttribute("data-wrapper-class")).toBeTruthy();
    expect(endDate.getAttribute("data-calendar-class")).toBeTruthy();
    expect(mocks.datePickerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "drm-start-date",
        withPortal: true,
      }),
    );
    expect(mocks.datePickerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "drm-end-date",
        withPortal: true,
      }),
    );
    expect(matrixLayout.tagName).toBe("SELECT");
    expect(matrixLayout.id).toBe("drm-matrix-layout");
    expect(matrixLayout.getAttribute("name")).toBe("daterange-matrix-mode");

    const regularSeason = screen.getByRole("button", {
      name: "Regular season",
    });
    const playoffs = screen.getByRole("button", { name: "Playoffs" });
    const home = screen.getByRole("button", { name: "Home" });
    const away = screen.getByRole("button", { name: "Away" });
    expect(regularSeason.getAttribute("aria-pressed")).toBe("true");
    expect(playoffs.getAttribute("aria-pressed")).toBe("false");
    expect(home.getAttribute("aria-pressed")).toBe("false");
    expect(away.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(home);
    expect(home.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(playoffs);
    expect(regularSeason.getAttribute("aria-pressed")).toBe("false");
    expect(playoffs.getAttribute("aria-pressed")).toBe("true");

    fireEvent.change(matrixLayout, { target: { value: "total-toi" } });
    expect(mocks.setDateRangeMatrixMode).toHaveBeenCalledWith("total-toi");
  });

  it("does not let an older aggregate request overwrite a newer team", async () => {
    const first = deferred<ReturnType<typeof aggregateResponse>>();
    const second = deferred<ReturnType<typeof aggregateResponse>>();
    mocks.fetchDeploymentMatrix
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(<DRMPage />);
    await waitForSeasonInitialization();

    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() =>
      expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Select TOR" }));
    await waitFor(() =>
      expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      second.resolve(aggregateResponse(2));
      await second.promise;
    });
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.aggregateStatus).toBe("success");
      expect(latest.aggregatedData).toEqual([
        expect.objectContaining({ playerId: 2 }),
      ]);
    });

    await act(async () => {
      first.resolve(aggregateResponse(1));
      await first.promise;
    });
    const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
    expect(latest.aggregatedData).toEqual([
      expect.objectContaining({ playerId: 2 }),
    ]);
  });

  it("does not let an older preset aggregate replace a newer calendar range", async () => {
    mocks.queryValues.team = "EDM";
    mocks.fetchDeploymentMatrix.mockResolvedValueOnce(emptyAggregateResponse);
    const first = deferred<ReturnType<typeof aggregateResponse>>();
    const second = deferred<ReturnType<typeof aggregateResponse>>();
    render(<DRMPage />);
    await waitForSeasonInitialization();
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(1));
    mocks.fetchDeploymentMatrix.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    fireEvent.click(screen.getByRole("button", { name: "Last 14 days" }));
    expect(mocks.fetchDeploymentMatrix.mock.calls.slice(1).map(([args]) => [args.startDate, args.endDate]))
      .toEqual([["2026-04-09", "2026-04-15"], ["2026-04-02", "2026-04-15"]]);
    await act(async () => { second.resolve(aggregateResponse(2)); await second.promise; });
    await act(async () => { first.resolve(aggregateResponse(1)); await first.promise; });
    expect(mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0].aggregatedData)
      .toEqual([expect.objectContaining({ playerId: 2 })]);
  });

  it("treats re-clicking an active calendar preset as a no-op", async () => {
    mocks.queryValues.team = "EDM";
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97));
    render(<DRMPage />);
    await waitForSeasonInitialization();
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(2));
    expect(mocks.fetchDeploymentMatrix).toHaveBeenLastCalledWith(expect.objectContaining({
      startDate: "2026-04-09", endDate: "2026-04-15",
    }));
  });

  it("does not fetch future games before the selected season type starts", async () => {
    vi.setSystemTime(new Date("2026-04-15T16:00:00Z"));
    Object.assign(mocks.queryValues, { team: "EDM", seasonType: "playoffs", timeframe: "L7" });
    render(<DRMPage />);
    await waitFor(() => expect(screen.getByText("The selected season has not started yet.")).toBeTruthy());
    expect(mocks.fetchDeploymentMatrix).not.toHaveBeenCalled();
    expect(mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
      startDate: "", endDate: "", aggregateStatus: "empty",
    }));
  });

  it("keeps the calendar window fixed while team and venue/opponent filters narrow it", async () => {
    Object.assign(mocks.queryValues, { team: "EDM", timeframe: "L7", start: "2026-01-01", end: "2026-01-02" });
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97, [2025021007, 2025021007, 2025021006]));
    render(<DRMPage />);
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenCalled());
    expect(screen.getByText("Showing games from Apr 9 to Apr 15, 2026.")).toBeTruthy();
    expect(screen.getByTestId("line-pair-grid")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.change(screen.getAllByTestId("team-dropdown")[1], { target: { value: "TOR" } });
    fireEvent.click(screen.getByRole("button", { name: "Select TOR" }));
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenLastCalledWith(expect.objectContaining({
      teamId: 10, homeOrAway: "home", opponentTeamAbbreviation: "TOR",
    })));
    for (const [args] of mocks.fetchDeploymentMatrix.mock.calls) {
      expect(args).toEqual(expect.objectContaining({ startDate: "2026-04-09", endDate: "2026-04-15" }));
      expect(args.gameIds).toBeUndefined();
    }
    expect(mocks.queryValues).toEqual(expect.objectContaining({ timeframe: "L7", start: "2026-04-09", end: "2026-04-15" }));
  });

  it("hides a resolved line-card scope on the first render of a changed filter", async () => {
    const changedScope = deferred<ReturnType<typeof aggregateResponse>>();
    mocks.fetchDeploymentMatrix
      .mockResolvedValueOnce(aggregateResponse(97, [2025021007]))
      .mockReturnValueOnce(changedScope.promise);

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));

    const initialGrid = await screen.findByTestId("line-pair-grid");
    const initialScopeKey = initialGrid.getAttribute("data-scope-key");
    expect(initialScopeKey).toContain("all-venues");

    fireEvent.click(screen.getByRole("button", { name: "Home" }));

    expect(screen.queryByTestId("line-pair-grid")).toBeNull();
    expect(
      screen.getByText(
        "Updating line and goalie cards…",
      ),
    ).toBeTruthy();
    await waitFor(() =>
      expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      changedScope.resolve(aggregateResponse(97, [2025021008]));
      await changedScope.promise;
    });

    const changedGrid = await screen.findByTestId("line-pair-grid");
    const changedScopeKey = changedGrid.getAttribute("data-scope-key");
    expect(changedScopeKey).toContain(":home:");
    expect(changedScopeKey).not.toBe(initialScopeKey);
  });

  it("forwards the hook's canonical line and pair groups to the line-card renderer", async () => {
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));

    await screen.findByTestId("line-pair-grid");
    expect(mocks.linePairGridProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lines: mocks.canonicalLines,
        pairs: mocks.canonicalPairs,
      }),
    );
  });

  it("switches strength from the same qualified response without refetching the date scope", async () => {
    mocks.queryValues.team = "EDM";
    const result = aggregateResponse(97, [2025021007]);
    result.byStrength.pp = aggregateResponse(29).byStrength.all;
    const unit = { teamId: 22, gameIds: [2025021007], strength: "pp", kind: "power_play", playerIds: [1, 2, 3, 4, 5], seconds: 120, skaterCount: 5 };
    mocks.fetchDeploymentMatrix.mockResolvedValue({ ...result, units: [unit] });
    render(<DRMPage />);
    await waitFor(() => expect(mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0].aggregatedData[0]?.playerId).toBe(97));
    const calls = mocks.fetchDeploymentMatrix.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Strength"), { target: { value: "pp" } });
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.aggregatedData[0].playerId).toBe(29);
      expect(latest.observedUnits).toEqual([unit]);
    });
    expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(calls);
  });

  it("keeps usable aggregate data visible while propagating skipped-game coverage", async () => {
    mocks.fetchDeploymentMatrix.mockResolvedValue({
      ...aggregateResponse(97, [2025021007]),
      coverage: { inputRows: 3, rosterRows: 1, skippedRows: 2, games: [] },
    });

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));

    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.aggregateStatus).toBe("partial");
      expect(latest.aggregateCoverage).toEqual({
        inputRows: 3,
        rosterRows: 1,
        skippedRows: 2,
        games: [],
      });
      expect(latest.aggregatedData).toEqual([
        expect.objectContaining({ playerId: 97 }),
      ]);
    });
    expect(mocks.linePairGridProps).toHaveBeenCalled();
  });

  it("blocks stale dates while a restored season changes and ignores its late response", async () => {
    mocks.queryValues.team = "EDM";
    mocks.fetchDeploymentMatrix.mockResolvedValue(emptyAggregateResponse);
    render(<DRMPage />);
    await waitForSeasonInitialization();
    const initialCalls = mocks.fetchDeploymentMatrix.mock.calls.length;
    const oldSeason = deferred<Record<string, unknown>>();
    const newerSeason = deferred<Record<string, unknown>>();
    mocks.fetchSeasonById.mockReturnValueOnce(oldSeason.promise).mockReturnValueOnce(newerSeason.promise);
    act(() => {
      mocks.queryValues.season = "20242025";
      mocks.queryValues.timeframe = "L7";
      window.dispatchEvent(new Event("popstate"));
    });
    await waitFor(() => expect(mocks.fetchSeasonById).toHaveBeenCalledWith(20242025));
    expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(initialCalls);
    act(() => {
      mocks.queryValues.season = "20232024";
      window.dispatchEvent(new Event("popstate"));
    });
    await act(async () => {
      newerSeason.resolve({ id: 20232024, startDate: "2023-10-10", regularSeasonEndDate: "2024-04-18", endDate: "2024-06-24" });
      await newerSeason.promise;
    });
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenLastCalledWith(expect.objectContaining({
      seasonId: 20232024, startDate: "2024-04-12", endDate: "2024-04-18",
    })));
    const settledCalls = mocks.fetchDeploymentMatrix.mock.calls.length;
    await act(async () => {
      oldSeason.resolve({ id: 20242025, startDate: "2024-10-04", regularSeasonEndDate: "2025-04-17", endDate: "2025-06-17" });
      await oldSeason.promise;
    });
    expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(settledCalls);
  });

  it("enters exact Custom mode and preserves its dates across team and filters", async () => {
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-02-10" },
    });
    await waitFor(() =>
      expect(mocks.fetchDeploymentMatrix).toHaveBeenLastCalledWith(
        expect.objectContaining({
          teamId: 22,
          startDate: "2026-02-01",
          endDate: "2026-02-10",
        }),
      ),
    );

    expect(
      screen
        .getByRole("button", { name: "Custom" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByText(
        "Showing games from Feb 1 to Feb 10, 2026.",
      ),
    ).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("line-pair-grid")).not.toBeNull());
    expect(mocks.linePairGridProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scopeKey: expect.stringContaining("2026-02-01:2026-02-10"),
        lines: mocks.canonicalLines,
        pairs: mocks.canonicalPairs,
      }),
    );
    expect(mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0].observedUnits).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Select TOR" }));
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    const opponentDropdown = screen.getAllByTestId("team-dropdown")[1];
    fireEvent.change(opponentDropdown, { target: { value: "TOR" } });
    await waitFor(() =>
      expect(mocks.fetchDeploymentMatrix).toHaveBeenLastCalledWith(
        expect.objectContaining({
          teamId: 10,
          startDate: "2026-02-01",
          endDate: "2026-02-10",
          homeOrAway: "home",
          opponentTeamAbbreviation: "TOR",
        }),
      ),
    );
  });

  it("resets Custom to the selected season and lets a preset recalculate", async () => {
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-02-10" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Playoffs" }));
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.startDate).toBe("2026-04-16");
      expect(latest.endDate).toBe("2026-06-24");
      expect(latest.seasonType).toBe("playoffs");
    });
    expect(
      screen
        .getByRole("button", { name: "Season to date" })
        .getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.startDate).toBe("2026-06-18");
      expect(latest.endDate).toBe("2026-06-24");
    });
  });

  it("fails closed for missing or reversed Custom dates", async () => {
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenCalled());

    const initialCalls = mocks.fetchDeploymentMatrix.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "" },
    });
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.aggregateStatus).toBe("error");
      expect(latest.aggregateError).toBe(
        "Select both Custom dates to load matrix data.",
      );
    });
    expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(initialCalls);
    expect(screen.getByRole("alert").textContent).toBe(
      "Select both Custom dates to load matrix data.",
    );

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-04-10" },
    });
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenCalled());
    const validCalls = mocks.fetchDeploymentMatrix.mock.calls.length;
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-04-01" },
    });
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.aggregateStatus).toBe("error");
      expect(latest.aggregateError).toBe(
        "Custom start date must not follow the end date.",
      );
    });
    expect(mocks.fetchDeploymentMatrix).toHaveBeenCalledTimes(validCalls);
    expect(screen.getByRole("alert").textContent).toBe(
      "Custom start date must not follow the end date.",
    );
    expect(screen.queryByTestId("line-pair-grid")).toBeNull();
  });

  it("does not let a late preset aggregate overwrite manual Custom dates", async () => {
    mocks.queryValues.team = "EDM";
    mocks.fetchDeploymentMatrix.mockResolvedValue(aggregateResponse(97));
    render(<DRMPage />);
    await waitForSeasonInitialization();
    const pending = deferred<ReturnType<typeof aggregateResponse>>();
    mocks.fetchDeploymentMatrix.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-02-01" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-02-10" } });
    await waitFor(() => expect(mocks.fetchDeploymentMatrix).toHaveBeenLastCalledWith(expect.objectContaining({
      startDate: "2026-02-01", endDate: "2026-02-10",
    })));
    await act(async () => { pending.resolve(aggregateResponse(1)); await pending.promise; });
    expect(mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
      startDate: "2026-02-01", endDate: "2026-02-10", aggregatedData: [expect.objectContaining({ playerId: 97 })],
    }));
  });

});
