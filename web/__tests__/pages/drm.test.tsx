import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DRMPage, {
  parseDRMDate,
  sanitizeDRMMode,
  sanitizeDRMSeasonId,
  toDateKey,
} from "pages/drm";

const mocks = vi.hoisted(() => ({
  fetchAggregatedData: vi.fn(),
  fetchCurrentSeason: vi.fn(),
  fetchSeasonById: vi.fn(),
  getDateRangeForGames: vi.fn(),
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
  fetchAggregatedData: mocks.fetchAggregatedData,
}));

vi.mock("components/DateRangeMatrix/utilities", () => ({
  getDateRangeForGames: mocks.getDateRangeForGames,
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

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
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
    regularSeasonPlayersData: { [playerId]: player },
    playoffPlayersData: {},
    matchedGameIds,
    cardStats: {
      scopeGameIds: Array.from(new Set(matchedGameIds)),
      skatersByPlayerId: {},
      goaliesByPlayerId: {},
    },
  };
}

function rangeResponse(
  startDate: string,
  endDate: string,
  gamesBack: 7 | 14 | 30,
) {
  return {
    startDate,
    endDate,
    gameIds: Array.from(
      { length: gamesBack },
      (_, index) => 2025021000 + gamesBack - index,
    ),
    requestedGameCount: gamesBack,
    resolvedGameCount: gamesBack,
  };
}

const emptyAggregateResponse = {
  regularSeasonPlayersData: {},
  playoffPlayersData: {},
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
    expect(mocks.fetchAggregatedData).not.toHaveBeenCalled();
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
    mocks.fetchAggregatedData.mockResolvedValue(aggregateResponse(97));

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
    mocks.fetchAggregatedData.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);

    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenCalledWith(
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
    expect(mocks.fetchAggregatedData).not.toHaveBeenCalled();
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

    const seasonTimeframe = screen.getByRole("button", { name: "Season" });
    const l7Timeframe = screen.getByRole("button", { name: "L7" });
    expect(seasonTimeframe.getAttribute("aria-pressed")).toBe("true");
    expect(l7Timeframe.getAttribute("aria-pressed")).toBe("false");

    const team = screen.getByLabelText("Team");
    const opponent = screen.getByLabelText("Opponent");
    const startDate = screen.getByLabelText("Start Date");
    const endDate = screen.getByLabelText("End Date");
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
      name: "Regular Season",
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
    mocks.fetchAggregatedData
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(<DRMPage />);
    await waitForSeasonInitialization();

    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Select TOR" }));
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(2),
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

  it("does not let an older last-N date lookup replace a newer range", async () => {
    const first = deferred<ReturnType<typeof rangeResponse>>();
    const second = deferred<ReturnType<typeof rangeResponse>>();
    mocks.getDateRangeForGames
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    mocks.fetchAggregatedData.mockResolvedValue(emptyAggregateResponse);

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());
    const initialAggregateCalls = mocks.fetchAggregatedData.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "L7" }));
    await waitFor(() =>
      expect(mocks.getDateRangeForGames).toHaveBeenCalledTimes(1),
    );
    expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(
      initialAggregateCalls,
    );
    fireEvent.click(screen.getByRole("button", { name: "L14" }));
    await waitFor(() =>
      expect(mocks.getDateRangeForGames).toHaveBeenCalledTimes(2),
    );
    expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(
      initialAggregateCalls,
    );

    await act(async () => {
      second.resolve(rangeResponse("2026-03-01", "2026-04-01", 14));
      await second.promise;
    });
    await waitFor(() => {
      const latestRequest = mocks.fetchAggregatedData.mock.calls.at(-1)?.[0];
      expect(latestRequest).toEqual(
        expect.objectContaining({
          teamId: 22,
          seasonId: 20252026,
          startDate: "2026-03-01",
          endDate: "2026-04-01",
          seasonType: "regularSeason",
        }),
      );
    });

    await act(async () => {
      first.resolve(rangeResponse("2026-01-01", "2026-02-01", 7));
      await first.promise;
    });
    const latestRequest = mocks.fetchAggregatedData.mock.calls.at(-1)?.[0];
    expect(latestRequest?.startDate).toBe("2026-03-01");
    expect(latestRequest?.endDate).toBe("2026-04-01");
  });

  it("treats re-clicking an active rolling preset as a no-op", async () => {
    const lookup = deferred<ReturnType<typeof rangeResponse>>();
    mocks.getDateRangeForGames.mockReturnValueOnce(lookup.promise);
    mocks.fetchAggregatedData.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "L7" }));
    fireEvent.click(screen.getByRole("button", { name: "L7" }));
    await waitFor(() =>
      expect(mocks.getDateRangeForGames).toHaveBeenCalledTimes(1),
    );

    const resolved = rangeResponse("2026-03-01", "2026-04-01", 7);
    await act(async () => {
      lookup.resolve(resolved);
      await lookup.promise;
    });
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenLastCalledWith(
        expect.objectContaining({ gameIds: resolved.gameIds }),
      ),
    );
    const aggregateCalls = mocks.fetchAggregatedData.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "L7" }));
    await act(async () => Promise.resolve());
    expect(mocks.getDateRangeForGames).toHaveBeenCalledTimes(1);
    expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(aggregateCalls);
  });

  it("clears an old range and exposes a failed last-N lookup", async () => {
    const lookup = deferred<ReturnType<typeof rangeResponse>>();
    mocks.getDateRangeForGames.mockReturnValueOnce(lookup.promise);
    mocks.fetchAggregatedData.mockResolvedValue(emptyAggregateResponse);

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "L7" }));
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.startDate).toBe("");
      expect(latest.endDate).toBe("");
      expect(latest.aggregateStatus).toBe("loading");
      expect(latest.aggregatedData).toEqual([]);
    });

    await act(async () => {
      lookup.reject(new Error("date lookup failed"));
      try {
        await lookup.promise;
      } catch {
        // The page owns this rejection and converts it to a safe result state.
      }
    });
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.aggregateStatus).toBe("error");
      expect(latest.aggregateError).toBe(
        "Unable to resolve the matrix date range.",
      );
      expect(latest.aggregatedData).toEqual([]);
    });
  });

  it("keeps an Option-A L7 window fixed while filters narrow it", async () => {
    const resolvedRange = rangeResponse("2026-03-10", "2026-04-01", 7);
    mocks.getDateRangeForGames.mockResolvedValue(resolvedRange);
    mocks.fetchAggregatedData.mockResolvedValue(
      aggregateResponse(97, [2025021007, 2025021007, 2025021006]),
    );

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "L7" }));
    await waitFor(() =>
      expect(mocks.getDateRangeForGames).toHaveBeenCalledWith({
        teamId: 22,
        seasonId: 20252026,
        seasonType: "regularSeason",
        gamesBack: 7,
        scopeStartDate: "2025-10-01",
        scopeEndDate: "2026-04-15",
      }),
    );
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          startDate: "2026-03-10",
          endDate: "2026-04-01",
          gameIds: resolvedRange.gameIds,
          homeOrAway: "",
          opponentTeamAbbreviation: "",
        }),
      ),
    );
    expect(
      screen.getByText(
        "Matrix scope: 2 matching games within last 7 team games.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("line-pair-grid")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          startDate: "2026-03-10",
          endDate: "2026-04-01",
          gameIds: resolvedRange.gameIds,
          homeOrAway: "home",
        }),
      ),
    );

    const opponentDropdown = screen.getAllByTestId("team-dropdown")[1];
    fireEvent.change(opponentDropdown, { target: { value: "TOR" } });
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          startDate: "2026-03-10",
          endDate: "2026-04-01",
          gameIds: resolvedRange.gameIds,
          homeOrAway: "home",
          opponentTeamAbbreviation: "TOR",
        }),
      ),
    );
    expect(mocks.getDateRangeForGames).toHaveBeenCalledTimes(1);
  });

  it("hides a resolved line-card scope on the first render of a changed filter", async () => {
    const changedScope = deferred<ReturnType<typeof aggregateResponse>>();
    mocks.fetchAggregatedData
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
        "Updating line and goalie stat cards for the selected matrix scope.",
      ),
    ).toBeTruthy();
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(2),
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
    mocks.fetchAggregatedData.mockResolvedValue(aggregateResponse(97));

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

  it("keeps usable aggregate data visible while propagating skipped-game coverage", async () => {
    mocks.fetchAggregatedData.mockResolvedValue({
      ...aggregateResponse(97, [2025021007]),
      coverage: { inputRows: 3, rosterRows: 1, skippedRows: 2 },
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
      });
      expect(latest.aggregatedData).toEqual([
        expect.objectContaining({ playerId: 97 }),
      ]);
    });
    expect(mocks.linePairGridProps).toHaveBeenCalled();
  });

  it("does not reuse another team's resolved rolling IDs while its new window loads", async () => {
    const edmRange = rangeResponse("2026-03-10", "2026-04-01", 7);
    const torLookup = deferred<ReturnType<typeof rangeResponse>>();
    mocks.getDateRangeForGames
      .mockResolvedValueOnce(edmRange)
      .mockReturnValueOnce(torLookup.promise);
    mocks.fetchAggregatedData.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "L7" }));
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          teamId: 22,
          gameIds: edmRange.gameIds,
        }),
      ),
    );
    const edmAggregateCalls = mocks.fetchAggregatedData.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Select TOR" }));
    await waitFor(() =>
      expect(mocks.getDateRangeForGames).toHaveBeenCalledTimes(2),
    );
    expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(edmAggregateCalls);

    const torRange = rangeResponse("2026-03-12", "2026-04-03", 7);
    await act(async () => {
      torLookup.resolve(torRange);
      await torLookup.promise;
    });
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          teamId: 10,
          startDate: "2026-03-12",
          endDate: "2026-04-03",
          gameIds: torRange.gameIds,
        }),
      ),
    );
  });

  it("enters exact Custom mode and preserves its dates across team and filters", async () => {
    mocks.fetchAggregatedData.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Start Date"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("End Date"), {
      target: { value: "2026-02-10" },
    });
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          teamId: 22,
          startDate: "2026-02-01",
          endDate: "2026-02-10",
          gameIds: undefined,
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
        "Custom range: 2026-02-01 through 2026-02-10 (inclusive).",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("line-pair-grid")).toBeNull();
    expect(
      screen.getByText(
        "Line and goalie stat cards are unavailable for Custom ranges; the matrix uses the selected dates.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Select TOR" }));
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    const opponentDropdown = screen.getAllByTestId("team-dropdown")[1];
    fireEvent.change(opponentDropdown, { target: { value: "TOR" } });
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          teamId: 10,
          startDate: "2026-02-01",
          endDate: "2026-02-10",
          homeOrAway: "home",
          opponentTeamAbbreviation: "TOR",
        }),
      ),
    );
    expect(mocks.getDateRangeForGames).not.toHaveBeenCalled();
  });

  it("resets Custom to the selected season and lets a preset recalculate", async () => {
    mocks.fetchAggregatedData.mockResolvedValue(aggregateResponse(97));
    const playoffRange = rangeResponse("2026-05-01", "2026-06-01", 7);
    mocks.getDateRangeForGames.mockResolvedValue(playoffRange);

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Start Date"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("End Date"), {
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
        .getByRole("button", { name: "Season" })
        .getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "L7" }));
    await waitFor(() =>
      expect(mocks.getDateRangeForGames).toHaveBeenCalledWith({
        teamId: 22,
        seasonId: 20252026,
        seasonType: "playoffs",
        gamesBack: 7,
        scopeStartDate: "2026-04-16",
        scopeEndDate: "2026-06-24",
      }),
    );
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.startDate).toBe("2026-05-01");
      expect(latest.endDate).toBe("2026-06-01");
    });
  });

  it("fails closed for missing or reversed Custom dates", async () => {
    mocks.fetchAggregatedData.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());

    const initialCalls = mocks.fetchAggregatedData.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Start Date"), {
      target: { value: "" },
    });
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.aggregateStatus).toBe("error");
      expect(latest.aggregateError).toBe(
        "Select both Custom dates to load matrix data.",
      );
    });
    expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(initialCalls);
    expect(screen.getByRole("alert").textContent).toBe(
      "Select both Custom dates to load matrix data.",
    );

    fireEvent.change(screen.getByLabelText("Start Date"), {
      target: { value: "2026-04-10" },
    });
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());
    const validCalls = mocks.fetchAggregatedData.mock.calls.length;
    fireEvent.change(screen.getByLabelText("End Date"), {
      target: { value: "2026-04-01" },
    });
    await waitFor(() => {
      const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
      expect(latest.aggregateStatus).toBe("error");
      expect(latest.aggregateError).toBe(
        "Custom start date must not follow the end date.",
      );
    });
    expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(validCalls);
    expect(screen.getByRole("alert").textContent).toBe(
      "Custom start date must not follow the end date.",
    );
    expect(screen.queryByTestId("line-pair-grid")).toBeNull();
  });

  it("does not let a late rolling lookup overwrite a manual Custom range", async () => {
    const lookup = deferred<ReturnType<typeof rangeResponse>>();
    mocks.getDateRangeForGames.mockReturnValueOnce(lookup.promise);
    mocks.fetchAggregatedData.mockResolvedValue(aggregateResponse(97));

    render(<DRMPage />);
    await waitForSeasonInitialization();
    fireEvent.click(screen.getByRole("button", { name: "Select EDM" }));
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "L7" }));
    await waitFor(() => expect(mocks.getDateRangeForGames).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Start Date"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("End Date"), {
      target: { value: "2026-02-10" },
    });
    await waitFor(() =>
      expect(mocks.fetchAggregatedData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          startDate: "2026-02-01",
          endDate: "2026-02-10",
          gameIds: undefined,
        }),
      ),
    );

    await act(async () => {
      lookup.resolve(rangeResponse("2026-03-01", "2026-04-01", 7));
      await lookup.promise;
    });
    const latest = mocks.useDateRangeMatrixData.mock.calls.at(-1)?.[0];
    expect(latest.startDate).toBe("2026-02-01");
    expect(latest.endDate).toBe("2026-02-10");
  });
});
