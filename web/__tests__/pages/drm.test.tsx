import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DRMPage, { parseDRMDate, toDateKey } from "pages/drm";

const mocks = vi.hoisted(() => ({
  fetchAggregatedData: vi.fn(),
  fetchCurrentSeason: vi.fn(),
  getDateRangeForGames: vi.fn(),
  linePairGridProps: vi.fn(),
  useDateRangeMatrixData: vi.fn(),
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
  default: ({ onSelect }: { onSelect: (team: string) => void }) => (
    <div data-testid="team-dropdown">
      <button onClick={() => onSelect("TOR")}>Choose TOR</button>
    </div>
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

vi.mock("components/Select", () => ({
  default: () => null,
}));

vi.mock("components/DateRangeMatrix/lineCombinationHelper", () => ({
  calculateLinesAndPairs: () => ({ lines: [], pairs: [] }),
}));

vi.mock("react-datepicker", () => ({
  default: ({
    selected,
    onChange,
    selectsStart,
  }: {
    selected?: Date;
    onChange: (date: Date | null) => void;
    selectsStart?: boolean;
  }) => (
    <input
      aria-label={selectsStart ? "Start Date picker" : "End Date picker"}
      type="date"
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
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("next-usequerystate", () => ({
  queryTypes: {
    string: {
      withDefault: () => ({}),
    },
  },
  useQueryState: (key: string) => [
    key === "daterange-matrix-mode" ? "line-combination" : null,
    vi.fn(),
  ],
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchCurrentSeason.mockResolvedValue({
    id: 20252026,
    startDate: "2025-10-01T00:00:00.000Z",
    regularSeasonEndDate: "2026-04-15T00:00:00.000Z",
    endDate: "2026-06-24T00:00:00.000Z",
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

    fireEvent.click(screen.getByRole("tab", { name: "L7" }));
    await waitFor(() =>
      expect(mocks.getDateRangeForGames).toHaveBeenCalledTimes(1),
    );
    expect(mocks.fetchAggregatedData).toHaveBeenCalledTimes(
      initialAggregateCalls,
    );
    fireEvent.click(screen.getByRole("tab", { name: "L14" }));
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
    fireEvent.click(screen.getByRole("tab", { name: "L7" }));
    fireEvent.click(screen.getByRole("tab", { name: "L7" }));
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

    fireEvent.click(screen.getByRole("tab", { name: "L7" }));
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

    fireEvent.click(screen.getByRole("tab", { name: "L7" }));
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

    fireEvent.click(screen.getByRole("tab", { name: "L7" }));
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
    fireEvent.click(
      within(opponentDropdown).getByRole("button", { name: "Choose TOR" }),
    );
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
    fireEvent.click(screen.getByRole("tab", { name: "L7" }));
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

    fireEvent.change(screen.getByLabelText("Start Date picker"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("End Date picker"), {
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
      screen.getByRole("tab", { name: "Custom" }).getAttribute("aria-selected"),
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
    fireEvent.click(
      within(opponentDropdown).getByRole("button", { name: "Choose TOR" }),
    );
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
    fireEvent.change(screen.getByLabelText("Start Date picker"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("End Date picker"), {
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
      screen.getByRole("tab", { name: "Season" }).getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "L7" }));
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
    fireEvent.change(screen.getByLabelText("Start Date picker"), {
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

    fireEvent.change(screen.getByLabelText("Start Date picker"), {
      target: { value: "2026-04-10" },
    });
    await waitFor(() => expect(mocks.fetchAggregatedData).toHaveBeenCalled());
    const validCalls = mocks.fetchAggregatedData.mock.calls.length;
    fireEvent.change(screen.getByLabelText("End Date picker"), {
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
    fireEvent.click(screen.getByRole("tab", { name: "L7" }));
    await waitFor(() => expect(mocks.getDateRangeForGames).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Start Date picker"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(screen.getByLabelText("End Date picker"), {
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
