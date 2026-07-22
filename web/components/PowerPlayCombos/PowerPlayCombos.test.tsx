import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, useCurrentSeasonQueryMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  useCurrentSeasonQueryMock: vi.fn(),
}));

vi.mock("lib/supabase/client", () => ({
  default: { from: fromMock },
}));

vi.mock("hooks/useCurrentSeason", () => ({
  useCurrentSeasonQuery: useCurrentSeasonQueryMock,
}));

import PowerPlayCombos from "./PowerPlayCombos";

type QueryResult = {
  data: unknown;
  error: Error | null;
};

type SeasonQueryState = {
  data: { seasonId: number } | null | undefined;
  isError: boolean;
  isPending: boolean;
};

function pendingSeasonQuery(): SeasonQueryState {
  return { data: undefined, isError: false, isPending: true };
}

function successfulSeasonQuery(
  data: SeasonQueryState["data"],
): SeasonQueryState {
  return { data, isError: false, isPending: false };
}

function failedSeasonQuery(): SeasonQueryState {
  return { data: undefined, isError: true, isPending: false };
}

function createQuery(result: QueryResult) {
  const resultPromise = Promise.resolve(result);
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.or = vi.fn(() => query);
  query.neq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.lt = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.single = vi.fn(() => resultPromise);
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => resultPromise.then(resolve, reject);
  return query;
}

function installTableResults(results: Record<string, QueryResult[]>) {
  const queries = Object.fromEntries(
    Object.entries(results).map(([table, tableResults]) => [
      table,
      tableResults.map(createQuery),
    ]),
  ) as Record<string, any[]>;
  const remaining = Object.fromEntries(
    Object.entries(queries).map(([table, tableQueries]) => [
      table,
      [...tableQueries],
    ]),
  ) as Record<string, any[]>;

  fromMock.mockImplementation((table: string) => {
    const query = remaining[table]?.shift();
    if (!query) throw new Error(`Missing query result for ${table}`);
    return query;
  });

  return queries;
}

describe("PowerPlayCombos season and source ownership", () => {
  beforeEach(() => {
    fromMock.mockReset();
    useCurrentSeasonQueryMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps loading without querying while current-season resolution is pending", () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());

    render(<PowerPlayCombos teamId={22} gameId={2025020001} />);

    expect(screen.getByText("Loading power play data...")).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("terminates successful empty season resolution without querying", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(successfulSeasonQuery(null));

    render(<PowerPlayCombos teamId={22} gameId={2025020001} />);

    expect(
      await screen.findByText("Power play data requires a season."),
    ).toBeTruthy();
    expect(screen.queryByText("Loading power play data...")).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("contains terminal season failure behind stable copy without querying", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(failedSeasonQuery());

    render(<PowerPlayCombos teamId={22} gameId={2025020001} />);

    expect(
      await screen.findByText("Unable to determine the current NHL season."),
    ).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("uses the resolved season for exact game and roster scope", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      successfulSeasonQuery({ seasonId: 20252026 }),
    );
    const queries = installTableResults({
      games: [
        {
          data: {
            id: 2025020001,
            startTime: "2025-10-08T00:00:00Z",
            seasonId: 20252026,
            homeTeamId: 22,
            awayTeamId: 10,
          },
          error: null,
        },
      ],
      rosters: [{ data: [], error: null }],
    });

    render(<PowerPlayCombos teamId={22} gameId={2025020001} />);

    expect(
      await screen.findByText("No power play units recorded for this game."),
    ).toBeTruthy();
    expect(queries.games[0].eq).toHaveBeenCalledWith("id", 2025020001);
    expect(queries.rosters[0].eq).toHaveBeenCalledWith("teamId", 22);
    expect(queries.rosters[0].eq).toHaveBeenCalledWith("seasonId", 20252026);
  });

  it("lets explicit historical source context bypass current-season failure", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(failedSeasonQuery());
    const queries = installTableResults({
      games: [
        {
          data: {
            id: 2024020001,
            startTime: "2024-10-08T00:00:00Z",
            seasonId: 20242025,
            homeTeamId: 59,
            awayTeamId: 10,
          },
          error: null,
        },
      ],
      rosters: [{ data: [], error: null }],
    });

    render(
      <PowerPlayCombos
        teamId={59}
        gameId={2024020001}
        seasonId={20242025}
        teamAbbreviation="UHC"
      />,
    );

    expect(
      await screen.findByText("No power play units recorded for this game."),
    ).toBeTruthy();
    expect(queries.rosters[0].eq).toHaveBeenCalledWith("teamId", 59);
    expect(queries.rosters[0].eq).toHaveBeenCalledWith("seasonId", 20242025);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps prior-game history inside the source team and season", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(failedSeasonQuery());
    const queries = installTableResults({
      games: [
        {
          data: {
            id: 2024020001,
            startTime: "2024-10-08T00:00:00Z",
            seasonId: 20242025,
            homeTeamId: 59,
            awayTeamId: 10,
          },
          error: null,
        },
        { data: [], error: null },
      ],
      rosters: [{ data: [{ playerId: 1, sweaterNumber: 9 }], error: null }],
      powerPlayCombinations: [{ data: [], error: null }],
    });

    render(
      <PowerPlayCombos teamId={59} gameId={2024020001} seasonId={20242025} />,
    );

    expect(
      await screen.findByText("No power play units recorded for this game."),
    ).toBeTruthy();
    expect(queries.games[1].or).toHaveBeenCalledWith(
      "homeTeamId.eq.59,awayTeamId.eq.59",
    );
    expect(queries.games[1].eq).toHaveBeenCalledWith("seasonId", 20242025);
  });

  it("fails closed before roster lookup when game context mismatches", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    installTableResults({
      games: [
        {
          data: {
            id: 2024020001,
            startTime: "2024-10-08T00:00:00Z",
            seasonId: 20242025,
            homeTeamId: 68,
            awayTeamId: 10,
          },
          error: null,
        },
      ],
    });

    render(
      <PowerPlayCombos teamId={59} gameId={2024020001} seasonId={20242025} />,
    );

    expect(
      await screen.findByText("Unable to load power play data right now."),
    ).toBeTruthy();
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
