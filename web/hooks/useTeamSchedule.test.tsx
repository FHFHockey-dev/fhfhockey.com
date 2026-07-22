import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, useCurrentSeasonQueryMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  useCurrentSeasonQueryMock: vi.fn(),
}));

vi.mock("lib/supabase", () => ({
  default: { from: fromMock },
}));

vi.mock("hooks/useCurrentSeason", () => ({
  useCurrentSeasonQuery: useCurrentSeasonQueryMock,
}));

import { useTeamSchedule } from "./useTeamSchedule";

type QueryResult = {
  data: any;
  error: Error | null;
};

type SeasonQueryState = {
  data: { seasonId?: number } | null | undefined;
  error: Error | null;
  isError: boolean;
  isPending: boolean;
  status: "pending" | "success" | "error";
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function createThenableQuery(result: QueryResult | Promise<QueryResult>) {
  const resultPromise = Promise.resolve(result);
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.lte = vi.fn(() => query);
  query.or = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => resultPromise.then(resolve, reject);
  return query;
}

function installTableResults(
  results: Record<string, Array<QueryResult | Promise<QueryResult>>>,
) {
  const queries = Object.fromEntries(
    Object.entries(results).map(([table, tableResults]) => [
      table,
      tableResults.map(createThenableQuery),
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

function pendingSeasonQuery(): SeasonQueryState {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: true,
    status: "pending",
  };
}

function successfulSeasonQuery(
  data: SeasonQueryState["data"],
): SeasonQueryState {
  return {
    data,
    error: null,
    isError: false,
    isPending: false,
    status: "success",
  };
}

function failedSeasonQuery(error: Error): SeasonQueryState {
  return {
    data: undefined,
    error,
    isError: true,
    isPending: false,
    status: "error",
  };
}

function gameFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 2024020001,
    seasonId: 20242025,
    type: 2,
    date: "2025-01-15",
    startTime: "2025-01-16T00:00:00Z",
    homeTeamId: 22,
    awayTeamId: 6,
    ...overrides,
  };
}

function standingsFixture(overrides: Record<string, unknown> = {}) {
  return {
    season_id: 20242025,
    date: "2025-01-15",
    team_abbrev: "EDM",
    home_wins: 15,
    home_losses: 6,
    home_ot_losses: 1,
    home_games_played: 22,
    road_wins: 13,
    road_losses: 7,
    road_ot_losses: 2,
    road_games_played: 22,
    wins: 28,
    losses: 13,
    ot_losses: 3,
    points: 59,
    regulation_wins: 22,
    regulation_plus_ot_wins: 25,
    shootout_wins: 3,
    games_played: 44,
    goal_differential: 20,
    goal_for: 150,
    goal_against: 130,
    streak_code: "W",
    streak_count: 2,
    l10_wins: 7,
    l10_losses: 2,
    l10_ot_losses: 1,
    l10_games_played: 10,
    l10_points: 15,
    l10_goal_differential: 8,
    home_goals_for: 80,
    home_goals_against: 60,
    road_goals_for: 70,
    road_goals_against: 70,
    league_sequence: 6,
    ...overrides,
  };
}

const emptyResult: QueryResult = { data: [], error: null };

describe("useTeamSchedule", () => {
  beforeEach(() => {
    fromMock.mockReset();
    useCurrentSeasonQueryMock.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([undefined, ""])(
    "waits without querying while the omitted season (%s) is pending",
    (seasonId) => {
      useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());

      const { result } = renderHook(() =>
        useTeamSchedule("EDM", seasonId, "22"),
      );

      expect(result.current).toEqual({
        games: [],
        loading: true,
        error: null,
        record: null,
        scheduleTeam: null,
      });
      expect(fromMock).not.toHaveBeenCalled();
    },
  );

  it("terminates without querying when current-season lookup succeeds empty", () => {
    useCurrentSeasonQueryMock.mockReturnValue(successfulSeasonQuery(null));

    const { result } = renderHook(() =>
      useTeamSchedule("EDM", undefined, "22"),
    );

    expect(result.current).toEqual({
      games: [],
      loading: false,
      error: "A valid NHL season is required.",
      record: null,
      scheduleTeam: null,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("terminates with stable copy when current-season lookup fails", () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      failedSeasonQuery(new Error("provider detail")),
    );

    const { result } = renderHook(() =>
      useTeamSchedule("EDM", undefined, "22"),
    );

    expect(result.current).toEqual({
      games: [],
      loading: false,
      error: "Unable to determine the current NHL season.",
      record: null,
      scheduleTeam: null,
    });
    expect(result.current.error).not.toContain("provider detail");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("makes invalid team identity terminal even while season lookup is pending", () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());

    const { result } = renderHook(() =>
      useTeamSchedule("", undefined, undefined),
    );

    expect(result.current).toEqual({
      games: [],
      loading: false,
      error: "A valid team selection is required.",
      record: null,
      scheduleTeam: null,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each([
    ["pending", pendingSeasonQuery()],
    ["failed", failedSeasonQuery(new Error("season lookup failed"))],
  ])(
    "lets an explicit historical season bypass a %s current-season query",
    async (_label, seasonQuery) => {
      useCurrentSeasonQueryMock.mockReturnValue(seasonQuery);
      const queries = installTableResults({
        games: [emptyResult],
        nhl_standings_details: [emptyResult],
      });

      const { result } = renderHook(() =>
        useTeamSchedule("EDM", "20242025", "22"),
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeNull();
      expect(queries.games[0].eq).toHaveBeenCalledWith("seasonId", 20242025);
      expect(queries.games[0].or).toHaveBeenCalledWith(
        "homeTeamId.eq.22,awayTeamId.eq.22",
      );
      expect(queries.nhl_standings_details[0].eq).toHaveBeenNthCalledWith(
        1,
        "season_id",
        20242025,
      );
      expect(queries.nhl_standings_details[0].eq).toHaveBeenNthCalledWith(
        2,
        "team_abbrev",
        "EDM",
      );
    },
  );

  it("uses the numeric seasonId from the current-season object", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      successfulSeasonQuery({ seasonId: 20252026 }),
    );
    const queries = installTableResults({
      games: [emptyResult],
      nhl_standings_details: [emptyResult],
    });

    const { result } = renderHook(() => useTeamSchedule("EDM", "", "22"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(queries.games[0].eq).toHaveBeenCalledWith("seasonId", 20252026);
    expect(queries.nhl_standings_details[0].eq).toHaveBeenCalledWith(
      "season_id",
      20252026,
    );
    expect(
      queries.games[0].eq.mock.calls
        .flat()
        .some((value: unknown) => Number.isNaN(value)),
    ).toBe(false);
  });

  it("keeps a valid cached season when a background refetch reports an error", async () => {
    useCurrentSeasonQueryMock.mockReturnValue({
      data: { seasonId: 20252026 },
      error: new Error("background refetch failed"),
      isError: true,
      isPending: false,
      status: "error",
    } satisfies SeasonQueryState);
    const queries = installTableResults({
      games: [emptyResult],
      nhl_standings_details: [emptyResult],
    });

    const { result } = renderHook(() =>
      useTeamSchedule("EDM", undefined, "22"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(queries.games[0].eq).toHaveBeenCalledWith("seasonId", 20252026);
    expect(queries.nhl_standings_details[0].eq).toHaveBeenCalledWith(
      "season_id",
      20252026,
    );
  });

  it("rejects a malformed current-season payload without querying", () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      successfulSeasonQuery({ seasonId: 20252027 }),
    );

    const { result } = renderHook(() =>
      useTeamSchedule("EDM", undefined, "22"),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("A valid NHL season is required.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing team id", "EDM", "20242025", undefined],
    ["partial team id", "EDM", "20242025", "22x"],
    ["zero team id", "EDM", "20242025", "0"],
    ["leading-zero team id", "EDM", "20242025", "022"],
    ["unsafe team id", "EDM", "20242025", "9007199254740992"],
    ["lowercase abbreviation", "edm", "20242025", "22"],
    ["unknown abbreviation", "XYZ", "20242025", "22"],
    ["inherited abbreviation", "toString", "20242025", "22"],
    ["mismatched pair", "EDM", "20242025", "6"],
    ["legacy UTA id 53", "UTA", "20242025", "53"],
    ["legacy UTA id 53", "UTA", "20232024", "53"],
    ["legacy UTA id 59", "UTA", "20242025", "59"],
    ["historical ARI pair", "ARI", "20232024", "53"],
    ["wrong-season UTA id 59", "UTA", "20252026", "59"],
    ["wrong-season ARI id 53", "ARI", "20242025", "53"],
    ["unsupported pre-2023 UTA lineage", "UTA", "20222023", "68"],
    ["partial season", "EDM", "2024", "22"],
    ["leading-zero season", "EDM", "020242025", "22"],
    ["nonnumeric season", "EDM", "abcdefgh", "22"],
    ["nonconsecutive season", "EDM", "20242026", "22"],
  ])(
    "rejects %s before any Supabase query",
    (_label, teamAbbr, seasonId, teamId) => {
      useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());

      const { result } = renderHook(() =>
        useTeamSchedule(teamAbbr, seasonId, teamId),
      );

      expect(result.current.games).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).not.toBeNull();
      expect(result.current.record).toBeNull();
      expect(fromMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      label: "current UTA alias over 2023-24 Arizona",
      teamAbbr: "UTA",
      seasonId: "20232024",
      teamId: "68",
      sourceTeamId: 53,
      standingsAbbr: "ARI",
      sourceAbbr: "ARI",
      sourceName: "Arizona Coyotes",
    },
    {
      label: "current UTA alias over 2024-25 Utah Hockey Club",
      teamAbbr: "UTA",
      seasonId: "20242025",
      teamId: "68",
      sourceTeamId: 59,
      standingsAbbr: "UTA",
      sourceAbbr: "UTA",
      sourceName: "Utah Hockey Club",
    },
    {
      label: "current 2025-26 Utah Mammoth identity",
      teamAbbr: "UTA",
      seasonId: "20252026",
      teamId: "68",
      sourceTeamId: 68,
      standingsAbbr: "UTA",
      sourceAbbr: "UTA",
      sourceName: "Utah Mammoth",
    },
  ])(
    "resolves $label without weakening the requested pair",
    async ({
      teamAbbr,
      seasonId,
      teamId,
      sourceTeamId,
      standingsAbbr,
      sourceAbbr,
      sourceName,
    }) => {
      useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
      const numericSeasonId = Number(seasonId);
      const gameId = numericSeasonId * 10000 + 1;
      const queries = installTableResults({
        games: [
          {
            data: [
              gameFixture({
                id: gameId,
                seasonId: numericSeasonId,
                homeTeamId: sourceTeamId,
              }),
            ],
            error: null,
          },
        ],
        teamGameStats: [
          {
            data: [
              { gameId, teamId: sourceTeamId, score: 4 },
              { gameId, teamId: 6, score: 2 },
            ],
            error: null,
          },
        ],
        nhl_standings_details: [emptyResult],
      });

      const { result } = renderHook(() =>
        useTeamSchedule(teamAbbr, seasonId, teamId),
      );

      expect(result.current.scheduleTeam).toEqual({
        id: sourceTeamId,
        abbreviation: sourceAbbr,
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(queries.games[0].or).toHaveBeenCalledWith(
        `homeTeamId.eq.${sourceTeamId},awayTeamId.eq.${sourceTeamId}`,
      );
      expect(queries.nhl_standings_details[0].eq).toHaveBeenNthCalledWith(
        2,
        "team_abbrev",
        standingsAbbr,
      );
      expect(result.current.games[0].homeTeam).toMatchObject({
        id: sourceTeamId,
        abbrev: sourceAbbr,
        placeName: { default: sourceName },
      });
      expect(result.current.scheduleTeam).toEqual({
        id: sourceTeamId,
        abbreviation: sourceAbbr,
      });
      expect(result.current.games[0].homeTeamScore).toBe(4);
      expect(result.current.games[0].awayTeamScore).toBe(2);
      expect(result.current.games[0].gameState).toBe("FINAL");
    },
  );

  it("labels a relocated historical opponent with its season identity", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    installTableResults({
      games: [
        {
          data: [
            gameFixture({
              seasonId: 20232024,
              homeTeamId: 22,
              awayTeamId: 53,
            }),
          ],
          error: null,
        },
      ],
      teamGameStats: [emptyResult],
      nhl_standings_details: [emptyResult],
    });

    const { result } = renderHook(() =>
      useTeamSchedule("EDM", "20232024", "22"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.games[0].awayTeam).toMatchObject({
      id: 53,
      abbrev: "ARI",
      placeName: { default: "Arizona Coyotes" },
    });
  });

  it("does not refetch an explicit season when current-season status settles", async () => {
    let seasonQuery: SeasonQueryState = pendingSeasonQuery();
    useCurrentSeasonQueryMock.mockImplementation(() => seasonQuery);
    installTableResults({
      games: [emptyResult],
      nhl_standings_details: [emptyResult],
    });

    const { result, rerender } = renderHook(() =>
      useTeamSchedule("EDM", "20242025", "22"),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fromMock).toHaveBeenCalledTimes(2);

    seasonQuery = successfulSeasonQuery({ seasonId: 20252026 });
    rerender();

    expect(result.current.loading).toBe(false);
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("uses the latest bounded standings snapshot on or before the requested date", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const queries = installTableResults({
      games: [emptyResult],
      nhl_standings_details: [
        {
          data: [standingsFixture()],
          error: null,
        },
      ],
    });

    const { result } = renderHook(() =>
      useTeamSchedule("EDM", "20242025", "22", "2025-01-15"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const standingsQuery = queries.nhl_standings_details[0];
    expect(standingsQuery.select).toHaveBeenCalledWith(
      "season_id,date,team_abbrev,home_wins,home_losses,home_ot_losses,home_games_played,road_wins,road_losses,road_ot_losses,road_games_played,wins,losses,ot_losses,points,games_played,goal_differential,goal_for,goal_against,streak_code,streak_count,l10_wins,l10_losses,l10_ot_losses,l10_games_played,l10_points,l10_goal_differential,home_goals_for,home_goals_against,road_goals_for,road_goals_against,league_sequence,regulation_wins,regulation_plus_ot_wins,shootout_wins",
    );
    expect(standingsQuery.eq).toHaveBeenNthCalledWith(1, "season_id", 20242025);
    expect(standingsQuery.eq).toHaveBeenNthCalledWith(2, "team_abbrev", "EDM");
    expect(standingsQuery.lte).toHaveBeenCalledOnce();
    expect(standingsQuery.lte).toHaveBeenCalledWith("date", "2025-01-15");
    expect(standingsQuery.order).toHaveBeenCalledWith("date", {
      ascending: false,
    });
    expect(standingsQuery.limit).toHaveBeenCalledWith(1);
    expect(result.current.record).toEqual({
      wins: 28,
      losses: 13,
      otLosses: 3,
      points: 59,
      regulationWins: 22,
      overtimeWins: 3,
      shootoutWins: 3,
    });
    expect(result.current.standingsDetails).toMatchObject({
      season_id: 20242025,
      team_abbrev: "EDM",
      home_wins: 15,
      road_wins: 13,
      league_sequence: 6,
    });
  });

  it("refetches the same team for a changed date and rejects the stale record owner", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const olderRecord = createDeferred<QueryResult>();
    const queries = installTableResults({
      games: [emptyResult, emptyResult],
      nhl_standings_details: [
        olderRecord.promise,
        {
          data: [
            standingsFixture({
              date: "2025-02-15",
              wins: 35,
              points: 74,
            }),
          ],
          error: null,
        },
      ],
    });

    const { result, rerender } = renderHook(
      ({ recordDate }) => useTeamSchedule("EDM", "20242025", "22", recordDate),
      { initialProps: { recordDate: "2025-01-15" } },
    );

    await waitFor(() =>
      expect(queries.nhl_standings_details[0].lte).toHaveBeenCalledWith(
        "date",
        "2025-01-15",
      ),
    );

    rerender({ recordDate: "2025-02-15" });

    expect(result.current).toEqual({
      games: [],
      loading: true,
      error: null,
      record: null,
      standingsDetails: null,
      scheduleTeam: { id: 22, abbreviation: "EDM" },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(queries.nhl_standings_details[1].lte).toHaveBeenCalledWith(
      "date",
      "2025-02-15",
    );
    expect(result.current.record?.wins).toBe(35);
    expect(result.current.record?.points).toBe(74);
    expect(result.current.standingsDetails?.date).toBe("2025-02-15");

    act(() =>
      olderRecord.resolve({
        data: [standingsFixture({ wins: 28, points: 59 })],
        error: null,
      }),
    );
    await act(async () => Promise.resolve());

    expect(result.current.record?.wins).toBe(35);
    expect(result.current.record?.points).toBe(74);
    expect(result.current.standingsDetails?.date).toBe("2025-02-15");
  });

  it.each([
    ["before first season snapshot", "20242025", "2024-09-01", 20242025],
    ["unsupported earlier season", "20232024", "2024-03-14", 20232024],
  ])(
    "returns no record for %s",
    async (_label, seasonId, recordDate, numericSeasonId) => {
      useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
      const queries = installTableResults({
        games: [emptyResult],
        nhl_standings_details: [emptyResult],
      });

      const { result } = renderHook(() =>
        useTeamSchedule("EDM", seasonId, "22", recordDate),
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      const standingsQuery = queries.nhl_standings_details[0];
      expect(standingsQuery.eq).toHaveBeenCalledWith(
        "season_id",
        numericSeasonId,
      );
      expect(standingsQuery.lte).toHaveBeenCalledWith("date", recordDate);
      expect(result.current.error).toBeNull();
      expect(result.current.record).toBeNull();
    },
  );

  it.each(["2025-02-29", "2025-04-31", "2025-1-15", "not-a-date", ""])(
    "preserves games but skips standings for invalid explicit record date %j",
    async (recordDate) => {
      useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
      installTableResults({
        games: [{ data: [gameFixture()], error: null }],
        teamGameStats: [emptyResult],
      });

      const { result } = renderHook(() =>
        useTeamSchedule("EDM", "20242025", "22", recordDate),
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.games).toHaveLength(1);
      expect(result.current.error).toBeNull();
      expect(result.current.record).toBeNull();
      expect(
        fromMock.mock.calls.some(
          ([table]) => table === "nhl_standings_details",
        ),
      ).toBe(false);
    },
  );

  it("keeps omitted record dates on the latest-snapshot path", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const queries = installTableResults({
      games: [emptyResult],
      nhl_standings_details: [
        {
          data: [standingsFixture({ date: "2025-04-17" })],
          error: null,
        },
      ],
    });

    const { result } = renderHook(() =>
      useTeamSchedule("EDM", "20242025", "22"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(queries.nhl_standings_details[0].lte).not.toHaveBeenCalled();
    expect(queries.nhl_standings_details[0].order).toHaveBeenCalledWith(
      "date",
      { ascending: false },
    );
    expect(queries.nhl_standings_details[0].limit).toHaveBeenCalledWith(1);
    expect(result.current.record?.points).toBe(59);
  });

  it("immediately masks a rich prior request and replaces it with empty data", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const nextGames = createDeferred<QueryResult>();
    const nextRecord = createDeferred<QueryResult>();
    installTableResults({
      games: [{ data: [gameFixture()], error: null }, nextGames.promise],
      teamGameStats: [
        {
          data: [
            { gameId: 2024020001, teamId: 22, score: 4 },
            { gameId: 2024020001, teamId: 6, score: 2 },
          ],
          error: null,
        },
      ],
      nhl_standings_details: [
        {
          data: [
            {
              wins: 30,
              losses: 15,
              ot_losses: 5,
              points: 65,
              regulation_wins: 25,
              regulation_plus_ot_wins: 28,
              shootout_wins: 2,
            },
          ],
          error: null,
        },
        nextRecord.promise,
      ],
    });

    const { result, rerender } = renderHook(
      ({ teamAbbr, teamId }) => useTeamSchedule(teamAbbr, "20242025", teamId),
      { initialProps: { teamAbbr: "EDM", teamId: "22" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.games).toHaveLength(1);
    expect(result.current.record?.points).toBe(65);

    rerender({ teamAbbr: "BOS", teamId: "6" });

    expect(result.current).toEqual({
      games: [],
      loading: true,
      error: null,
      record: null,
      standingsDetails: null,
      scheduleTeam: { id: 6, abbreviation: "BOS" },
    });

    act(() => nextGames.resolve(emptyResult));
    await waitFor(() =>
      expect(
        fromMock.mock.calls.filter(
          ([table]) => table === "nhl_standings_details",
        ),
      ).toHaveLength(2),
    );
    act(() => nextRecord.resolve(emptyResult));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({
      games: [],
      loading: false,
      error: null,
      record: null,
      standingsDetails: null,
      scheduleTeam: { id: 6, abbreviation: "BOS" },
    });
  });

  it("prevents an older request from continuing or overwriting a newer error", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const olderGames = createDeferred<QueryResult>();
    installTableResults({
      games: [
        olderGames.promise,
        { data: null, error: new Error("new request failed") },
      ],
    });

    const { result, rerender } = renderHook(
      ({ teamAbbr, teamId }) => useTeamSchedule(teamAbbr, "20242025", teamId),
      { initialProps: { teamAbbr: "EDM", teamId: "22" } },
    );

    rerender({ teamAbbr: "BOS", teamId: "6" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("new request failed");

    act(() => olderGames.resolve({ data: [gameFixture()], error: null }));
    await act(async () => Promise.resolve());

    expect(result.current.error).toBe("new request failed");
    expect(result.current.games).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(
      fromMock.mock.calls.some(([table]) => table === "teamGameStats"),
    ).toBe(false);
    expect(
      fromMock.mock.calls.some(([table]) => table === "nhl_standings_details"),
    ).toBe(false);
  });

  it("does not log or finalize a rejected request after unmount", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const games = createDeferred<QueryResult>();
    installTableResults({ games: [games.promise] });
    const errorSpy = vi.mocked(console.error);

    const { unmount } = renderHook(() =>
      useTeamSchedule("EDM", "20242025", "22"),
    );
    unmount();

    await act(async () => {
      games.reject(new Error("late rejection"));
      await games.promise.catch(() => undefined);
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("stops after a stale middle score query instead of starting record work", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const scores = createDeferred<QueryResult>();
    installTableResults({
      games: [{ data: [gameFixture()], error: null }],
      teamGameStats: [scores.promise],
    });

    const { result, rerender } = renderHook(
      ({ teamId }) => useTeamSchedule("EDM", "20242025", teamId),
      { initialProps: { teamId: "22" as string | undefined } },
    );
    await waitFor(() =>
      expect(
        fromMock.mock.calls.some(([table]) => table === "teamGameStats"),
      ).toBe(true),
    );

    rerender({ teamId: undefined });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("A valid team selection is required.");

    act(() => scores.resolve(emptyResult));
    await act(async () => Promise.resolve());

    expect(
      fromMock.mock.calls.some(([table]) => table === "nhl_standings_details"),
    ).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.games).toEqual([]);
  });

  it("retains games but no record when optional enrichment queries fail", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const scoreError = new Error("score lookup failed");
    const recordError = new Error("record lookup failed");
    installTableResults({
      games: [{ data: [gameFixture()], error: null }],
      teamGameStats: [{ data: null, error: scoreError }],
      nhl_standings_details: [{ data: null, error: recordError }],
    });

    const { result } = renderHook(() =>
      useTeamSchedule("EDM", "20242025", "22"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.games).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.record).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});
